import { useMemo } from 'react';
import { type OSLCResource } from 'oslc-client';
import {
  DD_NS,
  isDDProperty,
  isDiagramType,
  localName,
  type DiagramBounds,
  type DiagramElementData,
  type DiagramPoint,
  type DiagramStyle,
  type ParsedDiagram,
} from '../models/diagram-types.js';

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

/**
 * Get a single DD property value from an OSLCResource by local name.
 * Uses the generic get() which queries the rdflib store.
 */
function ddGet(resource: OSLCResource, ddLocalName: string): string | undefined {
  const val = resource.get(DD_NS + ddLocalName);
  if (val === undefined) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

/**
 * Get the rdf:type values of a blank node from the store.
 */
function getTypes(resource: OSLCResource): string[] {
  const types = resource.get(RDF_TYPE);
  if (types === undefined) return [];
  if (Array.isArray(types)) return types;
  return [types];
}

/**
 * Get a linked blank node as a new OSLCResource wrapping the same store.
 * The blank node URI is retrieved via a DD property local name.
 */
function ddGetLinkedResource(
  resource: OSLCResource,
  store: any,
  ddLocalName: string
): OSLCResource | undefined {
  const val = resource.get(DD_NS + ddLocalName);
  if (!val) return undefined;
  const uri = Array.isArray(val) ? val[0] : val;
  // Dynamic import to avoid circular dependency — OSLCResource constructor
  // is available from oslc-client
  const { OSLCResource: OSLCResourceClass } = require('oslc-client');
  return new OSLCResourceClass(uri, store);
}

/**
 * Get all linked blank nodes for a multi-valued DD property.
 */
function ddGetLinkedResources(
  resource: OSLCResource,
  store: any,
  ddLocalName: string
): OSLCResource[] {
  const val = resource.get(DD_NS + ddLocalName);
  if (!val) return [];
  const uris = Array.isArray(val) ? val : [val];
  const { OSLCResource: OSLCResourceClass } = require('oslc-client');
  return uris.map((uri: string) => new OSLCResourceClass(uri, store));
}

/**
 * Parse all DD-namespaced properties on a resource into a
 * generic key/value map. Uses getProperties() to enumerate
 * all predicates, filters to DD namespace.
 */
function parseStyle(resource: OSLCResource): DiagramStyle {
  const style: DiagramStyle = {};
  const allProps = resource.getProperties();
  for (const [predicate, value] of Object.entries(allProps)) {
    if (isDDProperty(predicate)) {
      style[localName(predicate)] = Array.isArray(value) ? value[0] : value;
    }
  }
  return style;
}

function parseBounds(resource: OSLCResource): DiagramBounds {
  const get = (name: string) => {
    const val = ddGet(resource, name);
    return val !== undefined ? parseFloat(val) : 0;
  };
  return {
    x: get('x'),
    y: get('y'),
    width: get('width') || 100,
    height: get('height') || 60,
  };
}

function parseElement(
  elementRes: OSLCResource,
  store: any
): DiagramElementData | null {
  const types = getTypes(elementRes);
  const modelElementURI = ddGet(elementRes, 'modelElement');

  // Parse style from localStyle blank node
  let style: DiagramStyle = {};
  const localStyleRes = ddGetLinkedResource(elementRes, store, 'localStyle');
  if (localStyleRes) {
    style = parseStyle(localStyleRes);
  }

  const isShape = types.some(t => t === DD_NS + 'Shape');
  const isEdge = types.some(t => t === DD_NS + 'Edge');

  if (isShape) {
    const boundsRes = ddGetLinkedResource(elementRes, store, 'bounds');
    const bounds = boundsRes ? parseBounds(boundsRes) : { x: 0, y: 0, width: 100, height: 60 };
    return {
      id: elementRes.getURI(),
      type: 'shape',
      modelElementURI,
      bounds,
      style,
    };
  }

  if (isEdge) {
    const sourceURI = ddGet(elementRes, 'source');
    const targetURI = ddGet(elementRes, 'target');
    if (!sourceURI || !targetURI) return null;
    // predicateURI and predicateLabel are set during auto-generation;
    // when reading from stored diagrams, they may be stored as
    // additional properties on the edge blank node
    const predicateURI = ddGet(elementRes, 'predicateURI');
    const predicateLabel = ddGet(elementRes, 'predicateLabel');
    const waypoints: DiagramPoint[] = [];
    return {
      id: elementRes.getURI(),
      type: 'edge',
      modelElementURI,
      predicateURI,
      predicateLabel,
      sourceId: sourceURI,
      targetId: targetURI,
      waypoints,
      style,
    };
  }

  return null;
}

/**
 * Parse an OSLCResource (diagram) into a ParsedDiagram.
 * Walks blank node structure via the rdflib store.
 */
export function parseDiagramResource(resource: OSLCResource): ParsedDiagram | null {
  const types = getTypes(resource);
  if (!isDiagramType(types)) return null;

  const store = resource.store;
  const elements: DiagramElementData[] = [];
  const elementMap = new Map<string, DiagramElementData>();

  const elementResources = ddGetLinkedResources(resource, store, 'diagramElement');
  for (const elRes of elementResources) {
    const parsed = parseElement(elRes, store);
    if (parsed) {
      elements.push(parsed);
      elementMap.set(parsed.id, parsed);
    }
  }

  return {
    uri: resource.getURI(),
    title: resource.getTitle() ?? resource.getURI(),
    elements,
    elementMap,
  };
}

/**
 * React hook: parse diagram data from an OSLCResource.
 */
export function useDiagramData(resource: OSLCResource | null): ParsedDiagram | null {
  return useMemo(() => {
    if (!resource) return null;
    return parseDiagramResource(resource);
  }, [resource]);
}
