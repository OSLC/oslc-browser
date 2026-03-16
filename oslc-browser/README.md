# oslc-browser

React component library for browsing and visualizing OSLC resources, built with Material-UI and Vite library mode. It provides column-based navigation, favorites, property inspection, diagram visualization, and an explorer graph -- all as composable React components, hooks, and types.

## Build

```bash
npm install
npm run build
```

This produces an ESM library in `dist/` (`dist/oslc-browser.js` with TypeScript declarations in `dist/index.d.ts`).

## Exports

### Components

| Export | Description |
|---|---|
| `OslcBrowserApp` | Top-level browser shell (toolbar, columns, detail panels) |
| `Toolbar` | Connection toolbar (server URL, credentials, connect button) |
| `MainLayout` | Split layout: column view on top, detail tabs on bottom |
| `ColumnView` | Horizontal scrolling column container |
| `ResourceColumn` | Single column listing a resource's outgoing links |
| `DetailsPanel` | Tabbed detail area (properties, explorer, diagram) |
| `FavoritesPanel` | Favorites sidebar with folder organization |
| `DiagramTab` | Tab wrapper for OSLC diagram rendering |
| `DiagramCanvas` | SVG canvas for diagram shapes and edges |
| `DiagramShape` | Individual diagram shape renderer |
| `DiagramEdge` / `DiagramEdgeDefs` | SVG edge paths and marker definitions |
| `DiagramToolbar` | Diagram-specific toolbar controls |
| `PropertiesTab` | RDF property/link table for the selected resource |
| `ExplorerTab` | Radial SVG graph of a resource and its outgoing links |

### Hooks

| Export | Description |
|---|---|
| `useOslcClient` | Manages the oslc-client connection lifecycle |
| `useNavigation` | Column navigation state (push, pop, jump) |
| `useFavorites` | Favorites CRUD with localStorage persistence |
| `useDiagramData` / `parseDiagramResource` | Parse OSLC diagram resources into renderable data |
| `traverseLinks` / `generateDiagramTurtle` | Walk outgoing links and produce diagram Turtle |

### Types

- **Navigation:** `ResourceProperty`, `ResourceLink`, `LoadedResource`, `PredicateItem`, `ColumnResource`, `NavigationColumn`, `NavigationState`, `ColumnItem`, `FavoriteItem`, `ConnectionState`
- **Extensibility:** `ExtraTab`, `ExtraMenuItem`, `OslcBrowserAppProps`
- **Diagram:** `DiagramBounds`, `DiagramPoint`, `DiagramStyle`, `DiagramShapeData`, `DiagramEdgeData`, `DiagramElementData`, `ParsedDiagram`
- **Utilities:** `localName`, `DD_NS`, `isDDProperty`, `isDiagramType`

## Usage

App shells consume oslc-browser as a `file:` dependency. In the consumer's `package.json`:

```json
{
  "dependencies": {
    "oslc-browser": "file:../oslc-browser"
  }
}
```

Then import the components and hooks you need:

```tsx
import { OslcBrowserApp } from 'oslc-browser';
import type { OslcBrowserAppProps } from 'oslc-browser';

function App() {
  return <OslcBrowserApp />;
}
```

Or compose lower-level pieces:

```tsx
import { Toolbar, ColumnView, DetailsPanel, useOslcClient, useNavigation } from 'oslc-browser';
```

Peer dependencies that the consuming app must provide: `react`, `react-dom`, `@mui/material`, `@mui/icons-material`, `@emotion/react`, `@emotion/styled`, `oslc-client`, and `rdflib`.

## App Shells

Three thin app shells consume this library:

- **oslc-server/ui** -- Web front-end served by oslc-server. Provides the default OSLC browser experience in a standard browser tab.
- **mrm-server/ui** -- Web front-end served by mrm-server. Adds MRM-specific extra tabs and menu items via the `ExtraTab` and `ExtraMenuItem` extension points.
- **oslc-browser/app** -- Electron desktop application wrapping the same components for offline or local use.

## Development

There is no standalone dev server in the library package itself. To develop and preview changes, run the dev server of one of the consuming app shells (e.g., `npm run dev` in `oslc-server/ui`), which will pick up changes from the linked library source.

## License

Apache 2.0
