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

  // Deduplicate targets by URI
  const uniqueLinks = new Map<string, { label: string; targetTitle: string }>();
  for (const link of resource.links) {
    if (!uniqueLinks.has(link.targetURI)) {
      uniqueLinks.set(link.targetURI, {
        label: link.predicateLabel,
        targetTitle: link.targetTitle ?? link.targetURI.split('/').pop() ?? link.targetURI,
      });
    }
  }

  const count = uniqueLinks.size;
  const radius = Math.min(width, height) * 0.35;
  const nodes: GraphNode[] = [centerNode];
  const edges: GraphEdge[] = [];

  let i = 0;
  for (const [uri, info] of uniqueLinks) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const targetNode: GraphNode = {
      uri,
      label: info.targetTitle,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      isCenter: false,
    };
    nodes.push(targetNode);
    edges.push({ source: centerNode, target: targetNode, label: info.label });
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

  if (resource.links.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary" fontSize={13}>No outgoing links to visualize</Typography>
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
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          return (
            <g key={`edge-${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth={1} markerEnd="url(#arrowhead)" />
              <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill="#666">{edge.label}</text>
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
