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
  iconURL?: string;
  x: number;
  y: number;
  isCenter: boolean;
}

interface EdgeLabel {
  text: string;
  /** Incoming labels are italicized to indicate the underlying triple
   *  is stored on another resource (this resource doesn't own it). */
  italic: boolean;
}

interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
  labels: EdgeLabel[];
}

function computeLayout(resource: LoadedResource, width: number, height: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = width / 2;
  const cy = height / 2;

  const centerNode: GraphNode = {
    uri: resource.uri,
    label: resource.title,
    iconURL: resource.iconURL,
    x: cx,
    y: cy,
    isCenter: true,
  };

  // Collect neighbors — outgoing links contribute directly; incoming
  // links are rendered in the same center→neighbor direction using the
  // inverseLabel declared on the source property's shape (so link
  // ownership is transparent), but italicized to signal the underlying
  // triple is stored on the source side.
  interface Neighbor {
    title: string;
    iconURL?: string;
    labels: EdgeLabel[];
  }
  const neighbors = new Map<string, Neighbor>();

  const pushUnique = (labels: EdgeLabel[], next: EdgeLabel): void => {
    if (!labels.some(l => l.text === next.text && l.italic === next.italic)) {
      labels.push(next);
    }
  };

  for (const link of resource.links) {
    const existing = neighbors.get(link.targetURI) ?? {
      title: link.targetTitle ?? link.targetURI.split('/').pop() ?? link.targetURI,
      iconURL: link.targetIcon,
      labels: [],
    };
    if (!existing.iconURL && link.targetIcon) existing.iconURL = link.targetIcon;
    pushUnique(existing.labels, { text: link.predicateLabel, italic: false });
    neighbors.set(link.targetURI, existing);
  }

  if (resource.incomingLinks) {
    for (const link of resource.incomingLinks) {
      const text = link.inverseLabel ?? link.predicateLabel;
      const existing = neighbors.get(link.sourceURI) ?? {
        title: link.sourceTitle ?? link.sourceURI.split('/').pop() ?? link.sourceURI,
        iconURL: link.sourceIcon,
        labels: [],
      };
      if (!existing.iconURL && link.sourceIcon) existing.iconURL = link.sourceIcon;
      pushUnique(existing.labels, { text, italic: true });
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
      iconURL: info.iconURL,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      isCenter: false,
    };
    nodes.push(neighborNode);
    edges.push({
      source: centerNode,
      target: neighborNode,
      labels: info.labels,
    });
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
              <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill="#666">
                {edge.labels.map((lab, li) => (
                  <tspan
                    key={li}
                    fontStyle={lab.italic ? 'italic' : 'normal'}
                  >
                    {li > 0 ? ', ' : ''}{lab.text}
                  </tspan>
                ))}
              </text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => {
          const ICON_SIZE = 16;
          const ICON_PAD = 6;
          const hasIcon = !!node.iconURL;
          // When an icon is present, shift the label rightward to leave
          // room and slightly tighten the truncation budget.
          const textX = hasIcon
            ? (ICON_PAD + ICON_SIZE + (NODE_WIDTH - ICON_PAD - ICON_SIZE)) / 2
            : NODE_WIDTH / 2;
          const maxLen = hasIcon ? 17 : 20;
          return (
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
              {hasIcon && (
                <image
                  href={node.iconURL}
                  x={ICON_PAD}
                  y={(NODE_HEIGHT - ICON_SIZE) / 2}
                  width={ICON_SIZE}
                  height={ICON_SIZE}
                  // Invert dark icons to white when sitting on the
                  // selected (blue) center node, matching the row
                  // treatment in ResourceColumn.
                  style={node.isCenter ? { filter: 'brightness(0) invert(1)' } : { opacity: 0.8 }}
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
              <text
                x={textX}
                y={NODE_HEIGHT / 2 + 4}
                textAnchor="middle"
                fontSize={11}
                fill={node.isCenter ? '#fff' : '#333'}
              >
                {node.label.length > maxLen ? node.label.substring(0, maxLen - 2) + '...' : node.label}
              </text>
            </g>
          );
        })}
      </svg>
    </Box>
  );
}
