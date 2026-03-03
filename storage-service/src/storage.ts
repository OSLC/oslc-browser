import type { IndexedFormula } from 'rdflib';

/**
 * Environment configuration for initializing a storage service.
 * Backends extend this with their specific configuration.
 */
export interface StorageEnv {
  appBase: string;
  context?: string;
  dbName?: string;
  mongoURL?: string;
  jenaURL?: string;
  [key: string]: unknown;
}

/**
 * Membership pattern for a DirectContainer.
 */
export interface MembershipPattern {
  container: string;
  hasMemberRelation?: string;
}

/**
 * An IndexedFormula with LDP metadata properties added at runtime.
 * This captures the pattern used throughout the codebase where
 * additional properties are attached to rdflib IndexedFormula instances.
 */
export interface LdpDocument extends IndexedFormula {
  uri: string;
  interactionModel?: string | null;
  membershipResource?: string;
  hasMemberRelation?: string;
  isMemberOfRelation?: string;
  membershipResourceFor?: MembershipPattern[];
}

/**
 * Result of a getMembershipTriples query.
 * Each binding has a `member` property with a `value` (URI string).
 */
export interface MemberBinding {
  member: { value: string };
}

/**
 * Abstract storage service interface.
 *
 * Provides a container of resources representing RDF graphs.
 * Implemented on different data sources (file system, MongoDB,
 * Apache Jena) to provide LDP access to those resources.
 */
export interface StorageService {
  /**
   * Initialize the storage backend.
   */
  init(env: StorageEnv): Promise<void>;

  /**
   * Drop/reset the storage backend.
   */
  drop(): Promise<void>;

  /**
   * Reserve a URI for subsequent update. Creates an empty graph placeholder.
   * Throws/rejects if the URI is already taken.
   */
  reserveURI(uri: string): Promise<number>;

  /**
   * Release a reserved URI that is no longer needed.
   */
  releaseURI(uri: string): Promise<void>;

  /**
   * Read a resource by URI. Returns the status code and the document.
   * Status 200 with document on success, 404 if not found.
   */
  read(uri: string): Promise<{ status: number; document: LdpDocument | null }>;

  /**
   * Create or update a resource.
   * Returns the HTTP status code (201 for create, 200 for update).
   */
  update(resource: LdpDocument): Promise<number>;

  /**
   * Insert triples into an existing resource (for PATCH support).
   */
  insertData(data: IndexedFormula, uri: string): Promise<number>;

  /**
   * Remove specific triples from an existing resource.
   * Inverse of insertData.
   */
  removeData(data: IndexedFormula, uri: string): Promise<number>;

  /**
   * Remove/delete a resource by URI.
   * Returns the HTTP status code.
   */
  remove(uri: string): Promise<number>;

  /**
   * Get membership triples for a container.
   * Used to calculate containment and membership on GET.
   */
  getMembershipTriples(container: LdpDocument): Promise<{ status: number; members: MemberBinding[] | null }>;

  /**
   * Execute a SPARQL CONSTRUCT query and return the results as an IndexedFormula.
   */
  constructQuery(sparql: string): Promise<{ status: number; results: IndexedFormula | null }>;

  /**
   * Execute a raw SPARQL query (SELECT, CONSTRUCT, ASK, DESCRIBE)
   * and return the raw response body and content type.
   * Optional — only implemented by backends with SPARQL support.
   */
  sparqlQuery?(sparql: string, accept: string): Promise<{ status: number; contentType: string; body: string }>;

  /**
   * Export the entire dataset in the specified format.
   * 'trig' preserves named graph structure; 'turtle' merges all into one graph.
   */
  exportDataset(format: 'trig' | 'turtle'): Promise<string>;

  /**
   * Import data into the dataset.
   * 'trig' restores named graph structure; 'turtle' parses and loads each
   * URI subject's Concise Bounded Description into its own named graph.
   */
  importDataset(data: string, format: 'trig' | 'turtle'): Promise<void>;
}
