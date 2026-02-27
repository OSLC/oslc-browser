# OSLC Browser Design

## Overview

Rewrite oslc-browser as a TypeScript React SPA with column-based navigation for browsing any OSLC 2.0/3.0 server. Uses oslc-client for authentication and resource fetching. Includes a favorites panel with folder support and a details panel with properties table and SVG explorer graph.

The browser treats all resources generically -- it follows outgoing RDF links without special-casing any resource type. A user can enter any URL (rootservices, a ServiceProviderCatalog, an individual resource) and navigate from there.

## Decisions

- **Platform:** Static React SPA built with Vite, deployed as static files
- **Server target:** Any OSLC 2.0/3.0 server, using oslc-client for auth
- **UI library:** MUI (Material UI) with Emotion styling
- **State management:** React Context + useReducer, no external state library
- **Persistence:** Browser localStorage for favorites and connection settings
- **Links:** Outgoing links only (no incoming link support)
- **CORS:** Relies on server CORS headers; no proxy in this phase

## Component Architecture

```
App
├── Toolbar
│   ├── Server URL input + Connect button
│   ├── Auth credentials (user/password)
│   └── Breadcrumb showing current navigation path
├── MainLayout (horizontal split)
│   ├── FavoritesPanel (left sidebar, resizable)
│   │   ├── Toolbar (add folder, add resource)
│   │   └── FavoritesTree (recursive MUI TreeView)
│   │       ├── FolderItem (expandable, draggable)
│   │       └── ResourceItem (clickable, draggable)
│   └── ColumnView (horizontal scroll area)
│       └── ResourceColumn[] (one per navigation step)
│           └── ResourceListItem[] (clickable, shows title + type)
└── DetailsPanel (bottom panel, resizable)
    ├── PropertiesTab (table of property name/value pairs)
    └── ExplorerTab (SVG graph of resource relationships)
```

## Navigation & Data Flow

Navigation is generic RDF link-following:

1. User enters any URL and connects with credentials
2. oslc-client fetches the resource, parses the RDF
3. Column 0 shows the resource's outgoing links grouped by predicate
4. Clicking a link fetches that target resource, shows its links in the next column
5. Clicking in an earlier column clears all subsequent columns
6. Navigation continues indefinitely -- every resource is treated the same way

### Navigation State

```typescript
interface NavigationColumn {
  uri: string;
  title: string;
  items: ColumnItem[];
  loading: boolean;
  error?: string;
}

interface ColumnItem {
  uri: string;
  title: string;
  type: 'resource' | 'link';
  selected: boolean;
  resourceTypes?: string[];
  predicate?: string;
}
```

Column contents for any resource show outgoing links grouped by predicate. Items that are URIs are clickable and navigate to the next column. Literal values are displayed in the DetailsPanel properties tab.

Selecting a resource populates the DetailsPanel with its full properties and links.

## Favorites

### Data Model

```typescript
interface FavoriteItem {
  id: string;
  name: string;
  type: 'folder' | 'resource';
  uri?: string;
  children?: FavoriteItem[];
  expanded?: boolean;
}
```

### Behavior

- Single workspace (no workspace management UI)
- Folders can nest arbitrarily deep
- Add favorite: right-click a resource in any column, choose "Add to Favorites"
- Click a resource favorite to navigate to it (populates column 0)
- Context menu: Rename, Delete, Move to folder
- MUI TreeView for rendering
- Persisted to localStorage as JSON

### Not included

- No multiple workspaces
- No drag-and-drop reordering
- No configuration management context

## Explorer View (Details Panel)

### Explorer Tab (SVG Graph)

Shows the selected resource as a simple SVG graph:

- Center node: selected resource (title + URI)
- Surrounding nodes: immediate outgoing link targets, arranged radially
- Edges: labeled with predicate local name
- Click a target node to navigate to it
- Hover for full URI tooltip
- No drag, zoom, pinning, or saved layouts

Implementation: pure SVG rendered by React with a simple radial layout algorithm. No D3 or external graph library.

### Properties Tab

- MUI Table of all literal properties as name/value rows
- Property names shown as local names with full URI in tooltip
- Link properties shown separately below as clickable URIs

## Authentication & Connection

- Toolbar has: server URL, username, password, Connect button
- On Connect, creates oslc-client instance with credentials
- oslc-client handles auth negotiation (JEE Forms, OAuth, Basic)
- On success, fetches the resource at the entered URL
- Connection state shown in toolbar (connected/disconnected)
- Credentials and server URL optionally persisted in localStorage
- Auth failures shown as error message below toolbar
- Network errors shown inline in the column that failed
- One server connection at a time

## File Structure

```
oslc-browser/
├── src/
│   ├── components/
│   │   ├── Toolbar.tsx
│   │   ├── MainLayout.tsx
│   │   ├── FavoritesPanel.tsx
│   │   ├── ColumnView.tsx
│   │   ├── ResourceColumn.tsx
│   │   ├── DetailsPanel.tsx
│   │   ├── PropertiesTab.tsx
│   │   └── ExplorerTab.tsx
│   ├── hooks/
│   │   ├── useOslcClient.ts
│   │   ├── useNavigation.ts
│   │   └── useFavorites.ts
│   ├── models/
│   │   └── types.ts
│   ├── App.tsx
│   ├── App.css
│   ├── main.tsx
│   └── index.css
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
└── vite.config.ts
```

## Build & Dependencies

Keep existing Vite + TypeScript setup.

**Dependencies:** react, react-dom, @mui/material, @mui/icons-material, @emotion/react, @emotion/styled, oslc-client (file:../oslc-client)

**Removed:** react-window (not needed)

## Out of Scope

- Incoming links
- OSLC query / selection dialogs
- Configuration management
- Multiple workspaces
- Saved explorer layouts
- CORS proxy
- Resource creation/update/delete via UI
- Drag-and-drop reordering in favorites
