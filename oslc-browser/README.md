# oslc-browser

A generic OSLC resource browser built with React, TypeScript, and MUI. It connects to any OSLC 2.0/3.0 server and lets you navigate resources by following outgoing RDF links in a column-based (Finder-style) UI.

## Features

- **Column-based navigation** -- enter a resource URL and navigate its outgoing links. Each link click opens a new column to the right, like macOS Finder.
- **Favorites** -- right-click any resource in a column to add it to favorites. Organize favorites into folders. Persisted to browser localStorage.
- **Properties panel** -- view all RDF properties and outgoing links for the selected resource in a table.
- **Explorer graph** -- visualize a resource and its outgoing links as an SVG radial graph.
- **Breadcrumb trail** -- click any breadcrumb to jump back to that resource.
- **Connection persistence** -- server URL and username are saved to localStorage across sessions.

## Prerequisites

- Node.js 20.19+ or 22.12+
- An OSLC server to connect to (e.g., oslc-server from this workspace, or IBM ELM)

## Running

From the workspace root:

```bash
npm install
npm run dev -w oslc-browser
```

Or from this directory:

```bash
npm install
npm run dev
```

The app starts at `http://localhost:5173` by default.

## Building

```bash
npm run build
npm run preview   # serve the production build locally
```

## Usage

1. Enter the URL of an OSLC resource (e.g., a rootservices document, ServiceProviderCatalog, or any RDF resource).
2. Enter credentials if the server requires authentication.
3. Click **Connect** to fetch the resource.
4. Click outgoing links in the columns to navigate deeper.
5. Right-click a resource to add it to Favorites.
6. Use the Properties and Explorer tabs at the bottom to inspect the selected resource.

## Tech Stack

- React 19 + TypeScript 5.8
- Vite 7
- MUI 7 (Material UI)
- oslc-client (OSLC/RDF resource fetching)
