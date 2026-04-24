import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import type { LoadedResource } from '../models/types.js';

interface ExplorerTabProps {
  resource: LoadedResource;
  onNodeClick: (uri: string) => void;
}

interface GraphNode {
  uri: string;
  label: string;
  x: number;
  y: number;
  isCenter: boolean;
}

interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
  label: string;
  /** 'outgoing' edges originate at the center; 'incoming' edges
   *  terminate at it. Used for styling (dashed + purple) so link
   *  ownership is visible at a glance. */
  direction: 'outgoing' | 'incoming';
}

function computeLayout(resource: LoadedResource, width: number, height: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = width / 2;
  const cy = height / 2;

  const centerNode: GraphNode = {
    uri: resource.uri,
    label: resource.title,
    x: cx,
    y: cy,
    isCenter: true,
  };

  // Collect outgoing and incoming neighbors — a single resource that is
  // both a target (outgoing) and a source (incoming) appears once with
  // both edges.
  interface Neighbor {
    title: string;
    outgoingLabels: string[];
    incomingLabels: string[];
  }
  const neighbors = new Map<string, Neighbor>();

  for (const link of resource.links) {
    const existing = neighbors.get(link.targetURI) ?? {
      title: link.targetTitle ?? link.targetURI.split('/').pop() ?? link.targetURI,
      outgoingLabels: [],
      incomingLabels: [],
    };
    if (!existing.outgoingLabels.includes(link.predicateLabel)) {
      existing.outgoingLabels.push(link.predicateLabel);
    }
    neighbors.set(link.targetURI, existing);
  }

  if (resource.incomingLinks) {
    for (const link of resource.incomingLinks) {
      const label = link.inverseLabel ?? link.predicateLabel;
      const existing = neighbors.get(link.sourceURI) ?? {
        title: link.sourceTitle ?? link.sourceURI.split('/').pop() ?? link.sourceURI,
        outgoingLabels: [],
        incomingLabels: [],
      };
      if (!existing.incomingLabels.includes(label)) {
        existing.incomingLabels.push(label);
      }
      neighbors.set(link.sourceURI, existing);
    }
  }

  const count = neighbors.size;
  const radius = Math.min(width, height) * 0.35;
  const nodes: GraphNode[] = [centerNode];
  const edges: GraphEdge[] = [];

  let i = 0;
  for (const [uri, info] of neighbors) {
    const angle = count === 0 ? 0 : (2 * Math.PI * i) / count - Math.PI / 2;
    const neighborNode: GraphNode = {
      uri,
      label: info.title,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      isCenter: false,
    };
    nodes.push(neighborNode);

    if (info.outgoingLabels.length > 0) {
      edges.push({
        source: centerNode,
        target: neighborNode,
        label: info.outgoingLabels.join(', '),
        direction: 'outgoing',
      });
    }
    if (info.incomingLabels.length > 0) {
      edges.push({
        source: neighborNode,
        target: centerNode,
        label: info.incomingLabels.join(', '),
        direction: 'incoming',
      });
    }
    i++;
  }

  return { nodes, edges };
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 32;
const ARROW_SIZE = 6;

export function ExplorerTabComponent({ resource, onNodeClick }: ExplorerTabProps) {
  const width = 800;
  const height = 500;

  const { nodes, edges } = useMemo(
    () => computeLayout(resource, width, height),
    [resource, width, height]
  );

  const hasLinks =
    resource.links.length > 0 ||
    (resource.incomingLinks && resource.incomingLinks.length > 0);

  if (!hasLinks) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary" fontSize={13}>No links to visualize</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="arrowhead" markerWidth={ARROW_SIZE} markerHeight={ARROW_SIZE} refX={ARROW_SIZE} refY={ARROW_SIZE / 2} orient="auto">
            <polygon points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`} fill="#999" />
          </marker>
          <marker id="arrowhead-incoming" markerWidth={ARROW_SIZE} markerHeight={ARROW_SIZE} refX={ARROW_SIZE} refY={ARROW_SIZE / 2} orient="auto">
            <polygon points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`} fill="#8e44ad" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const dx = edge.target.x - edge.source.x;
          const dy = edge.target.y - edge.source.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;

          // Shorten line to stop at node border
          const nx = dx / len;
          const ny = dy / len;
          const x1 = edge.source.x + nx * (NODE_WIDTH / 2);
          const y1 = edge.source.y + ny * (NODE_HEIGHT / 2);
          const x2 = edge.target.x - nx * (NODE_WIDTH / 2 + ARROW_SIZE);
          const y2 = edge.target.y - ny * (NODE_HEIGHT / 2 + ARROW_SIZE);

          // Offset the label perpendicular to the edge so parallel
          // outgoing/incoming edges between the same two nodes don't
          // overlap their text.
          const perpX = -ny;
          const perpY = nx;
          const labelOffset = edge.direction === 'incoming' ? 10 : -6;
          const mx = (x1 + x2) / 2 + perpX * labelOffset;
          const my = (y1 + y2) / 2 + perpY * labelOffset;

          const isIncoming = edge.direction === 'incoming';
          const stroke = isIncoming ? '#8e44ad' : '#999';
          const dash = isIncoming ? '4 3' : undefined;
          const marker = isIncoming ? 'url(#arrowhead-incoming)' : 'url(#arrowhead)';
          const textColor = isIncoming ? '#8e44ad' : '#666';

          return (
            <g key={`edge-${i}`}>
              <line
                x1={x1} y1={y1} x2={x2} y2={y2}
                stroke={stroke}
                strokeWidth={1}
                strokeDasharray={dash}
                markerEnd={marker}
              />
              <text x={mx} y={my} textAnchor="middle" fontSize={10} fill={textColor}>
                {edge.label}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <g
            key={node.uri}
            transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}
            onClick={() => onNodeClick(node.uri)}
            style={{ cursor: 'pointer' }}
          >
            <title>{node.label}</title>
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={4}
              fill={node.isCenter ? '#1976d2' : '#fff'}
              stroke={node.isCenter ? '#1565c0' : '#bbb'}
              strokeWidth={1}
            />
            <text
              x={NODE_WIDTH / 2}
              y={NODE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fill={node.isCenter ? '#fff' : '#333'}
            >
              {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
            </text>
          </g>
        ))}
      </svg>
    </Box>
  );
}
