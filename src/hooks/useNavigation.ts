import { useReducer, useCallback, useRef } from 'react';
import type {
  NavigationState,
  NavigationColumn,
  ColumnResource,
  PredicateItem,
  LoadedResource,
} from '../models/types.js';
import { localName } from '../models/types.js';

type NavigationAction =
  | { type: 'SET_ROOT'; column: NavigationColumn; resource: LoadedResource }
  | { type: 'SELECT_RESOURCE'; resource: LoadedResource; columnIndex?: number }
  | { type: 'NAVIGATE_PREDICATE'; columnIndex: number; resourceURI: string; predicate: string; title: string }
  | { type: 'SET_COLUMN_ERROR'; columnIndex: number; error: string }
  | { type: 'SET_COLUMN_RESOURCES'; columnIndex: number; resources: ColumnResource[] };

function reducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'SET_ROOT':
      return {
        columns: [action.column],
        selectedResource: action.resource,
      };

    case 'SELECT_RESOURCE': {
      if (action.columnIndex !== undefined) {
        // Update selectedResourceURI on the specified column
        const columns = [...state.columns];
        const col = columns[action.columnIndex];
        if (col) {
          columns[action.columnIndex] = { ...col, selectedResourceURI: action.resource.uri };
        }
        return { ...state, columns, selectedResource: action.resource };
      }
      return { ...state, selectedResource: action.resource };
    }

    case 'NAVIGATE_PREDICATE': {
      // Trim columns after this one, mark the resource and predicate as selected,
      // and add a loading column
      const columns = state.columns.slice(0, action.columnIndex + 1).map((col, i) => {
        if (i !== action.columnIndex) return col;
        return {
          ...col,
          selectedResourceURI: action.resourceURI,
          selectedPredicate: action.predicate,
        };
      });
      columns.push({
        uri: '',
        title: action.title,
        resources: [],
        loading: true,
      });
      return { ...state, columns };
    }

    case 'SET_COLUMN_ERROR': {
      const columns = [...state.columns];
      const col = columns[action.columnIndex];
      if (col) columns[action.columnIndex] = { ...col, loading: false, error: action.error };
      return { ...state, columns };
    }

    case 'SET_COLUMN_RESOURCES': {
      const columns = [...state.columns];
      const col = columns[action.columnIndex];
      if (col) columns[action.columnIndex] = { ...col, loading: false, resources: action.resources };
      return { ...state, columns };
    }

    default:
      return state;
  }
}

/** Build unique predicate items from a resource's outgoing and incoming links. */
function buildPredicates(resource: LoadedResource): PredicateItem[] {
  const items: PredicateItem[] = [];

  // Outgoing predicates
  const outgoing = new Map<string, { label: string; count: number }>();
  for (const link of resource.links) {
    const existing = outgoing.get(link.predicate);
    if (existing) existing.count++;
    else outgoing.set(link.predicate, { label: link.predicateLabel, count: 1 });
  }
  for (const [predicate, { label, count }] of outgoing) {
    items.push({
      predicate,
      predicateLabel: label,
      targetCount: count,
      direction: 'outgoing',
    });
  }

  // Incoming predicates — grouped by forward predicate URI, labeled
  // with the inverse wording from the source property's shape when
  // available so the user sees link ownership transparently (e.g.,
  // "Amplifies" appears on the Vision that is pointed at, even though
  // the underlying triple is owned by the Goal's `amplifiedBy`).
  if (resource.incomingLinks && resource.incomingLinks.length > 0) {
    const incoming = new Map<string, { label: string; count: number }>();
    for (const link of resource.incomingLinks) {
      const label = link.inverseLabel ?? link.predicateLabel;
      const existing = incoming.get(link.predicate);
      if (existing) existing.count++;
      else incoming.set(link.predicate, { label, count: 1 });
    }
    for (const [predicate, { label, count }] of incoming) {
      items.push({
        predicate,
        predicateLabel: label,
        targetCount: count,
        direction: 'incoming',
      });
    }
  }

  return items;
}

/** Create a ColumnResource from a LoadedResource. */
function toColumnResource(resource: LoadedResource): ColumnResource {
  return {
    resource,
    predicates: buildPredicates(resource),
  };
}

/** Create the root column for one or more resources. */
function rootColumn(resource: LoadedResource): NavigationColumn {
  if (resource.isQueryResult && resource.members) {
    return {
      uri: resource.uri,
      title: resource.title,
      resources: resource.members.map(toColumnResource),
      loading: false,
    };
  }
  return {
    uri: resource.uri,
    title: resource.title,
    resources: [toColumnResource(resource)],
    loading: false,
  };
}

const initialState: NavigationState = {
  columns: [],
  selectedResource: null,
};

export interface UseNavigationReturn {
  state: NavigationState;
  navigateToRoot: (resource: LoadedResource) => void;
  navigateToItem: (
    columnIndex: number,
    resource: LoadedResource,
    predicate: string,
    fetchResource: (uri: string) => Promise<LoadedResource | null>,
    direction?: 'outgoing' | 'incoming'
  ) => Promise<void>;
  selectResource: (resource: LoadedResource, columnIndex?: number) => void;
}

export function useNavigation(): UseNavigationReturn {
  const [state, dispatch] = useReducer(reducer, initialState);
  const stateRef = useRef(state);
  stateRef.current = state;

  const navigateToRoot = useCallback((resource: LoadedResource) => {
    dispatch({ type: 'SET_ROOT', column: rootColumn(resource), resource });
  }, []);

  const selectResource = useCallback((resource: LoadedResource, columnIndex?: number) => {
    dispatch({ type: 'SELECT_RESOURCE', resource, columnIndex });
  }, []);

  /**
   * Handle predicate click: fetch all target resources for that predicate
   * and show them as accordions in the next column.
   */
  const navigateToItem = useCallback(async (
    columnIndex: number,
    resource: LoadedResource,
    predicate: string,
    fetchResource: (uri: string) => Promise<LoadedResource | null>,
    direction: 'outgoing' | 'incoming' = 'outgoing'
  ) => {
    // Resolve the URIs to fetch based on direction: outgoing → targets
    // from this resource's own links; incoming → source URIs from links
    // owned elsewhere that point at this resource.
    let fetchURIs: string[] = [];
    if (direction === 'outgoing') {
      const targetLinks = resource.links.filter(l => l.predicate === predicate);
      fetchURIs = targetLinks.map(l => l.targetURI);
    } else {
      const incoming = resource.incomingLinks?.filter(l => l.predicate === predicate) ?? [];
      fetchURIs = incoming.map(l => l.sourceURI);
    }
    if (fetchURIs.length === 0) return;

    const predicateLabel = localName(predicate);
    dispatch({
      type: 'NAVIGATE_PREDICATE',
      columnIndex,
      resourceURI: resource.uri,
      predicate,
      title: predicateLabel,
    });

    const loadingColumnIndex = columnIndex + 1;

    // Fetch all target resources in parallel
    const results = await Promise.all(
      fetchURIs.map(async (uri) => {
        if (uri.startsWith('_:') && resource.inlineResources?.[uri]) {
          return resource.inlineResources[uri];
        }
        try {
          return await fetchResource(uri);
        } catch {
          return null;
        }
      })
    );

    const fetched = results.filter((r): r is LoadedResource => r !== null);

    if (fetched.length === 0) {
      dispatch({ type: 'SET_COLUMN_ERROR', columnIndex: loadingColumnIndex, error: 'No resources found' });
      return;
    }

    const columnResources = fetched.map(toColumnResource);
    dispatch({ type: 'SET_COLUMN_RESOURCES', columnIndex: loadingColumnIndex, resources: columnResources });
    dispatch({ type: 'SELECT_RESOURCE', resource: fetched[0] });
  }, []);

  return { state, navigateToRoot, navigateToItem, selectResource };
}
