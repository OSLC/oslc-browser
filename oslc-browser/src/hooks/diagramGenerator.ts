import OSLCClient, { type OSLCResource } from 'oslc-client';
import { localName } from '../models/diagram-types.js';

// Map MRM resource type URIs to inline style properties.
// Inlined as dd:localStyle because the parser doesn't yet resolve sharedStyle URIs.
// Values match MRMS-DiagramStyles.ttl.
const TYPE_STYLE_MAP: Record<string, Record<string, string>> = {
  'http://www.misa.org.ca/mrm#OrganizationUnit': {
    shapeType: 'rect', fill: 'true', fillColor: '#cce5ff', strokeColor: '#004085',
    strokeWidth: '1.5', fontSize: '12', fontName: 'Arial', fontColor: '#004085',
  },
  'http://www.misa.org.ca/mrm#Program': {
    shapeType: 'rect', fill: 'true', fillColor: '#d4edda', strokeColor: '#155724',
    strokeWidth: '1.5', fontSize: '12', fontName: 'Arial', fontColor: '#155724',
  },
  'http://www.misa.org.ca/mrm#Service': {
    shapeType: 'roundedRect', fill: 'true', fillColor: '#c3e6cb', strokeColor: '#155724',
    strokeWidth: '1.0', fontSize: '11', fontName: 'Arial', fontColor: '#155724',
  },
  'http://www.misa.org.ca/mrm#Process': {
    shapeType: 'ellipse', fill: 'true', fillColor: '#e2e3e5', strokeColor: '#383d41',
    strokeWidth: '1.0', fontSize: '10', fontName: 'Arial', fontColor: '#383d41',
  },
  'http://www.misa.org.ca/mrm#Resource': {
    shapeType: 'rect', fill: 'true', fillColor: '#fff3cd', strokeColor: '#856404',
    strokeWidth: '1.0', strokeDashLength: '5', strokeDashGap: '3', fontSize: '11',
    fontName: 'Arial', fontColor: '#856404',
  },
  'http://www.misa.org.ca/mrm#Outcome': {
    shapeType: 'ellipse', fill: 'true', fillColor: '#d1ecf1', strokeColor: '#0c5460',
    strokeWidth: '1.0', fontSize: '10', fontName: 'Arial', fontColor: '#0c5460',
  },
  'http://www.misa.org.ca/mrm#Output': {
    shapeType: 'rect', fill: 'true', fillColor: '#f8f9fa', strokeColor: '#6c757d',
    strokeWidth: '0.5', fontSize: '10', fontName: 'Arial', fontColor: '#6c757d',
  },
  'http://www.misa.org.ca/mrm#Need': {
    shapeType: 'ellipse', fill: 'true', fillColor: '#f5c6cb', strokeColor: '#721c24',
    strokeWidth: '1.0', fontSize: '10', fontName: 'Arial', fontColor: '#721c24',
  },
  'http://www.misa.org.ca/mrm#TargetGroup': {
    shapeType: 'stickFigure', fill: 'false', strokeColor: '#333333',
    strokeWidth: '1.5', fontSize: '10', fontName: 'Arial', fontColor: '#333333',
  },
};

interface TraversedNode {
  uri: string;
  title: string;
  types: string[];
  depth: number;
}

interface TraversedEdge {
  sourceURI: string;
  targetURI: string;
  predicateURI: string;
  predicateLabel: string;   // local name of the predicate, displayed on the edge
}

interface TraversalResult {
  nodes: TraversedNode[];
  edges: TraversedEdge[];
}

/**
 * Traverse outgoing links from a root resource using OSLCResource.getOutgoingLinks().
 * Fetches linked resources via OSLCClient.getResource().
 */
export async function traverseLinks(
  client: OSLCClient,
  rootResource: OSLCResource,
  maxDepth: number = 2
): Promise<TraversalResult> {
  const visited = new Set<string>();
  const nodes: TraversedNode[] = [];
  const edges: TraversedEdge[] = [];

  const rootURI = rootResource.getURI();
  // Derive the server origin so we only follow links to server-hosted resources
  const serverOrigin = new URL(rootURI).origin;
  const rootTypes = rootResource.get('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
  visited.add(rootURI);
  nodes.push({
    uri: rootURI,
    title: rootResource.getTitle() ?? localName(rootURI),
    types: Array.isArray(rootTypes) ? rootTypes : rootTypes ? [rootTypes] : [],
    depth: 0,
  });

  const queue: Array<{ resource: OSLCResource; depth: number }> = [
    { resource: rootResource, depth: 0 },
  ];

  while (queue.length > 0) {
    const { resource, depth } = queue.shift()!;
    if (depth >= maxDepth) continue;

    // Use OSLCResource.getOutgoingLinks() to discover all relationships.
    // Only follow links whose target shares the same server origin as the
    // root resource — vocabulary/ontology URIs (rdf:type values, enum
    // instances, etc.) are not fetchable resources and must be skipped.
    const links = resource.getOutgoingLinks();
    for (const link of links) {
      if (!link.targetURL.startsWith(serverOrigin)) continue;

      edges.push({
        sourceURI: link.sourceURL,
        targetURI: link.targetURL,
        predicateURI: link.linkType,
        predicateLabel: localName(link.linkType),
      });

      if (!visited.has(link.targetURL)) {
        visited.add(link.targetURL);
        try {
          const targetResource = await client.getResource(link.targetURL);
          if (targetResource) {
            const types = targetResource.get('http://www.w3.org/1999/02/22-rdf-syntax-ns#type');
            nodes.push({
              uri: link.targetURL,
              title: targetResource.getTitle() ?? localName(link.targetURL),
              types: Array.isArray(types) ? types : types ? [types] : [],
              depth: depth + 1,
            });
            queue.push({ resource: targetResource, depth: depth + 1 });
          }
        } catch {
          // Skip unreachable resources
        }
      }
    }
  }

  return { nodes, edges };
}

// Simple tree layout: root at top center, children in rows
function computeLayout(nodes: TraversedNode[]): Map<string, { x: number; y: number; width: number; height: number }> {
  const SHAPE_W = 140;
  const SHAPE_H = 50;
  const H_GAP = 30;
  const V_GAP = 60;

  const byDepth = new Map<number, TraversedNode[]>();
  for (const node of nodes) {
    const list = byDepth.get(node.depth) ?? [];
    list.push(node);
    byDepth.set(node.depth, list);
  }

  const layout = new Map<string, { x: number; y: number; width: number; height: number }>();
  const maxDepth = Math.max(...Array.from(byDepth.keys()));

  for (let d = 0; d <= maxDepth; d++) {
    const row = byDepth.get(d) ?? [];
    const totalWidth = row.length * SHAPE_W + (row.length - 1) * H_GAP;
    const startX = -totalWidth / 2;
    const y = d * (SHAPE_H + V_GAP);
    for (let i = 0; i < row.length; i++) {
      layout.set(row[i].uri, { x: startX + i * (SHAPE_W + H_GAP), y, width: SHAPE_W, height: SHAPE_H });
    }
  }
  return layout;
}

function getInlineStyle(types: string[]): Record<string, string> | undefined {
  for (const t of types) {
    if (TYPE_STYLE_MAP[t]) return TYPE_STYLE_MAP[t];
  }
  return undefined;
}

function serializeStyleTurtle(style: Record<string, string>): string {
  const lines: string[] = ['    a dd:Style ;'];
  for (const [key, val] of Object.entries(style)) {
    const isNumeric = ['strokeWidth', 'strokeDashLength', 'strokeDashGap',
      'fontSize', 'fillOpacity', 'strokeOpacity'].includes(key);
    if (isNumeric) {
      lines.push(`    dd:${key} "${val}"^^xsd:double ;`);
    } else if (val === 'true' || val === 'false') {
      lines.push(`    dd:${key} ${val} ;`);
    } else {
      lines.push(`    dd:${key} "${val}" ;`);
    }
  }
  if (lines.length > 1) {
    lines[lines.length - 1] = lines[lines.length - 1].replace(/ ;$/, '');
  }
  return lines.join('\n');
}

/**
 * Generate Turtle representation of a diagram from traversal results.
 * Uses inline dd:localStyle since the parser doesn't yet resolve sharedStyle URIs.
 */
export function generateDiagramTurtle(
  title: string,
  traversal: TraversalResult,
  diagramURI: string
): string {
  const layout = computeLayout(traversal.nodes);
  const lines: string[] = [];

  lines.push('@prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .');
  lines.push('@prefix dcterms: <http://purl.org/dc/terms/> .');
  lines.push('@prefix dd: <http://www.omg.org/spec/DD#> .');
  lines.push('@prefix xsd: <http://www.w3.org/2001/XMLSchema#> .');
  lines.push('');
  lines.push(`<${diagramURI}>`);
  lines.push('  a dd:Diagram ;');
  lines.push(`  dcterms:title "${title}" ;`);

  const shapeIds = new Map<string, string>();
  traversal.nodes.forEach((node, i) => shapeIds.set(node.uri, `_:shape${i}`));

  const allElementIds: string[] = [];
  traversal.nodes.forEach((_, i) => allElementIds.push(`_:shape${i}`));
  traversal.edges.forEach((_, i) => allElementIds.push(`_:edge${i}`));

  for (let i = 0; i < allElementIds.length; i++) {
    const sep = i < allElementIds.length - 1 ? ',' : '.';
    const pred = i === 0 ? 'dd:diagramElement' : '   ';
    lines.push(`  ${pred} ${allElementIds[i]} ${sep}`);
  }
  lines.push('');

  // Shape definitions with inlined styles
  for (let i = 0; i < traversal.nodes.length; i++) {
    const node = traversal.nodes[i];
    const bounds = layout.get(node.uri)!;
    const style = getInlineStyle(node.types);

    const escapedTitle = node.title.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
    lines.push(`_:shape${i}`);
    lines.push('  a dd:Shape ;');
    lines.push(`  dcterms:title "${escapedTitle}" ;`);
    lines.push(`  dd:modelElement <${node.uri}> ;`);
    if (style) {
      lines.push('  dd:localStyle [');
      lines.push(serializeStyleTurtle(style));
      lines.push('  ] ;');
    }
    lines.push('  dd:bounds [');
    lines.push('    a dd:Bounds ;');
    lines.push(`    dd:x "${bounds.x}"^^xsd:double ;`);
    lines.push(`    dd:y "${bounds.y}"^^xsd:double ;`);
    lines.push(`    dd:width "${bounds.width}"^^xsd:double ;`);
    lines.push(`    dd:height "${bounds.height}"^^xsd:double`);
    lines.push('  ] .');
    lines.push('');
  }

  // Edge definitions with predicate labels
  for (let i = 0; i < traversal.edges.length; i++) {
    const edge = traversal.edges[i];
    const sourceId = shapeIds.get(edge.sourceURI);
    const targetId = shapeIds.get(edge.targetURI);
    if (!sourceId || !targetId) continue;

    lines.push(`_:edge${i}`);
    lines.push('  a dd:Edge ;');
    lines.push(`  dd:source ${sourceId} ;`);
    lines.push(`  dd:target ${targetId} ;`);
    lines.push(`  dd:predicateURI "${edge.predicateURI}" ;`);
    lines.push(`  dd:predicateLabel "${edge.predicateLabel}" .`);
    lines.push('');
  }

  return lines.join('\n');
}
