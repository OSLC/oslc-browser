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

## Incoming Links

oslc-browser shows incoming links — relationships whose triple is stored on a *different* resource but whose object points at the resource you're viewing — alongside the outgoing links owned by the current resource. Navigation stays transparent: you see a single bidirectional model regardless of which side actually stores each triple.

### How they're rendered

Incoming relationships appear in the same UI surfaces as outgoing ones, labeled with the inverse wording declared on the source property's shape (e.g., a Strategy's `bmm:channelsEffortsToward` renders as "Efforts Channeled By" on the Vision it targets):

- **PropertiesTab**: incoming rows are appended to the Links table; the relationship label is italicized.
- **ResourceColumn**: incoming predicates sit alongside outgoing predicates in the resource accordion; italic label. Clicking one opens a new column of the source resources.
- **ExplorerTab**: the edge points center → source (same visual direction as an outgoing edge) with an italicized tspan for the inverse label. If a neighbor is linked in both directions, a single edge carries both labels with only the incoming portion italicized.

Italics are the only visual distinction. The tooltip on italic entries spells out "incoming — stored on source" for users curious about ownership.

### How they're discovered

On `fetchResource(uri)`, oslc-browser queries two sources in parallel and merges them, deduplicating on `(sourceURI, predicate)`:

1. **Same-server** (`fetchSameServerIncomingLinks`) — POSTs Turtle to `{origin-of-uri}/discover-links` following the OSLC LDM protocol:
   ```turtle
   @prefix oslc_ldm: <http://open-services.net/ns/ldm#> .
   [] oslc_ldm:resources <targetURI> .
   ```
   The response is Turtle triples whose object is the target. oslc-service implements this endpoint via a SPARQL reverse query over its storage. A missing endpoint (501/404) or unreachable server returns an empty list — the browser degrades gracefully.
2. **Cross-server** (`fetchCrossServerIncomingLinks`) — delegates to `oslc-client` `LDMClient` against a configured dedicated LDM provider or LQE. Today this path returns `[]` because no such provider is wired up; the machinery exists for when one is.

Results are attached to `LoadedResource.incomingLinks`; source titles are resolved via the same compact-representation fallback used for outgoing targets.

### Shape-driven labeling (not hardcoded)

oslc-browser does **not** carry a static table of link types or inverse wording. It reflects the inverse label off the resource shape at render time. That requires two proposed OSLC-OP vocabulary extensions on `oslc:Property` nodes in a `ResourceShape`:

| Property | Purpose |
|---|---|
| `oslc:inversePropertyDefinition` | URI identifier for the inverse direction. Never asserted as a triple — used only as a key when clients need to reference the inverse. |
| `oslc:inverseLabel` | Human-readable label for the inverse direction (e.g., `"Efforts Channeled By"`). This is what the browser displays on the target side of an incoming link. |

Example declaration in a shape TTL:

```turtle
<#p-channelsEffortsToward>
  a oslc:Property ;
  oslc:name "channelsEffortsToward" ;
  oslc:propertyDefinition bmm:channelsEffortsToward ;
  oslc:occurs oslc:Zero-or-many ;
  oslc:valueType oslc:Resource ;
  oslc:representation oslc:Reference ;
  oslc:inversePropertyDefinition bmm:effortsChanneledBy ;
  oslc:inverseLabel "Efforts Channeled By" .
```

Adding a new relationship to a domain means adding these two triples to the property constraint — no client rebuild, no coordination with oslc-browser. The shape *is* the contract.

### Shape cache seeding

`getInverseLabel(predicateURI)` looks up across cached shapes. Because an incoming link's predicate is declared on the *source-side* shape — which otherwise wouldn't be fetched when viewing a target — `useOslcClient.fetchResource` walks the resource's `oslc:serviceProvider` on first visit and pre-fetches every `oslc:resourceShape` advertised by its CreationFactories. A per-SP seeded-set avoids re-crawling.

### Protocol positioning

The `/discover-links` endpoint is the standard OSLC Link Discovery Management (LDM) wire format. `oslc-client`'s `LDMClient` can talk to it without code changes — the per-server endpoint and a dedicated LDM/LQE provider are interchangeable from the client's perspective. oslc4js treats per-server `/discover-links` as an extension: it's useful today for repositories that don't feed a central LDM provider, and it complements rather than replaces the TRS-fed provider pattern.

## App Shells

Three thin app shells consume this library:

- **oslc-server/ui** -- Web front-end served by oslc-server. Provides the default OSLC browser experience in a standard browser tab.
- **mrm-server/ui** -- Web front-end served by mrm-server. Adds MRM-specific extra tabs and menu items via the `ExtraTab` and `ExtraMenuItem` extension points.
- **oslc-browser/app** -- Electron desktop application wrapping the same components for offline or local use.

## Development

There is no standalone dev server in the library package itself. To develop and preview changes, run the dev server of one of the consuming app shells (e.g., `npm run dev` in `oslc-server/ui`), which will pick up changes from the linked library source.

## License

Apache 2.0
