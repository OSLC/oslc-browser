import type { DiagramEdgeData, DiagramShapeData, DiagramElementData } from '../models/diagram-types.js';

interface DiagramEdgeProps {
  edge: DiagramEdgeData;
  elementMap: Map<string, DiagramElementData>;
}

function getShapeCenter(shape: DiagramShapeData): { x: number; y: number } {
  return {
    x: shape.bounds.x + shape.bounds.width / 2,
    y: shape.bounds.y + shape.bounds.height / 2,
  };
}

export function DiagramEdgeComponent({ edge, elementMap }: DiagramEdgeProps) {
  const sourceEl = elementMap.get(edge.sourceId);
  const targetEl = elementMap.get(edge.targetId);
  if (!sourceEl || !targetEl || sourceEl.type !== 'shape' || targetEl.type !== 'shape') {
    return null;
  }

  const source = getShapeCenter(sourceEl);
  const target = getShapeCenter(targetEl);

  const points = [source, ...edge.waypoints, target];
  const d = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x},${p.y}`)
    .join(' ');

  const style = edge.style;
  const strokeColor = style['strokeColor'] ?? '#333333';
  const strokeW = style['strokeWidth'] ? parseFloat(style['strokeWidth']) : 1;
  const strokeOpacity = style['strokeOpacity'] ? parseFloat(style['strokeOpacity']) : 1;
  const dashArray =
    style['strokeDashLength'] && style['strokeDashGap']
      ? `${style['strokeDashLength']} ${style['strokeDashGap']}`
      : undefined;

  // Compute midpoint for edge label
  const mid = points[Math.floor(points.length / 2)];
  const label = edge.predicateLabel ?? '';

  return (
    <g>
      <path
        d={d}
        fill="none"
        stroke={strokeColor}
        strokeWidth={strokeW}
        strokeOpacity={strokeOpacity}
        strokeDasharray={dashArray}
        markerEnd="url(#arrowhead)"
      />
      {label && (
        <text
          x={mid.x}
          y={mid.y - 6}
          textAnchor="middle"
          fontSize={9}
          fill="#666"
          fontFamily="Arial, sans-serif"
        >
          {label}
        </text>
      )}
    </g>
  );
}

/** SVG <defs> for arrowhead marker — include once in the parent SVG */
export function DiagramEdgeDefs() {
  return (
    <defs>
      <marker
        id="arrowhead"
        markerWidth="10"
        markerHeight="7"
        refX="10"
        refY="3.5"
        orient="auto"
      >
        <polygon points="0 0, 10 3.5, 0 7" fill="#333" />
      </marker>
    </defs>
  );
}
