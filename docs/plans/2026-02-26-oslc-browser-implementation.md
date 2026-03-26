# OSLC Browser Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Rewrite oslc-browser as a TypeScript React SPA with column-based resource navigation, favorites with folders, and a details panel with properties table and SVG explorer graph.

**Architecture:** Static React SPA built with Vite. Uses oslc-client (JavaScript library with browser support) for OSLC resource fetching and authentication. State managed with React Context + useReducer. MUI components for UI. localStorage for persistence.

**Tech Stack:** React 19, TypeScript 5.8, Vite 7, MUI 7, oslc-client, rdflib (via oslc-client)

**Design doc:** `docs/plans/2026-02-26-oslc-browser-design.md`

---

### Task 1: Clean up project and update dependencies

Remove unused files and dependencies from the prototype. Set up the clean project structure.

**Files:**
- Modify: `oslc-browser/package.json`
- Delete: `oslc-browser/src/App.tsx` (will be rewritten)
- Delete: `oslc-browser/src/App.css`
- Delete: `oslc-browser/src/RelationshipsAccordion.css`
- Delete: `oslc-browser/src/assets/react.svg`
- Keep: `oslc-browser/src/main.tsx`, `oslc-browser/src/index.css`, `oslc-browser/src/vite-env.d.ts`
- Keep: `oslc-browser/index.html`, `oslc-browser/vite.config.ts`, `oslc-browser/tsconfig*.json`, `oslc-browser/eslint.config.js`

**Step 1: Update package.json**

Remove `react-window` and `@types/react-window` from dependencies. Add `uuid` for generating favorite IDs:

```json
{
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.1",
    "@mui/material": "^7.3.1",
    "oslc-client": "file:../oslc-client",
    "react": "^19.1.1",
    "react-dom": "^19.1.1"
  }
}
```

**Step 2: Delete old source files**

Delete `src/App.tsx`, `src/App.css`, `src/RelationshipsAccordion.css`, `src/assets/react.svg`.

**Step 3: Create directory structure**

```
mkdir -p src/components src/hooks src/models
```

**Step 4: Run npm install**

```bash
cd oslc-browser && npm install
```

**Step 5: Commit**

```bash
git add -A oslc-browser/
git commit -m "chore: clean up oslc-browser prototype, update dependencies"
```

---

### Task 2: TypeScript type definitions and models

Create the shared TypeScript interfaces and update the oslc-client type declarations to match the actual API.

**Files:**
- Create: `oslc-browser/src/models/types.ts`
- Modify: `oslc-browser/src/types/oslc-client.d.ts`

**Step 1: Rewrite oslc-client type declarations**

The existing type declarations don't match the actual oslc-client API. The real constructor takes `(user, password, configuration_context?)` and returns OSLCResource objects with `getTitle()`, `getProperties()`, `getOutgoingLinks()`, `getLinkTypes()`, `getURI()`, and `get(property)` methods.

`oslc-browser/src/types/oslc-client.d.ts`:
```typescript
declare module 'oslc-client' {
  export interface OutgoingLink {
    sourceURL: string;
    linkType: string;
    targetURL: string;
  }

  export class OSLCResource {
    uri: { value: string };
    store: any;
    etag?: string;

    getURI(): string;
    get(property: string | object): string | string[] | undefined;
    set(property: string | object, value: any): void;
    getIdentifier(): string | undefined;
    getTitle(): string | undefined;
    getShortTitle(): string | undefined;
    getDescription(): string | undefined;
    setTitle(value: string): void;
    setDescription(value: string): void;
    getLinkTypes(): Set<string>;
    getOutgoingLinks(linkTypes?: Set<string> | string[] | null): OutgoingLink[];
    getProperties(): Record<string, string | string[]>;
  }

  export default class OSLCClient {
    constructor(user: string, password: string, configuration_context?: string | null);

    use(server_url: string, serviceProviderName: string, domain?: string): Promise<void>;
    getResource(url: string, oslc_version?: string, accept?: string): Promise<OSLCResource>;
    getCompactResource(url: string, oslc_version?: string, accept?: string): Promise<any>;
    putResource(resource: OSLCResource, eTag?: string | null, oslc_version?: string): Promise<any>;
    createResource(resourceType: string, resource: OSLCResource, oslc_version?: string): Promise<any>;
    deleteResource(resource: OSLCResource, oslc_version?: string): Promise<any>;
    queryResources(resourceType: string, query: any): Promise<OSLCResource[]>;
    query(resourceType: string, query: any): Promise<any>;
    getQueryBase(resourceType: string): Promise<string>;
    getCreationFactory(resourceType: string): Promise<string>;
    getOwner(url: string): Promise<string>;
  }

  export class LDMClient extends OSLCClient {
    getIncomingLinks(targetResourceURLs: string[], linkTypes: string[], configurationContext?: string): Promise<any>;
    invert(triples: any[]): any[];
  }
}
```

**Step 2: Create application type definitions**

`oslc-browser/src/models/types.ts`:
```typescript
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
}

export interface ColumnItem {
  uri: string;
  title: string;
  predicate?: string;
  predicateLabel?: string;
  selected: boolean;
}

export interface NavigationColumn {
  uri: string;
  title: string;
  items: ColumnItem[];
  loading: boolean;
  error?: string;
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
```

**Step 3: Commit**

```bash
git add oslc-browser/src/models/types.ts oslc-browser/src/types/oslc-client.d.ts
git commit -m "feat: add TypeScript models and update oslc-client type declarations"
```

---

### Task 3: useOslcClient hook

Create the hook that manages the oslc-client instance, connection state, and resource fetching.

**Files:**
- Create: `oslc-browser/src/hooks/useOslcClient.ts`

**Step 1: Implement the hook**

`oslc-browser/src/hooks/useOslcClient.ts`:
```typescript
import { useState, useCallback, useRef } from 'react';
import OSLCClient, { type OSLCResource } from 'oslc-client';
import {
  type ConnectionState,
  type LoadedResource,
  type ResourceProperty,
  type ResourceLink,
  localName,
} from '../models/types.js';

export interface UseOslcClientReturn {
  connection: ConnectionState;
  setServerURL: (url: string) => void;
  setUsername: (user: string) => void;
  setPassword: (pass: string) => void;
  connect: () => Promise<LoadedResource | null>;
  fetchResource: (uri: string) => Promise<LoadedResource | null>;
}

function parseOslcResource(resource: OSLCResource, uri: string): LoadedResource {
  const title = resource.getTitle() ?? localName(uri);
  const properties: ResourceProperty[] = [];
  const links: ResourceLink[] = [];
  const resourceTypes: string[] = [];

  const allProps = resource.getProperties();
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  for (const [predicate, value] of Object.entries(allProps)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (predicate === RDF_TYPE) {
        resourceTypes.push(v);
        continue;
      }
      // Heuristic: if value looks like a URI, treat as link
      if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('urn:')) {
        links.push({
          predicate,
          predicateLabel: localName(predicate),
          targetURI: v,
          targetTitle: localName(v),
        });
      } else {
        properties.push({
          predicate,
          predicateLabel: localName(predicate),
          value: v,
          isLink: false,
        });
      }
    }
  }

  return { uri, title, properties, links, resourceTypes };
}

const STORAGE_KEY = 'oslc-browser-connection';

function loadSavedConnection(): Partial<ConnectionState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveConnection(state: ConnectionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      serverURL: state.serverURL,
      username: state.username,
    }));
  } catch { /* ignore */ }
}

export function useOslcClient(): UseOslcClientReturn {
  const saved = loadSavedConnection();
  const [connection, setConnection] = useState<ConnectionState>({
    serverURL: saved.serverURL ?? '',
    username: saved.username ?? '',
    password: '',
    connected: false,
    connecting: false,
  });
  const clientRef = useRef<OSLCClient | null>(null);

  const setServerURL = useCallback((url: string) => {
    setConnection(prev => ({ ...prev, serverURL: url }));
  }, []);

  const setUsername = useCallback((user: string) => {
    setConnection(prev => ({ ...prev, username: user }));
  }, []);

  const setPassword = useCallback((pass: string) => {
    setConnection(prev => ({ ...prev, password: pass }));
  }, []);

  const fetchResource = useCallback(async (uri: string): Promise<LoadedResource | null> => {
    const client = clientRef.current;
    if (!client) return null;

    try {
      const resource = await client.getResource(uri);
      return parseOslcResource(resource, uri);
    } catch (err) {
      console.error('Error fetching resource:', uri, err);
      return null;
    }
  }, []);

  const connect = useCallback(async (): Promise<LoadedResource | null> => {
    setConnection(prev => ({ ...prev, connecting: true, error: undefined }));

    try {
      const client = new OSLCClient(connection.username, connection.password);
      clientRef.current = client;

      // Fetch the resource at the entered URL
      const resource = await client.getResource(connection.serverURL);
      const loaded = parseOslcResource(resource, connection.serverURL);

      setConnection(prev => {
        const next = { ...prev, connected: true, connecting: false, error: undefined };
        saveConnection(next);
        return next;
      });
      return loaded;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setConnection(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: message,
      }));
      clientRef.current = null;
      return null;
    }
  }, [connection.serverURL, connection.username, connection.password]);

  return { connection, setServerURL, setUsername, setPassword, connect, fetchResource };
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/hooks/useOslcClient.ts
git commit -m "feat: add useOslcClient hook for connection and resource fetching"
```

---

### Task 4: useNavigation hook

Create the hook that manages column-based navigation state.

**Files:**
- Create: `oslc-browser/src/hooks/useNavigation.ts`

**Step 1: Implement the hook**

`oslc-browser/src/hooks/useNavigation.ts`:
```typescript
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
```

**Step 2: Commit**

```bash
git add oslc-browser/src/hooks/useNavigation.ts
git commit -m "feat: add useNavigation hook for column-based resource navigation"
```

---

### Task 5: useFavorites hook

Create the hook that manages the favorites tree with localStorage persistence.

**Files:**
- Create: `oslc-browser/src/hooks/useFavorites.ts`

**Step 1: Implement the hook**

`oslc-browser/src/hooks/useFavorites.ts`:
```typescript
import { useState, useCallback } from 'react';
import type { FavoriteItem } from '../models/types.js';

const STORAGE_KEY = 'oslc-browser-favorites';

function generateId(): string {
  return crypto.randomUUID();
}

function loadFavorites(): FavoriteItem[] {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return [];
}

function saveFavorites(items: FavoriteItem[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  } catch { /* ignore */ }
}

// Recursively remove an item by id
function removeById(items: FavoriteItem[], id: string): FavoriteItem[] {
  return items
    .filter(item => item.id !== id)
    .map(item => ({
      ...item,
      children: item.children ? removeById(item.children, id) : undefined,
    }));
}

// Recursively add an item to a parent folder
function addToFolder(items: FavoriteItem[], parentId: string, newItem: FavoriteItem): FavoriteItem[] {
  return items.map(item => {
    if (item.id === parentId && item.type === 'folder') {
      return { ...item, children: [...(item.children ?? []), newItem] };
    }
    if (item.children) {
      return { ...item, children: addToFolder(item.children, parentId, newItem) };
    }
    return item;
  });
}

// Recursively rename an item
function renameItem(items: FavoriteItem[], id: string, name: string): FavoriteItem[] {
  return items.map(item => {
    if (item.id === id) return { ...item, name };
    if (item.children) return { ...item, children: renameItem(item.children, id, name) };
    return item;
  });
}

// Toggle folder expanded state
function toggleExpanded(items: FavoriteItem[], id: string): FavoriteItem[] {
  return items.map(item => {
    if (item.id === id) return { ...item, expanded: !item.expanded };
    if (item.children) return { ...item, children: toggleExpanded(item.children, id) };
    return item;
  });
}

export interface UseFavoritesReturn {
  favorites: FavoriteItem[];
  addFolder: (name: string, parentId?: string) => void;
  addResource: (name: string, uri: string, parentId?: string) => void;
  removeItem: (id: string) => void;
  rename: (id: string, name: string) => void;
  toggleFolder: (id: string) => void;
}

export function useFavorites(): UseFavoritesReturn {
  const [favorites, setFavorites] = useState<FavoriteItem[]>(loadFavorites);

  const update = useCallback((updater: (prev: FavoriteItem[]) => FavoriteItem[]) => {
    setFavorites(prev => {
      const next = updater(prev);
      saveFavorites(next);
      return next;
    });
  }, []);

  const addFolder = useCallback((name: string, parentId?: string) => {
    const folder: FavoriteItem = {
      id: generateId(),
      name,
      type: 'folder',
      children: [],
      expanded: true,
    };
    update(prev => parentId ? addToFolder(prev, parentId, folder) : [...prev, folder]);
  }, [update]);

  const addResource = useCallback((name: string, uri: string, parentId?: string) => {
    const resource: FavoriteItem = {
      id: generateId(),
      name,
      type: 'resource',
      uri,
    };
    update(prev => parentId ? addToFolder(prev, parentId, resource) : [...prev, resource]);
  }, [update]);

  const removeItemFn = useCallback((id: string) => {
    update(prev => removeById(prev, id));
  }, [update]);

  const renameFn = useCallback((id: string, name: string) => {
    update(prev => renameItem(prev, id, name));
  }, [update]);

  const toggleFolderFn = useCallback((id: string) => {
    update(prev => toggleExpanded(prev, id));
  }, [update]);

  return {
    favorites,
    addFolder,
    addResource,
    removeItem: removeItemFn,
    rename: renameFn,
    toggleFolder: toggleFolderFn,
  };
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/hooks/useFavorites.ts
git commit -m "feat: add useFavorites hook with localStorage persistence"
```

---

### Task 6: Toolbar component

Create the connection toolbar with server URL, credentials, and connect button.

**Files:**
- Create: `oslc-browser/src/components/Toolbar.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/Toolbar.tsx`:
```tsx
import {
  AppBar,
  Toolbar as MuiToolbar,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Breadcrumbs,
  Link,
  Alert,
} from '@mui/material';
import type { ConnectionState, NavigationColumn } from '../models/types.js';

interface ToolbarProps {
  connection: ConnectionState;
  columns: NavigationColumn[];
  onServerURLChange: (url: string) => void;
  onUsernameChange: (user: string) => void;
  onPasswordChange: (pass: string) => void;
  onConnect: () => void;
  onBreadcrumbClick: (columnIndex: number) => void;
}

export function ToolbarComponent({
  connection,
  columns,
  onServerURLChange,
  onUsernameChange,
  onPasswordChange,
  onConnect,
  onBreadcrumbClick,
}: ToolbarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onConnect();
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <MuiToolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ mr: 2, whiteSpace: 'nowrap' }}>
          OSLC Browser
        </Typography>
        <TextField
          size="small"
          label="Server URL"
          value={connection.serverURL}
          onChange={e => onServerURLChange(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ minWidth: 300, flexGrow: 1 }}
        />
        <TextField
          size="small"
          label="Username"
          value={connection.username}
          onChange={e => onUsernameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ width: 140 }}
        />
        <TextField
          size="small"
          label="Password"
          type="password"
          value={connection.password}
          onChange={e => onPasswordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ width: 140 }}
        />
        <Button
          variant="contained"
          onClick={onConnect}
          disabled={connection.connecting || !connection.serverURL}
          startIcon={connection.connecting ? <CircularProgress size={16} /> : undefined}
        >
          {connection.connecting ? 'Connecting' : 'Connect'}
        </Button>
      </MuiToolbar>

      {connection.error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {connection.error}
        </Alert>
      )}

      {columns.length > 0 && (
        <Box sx={{ px: 2, py: 0.5, bgcolor: 'grey.100' }}>
          <Breadcrumbs maxItems={8} sx={{ fontSize: 13 }}>
            {columns.map((col, i) => (
              <Link
                key={col.uri + i}
                component="button"
                underline="hover"
                color={i === columns.length - 1 ? 'text.primary' : 'inherit'}
                onClick={() => onBreadcrumbClick(i)}
                sx={{ fontSize: 13 }}
              >
                {col.title}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>
      )}
    </AppBar>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/Toolbar.tsx
git commit -m "feat: add Toolbar component with connection form and breadcrumbs"
```

---

### Task 7: ResourceColumn component

Create the component that renders a single navigation column listing resource links.

**Files:**
- Create: `oslc-browser/src/components/ResourceColumn.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/ResourceColumn.tsx`:
```tsx
import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import type { NavigationColumn, ColumnItem } from '../models/types.js';

interface ResourceColumnProps {
  column: NavigationColumn;
  onItemClick: (item: ColumnItem) => void;
  onItemContextMenu: (event: React.MouseEvent, item: ColumnItem) => void;
}

export function ResourceColumnComponent({
  column,
  onItemClick,
  onItemContextMenu,
}: ResourceColumnProps) {
  if (column.loading) {
    return (
      <Box sx={{ width: 280, minWidth: 280, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: 1, borderColor: 'divider' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (column.error) {
    return (
      <Box sx={{ width: 280, minWidth: 280, p: 1, borderRight: 1, borderColor: 'divider' }}>
        <Alert severity="error" sx={{ fontSize: 12 }}>{column.error}</Alert>
      </Box>
    );
  }

  // Group items by predicate
  const groups = new Map<string, ColumnItem[]>();
  for (const item of column.items) {
    const key = item.predicateLabel ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <Box sx={{ width: 280, minWidth: 280, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
      <Typography
        variant="subtitle2"
        sx={{ px: 1.5, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider', fontSize: 13, fontWeight: 600 }}
        noWrap
        title={column.uri}
      >
        {column.title}
      </Typography>

      {column.items.length === 0 && (
        <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
          No outgoing links
        </Typography>
      )}

      <List dense disablePadding>
        {Array.from(groups.entries()).map(([predicateLabel, items], gi) => (
          <Box key={predicateLabel + gi}>
            {predicateLabel && (
              <>
                {gi > 0 && <Divider />}
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'grey.50' }}>
                  <Chip label={predicateLabel} size="small" sx={{ fontSize: 11, height: 20 }} />
                </Box>
              </>
            )}
            {items.map(item => (
              <ListItemButton
                key={item.uri}
                selected={item.selected}
                onClick={() => onItemClick(item)}
                onContextMenu={e => onItemContextMenu(e, item)}
                sx={{ py: 0.5 }}
              >
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                  title={item.uri}
                />
              </ListItemButton>
            ))}
          </Box>
        ))}
      </List>
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/ResourceColumn.tsx
git commit -m "feat: add ResourceColumn component with grouped links"
```

---

### Task 8: ColumnView component

Create the horizontal scrolling container that holds all resource columns.

**Files:**
- Create: `oslc-browser/src/components/ColumnView.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/ColumnView.tsx`:
```tsx
import { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { ResourceColumnComponent } from './ResourceColumn.js';
import type { NavigationColumn, ColumnItem } from '../models/types.js';

interface ColumnViewProps {
  columns: NavigationColumn[];
  onItemClick: (columnIndex: number, item: ColumnItem) => void;
  onItemContextMenu: (event: React.MouseEvent, item: ColumnItem) => void;
}

export function ColumnViewComponent({ columns, onItemClick, onItemContextMenu }: ColumnViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the right when new columns are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [columns.length]);

  return (
    <Box
      ref={scrollRef}
      sx={{
        display: 'flex',
        flexGrow: 1,
        overflow: 'auto',
        bgcolor: 'background.paper',
      }}
    >
      {columns.map((col, i) => (
        <ResourceColumnComponent
          key={col.uri + i}
          column={col}
          onItemClick={item => onItemClick(i, item)}
          onItemContextMenu={onItemContextMenu}
        />
      ))}
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/ColumnView.tsx
git commit -m "feat: add ColumnView component with horizontal scrolling"
```

---

### Task 9: FavoritesPanel component

Create the favorites sidebar with MUI TreeView for folders and resources.

**Files:**
- Create: `oslc-browser/src/components/FavoritesPanel.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/FavoritesPanel.tsx`:
```tsx
import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Link as LinkIcon,
  CreateNewFolder as CreateNewFolderIcon,
  ExpandMore,
  ChevronRight,
} from '@mui/icons-material';
import type { FavoriteItem } from '../models/types.js';

interface FavoritesPanelProps {
  favorites: FavoriteItem[];
  onAddFolder: (name: string, parentId?: string) => void;
  onAddResource: (name: string, uri: string, parentId?: string) => void;
  onRemoveItem: (id: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  onNavigateToResource: (uri: string) => void;
}

export function FavoritesPanelComponent({
  favorites,
  onAddFolder,
  onRemoveItem,
  onRenameItem,
  onToggleFolder,
  onNavigateToResource,
}: FavoritesPanelProps) {
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; item: FavoriteItem } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ item: FavoriteItem; name: string } | null>(null);
  const [newFolderDialog, setNewFolderDialog] = useState<{ parentId?: string; name: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, item: FavoriteItem) => {
    e.preventDefault();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, item });
  };

  const handleCloseMenu = () => setContextMenu(null);

  const renderItem = (item: FavoriteItem, depth: number): React.ReactNode => {
    const isFolder = item.type === 'folder';

    return (
      <Box key={item.id}>
        <ListItemButton
          sx={{ pl: 1.5 + depth * 2 }}
          onClick={() => {
            if (isFolder) onToggleFolder(item.id);
            else if (item.uri) onNavigateToResource(item.uri);
          }}
          onContextMenu={e => handleContextMenu(e, item)}
        >
          {isFolder && (
            <ListItemIcon sx={{ minWidth: 28 }}>
              {item.expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
            </ListItemIcon>
          )}
          <ListItemIcon sx={{ minWidth: 28 }}>
            {isFolder
              ? (item.expanded ? <FolderOpenIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" color="primary" />)
              : <LinkIcon fontSize="small" color="action" />
            }
          </ListItemIcon>
          <ListItemText
            primary={item.name}
            primaryTypographyProps={{ fontSize: 13, noWrap: true }}
            title={item.uri ?? item.name}
          />
        </ListItemButton>

        {isFolder && item.children && (
          <Collapse in={item.expanded}>
            {item.children.map(child => renderItem(child, depth + 1))}
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: 240, minWidth: 240, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontSize: 13, fontWeight: 600 }}>
          Favorites
        </Typography>
        <Tooltip title="New folder">
          <IconButton size="small" onClick={() => setNewFolderDialog({ name: '' })}>
            <CreateNewFolderIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <List dense disablePadding sx={{ overflow: 'auto', flexGrow: 1 }}>
        {favorites.length === 0 && (
          <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 12 }}>
            Right-click a resource to add it to favorites
          </Typography>
        )}
        {favorites.map(item => renderItem(item, 0))}
      </List>

      {/* Context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => {
          if (contextMenu) setRenameDialog({ item: contextMenu.item, name: contextMenu.item.name });
          handleCloseMenu();
        }}>Rename</MenuItem>
        {contextMenu?.item.type === 'folder' && (
          <MenuItem onClick={() => {
            if (contextMenu) setNewFolderDialog({ parentId: contextMenu.item.id, name: '' });
            handleCloseMenu();
          }}>New subfolder</MenuItem>
        )}
        <MenuItem onClick={() => {
          if (contextMenu) onRemoveItem(contextMenu.item.id);
          handleCloseMenu();
        }}>Delete</MenuItem>
      </Menu>

      {/* Rename dialog */}
      <Dialog open={renameDialog !== null} onClose={() => setRenameDialog(null)}>
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameDialog?.name ?? ''}
            onChange={e => setRenameDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter' && renameDialog) {
                onRenameItem(renameDialog.item.id, renameDialog.name);
                setRenameDialog(null);
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog(null)}>Cancel</Button>
          <Button onClick={() => {
            if (renameDialog) onRenameItem(renameDialog.item.id, renameDialog.name);
            setRenameDialog(null);
          }}>OK</Button>
        </DialogActions>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newFolderDialog !== null} onClose={() => setNewFolderDialog(null)}>
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Folder name"
            value={newFolderDialog?.name ?? ''}
            onChange={e => setNewFolderDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newFolderDialog?.name) {
                onAddFolder(newFolderDialog.name, newFolderDialog.parentId);
                setNewFolderDialog(null);
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(null)}>Cancel</Button>
          <Button onClick={() => {
            if (newFolderDialog?.name) onAddFolder(newFolderDialog.name, newFolderDialog.parentId);
            setNewFolderDialog(null);
          }}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/FavoritesPanel.tsx
git commit -m "feat: add FavoritesPanel component with tree view and context menu"
```

---

### Task 10: PropertiesTab component

Create the properties table that shows literal properties and link properties of the selected resource.

**Files:**
- Create: `oslc-browser/src/components/PropertiesTab.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/PropertiesTab.tsx`:
```tsx
import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Link,
  Chip,
  Divider,
} from '@mui/material';
import type { LoadedResource } from '../models/types.js';
import { localName } from '../models/types.js';

interface PropertiesTabProps {
  resource: LoadedResource;
  onLinkClick: (uri: string) => void;
}

export function PropertiesTabComponent({ resource, onLinkClick }: PropertiesTabProps) {
  return (
    <Box sx={{ overflow: 'auto', height: '100%', p: 1 }}>
      {/* Resource header */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {resource.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', wordBreak: 'break-all' }}>
        {resource.uri}
      </Typography>

      {/* Resource types */}
      {resource.resourceTypes.length > 0 && (
        <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {resource.resourceTypes.map(t => (
            <Chip key={t} label={localName(t)} size="small" title={t} sx={{ fontSize: 11, height: 20 }} />
          ))}
        </Box>
      )}

      {/* Literal properties */}
      {resource.properties.length > 0 && (
        <>
          <Typography variant="overline" sx={{ fontSize: 11 }}>Properties</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 12, fontWeight: 600, width: '30%' }}>Property</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resource.properties.map((prop, i) => (
                <TableRow key={prop.predicate + i}>
                  <TableCell sx={{ fontSize: 12 }} title={prop.predicate}>
                    {prop.predicateLabel}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, wordBreak: 'break-word' }}>
                    {prop.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Link properties */}
      {resource.links.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="overline" sx={{ fontSize: 11 }}>Links</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 12, fontWeight: 600, width: '30%' }}>Relationship</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Target</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resource.links.map((link, i) => (
                <TableRow key={link.predicate + link.targetURI + i}>
                  <TableCell sx={{ fontSize: 12 }} title={link.predicate}>
                    {link.predicateLabel}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    <Link
                      component="button"
                      onClick={() => onLinkClick(link.targetURI)}
                      sx={{ fontSize: 12, textAlign: 'left' }}
                      title={link.targetURI}
                    >
                      {link.targetTitle ?? link.targetURI}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/PropertiesTab.tsx
git commit -m "feat: add PropertiesTab component with properties and links tables"
```

---

### Task 11: ExplorerTab component

Create the SVG graph view that shows the selected resource and its outgoing links as a radial graph.

**Files:**
- Create: `oslc-browser/src/components/ExplorerTab.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/ExplorerTab.tsx`:
```tsx
import { useMemo } from 'react';
import { Box, Typography } from '@mui/material';
import type { LoadedResource } from '../models/types.js';

interface ExplorerTabProps {
  resource: LoadedResource;
  onNodeClick: (uri: string) => void;
}

interface GraphNode {
  uri: string;
  label: string;
  x: number;
  y: number;
  isCenter: boolean;
}

interface GraphEdge {
  source: GraphNode;
  target: GraphNode;
  label: string;
}

function computeLayout(resource: LoadedResource, width: number, height: number): { nodes: GraphNode[]; edges: GraphEdge[] } {
  const cx = width / 2;
  const cy = height / 2;

  const centerNode: GraphNode = {
    uri: resource.uri,
    label: resource.title,
    x: cx,
    y: cy,
    isCenter: true,
  };

  // Deduplicate targets by URI
  const uniqueLinks = new Map<string, { label: string; targetTitle: string }>();
  for (const link of resource.links) {
    if (!uniqueLinks.has(link.targetURI)) {
      uniqueLinks.set(link.targetURI, {
        label: link.predicateLabel,
        targetTitle: link.targetTitle ?? link.targetURI.split('/').pop() ?? link.targetURI,
      });
    }
  }

  const count = uniqueLinks.size;
  const radius = Math.min(width, height) * 0.35;
  const nodes: GraphNode[] = [centerNode];
  const edges: GraphEdge[] = [];

  let i = 0;
  for (const [uri, info] of uniqueLinks) {
    const angle = (2 * Math.PI * i) / count - Math.PI / 2;
    const targetNode: GraphNode = {
      uri,
      label: info.targetTitle,
      x: cx + radius * Math.cos(angle),
      y: cy + radius * Math.sin(angle),
      isCenter: false,
    };
    nodes.push(targetNode);
    edges.push({ source: centerNode, target: targetNode, label: info.label });
    i++;
  }

  return { nodes, edges };
}

const NODE_WIDTH = 140;
const NODE_HEIGHT = 32;
const ARROW_SIZE = 6;

export function ExplorerTabComponent({ resource, onNodeClick }: ExplorerTabProps) {
  const width = 800;
  const height = 500;

  const { nodes, edges } = useMemo(
    () => computeLayout(resource, width, height),
    [resource, width, height]
  );

  if (resource.links.length === 0) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary" fontSize={13}>No outgoing links to visualize</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ overflow: 'auto', height: '100%' }}>
      <svg width={width} height={height} style={{ display: 'block', margin: '0 auto' }}>
        <defs>
          <marker id="arrowhead" markerWidth={ARROW_SIZE} markerHeight={ARROW_SIZE} refX={ARROW_SIZE} refY={ARROW_SIZE / 2} orient="auto">
            <polygon points={`0 0, ${ARROW_SIZE} ${ARROW_SIZE / 2}, 0 ${ARROW_SIZE}`} fill="#999" />
          </marker>
        </defs>

        {/* Edges */}
        {edges.map((edge, i) => {
          const dx = edge.target.x - edge.source.x;
          const dy = edge.target.y - edge.source.y;
          const len = Math.sqrt(dx * dx + dy * dy);
          if (len === 0) return null;

          // Shorten line to stop at node border
          const nx = dx / len;
          const ny = dy / len;
          const x1 = edge.source.x + nx * (NODE_WIDTH / 2);
          const y1 = edge.source.y + ny * (NODE_HEIGHT / 2);
          const x2 = edge.target.x - nx * (NODE_WIDTH / 2 + ARROW_SIZE);
          const y2 = edge.target.y - ny * (NODE_HEIGHT / 2 + ARROW_SIZE);
          const mx = (x1 + x2) / 2;
          const my = (y1 + y2) / 2;

          return (
            <g key={`edge-${i}`}>
              <line x1={x1} y1={y1} x2={x2} y2={y2} stroke="#999" strokeWidth={1} markerEnd="url(#arrowhead)" />
              <text x={mx} y={my - 4} textAnchor="middle" fontSize={10} fill="#666">{edge.label}</text>
            </g>
          );
        })}

        {/* Nodes */}
        {nodes.map(node => (
          <g
            key={node.uri}
            transform={`translate(${node.x - NODE_WIDTH / 2}, ${node.y - NODE_HEIGHT / 2})`}
            onClick={() => onNodeClick(node.uri)}
            style={{ cursor: 'pointer' }}
          >
            <title>{node.uri}</title>
            <rect
              width={NODE_WIDTH}
              height={NODE_HEIGHT}
              rx={4}
              fill={node.isCenter ? '#1976d2' : '#fff'}
              stroke={node.isCenter ? '#1565c0' : '#bbb'}
              strokeWidth={1}
            />
            <text
              x={NODE_WIDTH / 2}
              y={NODE_HEIGHT / 2 + 4}
              textAnchor="middle"
              fontSize={11}
              fill={node.isCenter ? '#fff' : '#333'}
            >
              {node.label.length > 20 ? node.label.substring(0, 18) + '...' : node.label}
            </text>
          </g>
        ))}
      </svg>
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/ExplorerTab.tsx
git commit -m "feat: add ExplorerTab component with SVG radial graph"
```

---

### Task 12: DetailsPanel component

Create the tabbed details panel that holds the PropertiesTab and ExplorerTab.

**Files:**
- Create: `oslc-browser/src/components/DetailsPanel.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/DetailsPanel.tsx`:
```tsx
import { useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import { PropertiesTabComponent } from './PropertiesTab.js';
import { ExplorerTabComponent } from './ExplorerTab.js';
import type { LoadedResource } from '../models/types.js';

interface DetailsPanelProps {
  resource: LoadedResource | null;
  onLinkClick: (uri: string) => void;
}

export function DetailsPanelComponent({ resource, onLinkClick }: DetailsPanelProps) {
  const [tab, setTab] = useState(0);

  if (!resource) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary" fontSize={13}>Select a resource to view details</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}>
        <Tab label="Properties" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />
        <Tab label="Explorer" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />
      </Tabs>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {tab === 0 && <PropertiesTabComponent resource={resource} onLinkClick={onLinkClick} />}
        {tab === 1 && <ExplorerTabComponent resource={resource} onNodeClick={onLinkClick} />}
      </Box>
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/DetailsPanel.tsx
git commit -m "feat: add DetailsPanel component with Properties and Explorer tabs"
```

---

### Task 13: MainLayout component

Create the main layout that arranges FavoritesPanel, ColumnView, and DetailsPanel.

**Files:**
- Create: `oslc-browser/src/components/MainLayout.tsx`

**Step 1: Implement the component**

`oslc-browser/src/components/MainLayout.tsx`:
```tsx
import { Box } from '@mui/material';
import { ColumnViewComponent } from './ColumnView.js';
import { FavoritesPanelComponent } from './FavoritesPanel.js';
import { DetailsPanelComponent } from './DetailsPanel.js';
import type { NavigationColumn, ColumnItem, LoadedResource, FavoriteItem } from '../models/types.js';

interface MainLayoutProps {
  columns: NavigationColumn[];
  selectedResource: LoadedResource | null;
  favorites: FavoriteItem[];
  onColumnItemClick: (columnIndex: number, item: ColumnItem) => void;
  onColumnItemContextMenu: (event: React.MouseEvent, item: ColumnItem) => void;
  onLinkClick: (uri: string) => void;
  onNavigateToFavorite: (uri: string) => void;
  onAddFolder: (name: string, parentId?: string) => void;
  onAddResource: (name: string, uri: string, parentId?: string) => void;
  onRemoveFavorite: (id: string) => void;
  onRenameFavorite: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
}

export function MainLayoutComponent({
  columns,
  selectedResource,
  favorites,
  onColumnItemClick,
  onColumnItemContextMenu,
  onLinkClick,
  onNavigateToFavorite,
  onAddFolder,
  onAddResource,
  onRemoveFavorite,
  onRenameFavorite,
  onToggleFolder,
}: MainLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
      {/* Top: Favorites + Columns */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', minHeight: 0 }}>
        <FavoritesPanelComponent
          favorites={favorites}
          onAddFolder={onAddFolder}
          onAddResource={onAddResource}
          onRemoveItem={onRemoveFavorite}
          onRenameItem={onRenameFavorite}
          onToggleFolder={onToggleFolder}
          onNavigateToResource={onNavigateToFavorite}
        />
        <ColumnViewComponent
          columns={columns}
          onItemClick={onColumnItemClick}
          onItemContextMenu={onColumnItemContextMenu}
        />
      </Box>

      {/* Bottom: Details panel */}
      <Box sx={{ height: 280, minHeight: 200, borderTop: 1, borderColor: 'divider' }}>
        <DetailsPanelComponent
          resource={selectedResource}
          onLinkClick={onLinkClick}
        />
      </Box>
    </Box>
  );
}
```

**Step 2: Commit**

```bash
git add oslc-browser/src/components/MainLayout.tsx
git commit -m "feat: add MainLayout component arranging favorites, columns, and details"
```

---

### Task 14: App component (wire everything together)

Rewrite the root App component to compose all hooks and components.

**Files:**
- Create: `oslc-browser/src/App.tsx`
- Modify: `oslc-browser/src/index.css`

**Step 1: Write App.tsx**

`oslc-browser/src/App.tsx`:
```tsx
import { useCallback, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Menu, MenuItem } from '@mui/material';
import { ToolbarComponent } from './components/Toolbar.js';
import { MainLayoutComponent } from './components/MainLayout.js';
import { useOslcClient } from './hooks/useOslcClient.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useFavorites } from './hooks/useFavorites.js';
import type { ColumnItem } from './models/types.js';

const theme = createTheme({
  typography: {
    fontSize: 13,
  },
});

function App() {
  const { connection, setServerURL, setUsername, setPassword, connect, fetchResource } = useOslcClient();
  const { state: navState, navigateToRoot, navigateToItem } = useNavigation();
  const {
    favorites, addFolder, addResource, removeItem, rename, toggleFolder,
  } = useFavorites();

  // Context menu state for "Add to Favorites"
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; item: ColumnItem } | null>(null);

  const handleConnect = useCallback(async () => {
    const resource = await connect();
    if (resource) navigateToRoot(resource);
  }, [connect, navigateToRoot]);

  const handleColumnItemClick = useCallback(async (columnIndex: number, item: ColumnItem) => {
    await navigateToItem(columnIndex, item.uri, fetchResource);
  }, [navigateToItem, fetchResource]);

  const handleLinkClick = useCallback(async (uri: string) => {
    const resource = await fetchResource(uri);
    if (resource) navigateToRoot(resource);
  }, [fetchResource, navigateToRoot]);

  const handleNavigateToFavorite = useCallback(async (uri: string) => {
    const resource = await fetchResource(uri);
    if (resource) navigateToRoot(resource);
  }, [fetchResource, navigateToRoot]);

  const handleBreadcrumbClick = useCallback(async (columnIndex: number) => {
    const col = navState.columns[columnIndex];
    if (col) {
      const resource = await fetchResource(col.uri);
      if (resource) navigateToRoot(resource);
    }
  }, [navState.columns, fetchResource, navigateToRoot]);

  const handleItemContextMenu = useCallback((event: React.MouseEvent, item: ColumnItem) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, item });
  }, []);

  const handleCloseContextMenu = () => setContextMenu(null);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <ToolbarComponent
          connection={connection}
          columns={navState.columns}
          onServerURLChange={setServerURL}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onConnect={handleConnect}
          onBreadcrumbClick={handleBreadcrumbClick}
        />
        <MainLayoutComponent
          columns={navState.columns}
          selectedResource={navState.selectedResource}
          favorites={favorites}
          onColumnItemClick={handleColumnItemClick}
          onColumnItemContextMenu={handleItemContextMenu}
          onLinkClick={handleLinkClick}
          onNavigateToFavorite={handleNavigateToFavorite}
          onAddFolder={addFolder}
          onAddResource={addResource}
          onRemoveFavorite={removeItem}
          onRenameFavorite={rename}
          onToggleFolder={toggleFolder}
        />
      </div>

      {/* Column item context menu -- Add to Favorites */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => {
          if (contextMenu) addResource(contextMenu.item.title, contextMenu.item.uri);
          handleCloseContextMenu();
        }}>
          Add to Favorites
        </MenuItem>
      </Menu>
    </ThemeProvider>
  );
}

export default App;
```

**Step 2: Update index.css**

`oslc-browser/src/index.css`:
```css
html, body, #root {
  margin: 0;
  padding: 0;
  height: 100%;
  overflow: hidden;
}
```

**Step 3: Commit**

```bash
git add oslc-browser/src/App.tsx oslc-browser/src/index.css
git commit -m "feat: wire up App component with all hooks and components"
```

---

### Task 15: Build and verify

Build the project to verify TypeScript compilation and fix any errors.

**Step 1: Build**

```bash
cd oslc-browser && npm run build
```

Expected: clean build with no TypeScript errors.

**Step 2: Fix any compilation errors**

If there are TypeScript errors, fix them one at a time. Common issues:
- Missing imports
- Type mismatches in oslc-client declarations
- Strict mode violations (unused vars, etc.)

**Step 3: Run dev server and smoke test**

```bash
npm run dev
```

Verify in the browser:
- App renders with toolbar, empty favorites panel, empty column area, and empty details panel
- Can enter a server URL and click Connect
- If oslc-server is running, resources load into columns

**Step 4: Commit any fixes**

```bash
git add -A oslc-browser/
git commit -m "fix: resolve build issues in oslc-browser"
```

---

### Task 16: Update main.tsx entry point

Ensure the entry point is clean and matches the new structure.

**Files:**
- Modify: `oslc-browser/src/main.tsx`

**Step 1: Verify main.tsx**

The existing `main.tsx` should already work since it imports `App` from `./App.tsx`. Verify it still matches:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
```

No changes needed if it already matches.

**Step 2: Final build verification**

```bash
cd oslc-browser && npm run build
```

**Step 3: Commit if any changes**

```bash
git add oslc-browser/
git commit -m "chore: final build verification for oslc-browser"
```
