// --- Navigation types ---

export interface ResourceProperty {
  predicate: string;
  predicateLabel: string;
  value: string;
  isLink: boolean;
}

export interface ResourceLink {
  predicate: string;
  predicateLabel: string;
  targetURI: string;
  targetTitle?: string;
}

export interface LoadedResource {
  uri: string;
  title: string;
  properties: ResourceProperty[];
  links: ResourceLink[];
  resourceTypes: string[];
  inlineResources?: Record<string, LoadedResource>;
  /** True when this represents OSLC query results (multiple subjects). */
  isQueryResult?: boolean;
  /** Member resources when isQueryResult is true. */
  members?: LoadedResource[];
}

export interface ColumnItem {
  uri: string;
  title: string;
  predicate?: string;
  predicateLabel?: string;
  selected: boolean;
  kind: 'predicate' | 'resource';
  /** RDF types of the resource (only for kind === 'resource'). */
  resourceTypes?: string[];
}

export interface NavigationColumn {
  uri: string;
  title: string;
  items: ColumnItem[];
  loading: boolean;
  error?: string;
  resource?: LoadedResource;
}

export interface NavigationState {
  columns: NavigationColumn[];
  selectedResource: LoadedResource | null;
}

// --- Favorites types ---

export interface FavoriteItem {
  id: string;
  name: string;
  type: 'folder' | 'resource';
  uri?: string;
  children?: FavoriteItem[];
  expanded?: boolean;
}

// --- Connection types ---

export interface ConnectionState {
  serverURL: string;
  username: string;
  password: string;
  connected: boolean;
  connecting: boolean;
  error?: string;
}

// --- Utility ---

export function localName(uri: string): string {
  const hash = uri.lastIndexOf('#');
  if (hash >= 0) return uri.substring(hash + 1);
  const slash = uri.lastIndexOf('/');
  if (slash >= 0) return uri.substring(slash + 1);
  return uri;
}
