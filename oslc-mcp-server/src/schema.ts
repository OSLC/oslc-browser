import type { DiscoveredShape, ShapeProperty } from './types.js';

/**
 * JSON Schema type definition for MCP tool inputSchema.
 */
export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  description?: string;
}

interface JsonSchemaProperty {
  type: string;
  description?: string;
  format?: string;
  items?: { type: string; description?: string; format?: string; enum?: string[] };
  enum?: string[];
}

const OSLC_NS = 'http://open-services.net/ns/core#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

/**
 * Map an oslc:valueType URI to a JSON Schema type.
 */
function mapValueType(valueType: string): { type: string; format?: string } {
  switch (valueType) {
    case `${XSD_NS}string`:
    case `${XSD_NS}anyURI`:
      return { type: 'string' };
    case `${XSD_NS}integer`:
    case `${XSD_NS}int`:
    case `${XSD_NS}long`:
      return { type: 'integer' };
    case `${XSD_NS}float`:
    case `${XSD_NS}double`:
    case `${XSD_NS}decimal`:
      return { type: 'number' };
    case `${XSD_NS}boolean`:
      return { type: 'boolean' };
    case `${XSD_NS}dateTime`:
    case `${XSD_NS}date`:
      return { type: 'string', format: 'date-time' };
    case `${OSLC_NS}Resource`:
    case `${OSLC_NS}AnyResource`:
    case `${OSLC_NS}LocalResource`:
      return { type: 'string' };
    default:
      return { type: 'string' };
  }
}

/**
 * Build a description string for a property, including range info.
 */
function buildDescription(prop: ShapeProperty): string {
  const parts: string[] = [];
  if (prop.description) {
    parts.push(prop.description);
  }

  const isResource =
    prop.valueType === `${OSLC_NS}Resource` ||
    prop.valueType === `${OSLC_NS}AnyResource` ||
    prop.valueType === `${OSLC_NS}LocalResource`;

  if (isResource) {
    parts.push('(URI reference)');
  }
  if (prop.range) {
    parts.push(`Expected type: ${prop.range}`);
  }
  return parts.join(' ');
}

/**
 * Convert an OSLC ResourceShape into a JSON Schema for MCP tool input.
 *
 * @param shape - The discovered resource shape
 * @param excludeReadOnly - If true, exclude read-only properties (for create tools)
 * @returns JSON Schema object
 */
export function shapeToJsonSchema(
  shape: DiscoveredShape,
  excludeReadOnly: boolean = true
): JsonSchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const prop of shape.properties) {
    if (excludeReadOnly && prop.readOnly) {
      continue;
    }

    const { type, format } = mapValueType(prop.valueType);
    const description = buildDescription(prop);
    const isArray =
      prop.occurs === 'zero-or-many' || prop.occurs === 'one-or-more';

    if (isArray) {
      const schemaProp: JsonSchemaProperty = {
        type: 'array',
        items: {
          type,
          ...(format ? { format } : {}),
        },
      };
      if (description) schemaProp.description = description;
      if (prop.allowedValues.length > 0) {
        schemaProp.items = { ...schemaProp.items!, enum: prop.allowedValues };
      }
      properties[prop.name] = schemaProp;
    } else {
      const schemaProp: JsonSchemaProperty = { type };
      if (description) schemaProp.description = description;
      if (format) schemaProp.format = format;
      if (prop.allowedValues.length > 0) {
        schemaProp.enum = prop.allowedValues;
      }
      properties[prop.name] = schemaProp;
    }

    if (prop.occurs === 'exactly-one' || prop.occurs === 'one-or-more') {
      required.push(prop.name);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    ...(shape.description ? { description: shape.description } : {}),
  };
}

/**
 * Build a property-name-to-predicate-URI lookup map from a shape.
 */
export function buildPredicateMap(
  shape: DiscoveredShape
): Map<string, string> {
  const map = new Map<string, string>();
  for (const prop of shape.properties) {
    map.set(prop.name, prop.predicateURI);
  }
  return map;
}
