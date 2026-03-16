# OSLC MCP Server Design Spec

## Overview

A standalone Node.js MCP server that connects to any OSLC 3.0 server, dynamically discovers its capabilities, and exposes them as MCP tools and resources. This enables LLMs to perform CRUD operations on OSLC-managed resources and understand the domain model through self-describing vocabularies and resource shapes.

**Primary use case:** An LLM reads a document (PDF, Word, etc.), identifies domain entities and relationships (e.g., MRM Programs, Services, Processes), and creates them in an OSLC server's dataset via MCP tools.

## Architecture

```
Claude Desktop / Claude Code
  ↕ stdio transport
oslc-mcp-server (discovers capabilities at startup)
  ↕ oslc-client (RDF parsing, auth, content negotiation)
  ↕ HTTP (Turtle / JSON-LD)
Any OSLC 3.0 server (mrm-server, oslc-server, etc.)
  ↕
Fuseki / any storage backend
```

The MCP server is a pure client of the OSLC REST API. It has no dependency on ldp-service, oslc-service, or any server-side packages. It uses `oslc-client` for all HTTP communication, which handles RDF parsing with rdflib, content negotiation, and authentication.

### Key Design Decisions

- **Standalone process** — not embedded in any OSLC server. Communicates via HTTP through oslc-client.
- **Generic** — works with any OSLC 3.0 server, not specific to MRM. Discovers all capabilities from the service provider catalog.
- **Dynamic tool generation** — per-type tools are generated at startup from resource shapes, so tool schemas always match the server's current configuration.
- **oslc-client as dependency** — not a peer dep. The MCP server owns its oslc-client instance. This handles RDF parsing, content negotiation, and authentication (which can be complex for OSLC servers).
- **stdio transport** — standard for Claude Code and Claude Desktop integration.

## Configuration

### Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `OSLC_SERVER_URL` | Yes | Base URL of the OSLC server (e.g., `http://localhost:3002`) |
| `OSLC_CATALOG_URL` | No | Direct URL to the ServiceProviderCatalog. If omitted, defaults to `{OSLC_SERVER_URL}/oslc/catalog` |
| `OSLC_USERNAME` | No | Username for authentication, passed to oslc-client |
| `OSLC_PASSWORD` | No | Password for authentication, passed to oslc-client |

### CLI Arguments (override env vars)

```bash
oslc-mcp-server --server http://localhost:3002 --catalog http://localhost:3002/oslc/catalog --username admin --password secret
```

### Claude Desktop Configuration

```json
{
  "mcpServers": {
    "mrm": {
      "command": "node",
      "args": ["path/to/oslc-mcp-server/dist/index.js", "--server", "http://localhost:3002"]
    }
  }
}
```

## Startup Sequence

1. Parse configuration (CLI args override env vars)
2. Create oslc-client instance using `OSLCClient` (for RDF parsing and HTTP). Note: the discovery module does **not** use `OSLCClient.use()` because that method assumes Jazz-style rootservices and a single domain/service provider. Instead, discovery uses `OSLCClient.getResource()` directly to fetch and parse the catalog, service providers, and shapes as generic RDF documents.
3. Fetch the service provider catalog from `OSLC_CATALOG_URL` (or `{OSLC_SERVER_URL}/oslc/catalog`)
4. For each service provider, fetch creation factories and query capabilities
5. For each creation factory, fetch the associated resource shape (parallelized for performance; individual failures log a warning and skip that type rather than aborting startup)
6. Convert each resource shape to JSON Schema (see mapping below)
7. Generate per-type MCP tools from the discovered shapes
8. Register generic CRUD tools
9. Fetch vocabulary documents referenced by the server
10. Cache catalog, vocabulary, and shapes as MCP resources
11. Start stdio transport, ready for requests

## MCP Tools

### Per-Type Tools (dynamically generated)

For each creation factory discovered in the service provider catalog, two tools are generated:

**Tool naming:** The tool name is derived from the creation factory's `dcterms:title`, lowercased and sanitized (spaces/hyphens replaced with underscores). For example, a factory titled "Program" produces `create_program` and `query_program`. When multiple factories share the same `oslc:resourceType` (e.g., the 11 diagram factories all use `dd:Diagram`), the factory title disambiguates: `create_orgunitdiagram`, `create_programdiagram`, etc.

#### `create_<type>(properties)`

- **Description:** Generated from the creation factory's `dcterms:title` and the resource shape's `dcterms:description`
- **Parameters:** JSON Schema derived from the resource shape's `oslc:Property` definitions (see mapping table below). Each JSON property key corresponds to an `oslc:name`; the implementation stores the `oslc:propertyDefinition` URI internally to map short names back to full RDF predicates when constructing the resource.
- **Implementation:** Constructs an RDF resource from the provided properties using rdflib (via oslc-client). Uses `fetch` or oslc-client's low-level HTTP methods to POST to the creation factory URL (not `OSLCClient.createResource()`, which requires Jazz-style `use()` setup). Sets `Content-Type: text/turtle` and `OSLC-Core-Version: 3.0`.
- **Returns:** The URI of the created resource (from the `Location` header) and its properties

#### `query_<type>(filter?, select?, orderBy?)`

- **Description:** Query resources of this type
- **Parameters:**
  - `filter` (optional, string) — OSLC query filter expression mapped to `oslc.where` (e.g., `dcterms:title="My Program"`)
  - `select` (optional, string) — Property projection mapped to `oslc.select` (e.g., `dcterms:title,dcterms:description`)
  - `orderBy` (optional, string) — Sort order mapped to `oslc.orderBy`
- **Implementation:** GETs the query capability URL with the optional query parameters via oslc-client
- **Returns:** Array of matching resources with their URIs and properties

### Generic Tools (always available)

#### `get_resource(uri)`

- **Parameters:** `uri` (string, required) — the URI of the resource to fetch
- **Implementation:** GETs the resource via oslc-client
- **Returns:** All properties of the resource

#### `update_resource(uri, properties)`

- **Parameters:**
  - `uri` (string, required) — the URI of the resource to update
  - `properties` (object, required) — properties to set. For each property provided, the existing value(s) for that predicate are fully replaced. Properties not mentioned in the update are left unchanged.
- **Implementation:** GETs the current resource (capturing the ETag), applies the property changes to the RDF graph, PUTs the updated resource with `If-Match` set to the captured ETag for optimistic concurrency. Property names are mapped back to full predicate URIs using the discovered resource shapes.
- **Returns:** The updated resource

#### `delete_resource(uri)`

- **Parameters:** `uri` (string, required) — the URI of the resource to delete
- **Implementation:** DELETEs the resource via oslc-client
- **Returns:** Confirmation of deletion

#### `list_resource_types()`

- **Parameters:** None
- **Implementation:** Returns the cached discovery results
- **Returns:** Array of discovered resource types, each with:
  - Type name and URI
  - Creation factory URL
  - Query capability URL
  - Property summary (names, types, required/optional)

#### `query_resources(queryBase, filter?, select?, orderBy?)`

- **Parameters:**
  - `queryBase` (string, required) — the query capability URL
  - `filter` (optional, string) — OSLC query filter expression mapped to `oslc.where`
  - `select` (optional, string) — Property projection mapped to `oslc.select`
  - `orderBy` (optional, string) — Sort order mapped to `oslc.orderBy`
- **Implementation:** GETs the query base URL with optional query parameters
- **Returns:** Array of matching resources

## MCP Resources

Three read-only resources exposed as reference material for the LLM:

### `oslc://catalog`

The service provider catalog in a readable format. Lists all service providers, their creation factories, query capabilities, and resource types. Fetched and cached at startup.

### `oslc://vocabulary`

The RDF vocabulary (classes, properties, relationships) parsed from the server's vocabulary documents. Describes the domain model so the LLM understands what types exist and how they relate. Fetched and cached at startup.

### `oslc://shapes`

All resource shapes with their property definitions: property names, value types, cardinalities, descriptions, allowed values, and range constraints. This tells the LLM exactly what fields each resource type accepts. Fetched and cached at startup.

## Resource Shape to JSON Schema Mapping

When the server discovers a resource shape, it converts `oslc:Property` definitions to JSON Schema for the MCP tool parameters:

| OSLC Property Attribute | JSON Schema Mapping |
|---|---|
| `oslc:name` | property key |
| `dcterms:description` | `description` field |
| `oslc:valueType xsd:string` | `type: "string"` |
| `oslc:valueType xsd:integer` | `type: "integer"` |
| `oslc:valueType xsd:boolean` | `type: "boolean"` |
| `oslc:valueType xsd:dateTime` | `type: "string", format: "date-time"` |
| `oslc:valueType oslc:Resource` | `type: "string"` (URI) with description noting it's a resource reference |
| `oslc:valueType oslc:AnyResource` | `type: "string"` (URI), same as `oslc:Resource` |
| `oslc:valueType oslc:LocalResource` | `type: "string"` (URI), same as `oslc:Resource` — inline objects are not supported in tool input |
| `oslc:allowedValue` / `oslc:allowedValues` | `enum` array of allowed values |
| `oslc:propertyDefinition` | stored internally to map `oslc:name` back to the full predicate URI; not exposed in JSON Schema |
| `oslc:representation` | all resource-valued properties map to URI strings regardless of `oslc:Reference` / `oslc:Inline` / `oslc:Either` |
| `oslc:occurs oslc:Exactly-one` | added to `required` array |
| `oslc:occurs oslc:One-or-more` | `type: "array"`, added to `required` |
| `oslc:occurs oslc:Zero-or-one` | optional, scalar |
| `oslc:occurs oslc:Zero-or-many` | `type: "array"`, optional |
| `oslc:range` | noted in `description` as the expected resource type |

Properties with `oslc:readOnly true` are excluded from create tool schemas but included in query/get results.

## Package Structure

```
oslc-mcp-server/
  package.json          # deps: oslc-client, @modelcontextprotocol/sdk
  tsconfig.json
  src/
    index.ts            # CLI entry point, arg parsing, startup sequence
    server.ts           # MCP server setup, tool/resource registration
    discovery.ts        # Fetch catalog, service providers, shapes via oslc-client
    schema.ts           # Convert OSLC resource shapes to JSON Schema
    tools/
      generic.ts        # get_resource, update_resource, delete_resource, list_resource_types, query_resources
      factory.ts        # Generates per-type create_<type> and query_<type> tools from discovered shapes
    resources.ts        # MCP resource handlers for catalog, vocabulary, shapes
```

### File Responsibilities

- **index.ts** — Parses CLI arguments and env vars, creates oslc-client, runs discovery, starts the MCP server
- **server.ts** — Creates the MCP `Server` instance, registers all tools and resources, connects stdio transport
- **discovery.ts** — Walks the OSLC service provider catalog using oslc-client: fetches catalog → service providers → creation factories → query capabilities → resource shapes → vocabulary documents. Returns a structured discovery result.
- **schema.ts** — Pure function that converts an OSLC resource shape (parsed RDF) into a JSON Schema object. Handles the mapping table above.
- **tools/generic.ts** — Implements the five generic tool handlers (get, update, delete, list_resource_types, query). Each handler uses oslc-client to make HTTP requests.
- **tools/factory.ts** — Takes discovery results and generates per-type tool definitions (name, description, JSON Schema, handler function) for each creation factory and query capability.
- **resources.ts** — Formats and serves the cached catalog, vocabulary, and shapes as human-readable MCP resource content.

## Dependencies

```json
{
  "dependencies": {
    "@modelcontextprotocol/sdk": "latest",
    "oslc-client": "file:../oslc-client"
  },
  "devDependencies": {
    "typescript": "~5.8.3",
    "@types/node": "^22.0.0"
  }
}
```

## Build Order

```
oslc-client → oslc-mcp-server
```

The MCP server depends only on oslc-client at build time. At runtime it communicates with any OSLC server via HTTP.

## JSON-LD Optimization

At startup, the discovery module tests whether the OSLC server supports JSON-LD by requesting the catalog with `Accept: application/ld+json`. If the server returns a valid JSON-LD response, the MCP server enables JSON-LD mode for that connection.

**When JSON-LD is supported:**
- Create tools wrap the LLM's JSON properties in a JSON-LD document with the appropriate `@context` and POST as `application/ld+json`. No rdflib RDF graph construction needed.
- Update tools send JSON-LD PUT requests similarly.
- GET responses requested as `application/ld+json` return JSON that can be passed almost directly back to the LLM as tool results.
- The `@context` provides the short-name-to-URI mapping, reducing the need for internal `oslc:propertyDefinition` mapping.

**When JSON-LD is not supported (fallback):**
- Create/update tools construct RDF graphs using rdflib (via oslc-client) and serialize as Turtle.
- GET responses are parsed from Turtle/RDF+XML via rdflib and converted to JSON for tool results.
- The `oslc:propertyDefinition` mapping is used to convert between JSON property names and full predicate URIs.

This keeps the MCP server generic — works with any OSLC 3.0 server — while taking advantage of JSON-LD when available for simpler, more efficient data flows.

## oslc-client Usage Notes

The MCP server uses oslc-client for RDF parsing, HTTP communication, and authentication, but does **not** use the high-level `OSLCClient.use()` or `OSLCClient.createResource()` methods. Those methods assume Jazz-style rootservices discovery and a single domain/service provider, which is too opinionated for a generic OSLC 3.0 client.

Instead, the discovery module uses:
- `OSLCClient.getResource(url)` — to fetch and parse any RDF resource (catalog, service providers, shapes, vocabulary)
- The underlying HTTP client (via oslc-client) for POST/PUT/DELETE operations with explicit URLs and headers

Since oslc-client is plain JavaScript with no TypeScript declarations, the MCP server includes a minimal `oslc-client.d.ts` type declaration file declaring the methods and types it uses.

## Document-to-Resource Workflow

The primary use case enabled by this design:

1. User provides a document (PDF, Word, etc.) to the LLM
2. LLM reads the MCP resources (`oslc://vocabulary`, `oslc://shapes`) to understand the domain model
3. LLM calls `list_resource_types()` to see what creation factories are available
4. LLM reads the document and identifies domain entities and relationships
5. LLM calls per-type create tools (e.g., `create_program(...)`, `create_service(...)`) to create resources
6. LLM calls `update_resource(uri, properties)` to add cross-references between created resources
7. Resources are now in the OSLC server's dataset, browsable via oslc-browser UI

The LLM acts as the intelligence layer — understanding document content, mapping it to the ontology, and orchestrating the creation. The MCP server provides the tools.

## Error Handling

- **Startup failures** (server unreachable, catalog not found): Log error and exit with non-zero status. The MCP host will report the failure.
- **Tool execution failures** (HTTP errors, validation errors): Return MCP error response with the HTTP status code and error message from the OSLC server. Do not crash the process.
- **Authentication failures**: Return descriptive error suggesting credential configuration. Do not retry.
- **Malformed RDF responses**: Log warning, return error to the LLM with as much context as possible.

## Out of Scope

- Bulk import tool — the LLM creates resources individually via per-type tools
- WebSocket or SSE transport — stdio only for now
- Resource change notifications — polling or subscriptions not included
- OSLC delegated dialogs — those are UI-based, not relevant for MCP
- Code generation or scaffolding — the MCP server is a runtime tool, not a dev tool
