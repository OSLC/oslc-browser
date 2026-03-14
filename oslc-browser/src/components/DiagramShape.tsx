import React from 'react';
import type { DiagramShapeData, DiagramStyle } from '../models/diagram-types.js';

interface DiagramShapeProps {
  shape: DiagramShapeData;
  onClick?: (modelElementURI: string) => void;
}

/** Read a style property as string, with fallback */
function s(style: DiagramStyle, key: string, fallback: string = ''): string {
  return style[key] ?? fallback;
}

/** Read a style property as number, with fallback */
function n(style: DiagramStyle, key: string, fallback: number = 0): number {
  const val = style[key];
  return val !== undefined ? parseFloat(val) : fallback;
}

/** Read a style property as boolean */
function b(style: DiagramStyle, key: string): boolean | undefined {
  const val = style[key];
  if (val === undefined) return undefined;
  return val === 'true' || val === '1';
}

function renderShapeSVG(shape: DiagramShapeData): React.ReactNode {
  const { bounds, style } = shape;
  const { x, y, width, height } = bounds;
  const fill = s(style, 'fillColor', '#ffffff');
  const fillOpacity = n(style, 'fillOpacity', 1);
  const strokeColor = s(style, 'strokeColor', '#333333');
  const strokeW = n(style, 'strokeWidth', 1);
  const strokeOpacity = n(style, 'strokeOpacity', 1);
  const dashArray =
    style['strokeDashLength'] && style['strokeDashGap']
      ? `${style['strokeDashLength']} ${style['strokeDashGap']}`
      : undefined;

  const commonProps = {
    fill: b(style, 'fill') === false ? 'none' : fill,
    fillOpacity,
    stroke: b(style, 'stroke') === false ? 'none' : strokeColor,
    strokeWidth: strokeW,
    strokeOpacity,
    strokeDasharray: dashArray,
  };

  const shapeType = s(style, 'shapeType', 'rect');

  switch (shapeType) {
    case 'ellipse':
      return (
        <ellipse
          cx={x + width / 2}
          cy={y + height / 2}
          rx={width / 2}
          ry={height / 2}
          {...commonProps}
        />
      );
    case 'roundedRect':
      return (
        <rect
          x={x} y={y} width={width} height={height}
          rx={8} ry={8}
          {...commonProps}
        />
      );
    case 'diamond': {
      const cx = x + width / 2;
      const cy = y + height / 2;
      const points = `${cx},${y} ${x + width},${cy} ${cx},${y + height} ${x},${cy}`;
      return <polygon points={points} {...commonProps} />;
    }
    case 'stickFigure': {
      const cx = x + width / 2;
      const headR = Math.min(width, height) * 0.15;
      const headCy = y + headR;
      const bodyTop = y + headR * 2;
      const bodyBottom = y + height * 0.6;
      const armY = bodyTop + (bodyBottom - bodyTop) * 0.3;
      return (
        <g stroke={strokeColor} strokeWidth={strokeW} fill="none">
          <circle cx={cx} cy={headCy} r={headR} />
          <line x1={cx} y1={bodyTop} x2={cx} y2={bodyBottom} />
          <line x1={x + width * 0.2} y1={armY} x2={x + width * 0.8} y2={armY} />
          <line x1={cx} y1={bodyBottom} x2={x + width * 0.25} y2={y + height} />
          <line x1={cx} y1={bodyBottom} x2={x + width * 0.75} y2={y + height} />
        </g>
      );
    }
    case 'rect':
    default:
      return (
        <rect
          x={x} y={y} width={width} height={height}
          {...commonProps}
        />
      );
  }
}

export function DiagramShapeComponent({ shape, onClick }: DiagramShapeProps) {
  const { bounds, style, modelElementURI, modelElementTitle } = shape;
  const fontSize = n(style, 'fontSize', 11);
  const fontFamily = s(style, 'fontName', 'Arial, sans-serif');
  const fontColor = s(style, 'fontColor', '#333333');
  const fontWeight = b(style, 'fontBold') ? 'bold' : 'normal';
  const fStyle = b(style, 'fontItalic') ? 'italic' : 'normal';
  const textDecoration = [
    b(style, 'fontUnderline') ? 'underline' : '',
    b(style, 'fontStrikeThrough') ? 'line-through' : '',
  ].filter(Boolean).join(' ') || undefined;

  const title = modelElementTitle ?? modelElementURI ?? '';

  const handleClick = () => {
    if (modelElementURI && onClick) onClick(modelElementURI);
  };

  return (
    <g
      style={{ cursor: modelElementURI ? 'pointer' : 'default' }}
      onClick={handleClick}
    >
      <title>{title}</title>
      {renderShapeSVG(shape)}
      {s(style, 'shapeType', 'rect') !== 'stickFigure' && (
        <text
          x={bounds.x + bounds.width / 2}
          y={bounds.y + bounds.height / 2}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={fontColor}
          fontWeight={fontWeight}
          fontStyle={fStyle}
          textDecoration={textDecoration}
        >
          {title}
        </text>
      )}
      {s(style, 'shapeType', 'rect') === 'stickFigure' && (
        <text
          x={bounds.x + bounds.width / 2}
          y={bounds.y + bounds.height + 14}
          textAnchor="middle"
          fontSize={fontSize}
          fontFamily={fontFamily}
          fill={fontColor}
        >
          {title}
        </text>
      )}
    </g>
  );
}
