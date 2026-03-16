# oslc-mcp-server

A [Model Context Protocol](https://modelcontextprotocol.io/) (MCP) server that connects to any OSLC 3.0 server, discovers its capabilities, and exposes them as MCP tools and resources for LLM-driven CRUD operations.

## The Problem

AI assistants can't interact with OSLC servers directly. This module bridges that gap by dynamically discovering an OSLC server's service providers, creation factories, query capabilities, and resource shapes at startup, then exposing them as typed MCP tools that any MCP-compatible AI assistant can call.

## Prerequisites

- [Node.js](http://nodejs.org) v22 or later
- An OSLC 3.0 server running (e.g., oslc-server or mrm-server from this workspace)

## Build

```bash
cd oslc-mcp-server
npm install
npm run build
```

## Configuration

The server accepts configuration via CLI arguments or environment variables (CLI overrides env):

| CLI Argument | Environment Variable | Description |
|-------------|---------------------|-------------|
| `--server <url>` | `OSLC_SERVER_URL` | **Required.** Base URL of the OSLC server |
| `--catalog <url>` | `OSLC_CATALOG_URL` | Catalog URL (defaults to `{server}/oslc/catalog`) |
| `--username <user>` | `OSLC_USERNAME` | Username for authenticated servers |
| `--password <pass>` | `OSLC_PASSWORD` | Password for authenticated servers |

## Running

Start your OSLC server first, then:

```bash
node dist/index.js --server http://localhost:3002 --catalog http://localhost:3002/oslc
```

The server communicates via stdio using the MCP protocol. To use it with Claude Code, add it to your MCP server configuration:

```json
{
  "mcpServers": {
    "oslc": {
      "command": "node",
      "args": ["path/to/oslc-mcp-server/dist/index.js", "--server", "http://localhost:3002", "--catalog", "http://localhost:3002/oslc"]
    }
  }
}
```

## What It Does

At startup, the server:

1. Connects to the OSLC server's service provider catalog
2. Walks all service providers, collecting creation factories, query capabilities, and resource shapes
3. Generates per-type MCP tools from each creation factory and query capability (e.g., `create_programs`, `query_services`)
4. Registers generic CRUD tools (`get_resource`, `update_resource`, `delete_resource`, `list_resource_types`, `query_resources`)
5. Exposes catalog, vocabulary, and resource shapes as MCP resources for LLM context

### MCP Tools

**Per-type tools** (dynamically generated from discovery):
- `create_<type>` -- Creates a resource of that type. Input schema is derived from the OSLC resource shape, with proper types, descriptions, required fields, and allowed values.
- `query_<type>` -- Queries resources of that type using `oslc.where`, `oslc.select`, and `oslc.orderBy` parameters.

**Generic tools** (always available):
- `get_resource` -- Fetch any OSLC resource by URI
- `update_resource` -- Update properties on an existing resource (uses ETag for concurrency)
- `delete_resource` -- Delete a resource by URI
- `list_resource_types` -- List all discovered resource types with their factories and properties
- `query_resources` -- Query any resource type using a query capability URL

### MCP Resources

- `oslc://catalog` -- Service provider catalog summary (providers, factories, query capabilities)
- `oslc://vocabulary` -- Resource types and their relationships
- `oslc://shapes` -- Property definitions for each resource type (names, types, cardinalities)

## Architecture

```
oslc-mcp-server/src/
├── index.ts           CLI entry point, arg parsing, startup orchestration
├── server.ts          MCP Server setup, tool/resource registration, stdio transport
├── discovery.ts       Walks OSLC catalog, collects shapes/factories/queries
├── schema.ts          Converts OSLC resource shapes to JSON Schema
├── resources.ts       MCP resource definitions (catalog/vocabulary/shapes)
├── types.ts           Shared TypeScript interfaces
├── oslc-client.d.ts   Type declarations for oslc-client
└── tools/
    ├── generic.ts     Handlers for generic CRUD tools
    └── factory.ts     Generates per-type tool definitions from discovery
```

**Dependencies:** Uses [oslc-client](../oslc-client) for all OSLC operations (HTTP, RDF parsing via rdflib, authentication) and [@modelcontextprotocol/sdk](https://github.com/modelcontextprotocol/typescript-sdk) for the MCP server framework.

## License

Licensed under the Apache License, Version 2.0. See the workspace root LICENSE for details.
