import { useRef, useCallback } from 'react';

/**
 * Parsed property from an OSLC ResourceShape.
 */
export interface ShapePropertyInfo {
  /** Short name from oslc:name */
  name: string;
  /** Full predicate URI from oslc:propertyDefinition */
  predicateURI: string;
  /** Value type URI (e.g., oslc:Resource, xsd:string) */
  valueType: string;
  /** Inverse property URI from oslc:inversePropertyDefinition.
   *  Identifier only — never asserted as a triple. */
  inversePropertyDefinition?: string;
  /** Human-readable inverse label from oslc:inverseLabel. */
  inverseLabel?: string;
}

/**
 * Parsed OSLC ResourceShape.
 */
export interface ParsedShape {
  shapeURI: string;
  properties: ShapePropertyInfo[];
  /** Quick lookup: predicate URI → valueType */
  predicateValueTypes: Map<string, string>;
  /** Quick lookup: predicate URI → oslc:inverseLabel (if declared) */
  predicateInverseLabels: Map<string, string>;
}

const OSLC_NS = 'http://open-services.net/ns/core#';

/**
 * Returns true if the valueType indicates a navigable resource link.
 */
export function isLinkValueType(valueType: string): boolean {
  return (
    valueType === `${OSLC_NS}Resource` ||
    valueType === `${OSLC_NS}AnyResource`
  );
}

/**
 * Hook providing a cache for parsed OSLC resource shapes.
 * Shapes are fetched once and cached for the lifetime of the component.
 */
export function useShapeCache() {
  const cache = useRef<Map<string, ParsedShape | null>>(new Map());
  const pending = useRef<Map<string, Promise<ParsedShape | null>>>(new Map());

  const getShape = useCallback(
    async (
      shapeURI: string,
      fetchFn: (uri: string) => Promise<any>
    ): Promise<ParsedShape | null> => {
      // Return cached result
      if (cache.current.has(shapeURI)) {
        return cache.current.get(shapeURI)!;
      }

      // Return pending fetch if already in flight
      if (pending.current.has(shapeURI)) {
        return pending.current.get(shapeURI)!;
      }

      // Fetch and parse
      const promise = (async () => {
        try {
          const resource = await fetchFn(shapeURI);
          if (!resource || !resource.store) {
            cache.current.set(shapeURI, null);
            return null;
          }

          const store = resource.store;
          const shapeSym = store.sym(shapeURI);

          // Find all oslc:property nodes
          const propNodes = store.each(
            shapeSym,
            store.sym(`${OSLC_NS}property`),
            null
          );

          const properties: ShapePropertyInfo[] = [];
          const predicateValueTypes = new Map<string, string>();
          const predicateInverseLabels = new Map<string, string>();

          for (const propNode of propNodes) {
            const propDefNode = store.any(
              propNode,
              store.sym(`${OSLC_NS}propertyDefinition`),
              null
            );
            const valueTypeNode = store.any(
              propNode,
              store.sym(`${OSLC_NS}valueType`),
              null
            );
            const nameNode = store.anyValue(
              propNode,
              store.sym(`${OSLC_NS}name`)
            );
            const inversePropDefNode = store.any(
              propNode,
              store.sym(`${OSLC_NS}inversePropertyDefinition`),
              null
            );
            const inverseLabel = store.anyValue(
              propNode,
              store.sym(`${OSLC_NS}inverseLabel`)
            );

            const predicateURI = propDefNode?.value ?? '';
            const valueType = valueTypeNode?.value ?? '';
            const name = nameNode ?? '';
            const inversePropertyDefinition = inversePropDefNode?.value;

            if (predicateURI) {
              const prop: ShapePropertyInfo = { name, predicateURI, valueType };
              if (inversePropertyDefinition) prop.inversePropertyDefinition = inversePropertyDefinition;
              if (inverseLabel) prop.inverseLabel = inverseLabel;
              properties.push(prop);
              predicateValueTypes.set(predicateURI, valueType);
              if (inverseLabel) predicateInverseLabels.set(predicateURI, inverseLabel);
            }
          }

          const parsed: ParsedShape = {
            shapeURI,
            properties,
            predicateValueTypes,
            predicateInverseLabels,
          };
          cache.current.set(shapeURI, parsed);
          return parsed;
        } catch (err) {
          console.error(`[shape-cache] Failed to fetch shape ${shapeURI}:`, err);
          cache.current.set(shapeURI, null);
          return null;
        }
      })();

      pending.current.set(shapeURI, promise);
      const result = await promise;
      pending.current.delete(shapeURI);
      return result;
    },
    []
  );

  /**
   * Look up the inverse label for a forward predicate URI by searching
   * all cached shapes. Returns undefined when no cached shape declares
   * an inverseLabel for the predicate.
   *
   * This is used to render incoming links on the target side using the
   * inverse wording declared on the source property — e.g., an incoming
   * `bmm:amplifies` link appears as "Amplified By" when the VisionShape's
   * `amplifiedBy` property declared that inverseLabel.
   */
  const getInverseLabel = useCallback(
    (predicateURI: string): string | undefined => {
      for (const shape of cache.current.values()) {
        if (!shape) continue;
        const label = shape.predicateInverseLabels.get(predicateURI);
        if (label) return label;
      }
      return undefined;
    },
    []
  );

  return { getShape, getInverseLabel };
}
