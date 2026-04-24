import type { Theme } from '@mui/material';

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

/**
 * A link into this resource from another resource — i.e. some other
 * resource has a property whose value is this resource's URI. Discovered
 * via the LDM /discover-links endpoint (same-server) or an LDM provider
 * / LQE (cross-server); oslc-browser merges both sources.
 *
 * `inverseLabel` (from the source property's oslc:inverseLabel in the
 * shape) is what we display in the UI — the outgoing predicate is
 * meaningful on the source side, but we render it on the target side
 * using the inverse wording so link ownership is transparent.
 */
export interface IncomingLink {
  sourceURI: string;
  sourceTitle?: string;
  /** The forward predicate URI on the source resource. */
  predicate: string;
  /** Short label derived from the forward predicate (fallback when
   *  no inverse metadata is available). */
  predicateLabel: string;
  /** Human-readable inverse label from the source property's
   *  oslc:inverseLabel, if the shape declared one. */
  inverseLabel?: string;
  /** Origin of the discovery — used for display hinting. */
  origin: 'same-server' | 'cross-server';
}

export interface LoadedResource {
  uri: string;
  title: string;
  properties: ResourceProperty[];
  links: ResourceLink[];
  /** Links that target this resource (populated on demand). */
  incomingLinks?: IncomingLink[];
  resourceTypes: string[];
  inlineResources?: Record<string, LoadedResource>;
  /** True when this represents OSLC query results (multiple subjects). */
  isQueryResult?: boolean;
  /** Member resources when isQueryResult is true. */
  members?: LoadedResource[];
}

export interface PredicateItem {
  predicate: string;
  predicateLabel: string;
  targetCount: number;
}

export interface ColumnResource {
  resource: LoadedResource;
  /** Unique link predicates for accordion body */
  predicates: PredicateItem[];
}

export interface NavigationColumn {
  uri: string;
  title: string;
  resources: ColumnResource[];
  loading: boolean;
  error?: string;
  /** URI of the selected (expanded) resource in this column */
  selectedResourceURI?: string;
  /** URI of the selected predicate in this column */
  selectedPredicate?: string;
}

export interface NavigationState {
  columns: NavigationColumn[];
  selectedResource: LoadedResource | null;
}

// Kept for compatibility with context menu and other uses
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

/** Additional tab for DetailsPanel, rendered after built-in tabs. */
export interface ExtraTab {
  label: string;
  render: (resource: LoadedResource) => React.ReactNode;
}

/** Additional context menu item, appended after built-in items. */
export interface ExtraMenuItem {
  label: string;
  onClick: (resource: LoadedResource) => void;
  visible?: (resource: LoadedResource) => boolean;
}

/** Props for the OslcBrowserApp convenience component. */
export interface OslcBrowserAppProps {
  /** Optional MUI theme. If omitted, uses a default dark theme. */
  theme?: Theme;
  /** Additional tabs shown in DetailsPanel after built-in tabs. */
  extraTabs?: ExtraTab[];
  /** Additional context menu items appended after built-in items. */
  extraMenuItems?: ExtraMenuItem[];
}
