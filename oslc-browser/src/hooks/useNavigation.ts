import { useReducer, useCallback } from 'react';
import type {
  NavigationState,
  NavigationColumn,
  ColumnItem,
  LoadedResource,
} from '../models/types.js';
import { localName } from '../models/types.js';

type NavigationAction =
  | { type: 'SET_ROOT'; column: NavigationColumn; resource: LoadedResource }
  | { type: 'SELECT_ITEM'; columnIndex: number; itemUri: string }
  | { type: 'ADD_COLUMN'; column: NavigationColumn; afterIndex: number; resource: LoadedResource }
  | { type: 'SET_COLUMN_LOADING'; columnIndex: number }
  | { type: 'SET_COLUMN_ERROR'; columnIndex: number; error: string };

function reducer(state: NavigationState, action: NavigationAction): NavigationState {
  switch (action.type) {
    case 'SET_ROOT':
      return {
        columns: [action.column],
        selectedResource: action.resource,
      };

    case 'SELECT_ITEM': {
      const columns = state.columns.slice(0, action.columnIndex + 1).map((col, i) => {
        if (i !== action.columnIndex) return col;
        return {
          ...col,
          items: col.items.map(item => ({
            ...item,
            selected: item.uri === action.itemUri,
          })),
        };
      });
      return { ...state, columns };
    }

    case 'ADD_COLUMN': {
      const columns = state.columns.slice(0, action.afterIndex + 1);
      // Mark the selected item in the previous column
      columns[action.afterIndex] = {
        ...columns[action.afterIndex],
        items: columns[action.afterIndex].items.map(item => ({
          ...item,
          selected: item.uri === action.column.uri,
        })),
      };
      columns.push(action.column);
      return { columns, selectedResource: action.resource };
    }

    case 'SET_COLUMN_LOADING': {
      const columns = [...state.columns];
      // Remove columns after the loading one
      const truncated = columns.slice(0, action.columnIndex + 1);
      truncated.push({
        uri: '',
        title: 'Loading...',
        items: [],
        loading: true,
      });
      return { ...state, columns: truncated };
    }

    case 'SET_COLUMN_ERROR': {
      const columns = [...state.columns];
      const last = columns[columns.length - 1];
      columns[columns.length - 1] = { ...last, loading: false, error: action.error };
      return { ...state, columns };
    }

    default:
      return state;
  }
}

function resourceToColumn(resource: LoadedResource): NavigationColumn {
  const items: ColumnItem[] = resource.links.map(link => ({
    uri: link.targetURI,
    title: link.targetTitle ?? localName(link.targetURI),
    predicate: link.predicate,
    predicateLabel: link.predicateLabel,
    selected: false,
  }));

  return {
    uri: resource.uri,
    title: resource.title,
    items,
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
    itemUri: string,
    fetchResource: (uri: string) => Promise<LoadedResource | null>
  ) => Promise<void>;
}

export function useNavigation(): UseNavigationReturn {
  const [state, dispatch] = useReducer(reducer, initialState);

  const navigateToRoot = useCallback((resource: LoadedResource) => {
    dispatch({ type: 'SET_ROOT', column: resourceToColumn(resource), resource });
  }, []);

  const navigateToItem = useCallback(async (
    columnIndex: number,
    itemUri: string,
    fetchResource: (uri: string) => Promise<LoadedResource | null>
  ) => {
    dispatch({ type: 'SET_COLUMN_LOADING', columnIndex });

    const resource = await fetchResource(itemUri);
    if (!resource) {
      dispatch({ type: 'SET_COLUMN_ERROR', columnIndex: columnIndex + 1, error: 'Failed to load resource' });
      return;
    }

    dispatch({
      type: 'ADD_COLUMN',
      column: resourceToColumn(resource),
      afterIndex: columnIndex,
      resource,
    });
  }, []);

  return { state, navigateToRoot, navigateToItem };
}
