import React, { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { ParsedDiagram } from '../models/diagram-types.js';
import { DiagramShapeComponent } from './DiagramShape.js';
import { DiagramEdgeComponent, DiagramEdgeDefs } from './DiagramEdge.js';
import { DiagramToolbarComponent } from './DiagramToolbar.js';

interface DiagramCanvasProps {
  diagram: ParsedDiagram;
  onNavigate: (uri: string) => void;
}

const ZOOM_STEP = 0.2;
const MIN_ZOOM = 0.1;
const MAX_ZOOM = 5;
const PADDING = 40;

function computeContentBounds(diagram: ParsedDiagram) {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const el of diagram.elements) {
    if (el.type === 'shape') {
      minX = Math.min(minX, el.bounds.x);
      minY = Math.min(minY, el.bounds.y);
      maxX = Math.max(maxX, el.bounds.x + el.bounds.width);
      maxY = Math.max(maxY, el.bounds.y + el.bounds.height);
    }
  }
  if (!isFinite(minX)) return { x: 0, y: 0, width: 800, height: 600 };
  return {
    x: minX - PADDING,
    y: minY - PADDING,
    width: maxX - minX + PADDING * 2,
    height: maxY - minY + PADDING * 2,
  };
}

export function DiagramCanvasComponent({ diagram, onNavigate }: DiagramCanvasProps) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [zoom, setZoom] = useState(1);
  const [pan, setPan] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const contentBounds = computeContentBounds(diagram);

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.preventDefault();
    const delta = e.deltaY > 0 ? -ZOOM_STEP : ZOOM_STEP;
    setZoom(z => Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, z + delta)));
  }, []);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button === 0) {
      setDragging(true);
      setDragStart({ x: e.clientX - pan.x, y: e.clientY - pan.y });
    }
  }, [pan]);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (dragging) {
      setPan({ x: e.clientX - dragStart.x, y: e.clientY - dragStart.y });
    }
  }, [dragging, dragStart]);

  const handleMouseUp = useCallback(() => setDragging(false), []);

  const handleZoomIn = useCallback(() =>
    setZoom(z => Math.min(MAX_ZOOM, z + ZOOM_STEP)), []);
  const handleZoomOut = useCallback(() =>
    setZoom(z => Math.max(MIN_ZOOM, z - ZOOM_STEP)), []);
  const handleFitToView = useCallback(() => {
    setZoom(1);
    setPan({ x: 0, y: 0 });
  }, []);

  const shapes = diagram.elements.filter(e => e.type === 'shape');
  const edges = diagram.elements.filter(e => e.type === 'edge');

  const viewBox = `${contentBounds.x} ${contentBounds.y} ${contentBounds.width / zoom} ${contentBounds.height / zoom}`;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <DiagramToolbarComponent
        onZoomIn={handleZoomIn}
        onZoomOut={handleZoomOut}
        onFitToView={handleFitToView}
      />
      <Box sx={{ flex: 1, overflow: 'hidden', cursor: dragging ? 'grabbing' : 'grab' }}>
        <svg
          ref={svgRef}
          width="100%"
          height="100%"
          viewBox={viewBox}
          onWheel={handleWheel}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={handleMouseUp}
          style={{ display: 'block' }}
        >
          <DiagramEdgeDefs />
          <g transform={`translate(${pan.x / zoom},${pan.y / zoom})`}>
            {edges.map(e =>
              e.type === 'edge' ? (
                <DiagramEdgeComponent key={e.id} edge={e} elementMap={diagram.elementMap} />
              ) : null
            )}
            {shapes.map(s =>
              s.type === 'shape' ? (
                <DiagramShapeComponent key={s.id} shape={s} onClick={onNavigate} />
              ) : null
            )}
          </g>
        </svg>
      </Box>
    </Box>
  );
}
