# OSLC Browser Component Library Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Refactor oslc-browser from a standalone SPA into a Vite library mode React component library, consumed by three thin app shells (Electron, oslc-server/ui, mrm-server/ui).

**Architecture:** oslc-browser exports all components, hooks, and types via a barrel file and builds with Vite library mode. Each consumer is a thin Vite app that imports from the library. Extension is via React props (`extraTabs`, `extraMenuItems`, `theme`).

**Tech Stack:** React 19, Vite 7 (library mode), TypeScript 5.8, MUI 7, Electron, vite-plugin-dts, oslc-client, rdflib

**Spec:** `docs/superpowers/specs/2026-03-15-oslc-browser-library-design.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `oslc-browser/src/index.ts` | Barrel export — all components, hooks, types |
| `oslc-browser/src/components/OslcBrowserApp.tsx` | Convenience "full app" component (refactored from App.tsx) |
| `oslc-server/ui/src/main.tsx` | React entry point for oslc-server |
| `oslc-server/ui/src/App.tsx` | Thin shell rendering `<OslcBrowserApp />` |
| `oslc-server/ui/index.html` | HTML template |
| `oslc-server/ui/vite.config.ts` | Vite app config, builds to ../public/ |
| `oslc-server/ui/package.json` | Dependencies on oslc-browser + oslc-client |
| `oslc-server/ui/tsconfig.json` | TypeScript config |
| `mrm-server/ui/src/main.tsx` | React entry point for mrm-server |
| `mrm-server/ui/src/App.tsx` | Thin shell with extensibility props |
| `mrm-server/ui/index.html` | HTML template |
| `mrm-server/ui/vite.config.ts` | Vite app config, builds to ../public/ |
| `mrm-server/ui/package.json` | Dependencies |
| `mrm-server/ui/tsconfig.json` | TypeScript config |
| `oslc-browser/app/src/main.ts` | Electron main process |
| `oslc-browser/app/src/preload.ts` | Electron preload script |
| `oslc-browser/app/src/renderer/main.tsx` | React entry for Electron |
| `oslc-browser/app/src/renderer/index.html` | HTML template for Electron |
| `oslc-browser/app/vite.config.ts` | Vite config for Electron renderer |
| `oslc-browser/app/package.json` | Electron + oslc-browser deps |

### Files to Modify

| File | Change |
|------|--------|
| `oslc-browser/vite.config.ts` | Replace with library mode config |
| `oslc-browser/package.json` | Add main/module/types/exports, change deps to peerDeps |
| `oslc-browser/tsconfig.json` | Consolidate from tsconfig.app.json + tsconfig.node.json |
| `oslc-browser/src/models/types.ts` | Add ExtraTab, ExtraMenuItem, OslcBrowserAppProps interfaces |
| `oslc-browser/src/models/diagram-types.ts` | Remove duplicate localName function |

### Files to Delete

| File | Reason |
|------|--------|
| `oslc-browser/src/App.tsx` | Replaced by OslcBrowserApp.tsx |
| `oslc-browser/src/main.tsx` | Each consumer provides its own |
| `oslc-browser/index.html` | Each consumer provides its own |
| `oslc-browser/tsconfig.app.json` | Consolidated into tsconfig.json |
| `oslc-browser/tsconfig.node.json` | Consolidated into tsconfig.json |
| `oslc-browser/public/vite.svg` | Consumers provide their own assets |

---

## Chunk 1: Library Extraction

### Task 1: Add Extension Interfaces to types.ts

**Files:**
- Modify: `oslc-browser/src/models/types.ts`

- [ ] **Step 1: Add ExtraTab, ExtraMenuItem, and OslcBrowserAppProps interfaces**

Add at the end of `oslc-browser/src/models/types.ts`:

```typescript
import type { Theme } from '@mui/material';

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
```

- [ ] **Step 2: Verify TypeScript compiles**

Run: `cd oslc-browser && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd oslc-browser
git add src/models/types.ts
git commit -m "feat: add ExtraTab, ExtraMenuItem, OslcBrowserAppProps interfaces"
```

---

### Task 2: Remove Duplicate localName from diagram-types.ts

**Files:**
- Modify: `oslc-browser/src/models/diagram-types.ts`
- Modify: Any files importing `localName` from `diagram-types`

- [ ] **Step 1: Update imports in diagramGenerator.ts and useDiagramData.ts**

In `oslc-browser/src/hooks/diagramGenerator.ts`, change:
```typescript
import { localName } from '../models/diagram-types.js';
```
to:
```typescript
import { localName } from '../models/types.js';
```

In `oslc-browser/src/hooks/useDiagramData.ts`, remove `localName` from the `diagram-types.js` import and add a separate import:
```typescript
import { localName } from '../models/types.js';
import {
  DD_NS,
  isDDProperty,
  isDiagramType,
  // localName removed — now imported from types.js
  type DiagramBounds,
  ...
} from '../models/diagram-types.js';
```

In `oslc-browser/src/App.tsx` (still exists at this point), change:
```typescript
import { localName } from './models/diagram-types.js';
```
to:
```typescript
import { localName } from './models/types.js';
```

This keeps the code compiling between tasks. App.tsx will be replaced by OslcBrowserApp.tsx in Task 3.

- [ ] **Step 2: Remove localName from diagram-types.ts**

Delete the `localName` function from `oslc-browser/src/models/diagram-types.ts`. Keep only the diagram-specific exports (`DD_NS`, `isDDProperty`, `isDiagramType`, and all interfaces).

Note: `App.tsx` also imports `localName` from `diagram-types`, but `App.tsx` will be replaced by `OslcBrowserApp.tsx` in Task 3 which will import from `types.js` instead.

- [ ] **Step 3: Verify TypeScript compiles**

Run: `cd oslc-browser && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 4: Commit**

```bash
cd oslc-browser
git add -A
git commit -m "refactor: consolidate localName to single export in types.ts"
```

---

### Task 3: Create OslcBrowserApp Component

**Files:**
- Create: `oslc-browser/src/components/OslcBrowserApp.tsx`
- Delete: `oslc-browser/src/App.tsx` (after OslcBrowserApp is working)

- [ ] **Step 1: Create OslcBrowserApp.tsx**

Create `oslc-browser/src/components/OslcBrowserApp.tsx` with the following complete contents. This is a direct refactoring of `App.tsx` with these changes: named export, props interface, theme from props, extraTabs passed through, extraMenuItems appended to context menu.

```typescript
import { useCallback, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Divider, Menu, MenuItem } from '@mui/material';
import { Namespace, sym } from 'rdflib';
import type { OSLCResource } from 'oslc-client';
import { ToolbarComponent } from './Toolbar.js';
import { MainLayoutComponent } from './MainLayout.js';
import { useOslcClient } from '../hooks/useOslcClient.js';
import { useNavigation } from '../hooks/useNavigation.js';
import { useFavorites } from '../hooks/useFavorites.js';
import { traverseLinks, generateDiagramTurtle } from '../hooks/diagramGenerator.js';
import { localName } from '../models/types.js';
import type { LoadedResource, OslcBrowserAppProps } from '../models/types.js';

interface DiagramFactory {
  title: string;
  creationURI: string;
  shapeDescription: string;
}

const DD_DIAGRAM = 'http://www.omg.org/spec/DD#Diagram';
const oslcNS = Namespace('http://open-services.net/ns/core#');
const dctermsNS = Namespace('http://purl.org/dc/terms/');

const defaultTheme = createTheme({ typography: { fontSize: 13 } });

export function OslcBrowserAppComponent({
  theme,
  extraTabs,
  extraMenuItems,
}: OslcBrowserAppProps) {
  const { connection, setServerURL, setUsername, setPassword, connect, fetchResource, fetchRawResource, getClient } = useOslcClient();
  const { state: navState, navigateToRoot, navigateToItem, selectResource } = useNavigation();
  const {
    favorites, addFolder, addResource, removeItem, rename, toggleFolder,
  } = useFavorites();

  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; resource: LoadedResource } | null>(null);
  const [matchingFactories, setMatchingFactories] = useState<DiagramFactory[]>([]);
  const [diagramResource, setDiagramResource] = useState<OSLCResource | null>(null);

  const handleConnect = useCallback(async () => {
    const resource = await connect();
    if (resource) navigateToRoot(resource);
  }, [connect, navigateToRoot]);

  const handlePredicateClick = useCallback(async (columnIndex: number, resource: LoadedResource, predicate: string) => {
    await navigateToItem(columnIndex, resource, predicate, fetchResource);
  }, [navigateToItem, fetchResource]);

  const handleNavigateToResource = useCallback(async (uri: string) => {
    const resource = await fetchResource(uri);
    if (resource) navigateToRoot(resource);
  }, [fetchResource, navigateToRoot]);

  const handleResourceContextMenu = useCallback(async (event: React.MouseEvent, resource: LoadedResource) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, resource });
    setMatchingFactories([]);

    const client = getClient();
    if (!client) return;

    try {
      const rawResource = await client.getResource(resource.uri);
      if (!rawResource?.store) return;

      const store = rawResource.store;
      const resourceSym = store.sym(resource.uri);

      const spNode = store.the(resourceSym, oslcNS('serviceProvider'), null);
      let spURI = spNode?.value ?? '';

      if (!spURI && connection.serverURL) {
        const connURL = new URL(connection.serverURL);
        const segments = connURL.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
          spURI = `${connURL.origin}/${segments.slice(0, 2).join('/')}`;
        }
      }
      if (!spURI) return;

      const rdfType = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      const typeNodes = store.each(resourceSym, rdfType('type'), null);
      const typeNames: string[] = typeNodes.map((n: any) => localName(n.value)).filter(Boolean);
      if (typeNames.length === 0 && resource.resourceTypes) {
        for (const t of resource.resourceTypes) {
          const name = localName(t);
          if (name) typeNames.push(name);
        }
      }
      if (typeNames.length === 0) return;

      const spResource = await client.getResource(spURI);
      if (!spResource?.store) return;
      const spStore = spResource.store;

      const ddDiagramSym = sym(DD_DIAGRAM);
      const spSym = spStore.sym(spURI);
      const services = spStore.each(spSym, oslcNS('service'), null);

      const factories: DiagramFactory[] = [];

      for (const service of services) {
        const creationFactories = spStore.each(service, oslcNS('creationFactory'), null);

        for (const factory of creationFactories) {
          const hasDD = spStore.statementsMatching(factory, oslcNS('resourceType'), ddDiagramSym);
          if (hasDD.length === 0) continue;

          const titleNode = spStore.the(factory, dctermsNS('title'), null);
          const creationNode = spStore.the(factory, oslcNS('creation'), null);
          const shapeNode = spStore.the(factory, oslcNS('resourceShape'), null);

          const title = titleNode?.value ?? '';
          const creationURI = creationNode?.value ?? '';
          const shapeURI = shapeNode?.value ?? '';
          if (!title || !creationURI) continue;

          let shapeDescription = '';
          if (shapeURI) {
            try {
              const shapeDocURI = shapeURI.split('#')[0];
              const shapeResource = await client.getResource(shapeDocURI);
              if (shapeResource?.store) {
                const shapeSym = shapeResource.store.sym(shapeURI);
                const descNode = shapeResource.store.the(shapeSym, dctermsNS('description'), null);
                shapeDescription = descNode?.value ?? '';
              }
            } catch {
              // Shape may not be fetchable; skip
            }
          }
          factories.push({ title, creationURI, shapeDescription });
        }
      }

      const matching = factories.filter(f =>
        typeNames.some((name: string) => f.shapeDescription.includes(name))
      );
      setMatchingFactories(matching);
    } catch (err) {
      console.error('[ContextMenu] Error discovering diagram factories:', err);
    }
  }, [getClient, connection.serverURL]);

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setMatchingFactories([]);
  };

  const handleCreateDiagram = useCallback(async (factory: DiagramFactory) => {
    const resource = contextMenu?.resource;
    handleCloseContextMenu();
    if (!resource) return;

    const client = getClient();
    if (!client) return;

    try {
      const rawRes = await fetchRawResource(resource.uri);
      if (!rawRes) return;

      const traversal = await traverseLinks(client, rawRes, 2);
      const diagramTitle = `${resource.title} - ${factory.title}`;
      const turtle = generateDiagramTurtle(diagramTitle, traversal, '');

      const response = await fetch(factory.creationURI, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/turtle',
          'Accept': 'text/turtle',
          'OSLC-Core-Version': '3.0',
        },
        body: turtle,
      });

      if (response.ok) {
        const newDiagramURI = response.headers.get('Location');
        if (newDiagramURI) {
          const diagramRes = await fetchRawResource(newDiagramURI);
          if (diagramRes) setDiagramResource(diagramRes);
        }
      } else {
        console.error('Failed to create diagram, status:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Error creating diagram:', err);
    }
  }, [contextMenu, getClient, fetchRawResource]);

  return (
    <ThemeProvider theme={theme ?? defaultTheme}>
      <CssBaseline />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <ToolbarComponent
          connection={connection}
          onServerURLChange={setServerURL}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onConnect={handleConnect}
        />
        <MainLayoutComponent
          columns={navState.columns}
          selectedResource={navState.selectedResource}
          favorites={favorites}
          diagramResource={diagramResource}
          extraTabs={extraTabs}
          onPredicateClick={handlePredicateClick}
          onResourceSelect={(resource, columnIndex) => selectResource(resource, columnIndex)}
          onResourceContextMenu={handleResourceContextMenu}
          onLinkClick={handleNavigateToResource}
          onNavigateToFavorite={handleNavigateToResource}
          onAddFolder={addFolder}
          onRemoveFavorite={removeItem}
          onRenameFavorite={rename}
          onToggleFolder={toggleFolder}
          fetchRawResource={fetchRawResource}
        />
      </div>

      {/* Resource context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => {
          if (contextMenu) addResource(contextMenu.resource.title, contextMenu.resource.uri);
          handleCloseContextMenu();
        }}>
          Add to Favorites
        </MenuItem>
        {matchingFactories.length > 0 && <Divider />}
        {matchingFactories.map((factory) => (
          <MenuItem
            key={factory.title}
            onClick={() => handleCreateDiagram(factory)}
          >
            {factory.title}
          </MenuItem>
        ))}
        {extraMenuItems && extraMenuItems.length > 0 && <Divider />}
        {extraMenuItems?.filter(item => !item.visible || (contextMenu?.resource && item.visible(contextMenu.resource)))
          .map((item, i) => (
            <MenuItem key={`extra-${i}`} onClick={() => {
              if (contextMenu?.resource) item.onClick(contextMenu.resource);
              handleCloseContextMenu();
            }}>
              {item.label}
            </MenuItem>
          ))}
      </Menu>
    </ThemeProvider>
  );
}
```

- [ ] **Step 2: Update MainLayoutComponent to accept and pass extraTabs**

In `oslc-browser/src/components/MainLayout.tsx`:

1. Add import: `import type { ExtraTab } from '../models/types.js';`
2. Add to `MainLayoutProps`: `extraTabs?: ExtraTab[];`
3. Destructure `extraTabs` from props
4. Pass `extraTabs={extraTabs}` to `<DetailsPanelComponent>`

- [ ] **Step 3: Update DetailsPanelComponent to render extraTabs**

In `oslc-browser/src/components/DetailsPanel.tsx`:

1. Add import: `import type { ExtraTab } from '../models/types.js';`
2. Add to `DetailsPanelProps`: `extraTabs?: ExtraTab[];`
3. Destructure `extraTabs` from props
4. After the existing Diagram Tab, render extra tabs:

```typescript
{extraTabs?.map((et, i) => (
  <Tab key={`extra-${i}`} label={et.label} />
))}
```

5. After the existing Diagram TabPanel, render extra tab panels:

```typescript
{extraTabs?.map((et, i) => (
  tab === 3 + i && resource ? (
    <Box key={`extra-panel-${i}`} sx={{ p: 1, overflow: 'auto', flexGrow: 1 }}>
      {et.render(resource)}
    </Box>
  ) : null
))}
```

- [ ] **Step 4: Update App.tsx to use OslcBrowserApp temporarily**

Replace `oslc-browser/src/App.tsx` contents with:

```typescript
import { OslcBrowserAppComponent } from './components/OslcBrowserApp.js';
export default function App() {
  return <OslcBrowserAppComponent />;
}
```

This keeps the existing `main.tsx` working during the transition.

- [ ] **Step 5: Verify the app builds and runs**

Run: `cd oslc-browser && npx tsc --noEmit && npx vite build`
Expected: Build succeeds

- [ ] **Step 6: Commit**

```bash
cd oslc-browser
git add -A
git commit -m "refactor: extract OslcBrowserApp component from App.tsx"
```

---

### Task 4: Create Barrel Export (index.ts)

**Files:**
- Create: `oslc-browser/src/index.ts`

- [ ] **Step 1: Create the barrel file**

Create `oslc-browser/src/index.ts`:

```typescript
// Components
export { OslcBrowserAppComponent as OslcBrowserApp } from './components/OslcBrowserApp.js';
export { ToolbarComponent as Toolbar } from './components/Toolbar.js';
export { MainLayoutComponent as MainLayout } from './components/MainLayout.js';
export { ColumnViewComponent as ColumnView } from './components/ColumnView.js';
export { ResourceColumnComponent as ResourceColumn } from './components/ResourceColumn.js';
export { DetailsPanelComponent as DetailsPanel } from './components/DetailsPanel.js';
export { FavoritesPanelComponent as FavoritesPanel } from './components/FavoritesPanel.js';
export { DiagramTabComponent as DiagramTab } from './components/DiagramTab.js';
export { DiagramCanvasComponent as DiagramCanvas } from './components/DiagramCanvas.js';
export { DiagramShapeComponent as DiagramShape } from './components/DiagramShape.js';
export { DiagramEdgeComponent as DiagramEdge, DiagramEdgeDefs } from './components/DiagramEdge.js';
export { DiagramToolbarComponent as DiagramToolbar } from './components/DiagramToolbar.js';
export { PropertiesTabComponent as PropertiesTab } from './components/PropertiesTab.js';
export { ExplorerTabComponent as ExplorerTab } from './components/ExplorerTab.js';

// Hooks
export { useOslcClient } from './hooks/useOslcClient.js';
export { useNavigation } from './hooks/useNavigation.js';
export { useFavorites } from './hooks/useFavorites.js';
export { useDiagramData, parseDiagramResource } from './hooks/useDiagramData.js';
export { traverseLinks, generateDiagramTurtle } from './hooks/diagramGenerator.js';

// Types
export type {
  ResourceProperty, ResourceLink, LoadedResource,
  PredicateItem, ColumnResource, NavigationColumn, NavigationState,
  ColumnItem, FavoriteItem, ConnectionState,
  ExtraTab, ExtraMenuItem, OslcBrowserAppProps,
} from './models/types.js';
export { localName } from './models/types.js';

export type {
  DiagramBounds, DiagramPoint, DiagramStyle,
  DiagramShapeData, DiagramEdgeData, DiagramElementData,
  ParsedDiagram,
} from './models/diagram-types.js';
export { DD_NS, isDDProperty, isDiagramType } from './models/diagram-types.js';
```

- [ ] **Step 2: Verify TypeScript compiles with barrel**

Run: `cd oslc-browser && npx tsc --noEmit`
Expected: No errors

- [ ] **Step 3: Commit**

```bash
cd oslc-browser
git add src/index.ts
git commit -m "feat: add barrel export index.ts"
```

---

### Task 5: Convert to Vite Library Mode

**Files:**
- Modify: `oslc-browser/vite.config.ts`
- Modify: `oslc-browser/package.json`
- Modify: `oslc-browser/tsconfig.json`
- Delete: `oslc-browser/tsconfig.app.json`
- Delete: `oslc-browser/tsconfig.node.json`
- Delete: `oslc-browser/src/App.tsx`
- Delete: `oslc-browser/src/main.tsx`
- Delete: `oslc-browser/index.html`
- Delete: `oslc-browser/public/vite.svg`
- Delete: `oslc-browser/src/index.css`

- [ ] **Step 1: Install vite-plugin-dts**

Run: `cd oslc-browser && npm install --save-dev vite-plugin-dts`

- [ ] **Step 2: Replace vite.config.ts with library mode config**

Replace `oslc-browser/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import dts from 'vite-plugin-dts';
import { resolve } from 'path';

export default defineConfig({
  plugins: [
    react(),
    dts({ rollupTypes: true }),
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
        /^@mui\//,
        /^@emotion\//,
        'oslc-client',
        'rdflib',
      ],
    },
  },
});
```

Note: Using regex patterns for @mui/ and @emotion/ to catch all sub-packages (e.g., `@mui/material/Accordion`).

- [ ] **Step 3: Update package.json**

Update `oslc-browser/package.json`:

```json
{
  "name": "oslc-browser",
  "version": "1.0.0",
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
  "files": ["dist"],
  "scripts": {
    "build": "vite build",
    "lint": "eslint ."
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
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.1",
    "@mui/material": "^7.3.1",
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "eslint": "^9.32.0",
    "oslc-client": "file:../oslc-client",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "rdflib": "^2.2.35",
    "typescript": "~5.8.3",
    "vite": "^7.1.0",
    "vite-plugin-dts": "^4.5.0"
  }
}
```

Key changes:
- Moved runtime deps to peerDependencies
- Added them also to devDependencies (for building/testing the library)
- Added main/module/types/exports fields
- Added files field to limit published content
- Removed dev/preview/build scripts that reference app mode
- Added rdflib as peer dep

- [ ] **Step 4: Consolidate TypeScript config**

Replace `oslc-browser/tsconfig.json` with a single config (no more references):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "outDir": "dist",
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Delete old SPA files**

Delete these files:
- `oslc-browser/src/App.tsx`
- `oslc-browser/src/main.tsx`
- `oslc-browser/index.html`
- `oslc-browser/tsconfig.app.json`
- `oslc-browser/tsconfig.node.json`
- `oslc-browser/public/vite.svg`
- `oslc-browser/src/index.css` (if any CSS is needed, it should be inlined in components)

- [ ] **Step 6: Handle index.css styles**

The deleted `index.css` contains body/html reset styles (`margin: 0; padding: 0; height: 100%; overflow: hidden`). These are now the consumer's responsibility. Each consumer's `index.html` should include equivalent styles, or the consumer's `main.tsx` can import a local CSS file.

For the server UI shells, add these styles inline in each `index.html` `<head>`:
```html
<style>html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
```

Also check no component imports `index.css`:
Run: `grep -rn "index.css" oslc-browser/src/`
The import is only in the deleted `main.tsx`.

- [ ] **Step 7: Run npm install and build**

```bash
cd oslc-browser
npm install
npx vite build
```

Expected: Build succeeds, producing `dist/oslc-browser.js` and `dist/index.d.ts`

- [ ] **Step 8: Verify dist output**

Run: `ls -la oslc-browser/dist/`
Expected: `oslc-browser.js` and `index.d.ts` (or `oslc-browser.d.ts`) files exist

- [ ] **Step 9: Commit**

```bash
cd oslc-browser
git add -A
git commit -m "feat: convert oslc-browser to Vite library mode"
```

---

## Chunk 2: Server UI Shells

### Task 6: Create oslc-server/ui

**Files:**
- Create: `oslc-server/ui/package.json`
- Create: `oslc-server/ui/tsconfig.json`
- Create: `oslc-server/ui/vite.config.ts`
- Create: `oslc-server/ui/index.html`
- Create: `oslc-server/ui/src/main.tsx`
- Create: `oslc-server/ui/src/App.tsx`

- [ ] **Step 1: Preserve existing static assets**

oslc-server has existing files in `public/` (`usage.html`, `images/favicon.ico`, `stylesheets/style.css`). The Vite build uses `emptyOutDir: true` which would delete them. Move these into the UI source so Vite copies them to the build output:

```bash
mkdir -p oslc-server/ui/public
cp -r oslc-server/public/* oslc-server/ui/public/
```

Vite automatically copies files from `ui/public/` into the build output directory. This preserves the existing assets alongside the new React app.

- [ ] **Step 2: Create ui/src directory**

Run: `mkdir -p oslc-server/ui/src`

- [ ] **Step 3: Create package.json**

Create `oslc-server/ui/package.json`:

```json
{
  "name": "oslc-server-ui",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.1",
    "@mui/material": "^7.3.1",
    "oslc-browser": "file:../../oslc-browser",
    "oslc-client": "file:../../oslc-client",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "rdflib": "^2.2.35"
  },
  "devDependencies": {
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "typescript": "~5.8.3",
    "vite": "^7.1.0"
  }
}
```

- [ ] **Step 4: Create tsconfig.json**

Create `oslc-server/ui/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 5: Create vite.config.ts**

Create `oslc-server/ui/vite.config.ts`:

```typescript
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

- [ ] **Step 6: Create index.html**

Create `oslc-server/ui/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>OSLC Browser</title>
    <style>html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 7: Create src/main.tsx**

Create `oslc-server/ui/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 8: Create src/App.tsx**

Create `oslc-server/ui/src/App.tsx`:

```typescript
import { OslcBrowserApp } from 'oslc-browser';

export default function App() {
  return <OslcBrowserApp />;
}
```

- [ ] **Step 9: Install dependencies and build**

```bash
cd oslc-server/ui
npm install
npx vite build
```

Expected: Build succeeds, output goes to `oslc-server/public/`. The existing assets (usage.html, images/, stylesheets/) are preserved because they were copied to `ui/public/` in Step 1.

- [ ] **Step 10: Verify the built files**

Run: `ls oslc-server/public/`
Expected: `index.html`, `assets/` directory, plus preserved `usage.html`, `images/`, `stylesheets/`

- [ ] **Step 11: Test with oslc-server**

Start oslc-server (requires Fuseki running on localhost:3030/rmcm):

```bash
cd oslc-server && npm start
```

Open `http://localhost:3001/` in a browser. The OSLC browser UI should load. Enter `http://localhost:3001/` in the Server URL field and verify it connects and shows the service provider catalog.

- [ ] **Step 12: Add build output to oslc-server .gitignore**

The `public/` directory now contains both source-controlled assets (from `ui/public/`) and build output. Add build-specific files to `.gitignore`:

Add to `oslc-server/.gitignore`:
```
public/assets/
public/index.html
```

- [ ] **Step 13: Commit**

```bash
cd oslc-server
git add ui/ .gitignore
git commit -m "feat: add ui/ thin app shell consuming oslc-browser library"
```

---

### Task 7: Create mrm-server/ui

**Files:**
- Create: `mrm-server/ui/package.json`
- Create: `mrm-server/ui/tsconfig.json`
- Create: `mrm-server/ui/vite.config.ts`
- Create: `mrm-server/ui/index.html`
- Create: `mrm-server/ui/src/main.tsx`
- Create: `mrm-server/ui/src/App.tsx`

- [ ] **Step 1: Create ui directory**

Run: `mkdir -p mrm-server/ui/src`

- [ ] **Step 2: Create package.json**

Create `mrm-server/ui/package.json` (identical to oslc-server/ui except name):

```json
{
  "name": "mrm-server-ui",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.1",
    "@mui/material": "^7.3.1",
    "oslc-browser": "file:../../oslc-browser",
    "oslc-client": "file:../../oslc-client",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "rdflib": "^2.2.35"
  },
  "devDependencies": {
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "typescript": "~5.8.3",
    "vite": "^7.1.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `mrm-server/ui/tsconfig.json` (identical to oslc-server/ui):

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src"]
}
```

- [ ] **Step 4: Create vite.config.ts**

Create `mrm-server/ui/vite.config.ts`:

```typescript
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

- [ ] **Step 5: Create index.html**

Create `mrm-server/ui/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>MRM Browser</title>
    <style>html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 6: Create src/main.tsx**

Create `mrm-server/ui/src/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.js';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

- [ ] **Step 7: Create src/App.tsx with extensibility props**

Create `mrm-server/ui/src/App.tsx`:

```typescript
import { OslcBrowserApp } from 'oslc-browser';
import type { ExtraTab, ExtraMenuItem } from 'oslc-browser';

// MRM-specific tabs and menu items will be added here later.
// For now, the app renders the default OSLC browser.
const mrmTabs: ExtraTab[] = [];
const mrmMenuItems: ExtraMenuItem[] = [];

export default function App() {
  return (
    <OslcBrowserApp
      extraTabs={mrmTabs}
      extraMenuItems={mrmMenuItems}
    />
  );
}
```

- [ ] **Step 8: Install dependencies and build**

```bash
cd mrm-server/ui
npm install
npx vite build
```

Expected: Build succeeds, output goes to `mrm-server/public/`

- [ ] **Step 9: Create mrm-server/public directory and .gitignore**

If mrm-server doesn't have a `public/` dir, the build will create it. Add to `mrm-server/.gitignore`:

```
public/assets/
public/index.html
```

- [ ] **Step 10: Test with mrm-server**

Start mrm-server (requires Fuseki running on localhost:3030/mrm):

```bash
cd mrm-server && npm start
```

Open `http://localhost:3002/` in a browser. The MRM browser UI should load identically to the OSLC browser.

- [ ] **Step 11: Commit**

```bash
cd mrm-server
git add ui/ .gitignore
git commit -m "feat: add ui/ thin app shell with extensibility props"
```

---

## Chunk 3: Electron Desktop App

### Task 8: Create Electron App Shell

**Files:**
- Create: `oslc-browser/app/package.json`
- Create: `oslc-browser/app/vite.config.ts`
- Create: `oslc-browser/app/tsconfig.json`
- Create: `oslc-browser/app/src/main.ts`
- Create: `oslc-browser/app/src/preload.ts`
- Create: `oslc-browser/app/src/renderer/main.tsx`
- Create: `oslc-browser/app/src/renderer/index.html`

- [ ] **Step 1: Create directory structure**

Run: `mkdir -p oslc-browser/app/src/renderer`

- [ ] **Step 2: Create package.json**

Create `oslc-browser/app/package.json`:

```json
{
  "name": "oslc-browser-app",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "main": "dist/main.js",
  "scripts": {
    "dev": "vite",
    "build": "vite build && tsc -p tsconfig.main.json",
    "start": "electron dist/main.js",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.14.0",
    "@emotion/styled": "^11.14.1",
    "@mui/icons-material": "^7.3.1",
    "@mui/material": "^7.3.1",
    "oslc-browser": "file:..",
    "oslc-client": "file:../../oslc-client",
    "react": "^19.1.1",
    "react-dom": "^19.1.1",
    "rdflib": "^2.2.35"
  },
  "devDependencies": {
    "@types/react": "^19.1.9",
    "@types/react-dom": "^19.1.6",
    "@vitejs/plugin-react": "^4.5.2",
    "electron": "^35.0.0",
    "typescript": "~5.8.3",
    "vite": "^7.1.0"
  }
}
```

- [ ] **Step 3: Create tsconfig.json for renderer**

Create `oslc-browser/app/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "bundler",
    "strict": true,
    "jsx": "react-jsx",
    "skipLibCheck": true,
    "isolatedModules": true,
    "allowImportingTsExtensions": true,
    "noEmit": true
  },
  "include": ["src/renderer"]
}
```

- [ ] **Step 4: Create tsconfig.main.json for Electron main process**

Create `oslc-browser/app/tsconfig.main.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "nodenext",
    "strict": true,
    "outDir": "dist",
    "skipLibCheck": true
  },
  "include": ["src/main.ts", "src/preload.ts"]
}
```

Note: Uses `NodeNext` module resolution for Electron's ESM support (the package.json has `"type": "module"`). Electron 28+ supports ESM natively.

- [ ] **Step 5: Create Electron main process**

Create `oslc-browser/app/src/main.ts`:

```typescript
import { app, BrowserWindow } from 'electron';
import { join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    webPreferences: {
      preload: join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  // In development, load from Vite dev server
  if (process.env.NODE_ENV === 'development') {
    win.loadURL('http://localhost:5173');
    win.webContents.openDevTools();
  } else {
    // In production, load the built renderer
    win.loadFile(join(__dirname, 'renderer', 'index.html'));
  }
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});
```

- [ ] **Step 6: Create preload script**

Create `oslc-browser/app/src/preload.ts`:

```typescript
// Preload script runs in renderer context with Node.js access.
// Currently empty — add IPC bridges here when needed.
```

- [ ] **Step 7: Create renderer entry**

Create `oslc-browser/app/src/renderer/main.tsx`:

```typescript
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OslcBrowserApp } from 'oslc-browser';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OslcBrowserApp />
  </StrictMode>,
);
```

- [ ] **Step 8: Create renderer HTML**

Create `oslc-browser/app/src/renderer/index.html`:

```html
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <meta http-equiv="Content-Security-Policy"
          content="default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; connect-src *;" />
    <title>OSLC Browser</title>
    <style>html, body, #root { margin: 0; padding: 0; height: 100%; overflow: hidden; }</style>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="./main.tsx"></script>
  </body>
</html>
```

Note: The CSP `connect-src *` allows the browser to connect to any OSLC server. Adjust for production security needs.

- [ ] **Step 9: Create Vite config for renderer**

Create `oslc-browser/app/vite.config.ts`:

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  root: resolve(__dirname, 'src/renderer'),
  build: {
    outDir: resolve(__dirname, 'dist/renderer'),
    emptyOutDir: true,
  },
});
```

- [ ] **Step 10: Install dependencies**

```bash
cd oslc-browser/app
npm install
```

- [ ] **Step 11: Build renderer**

```bash
cd oslc-browser/app
npx vite build
```

Expected: Build succeeds, output in `dist/renderer/`

- [ ] **Step 12: Build main process**

```bash
cd oslc-browser/app
npx tsc -p tsconfig.main.json
```

Expected: Compiles `src/main.ts` and `src/preload.ts` to `dist/`

- [ ] **Step 13: Test Electron app**

```bash
cd oslc-browser/app
npm start
```

Expected: An Electron window opens showing the OSLC browser UI. Enter an OSLC server URL to test connectivity.

- [ ] **Step 14: Add dist/ to .gitignore**

Create `oslc-browser/app/.gitignore`:
```
dist/
node_modules/
```

- [ ] **Step 15: Commit**

```bash
cd oslc-browser
git add app/
git commit -m "feat: add Electron desktop app shell"
```

---

## Chunk 4: Final Integration

### Task 9: Update Build Order Documentation

**Files:**
- Modify: `docs/system_patterns.md` (if it documents build order)

- [ ] **Step 1: Update architecture memory and docs**

Update the build order documentation to reflect:

```
storage-service → ldp-service → oslc-service → oslc-client → oslc-browser (library) → oslc-server/ui → mrm-server/ui
                                                                                    → oslc-browser/app
```

- [ ] **Step 2: Commit**

```bash
git add docs/
git commit -m "docs: update build order for library architecture"
```

---

### Task 10: End-to-End Verification

- [ ] **Step 1: Clean build of entire chain**

```bash
# Build oslc-browser library
cd oslc-browser && npm run build

# Build oslc-server UI
cd ../oslc-server/ui && npm run build

# Build mrm-server UI
cd ../../mrm-server/ui && npm run build
```

Expected: All three builds succeed.

- [ ] **Step 2: Test oslc-server**

Start Fuseki with the rmcm dataset, then:

```bash
cd oslc-server && npm start
```

Open `http://localhost:3001/` — verify the OSLC browser loads and connects.

- [ ] **Step 3: Test mrm-server**

Start Fuseki with the mrm dataset, then:

```bash
cd mrm-server && npm start
```

Open `http://localhost:3002/` — verify the MRM browser loads and connects. Verify diagram creation still works (right-click a resource → create diagram).

- [ ] **Step 4: Test Electron app**

```bash
cd oslc-browser/app && npm start
```

Verify the desktop window opens and can connect to either server.

- [ ] **Step 5: Final commit**

If any fixes were needed during verification:

```bash
git add -A
git commit -m "fix: end-to-end verification fixes"
```
