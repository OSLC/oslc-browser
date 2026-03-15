# OSLC Browser Component Library Design

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor oslc-browser from a standalone SPA into a reusable Vite library mode React component library, consumed by three thin app shells: an Electron desktop client, oslc-server's web UI, and mrm-server's extensible web UI.

**Architecture:** oslc-browser exports components, hooks, and types as an ESM library. Each consumer is a thin app shell that imports and composes library pieces. Extension is done via React props and composition, not a plugin system.

**Tech Stack:** React, Vite (library mode), TypeScript, MUI, Electron, oslc-client

---

## 1. Package Structure

### 1.1 oslc-browser (Library)

oslc-browser becomes a Vite library package. It has no `App.tsx` entry point or `main.tsx` — it is purely a library of components, hooks, and types.

```
oslc-browser/
├── src/
│   ├── index.ts                ← barrel export (all components, hooks, types)
│   ├── components/
│   │   ├── Toolbar.tsx
│   │   ├── MainLayout.tsx
│   │   ├── ColumnView.tsx
│   │   ├── ResourceColumn.tsx
│   │   ├── DetailsPanel.tsx
│   │   ├── FavoritesPanel.tsx
│   │   ├── DiagramTab.tsx
│   │   ├── DiagramCanvas.tsx
│   │   ├── DiagramShape.tsx
│   │   ├── DiagramEdge.tsx
│   │   ├── DiagramToolbar.tsx
│   │   ├── PropertiesTab.tsx
│   │   ├── ExplorerTab.tsx
│   │   └── OslcBrowserApp.tsx  ← convenience "full app" component
│   ├── hooks/
│   │   ├── useOslcClient.ts
│   │   ├── useNavigation.ts
│   │   ├── useFavorites.ts
│   │   ├── useDiagramData.ts
│   │   └── diagramGenerator.ts
│   └── models/
│       ├── types.ts
│       └── diagram-types.ts
├── vite.config.ts              ← library mode config (ESM output)
├── package.json                ← peerDeps: react, react-dom, @mui/material,
│                                  @mui/icons-material, oslc-client
└── tsconfig.json
```

**Key decisions:**
- The existing `App.tsx` logic moves into `OslcBrowserApp.tsx` as a convenience component that wires all hooks and components together. Consumers can render `<OslcBrowserApp />` for the full default experience, or compose individual components for custom layouts.
- `main.tsx`, `index.html`, and the Vite app config are removed from the library — each consumer provides its own.

### 1.2 oslc-browser/app/ (Electron Desktop Client)

A thin Electron shell that renders `<OslcBrowserApp />` in a native macOS window.

```
oslc-browser/app/
├── src/
│   ├── main.ts             ← Electron main process (BrowserWindow creation)
│   ├── preload.ts           ← Electron preload script
│   └── renderer/
│       ├── main.tsx         ← React entry, renders <OslcBrowserApp />
│       └── index.html
├── package.json             ← deps: oslc-browser (file:..), oslc-client (file:),
│                               electron, react, @mui/*
└── vite.config.ts           ← electron-vite or vite + electron plugin
```

### 1.3 oslc-server/ui/ (Generic OSLC Web Client)

A thin Vite app shell served by oslc-server. Used for developing and debugging generic OSLC browser components.

```
oslc-server/
├── src/app.ts               ← existing Express server (already serves from public/)
├── ui/
│   ├── src/
│   │   ├── main.tsx          ← React entry point
│   │   └── App.tsx           ← imports and renders <OslcBrowserApp />
│   ├── index.html
│   ├── vite.config.ts        ← standard Vite app config, builds to ../public/
│   └── package.json          ← deps: oslc-browser (file:), oslc-client (file:),
│                                 react, @mui/*
├── public/                   ← build output served by express.static (already exists)
└── package.json
```

### 1.4 mrm-server/ui/ (MRM-Extended Web Client)

Same pattern as oslc-server/ui, but with MRM-specific components and extensions.

```
mrm-server/
├── src/app.ts               ← existing Express server
├── ui/
│   ├── src/
│   │   ├── main.tsx
│   │   ├── App.tsx           ← imports <OslcBrowserApp /> + MRM extensions
│   │   └── components/       ← MRM-specific components (added later)
│   ├── index.html
│   ├── vite.config.ts
│   └── package.json
├── public/                   ← build output
└── package.json
```

---

## 2. Library Exports

### 2.1 Components

All existing components are exported from `src/index.ts`:

| Component | Purpose |
|-----------|---------|
| `OslcBrowserApp` | Convenience "full app" component — wires all hooks and sub-components |
| `Toolbar` | Server URL, credentials, connect button |
| `MainLayout` | Three-panel layout (favorites, columns, details) with draggable divider |
| `ColumnView` | Scrollable column container |
| `ResourceColumn` | Accordion-based resource navigation column |
| `DetailsPanel` | Tabbed panel (Properties, Explorer, Diagram) |
| `FavoritesPanel` | Saved resources and folders |
| `DiagramTab` | Diagram visualization tab |
| `DiagramCanvas` | SVG diagram renderer |
| `DiagramShape` | Individual diagram shape with text ellipsis |
| `DiagramEdge` | SVG edge/connector between diagram shapes |
| `DiagramToolbar` | Diagram zoom/pan controls |
| `PropertiesTab` | Resource property display |
| `ExplorerTab` | Alternative resource view |

### 2.2 Hooks

| Hook | Purpose |
|------|---------|
| `useOslcClient` | Connection management, resource fetching, authentication |
| `useNavigation` | Multi-column accordion navigation state |
| `useFavorites` | Favorites persistence (localStorage) |
| `useDiagramData` | Diagram state from RDF (StoreNode-based, no OSLCResource) |
| `diagramGenerator` | Turtle generation for DD diagrams |

### 2.3 Types

All interfaces from `models/types.ts` and `models/diagram-types.ts`:

- `LoadedResource`, `ResourceProperty`, `ResourceLink`
- `NavigationColumn`, `ColumnResource`, `PredicateItem`
- `ConnectionState`, `FavoriteItem`
- `ColumnItem`, `OslcBrowserAppProps` (new extension interfaces)
- `ExtraTab`, `ExtraMenuItem` (new extension interfaces)
- Utility functions: `localName`
- Diagram types: `DDDiagram`, `DDShape`, `DDEdge`, etc.

### 2.4 Barrel File (src/index.ts)

```typescript
// Components — re-exported with short names (dropping Component suffix)
export { OslcBrowserAppComponent as OslcBrowserApp } from './components/OslcBrowserApp';
export { ToolbarComponent as Toolbar } from './components/Toolbar';
export { MainLayoutComponent as MainLayout } from './components/MainLayout';
export { ColumnViewComponent as ColumnView } from './components/ColumnView';
export { ResourceColumnComponent as ResourceColumn } from './components/ResourceColumn';
export { DetailsPanelComponent as DetailsPanel } from './components/DetailsPanel';
export { FavoritesPanelComponent as FavoritesPanel } from './components/FavoritesPanel';
export { DiagramTabComponent as DiagramTab } from './components/DiagramTab';
export { DiagramCanvasComponent as DiagramCanvas } from './components/DiagramCanvas';
export { DiagramShapeComponent as DiagramShape } from './components/DiagramShape';
export { DiagramEdgeComponent as DiagramEdge } from './components/DiagramEdge';
export { DiagramToolbarComponent as DiagramToolbar } from './components/DiagramToolbar';
export { PropertiesTabComponent as PropertiesTab } from './components/PropertiesTab';
export { ExplorerTabComponent as ExplorerTab } from './components/ExplorerTab';

// Hooks
export { useOslcClient } from './hooks/useOslcClient';
export { useNavigation } from './hooks/useNavigation';
export { useFavorites } from './hooks/useFavorites';
export { useDiagramData } from './hooks/useDiagramData';
export { traverseLinks, generateDiagramTurtle } from './hooks/diagramGenerator';

// Types
export type {
  LoadedResource, ResourceProperty, ResourceLink,
  NavigationColumn, NavigationState, ColumnResource, PredicateItem, ColumnItem,
  ConnectionState, FavoriteItem,
  ExtraTab, ExtraMenuItem, OslcBrowserAppProps,
} from './models/types';
export { localName } from './models/types';
export type * from './models/diagram-types';
```

Note: The `DiagramFactory` interface (currently in App.tsx) is intentionally internal to `OslcBrowserApp` — it is an implementation detail of the built-in context menu. The duplicate `localName` function in `diagram-types.ts` should be consolidated to the single export from `types.ts` during migration.

### 2.5 OslcBrowserApp Props Interface

```typescript
export interface OslcBrowserAppProps {
  /** Optional MUI theme. If omitted, uses a default dark theme. */
  theme?: Theme;
  /** Additional tabs to show in DetailsPanel after the built-in tabs. */
  extraTabs?: ExtraTab[];
  /** Additional context menu items appended after built-in items
   *  (Add to Favorites, Create Diagram). */
  extraMenuItems?: ExtraMenuItem[];
}
```

`OslcBrowserApp` internally creates all hooks (`useOslcClient`, `useNavigation`, `useFavorites`), manages context menus (including built-in diagram factory discovery), and passes `extraTabs`/`extraMenuItems` through to the relevant child components. The consumer does not need to access internals — if a consumer needs deeper control, they compose the individual components and hooks directly instead of using `OslcBrowserApp`.

**Theme ownership:** `OslcBrowserApp` wraps its content in a `<ThemeProvider>`. If the consumer passes a `theme` prop, that theme is used. Otherwise, the current default dark theme is used. Consumers who want full theme control can skip `OslcBrowserApp` and wrap the individual components in their own `<ThemeProvider>`.

---

## 3. Build Pipeline

### 3.1 oslc-browser Library Build

Vite library mode configuration:

```typescript
// oslc-browser/vite.config.ts
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true }),  // generates dist/index.d.ts
  ],
  build: {
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'oslc-browser',
    },
    rollupOptions: {
      external: [
        'react', 'react-dom', 'react/jsx-runtime',
        '@mui/material', '@mui/icons-material', '@emotion/react', '@emotion/styled',
        'oslc-client', 'rdflib',
      ],
    },
  },
});
```

**package.json fields:**

```json
{
  "type": "module",
  "main": "dist/oslc-browser.js",
  "module": "dist/oslc-browser.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/oslc-browser.js",
      "types": "./dist/index.d.ts"
    }
  },
  "peerDependencies": {
    "react": "^19.0.0",
    "react-dom": "^19.0.0",
    "@mui/material": "^7.0.0",
    "@mui/icons-material": "^7.0.0",
    "@emotion/react": "^11.0.0",
    "@emotion/styled": "^11.0.0",
    "oslc-client": "*",
    "rdflib": "^2.0.0"
  },
  "devDependencies": {
    "vite": "^7.0.0",
    "@vitejs/plugin-react": "^4.0.0",
    "vite-plugin-dts": "^4.0.0",
    "typescript": "^5.7.0"
  }
}
```

**Build command:** `npx vite build` (vite-plugin-dts handles declaration generation)

### 3.2 Server UI Builds

Each server's `ui/` uses a standard Vite app config:

```typescript
// oslc-server/ui/vite.config.ts
// Note: oslc-server uses port from its own config.json (default 3001)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/oslc': 'http://localhost:3001',
      '/resource': 'http://localhost:3001',
      '/compact': 'http://localhost:3001',
      '/sparql': 'http://localhost:3001',
      '/dialog': 'http://localhost:3001',
    },
  },
});
```

```typescript
// mrm-server/ui/vite.config.ts
// Note: mrm-server uses port from its own config.json (default 3002)
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    outDir: '../public',
    emptyOutDir: true,
  },
  server: {
    proxy: {
      '/oslc': 'http://localhost:3002',
      '/resource': 'http://localhost:3002',
      '/compact': 'http://localhost:3002',
      '/sparql': 'http://localhost:3002',
      '/dialog': 'http://localhost:3002',
    },
  },
});
```

Each server's proxy port must match its own backend port from `config.json`.

**Build command:** `npx vite build`
**Dev command:** `npx vite` (runs dev server with HMR, proxies API to backend)

### 3.3 Build Order

```
storage-service → ldp-service → oslc-service → oslc-client
                                                    ↓
                                              oslc-browser (library)
                                              /          \
                                   oslc-server/ui    mrm-server/ui
                                   oslc-browser/app
```

oslc-browser must be built before any consumer.

---

## 4. Extensibility Architecture

Extension is done via React props and composition. No plugin system, no registry.

### 4.1 Extra Tabs

DetailsPanel accepts optional `extraTabs`:

```typescript
export interface ExtraTab {
  label: string;
  render: (resource: LoadedResource) => React.ReactNode;
}

// In DetailsPanel component
interface DetailsPanelProps {
  // ... existing props
  extraTabs?: ExtraTab[];
}
```

### 4.2 Extra Context Menu Items

Resource context menus accept optional `extraMenuItems`:

```typescript
export interface ExtraMenuItem {
  label: string;
  onClick: (resource: LoadedResource) => void;
  visible?: (resource: LoadedResource) => boolean;
}
```

Extra menu items are appended after the built-in items ("Add to Favorites", dynamic diagram creation factories). The built-in context menu logic (including diagram factory discovery via `getClient()` and `fetchRawResource()`) remains inside `OslcBrowserApp`. Consumers who need access to the OSLC client instance for their menu actions can use the exported `useOslcClient` hook when composing individual components directly.

### 4.3 Layout Composition

Consumers wrap `<OslcBrowserApp />` with additional UI:

```typescript
// mrm-server/ui/src/App.tsx
import { OslcBrowserApp } from 'oslc-browser';
import { MrmSidebar } from './components/MrmSidebar';

function App() {
  return (
    <div style={{ display: 'flex' }}>
      <MrmSidebar />
      <OslcBrowserApp
        extraTabs={mrmTabs}
        extraMenuItems={mrmActions}
      />
    </div>
  );
}
```

### 4.4 Future Extension Points

More props can be added to library components as needed. The pattern is always the same: optional prop on the component, consumer passes MRM-specific implementation. No extension points are added until needed (YAGNI).

---

## 5. Dependencies

### 5.1 oslc-browser (library)

**peerDependencies** (consumer provides):
- react, react-dom
- @mui/material, @mui/icons-material, @emotion/react, @emotion/styled
- oslc-client, rdflib

**devDependencies** (build-time only):
- vite, @vitejs/plugin-react, vite-plugin-dts
- typescript
- All peer deps (for development/testing)

### 5.2 Each server's ui/ and oslc-browser/app/

**dependencies:**
- `oslc-browser`: `file:../../oslc-browser` (or `file:..` for app/)
- `oslc-client`: `file:../../oslc-client`
- react, react-dom
- @mui/material, @mui/icons-material, @emotion/react, @emotion/styled

**devDependencies:**
- vite, @vitejs/plugin-react, typescript
- electron (for app/ only)

---

## 6. Server-Side Changes

### 6.1 oslc-server

No changes needed to `src/app.ts`. It already serves static files from `public/` via `express.static`. The UI build output goes directly into `public/`.

One potential addition: a catch-all route for SPA client-side routing, if the browser app uses React Router in the future:

```typescript
// Optional: SPA fallback
app.get('*', (req, res) => {
  res.sendFile(join(__dirname, '..', 'public', 'index.html'));
});
```

Not needed now — the current oslc-browser is a single-page app without client-side routing.

### 6.2 mrm-server

Same as oslc-server — no changes needed. Already serves from `public/`.

---

## 7. Migration Plan

### 7.1 Files to Remove from oslc-browser

- `src/App.tsx` — logic moves to `src/components/OslcBrowserApp.tsx`
- `src/main.tsx` — each consumer provides its own
- `index.html` — each consumer provides its own
- `tsconfig.app.json`, `tsconfig.node.json` — consolidated into single `tsconfig.json`
- `public/` directory (favicon, images) — consumers provide their own static assets

### 7.2 Files to Add to oslc-browser

- `src/index.ts` — barrel export
- `src/components/OslcBrowserApp.tsx` — convenience component (refactored from App.tsx)
- `vite.config.ts` — replaced with library mode config
- `app/` — Electron desktop client (new subfolder)

### 7.3 Implementation Phases

**Phase 1: Library extraction** — Refactor oslc-browser into library mode. Create `OslcBrowserApp.tsx` from existing `App.tsx`. Add barrel exports. Update vite.config.ts to library mode. Add vite-plugin-dts.

**Phase 2: oslc-server/ui** — Create thin app shell in oslc-server/ui/ that imports and renders `<OslcBrowserApp />`. Verify it builds and serves correctly.

**Phase 3: mrm-server/ui** — Create thin app shell in mrm-server/ui/ with extensibility props. Verify build and serving.

**Phase 4: Electron app** — Create oslc-browser/app/ with Electron shell. Verify desktop client works.

Each phase produces a working, testable result before proceeding to the next.
