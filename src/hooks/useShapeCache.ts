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
}

/**
 * Parsed OSLC ResourceShape.
 */
export interface ParsedShape {
  shapeURI: string;
  properties: ShapePropertyInfo[];
  /** Quick lookup: predicate URI → valueType */
  predicateValueTypes: Map<string, string>;
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

            const predicateURI = propDefNode?.value ?? '';
            const valueType = valueTypeNode?.value ?? '';
            const name = nameNode ?? '';

            if (predicateURI) {
              properties.push({ name, predicateURI, valueType });
              predicateValueTypes.set(predicateURI, valueType);
            }
          }

          const parsed: ParsedShape = {
            shapeURI,
            properties,
            predicateValueTypes,
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

  return { getShape };
}
