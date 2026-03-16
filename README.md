# oslc4js

A collection of Node.js modules for building [OSLC 3.0](https://docs.oasis-open-projects.org/oslc-op/core/v3.0/oslc-core.html) servers and clients, implementing the [W3C Linked Data Platform](https://www.w3.org/TR/ldp/) (LDP) specification.

## Modules

The workspace is organized into layered modules that build on each other:

### Storage Layer

| Module | Description |
|--------|-------------|
| [storage-service](storage-service/) | Abstract TypeScript interface defining the contract for storage backends |
| [ldp-service-jena](ldp-service-jena/) | Storage backend using Apache Jena Fuseki |
| [ldp-service-fs](ldp-service-fs/) | Storage backend using the local file system |
| [ldp-service-mongodb](ldp-service-mongodb/) | Storage backend using MongoDB |

### Middleware Layer

| Module | Description |
|--------|-------------|
| [ldp-service](ldp-service/) | Express middleware implementing the W3C LDP protocol (containers, RDF sources, content negotiation) |
| [oslc-service](oslc-service/) | Express middleware adding OSLC 3.0 services on top of ldp-service (discovery, creation factories, query, shapes, delegated UI) |

### Applications

| Module | Description |
|--------|-------------|
| [oslc-server](oslc-server/) | OSLC 3.0 reference server implementation |
| [mrm-server](mrm-server/) | OSLC server for the MISA Municipal Reference Model |
| [ldp-app](ldp-app/) | Example LDP application demonstrating ldp-service |

### Client and UI

| Module | Description |
|--------|-------------|
| [oslc-client](oslc-client/) | JavaScript library for consuming OSLC servers (HTTP, RDF parsing, authentication) |
| [oslc-browser](oslc-browser/) | React component library for browsing and visualizing OSLC resources |
| [oslc-mcp-server](oslc-mcp-server/) | MCP server exposing OSLC capabilities as tools for AI assistants |

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Applications                                               │
│  ┌─────────────┐  ┌─────────────┐  ┌──────────────────────┐│
│  │ oslc-server  │  │ mrm-server  │  │ ldp-app              ││
│  └──────┬───────┘  └──────┬──────┘  └──────────┬───────────┘│
├─────────┼─────────────────┼────────────────────┼────────────┤
│  Middleware                                                  │
│  ┌──────┴─────────────────┴──────┐             │            │
│  │         oslc-service           │             │            │
│  └──────────────┬────────────────┘             │            │
│  ┌──────────────┴──────────────────────────────┘            │
│  │              ldp-service                                  │
│  └──────────────┬───────────────────────────────────────────┤
│  Storage                                                     │
│  ┌──────────────┴──────────────┐                            │
│  │        storage-service       │  (interface)               │
│  ├─────────┬──────────┬────────┤                            │
│  │  jena   │    fs    │ mongo  │  (implementations)         │
│  └─────────┴──────────┴────────┘                            │
├─────────────────────────────────────────────────────────────┤
│  Clients                                                     │
│  ┌──────────────┐ ┌──────────────┐ ┌───────────────────────┐│
│  │ oslc-client   │ │ oslc-browser │ │ oslc-mcp-server       ││
│  └──────────────┘ └──────────────┘ └───────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

## Prerequisites

- [Node.js](http://nodejs.org) v22 or later
- [Apache Jena Fuseki](https://jena.apache.org/documentation/fuseki2/) (for oslc-server, mrm-server, and ldp-app)

## Build

Install all dependencies from the workspace root:

```bash
npm install
```

Build modules in dependency order:

```bash
cd storage-service && npm run build && cd ..
cd ldp-service-jena && npm run build && cd ..
cd ldp-service && npm run build && cd ..
cd oslc-service && npm run build && cd ..
cd oslc-client && npm run build && cd ..
cd oslc-server && npm run build && cd ..
cd mrm-server && npm run build && cd ..
cd oslc-browser && npm run build && cd ..
cd oslc-mcp-server && npm run build && cd ..
```

## Quick Start

1. Start Apache Jena Fuseki with a dataset (e.g., `mrm`)
2. Build all modules (see above)
3. Start a server:

```bash
cd mrm-server && npm start
```

4. Browse resources at `http://localhost:3002` using the oslc-browser UI, or use oslc-client programmatically:

```javascript
import { OSLCClient } from 'oslc-client';

const client = new OSLCClient();
const resource = await client.getResource('http://localhost:3002/oslc/mrmv2-1', '3.0');
console.log(resource.getTitle());
```

## Standards

- [OSLC Core 3.0](https://docs.oasis-open-projects.org/oslc-op/core/v3.0/oslc-core.html) -- Open Services for Lifecycle Collaboration
- [W3C LDP](https://www.w3.org/TR/ldp/) -- Linked Data Platform 1.0
- [RDF 1.1](https://www.w3.org/TR/rdf11-concepts/) -- Resource Description Framework

## License

Licensed under the Apache License, Version 2.0. See individual module directories for details.
