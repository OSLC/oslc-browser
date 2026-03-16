/** The DD namespace URI — used only for type detection, not property matching */
export const DD_NS = 'http://www.omg.org/spec/DD#';

/** Check if a URI belongs to the DD namespace */
export function isDDProperty(predicateURI: string): boolean {
  return predicateURI.startsWith(DD_NS);
}

/** Check if a resource has dd:Diagram in its rdf:type values */
export function isDiagramType(types: string | string[]): boolean {
  const arr = Array.isArray(types) ? types : [types];
  return arr.some(t => t === DD_NS + 'Diagram');
}

// ---- Runtime data structures (populated by generic RDF/OSLCResource parsing) ----

export interface DiagramBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DiagramPoint {
  x: number;
  y: number;
}

/**
 * Style properties collected generically from dd:Style blank nodes.
 * Keys are DD local names (e.g., "fillColor", "shapeType").
 * Values are strings — the renderer coerces to number/boolean as needed.
 */
export type DiagramStyle = Record<string, string>;

export interface DiagramShapeData {
  id: string;                    // blank node ID
  type: 'shape';
  modelElementURI?: string;      // URI of the OSLC model element
  modelElementTitle?: string;    // resolved title (from compact)
  bounds: DiagramBounds;
  style: DiagramStyle;
}

export interface DiagramEdgeData {
  id: string;                    // blank node ID
  type: 'edge';
  modelElementURI?: string;
  predicateURI?: string;         // the link predicate this edge represents
  predicateLabel?: string;       // human-readable label for the predicate
  sourceId: string;              // blank node ID of source shape
  targetId: string;              // blank node ID of target shape
  waypoints: DiagramPoint[];
  style: DiagramStyle;
}

export type DiagramElementData = DiagramShapeData | DiagramEdgeData;

export interface ParsedDiagram {
  uri: string;
  title: string;
  elements: DiagramElementData[];
  elementMap: Map<string, DiagramElementData>;
}
