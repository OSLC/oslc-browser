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
const DCTERMS_TITLE = 'http://purl.org/dc/terms/title';

/**
 * Thin wrapper around an rdflib store node (NamedNode or BlankNode)
 * that provides a get()-like interface for querying properties.
 * This avoids using OSLCResource for blank nodes, which fails because
 * OSLCResource's constructor requires a valid URL.
 */
interface StoreNode {
  /** The rdflib node (NamedNode or BlankNode) */
  node: any;
  /** The rdflib store */
  store: any;
}

function storeNodeGet(sn: StoreNode, property: string): string | string[] | undefined {
  const p = sn.store.sym(property);
  const results = sn.store.each(sn.node, p, null);
  if (results.length === 0) return undefined;
  if (results.length === 1) return results[0].value;
  return results.map((v: any) => v.value);
}

function storeNodeGetRaw(sn: StoreNode, property: string): any[] {
  const p = sn.store.sym(property);
  return sn.store.each(sn.node, p, null);
}

function storeNodeGetProperties(sn: StoreNode): Record<string, string | string[]> {
  const stmts = sn.store.statementsMatching(sn.node, null, null);
  const result: Record<string, string | string[]> = {};
  for (const st of stmts) {
    const pred = st.predicate.value;
    const val = st.object.value;
    const existing = result[pred];
    if (existing === undefined) {
      result[pred] = val;
    } else if (Array.isArray(existing)) {
      existing.push(val);
    } else {
      result[pred] = [existing, val];
    }
  }
  return result;
}

function ddGet(sn: StoreNode, ddLocalName: string): string | undefined {
  const val = storeNodeGet(sn, DD_NS + ddLocalName);
  if (val === undefined) return undefined;
  return Array.isArray(val) ? val[0] : val;
}

function getTypes(sn: StoreNode): string[] {
  const types = storeNodeGet(sn, RDF_TYPE);
  if (types === undefined) return [];
  if (Array.isArray(types)) return types;
  return [types];
}

/**
 * Get a linked node (possibly blank) as a StoreNode.
 * Uses storeNodeGetRaw to preserve the actual rdflib node object
 * rather than converting to .value string.
 */
function ddGetLinkedNode(sn: StoreNode, ddLocalName: string): StoreNode | undefined {
  const nodes = storeNodeGetRaw(sn, DD_NS + ddLocalName);
  if (nodes.length === 0) return undefined;
  return { node: nodes[0], store: sn.store };
}

function ddGetLinkedNodes(sn: StoreNode, ddLocalName: string): StoreNode[] {
  const nodes = storeNodeGetRaw(sn, DD_NS + ddLocalName);
  return nodes.map((n: any) => ({ node: n, store: sn.store }));
}

function parseStyle(sn: StoreNode): DiagramStyle {
  const style: DiagramStyle = {};
  const allProps = storeNodeGetProperties(sn);
  for (const [predicate, value] of Object.entries(allProps)) {
    if (isDDProperty(predicate)) {
      style[localName(predicate)] = Array.isArray(value) ? value[0] : value;
    }
  }
  return style;
}

function parseBounds(sn: StoreNode): DiagramBounds {
  const get = (name: string) => {
    const val = ddGet(sn, name);
    return val !== undefined ? parseFloat(val) : 0;
  };
  return {
    x: get('x'),
    y: get('y'),
    width: get('width') || 100,
    height: get('height') || 60,
  };
}

function parseElement(elNode: StoreNode): DiagramElementData | null {
  const types = getTypes(elNode);
  const modelElementURI = ddGet(elNode, 'modelElement');

  let style: DiagramStyle = {};
  const localStyleNode = ddGetLinkedNode(elNode, 'localStyle');
  if (localStyleNode) {
    style = parseStyle(localStyleNode);
  }

  const isShape = types.some(t => t === DD_NS + 'Shape');
  const isEdge = types.some(t => t === DD_NS + 'Edge');

  // Use the node's .value as the ID (works for both NamedNodes and BlankNodes)
  const id = elNode.node.value;

  if (isShape) {
    const boundsNode = ddGetLinkedNode(elNode, 'bounds');
    const bounds = boundsNode ? parseBounds(boundsNode) : { x: 0, y: 0, width: 100, height: 60 };
    // Read dcterms:title stored on the shape blank node during generation
    const titleVal = storeNodeGet(elNode, DCTERMS_TITLE);
    const modelElementTitle = titleVal ? (Array.isArray(titleVal) ? titleVal[0] : titleVal) : undefined;
    return {
      id,
      type: 'shape',
      modelElementURI,
      modelElementTitle,
      bounds,
      style,
    };
  }

  if (isEdge) {
    const sourceURI = ddGet(elNode, 'source');
    const targetURI = ddGet(elNode, 'target');
    if (!sourceURI || !targetURI) return null;
    const predicateURI = ddGet(elNode, 'predicateURI');
    const predicateLabel = ddGet(elNode, 'predicateLabel');
    const waypoints: DiagramPoint[] = [];
    return {
      id,
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
 * Uses the rdflib store directly to navigate blank nodes.
 */
export function parseDiagramResource(resource: OSLCResource): ParsedDiagram | null {
  const types = resource.get(RDF_TYPE);
  const typeList = types === undefined ? [] : Array.isArray(types) ? types : [types];
  if (!isDiagramType(typeList)) return null;

  const store = resource.store;
  // Create a StoreNode for the diagram root using the actual rdflib node
  const diagramNode: StoreNode = { node: store.sym(resource.getURI()), store };

  const elements: DiagramElementData[] = [];
  const elementMap = new Map<string, DiagramElementData>();

  const elementNodes = ddGetLinkedNodes(diagramNode, 'diagramElement');
  for (const elNode of elementNodes) {
    const parsed = parseElement(elNode);
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
