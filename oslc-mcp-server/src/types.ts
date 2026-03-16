/**
 * A single property from an OSLC ResourceShape.
 */
export interface ShapeProperty {
  /** Short name from oslc:name (used as JSON key in tool input) */
  name: string;
  /** Full predicate URI from oslc:propertyDefinition */
  predicateURI: string;
  /** Human-readable description from dcterms:description */
  description: string;
  /** Value type URI (e.g., xsd:string, oslc:Resource) */
  valueType: string;
  /** Cardinality: 'exactly-one' | 'zero-or-one' | 'zero-or-many' | 'one-or-more' */
  occurs: string;
  /** Expected resource type URI from oslc:range (if resource-valued) */
  range: string | null;
  /** Whether the property is read-only */
  readOnly: boolean;
  /** Allowed values (from oslc:allowedValue / oslc:allowedValues) */
  allowedValues: string[];
}

/**
 * A discovered OSLC ResourceShape.
 */
export interface DiscoveredShape {
  /** URI of the resource shape */
  shapeURI: string;
  /** Title of the shape from dcterms:title */
  title: string;
  /** Description from dcterms:description */
  description: string;
  /** Properties defined in this shape */
  properties: ShapeProperty[];
}

/**
 * A discovered creation factory from the service provider.
 */
export interface DiscoveredFactory {
  /** Title from dcterms:title */
  title: string;
  /** Creation factory URL for POST */
  creationURI: string;
  /** Resource type URI from oslc:resourceType */
  resourceType: string;
  /** Associated resource shape */
  shape: DiscoveredShape | null;
}

/**
 * A discovered query capability from the service provider.
 */
export interface DiscoveredQuery {
  /** Title from dcterms:title */
  title: string;
  /** Query base URL */
  queryBase: string;
  /** Resource type URI from oslc:resourceType */
  resourceType: string;
}

/**
 * A discovered service provider.
 */
export interface DiscoveredServiceProvider {
  /** Title from dcterms:title */
  title: string;
  /** URI of the service provider */
  uri: string;
  /** Creation factories */
  factories: DiscoveredFactory[];
  /** Query capabilities */
  queries: DiscoveredQuery[];
}

/**
 * Complete discovery result from walking the catalog.
 */
export interface DiscoveryResult {
  /** The catalog URI */
  catalogURI: string;
  /** Whether the server supports JSON-LD */
  supportsJsonLd: boolean;
  /** All discovered service providers */
  serviceProviders: DiscoveredServiceProvider[];
  /** All discovered resource shapes (deduplicated by URI) */
  shapes: Map<string, DiscoveredShape>;
  /** Raw vocabulary content (RDF as readable text) */
  vocabularyContent: string;
  /** Raw catalog content (readable text summary) */
  catalogContent: string;
  /** Raw shapes content (readable text summary) */
  shapesContent: string;
}

/**
 * Configuration parsed from CLI args and env vars.
 */
export interface ServerConfig {
  serverURL: string;
  catalogURL: string;
  username: string;
  password: string;
}
