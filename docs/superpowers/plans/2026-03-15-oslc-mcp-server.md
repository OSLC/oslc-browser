# OSLC MCP Server Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone MCP server that connects to any OSLC 3.0 server, discovers its capabilities, and exposes them as MCP tools and resources for LLM-driven CRUD operations.

**Architecture:** Standalone Node.js process using stdio transport. At startup, discovers the OSLC service provider catalog via oslc-client, generates per-type tools from resource shapes, and registers generic CRUD tools. Vocabulary, shapes, and catalog are exposed as MCP resources.

**Tech Stack:** TypeScript 5.8, @modelcontextprotocol/sdk, oslc-client (file dependency), rdflib (via oslc-client)

**Spec:** `docs/superpowers/specs/2026-03-15-oslc-mcp-server-design.md`

---

## File Structure

### Files to Create

| File | Responsibility |
|------|---------------|
| `oslc-mcp-server/package.json` | Package config with deps on @modelcontextprotocol/sdk + oslc-client |
| `oslc-mcp-server/tsconfig.json` | TypeScript config for Node.js ESM |
| `oslc-mcp-server/src/oslc-client.d.ts` | Minimal type declarations for oslc-client |
| `oslc-mcp-server/src/types.ts` | Shared TypeScript interfaces for discovery results |
| `oslc-mcp-server/src/schema.ts` | Convert OSLC resource shapes to JSON Schema |
| `oslc-mcp-server/src/discovery.ts` | Walk OSLC catalog and collect shapes/factories/queries |
| `oslc-mcp-server/src/tools/generic.ts` | Generic CRUD tool handlers |
| `oslc-mcp-server/src/tools/factory.ts` | Generate per-type tool definitions from discovery |
| `oslc-mcp-server/src/resources.ts` | MCP resource handlers for catalog/vocabulary/shapes |
| `oslc-mcp-server/src/server.ts` | MCP Server setup, tool/resource registration, stdio transport |
| `oslc-mcp-server/src/index.ts` | CLI entry point, arg parsing, startup orchestration |

---

## Chunk 1: Package Setup, Types, and Schema Conversion

### Task 1: Create Package Scaffold

**Files:**
- Create: `oslc-mcp-server/package.json`
- Create: `oslc-mcp-server/tsconfig.json`
- Create: `oslc-mcp-server/src/oslc-client.d.ts`
- Create: `oslc-mcp-server/.gitignore`

- [ ] **Step 1: Create directory structure**

```bash
mkdir -p oslc-mcp-server/src/tools
```

- [ ] **Step 2: Create package.json**

Create `oslc-mcp-server/package.json`:

```json
{
  "name": "oslc-mcp-server",
  "version": "1.0.0",
  "type": "module",
  "private": true,
  "main": "dist/index.js",
  "bin": {
    "oslc-mcp-server": "dist/index.js"
  },
  "scripts": {
    "build": "tsc",
    "start": "node dist/index.js"
  },
  "dependencies": {
    "@modelcontextprotocol/sdk": "^1.12.1",
    "oslc-client": "file:../oslc-client"
  },
  "devDependencies": {
    "@types/node": "^22.0.0",
    "typescript": "~5.8.3"
  }
}
```

- [ ] **Step 3: Create tsconfig.json**

Create `oslc-mcp-server/tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  },
  "include": ["src"]
}
```

Note: Uses `Node16` module resolution (same as mrm-server and oslc-server) for ESM compatibility with `"type": "module"`.

- [ ] **Step 4: Create .gitignore**

Create `oslc-mcp-server/.gitignore`:

```
dist/
node_modules/
```

- [ ] **Step 5: Create oslc-client type declarations**

Create `oslc-mcp-server/src/oslc-client.d.ts`:

```typescript
declare module 'oslc-client' {
  import { IndexedFormula, NamedNode } from 'rdflib';

  export class OSLCResource {
    uri: NamedNode;
    store: IndexedFormula;
    etag: string | null;
    queryURI: string;
    getURI(): string;
    get(property: string): any;
    set(property: string, value: any): void;
    getTitle(): string | undefined;
    getDescription(): string | undefined;
    getIdentifier(): string | undefined;
    getProperties(): Record<string, any>;
  }

  export class OSLCClient {
    client: {
      get(url: string, config?: any): Promise<any>;
      post(url: string, data?: any, config?: any): Promise<any>;
      put(url: string, data?: any, config?: any): Promise<any>;
      delete(url: string, config?: any): Promise<any>;
    };

    constructor(user?: string, password?: string, configurationContext?: string | null);

    getResource(
      url: string,
      oslcVersion?: string,
      accept?: string
    ): Promise<OSLCResource>;

    putResource(
      resource: OSLCResource,
      eTag?: string | null,
      oslcVersion?: string
    ): Promise<OSLCResource>;

    deleteResource(
      resource: OSLCResource,
      oslcVersion?: string
    ): Promise<void>;
  }
}
```

- [ ] **Step 6: Install dependencies**

```bash
cd oslc-mcp-server
npm install
```

- [ ] **Step 7: Verify TypeScript compiles (empty project)**

```bash
cd oslc-mcp-server
echo 'console.log("hello");' > src/index.ts
npx tsc
ls dist/index.js
rm src/index.ts dist/index.js dist/index.js.map dist/index.d.ts
```

Expected: Compiles without error.

- [ ] **Step 8: Commit**

```bash
cd oslc-mcp-server
git add package.json package-lock.json tsconfig.json .gitignore src/oslc-client.d.ts
git commit -m "feat: scaffold oslc-mcp-server package"
```

---

### Task 2: Define Shared Types

**Files:**
- Create: `oslc-mcp-server/src/types.ts`

- [ ] **Step 1: Create types.ts**

Create `oslc-mcp-server/src/types.ts`:

```typescript
/**
 * A single property from an OSLC ResourceShape.
 */
export interface ShapeProperty {
  /** Short name from oslc:name (used as JSON key in tool input) */
  name: string;
  /** Full predicate URI from oslc:propertyDefinition */
  predicateURI: string;
  /** Human-readable description from dcterms:description */
  description: string;
  /** Value type URI (e.g., xsd:string, oslc:Resource) */
  valueType: string;
  /** Cardinality: 'exactly-one' | 'zero-or-one' | 'zero-or-many' | 'one-or-more' */
  occurs: string;
  /** Expected resource type URI from oslc:range (if resource-valued) */
  range: string | null;
  /** Whether the property is read-only */
  readOnly: boolean;
  /** Allowed values (from oslc:allowedValue / oslc:allowedValues) */
  allowedValues: string[];
}

/**
 * A discovered OSLC ResourceShape.
 */
export interface DiscoveredShape {
  /** URI of the resource shape */
  shapeURI: string;
  /** Title of the shape from dcterms:title */
  title: string;
  /** Description from dcterms:description */
  description: string;
  /** Properties defined in this shape */
  properties: ShapeProperty[];
}

/**
 * A discovered creation factory from the service provider.
 */
export interface DiscoveredFactory {
  /** Title from dcterms:title */
  title: string;
  /** Creation factory URL for POST */
  creationURI: string;
  /** Resource type URI from oslc:resourceType */
  resourceType: string;
  /** Associated resource shape */
  shape: DiscoveredShape | null;
}

/**
 * A discovered query capability from the service provider.
 */
export interface DiscoveredQuery {
  /** Title from dcterms:title */
  title: string;
  /** Query base URL */
  queryBase: string;
  /** Resource type URI from oslc:resourceType */
  resourceType: string;
}

/**
 * A discovered service provider.
 */
export interface DiscoveredServiceProvider {
  /** Title from dcterms:title */
  title: string;
  /** URI of the service provider */
  uri: string;
  /** Creation factories */
  factories: DiscoveredFactory[];
  /** Query capabilities */
  queries: DiscoveredQuery[];
}

/**
 * Complete discovery result from walking the catalog.
 */
export interface DiscoveryResult {
  /** The catalog URI */
  catalogURI: string;
  /** Whether the server supports JSON-LD */
  supportsJsonLd: boolean;
  /** All discovered service providers */
  serviceProviders: DiscoveredServiceProvider[];
  /** All discovered resource shapes (deduplicated by URI) */
  shapes: Map<string, DiscoveredShape>;
  /** Raw vocabulary content (RDF as readable text) */
  vocabularyContent: string;
  /** Raw catalog content (readable text summary) */
  catalogContent: string;
  /** Raw shapes content (readable text summary) */
  shapesContent: string;
}

/**
 * Configuration parsed from CLI args and env vars.
 */
export interface ServerConfig {
  serverURL: string;
  catalogURL: string;
  username: string;
  password: string;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/types.ts
git commit -m "feat: add shared type definitions"
```

---

### Task 3: Implement Schema Conversion

**Files:**
- Create: `oslc-mcp-server/src/schema.ts`

This is a pure function module — no I/O, no dependencies beyond the types. It converts OSLC resource shape data into JSON Schema for MCP tool parameters.

- [ ] **Step 1: Create schema.ts**

Create `oslc-mcp-server/src/schema.ts`:

```typescript
import type { DiscoveredShape, ShapeProperty } from './types.js';

/**
 * JSON Schema type definition for MCP tool inputSchema.
 */
export interface JsonSchema {
  type: 'object';
  properties: Record<string, JsonSchemaProperty>;
  required: string[];
  description?: string;
}

interface JsonSchemaProperty {
  type: string;
  description?: string;
  format?: string;
  items?: { type: string; description?: string; format?: string; enum?: string[] };
  enum?: string[];
}

const OSLC_NS = 'http://open-services.net/ns/core#';
const XSD_NS = 'http://www.w3.org/2001/XMLSchema#';

/**
 * Map an oslc:valueType URI to a JSON Schema type.
 */
function mapValueType(valueType: string): { type: string; format?: string } {
  switch (valueType) {
    case `${XSD_NS}string`:
    case `${XSD_NS}anyURI`:
      return { type: 'string' };
    case `${XSD_NS}integer`:
    case `${XSD_NS}int`:
    case `${XSD_NS}long`:
      return { type: 'integer' };
    case `${XSD_NS}float`:
    case `${XSD_NS}double`:
    case `${XSD_NS}decimal`:
      return { type: 'number' };
    case `${XSD_NS}boolean`:
      return { type: 'boolean' };
    case `${XSD_NS}dateTime`:
    case `${XSD_NS}date`:
      return { type: 'string', format: 'date-time' };
    case `${OSLC_NS}Resource`:
    case `${OSLC_NS}AnyResource`:
    case `${OSLC_NS}LocalResource`:
      return { type: 'string' };
    default:
      return { type: 'string' };
  }
}

/**
 * Build a description string for a property, including range info.
 */
function buildDescription(prop: ShapeProperty): string {
  const parts: string[] = [];
  if (prop.description) {
    parts.push(prop.description);
  }

  const isResource =
    prop.valueType === `${OSLC_NS}Resource` ||
    prop.valueType === `${OSLC_NS}AnyResource` ||
    prop.valueType === `${OSLC_NS}LocalResource`;

  if (isResource) {
    parts.push('(URI reference)');
  }
  if (prop.range) {
    parts.push(`Expected type: ${prop.range}`);
  }
  return parts.join(' ');
}

/**
 * Convert an OSLC ResourceShape into a JSON Schema for MCP tool input.
 *
 * @param shape - The discovered resource shape
 * @param excludeReadOnly - If true, exclude read-only properties (for create tools)
 * @returns JSON Schema object
 */
export function shapeToJsonSchema(
  shape: DiscoveredShape,
  excludeReadOnly: boolean = true
): JsonSchema {
  const properties: Record<string, JsonSchemaProperty> = {};
  const required: string[] = [];

  for (const prop of shape.properties) {
    if (excludeReadOnly && prop.readOnly) {
      continue;
    }

    const { type, format } = mapValueType(prop.valueType);
    const description = buildDescription(prop);
    const isArray =
      prop.occurs === 'zero-or-many' || prop.occurs === 'one-or-more';

    if (isArray) {
      const schemaProp: JsonSchemaProperty = {
        type: 'array',
        items: {
          type,
          ...(format ? { format } : {}),
        },
      };
      if (description) schemaProp.description = description;
      if (prop.allowedValues.length > 0) {
        schemaProp.items = { ...schemaProp.items!, enum: prop.allowedValues };
      }
      properties[prop.name] = schemaProp;
    } else {
      const schemaProp: JsonSchemaProperty = { type };
      if (description) schemaProp.description = description;
      if (format) schemaProp.format = format;
      if (prop.allowedValues.length > 0) {
        schemaProp.enum = prop.allowedValues;
      }
      properties[prop.name] = schemaProp;
    }

    if (prop.occurs === 'exactly-one' || prop.occurs === 'one-or-more') {
      required.push(prop.name);
    }
  }

  return {
    type: 'object',
    properties,
    required,
    ...(shape.description ? { description: shape.description } : {}),
  };
}

/**
 * Build a property-name-to-predicate-URI lookup map from a shape.
 */
export function buildPredicateMap(
  shape: DiscoveredShape
): Map<string, string> {
  const map = new Map<string, string>();
  for (const prop of shape.properties) {
    map.set(prop.name, prop.predicateURI);
  }
  return map;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/schema.ts
git commit -m "feat: add OSLC shape to JSON Schema conversion"
```

---

## Chunk 2: Discovery and Tool Implementations

### Task 4: Implement OSLC Discovery

**Files:**
- Create: `oslc-mcp-server/src/discovery.ts`

This module walks the OSLC service provider catalog using oslc-client's `getResource()` method and collects all creation factories, query capabilities, and resource shapes. It also detects JSON-LD support.

- [ ] **Step 1: Create discovery.ts**

Create `oslc-mcp-server/src/discovery.ts`:

```typescript
import { OSLCClient, OSLCResource } from 'oslc-client';
import { Namespace } from 'rdflib';
import type {
  ServerConfig,
  DiscoveryResult,
  DiscoveredServiceProvider,
  DiscoveredFactory,
  DiscoveredQuery,
  DiscoveredShape,
  ShapeProperty,
} from './types.js';

const oslcNS = Namespace('http://open-services.net/ns/core#');
const dctermsNS = Namespace('http://purl.org/dc/terms/');
const xsdNS = Namespace('http://www.w3.org/2001/XMLSchema#');

const OSLC = 'http://open-services.net/ns/core#';

/**
 * Map an oslc:occurs URI to a normalized string.
 */
function normalizeOccurs(occursURI: string): string {
  switch (occursURI) {
    case `${OSLC}Exactly-one`:
      return 'exactly-one';
    case `${OSLC}Zero-or-one`:
      return 'zero-or-one';
    case `${OSLC}Zero-or-many`:
      return 'zero-or-many';
    case `${OSLC}One-or-more`:
      return 'one-or-more';
    default:
      return 'zero-or-one';
  }
}

/**
 * Test if the OSLC server supports JSON-LD content negotiation.
 */
async function testJsonLdSupport(
  client: OSLCClient,
  catalogURL: string
): Promise<boolean> {
  try {
    await client.getResource(catalogURL, '3.0', 'application/ld+json');
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a resource shape document into a DiscoveredShape.
 */
function parseShape(shapeResource: OSLCResource, overrideURI?: string): DiscoveredShape {
  const store = shapeResource.store;
  const shapeURI = overrideURI ?? shapeResource.getURI();
  const shapeSym = store.sym(shapeURI);

  const title =
    store.anyValue(shapeSym, dctermsNS('title')) ?? '';
  const description =
    store.anyValue(shapeSym, dctermsNS('description')) ?? '';

  const propertyNodes = store.each(shapeSym, oslcNS('property'), null);
  const properties: ShapeProperty[] = [];

  for (const propNode of propertyNodes) {
    const name = store.anyValue(propNode, oslcNS('name')) ?? '';
    if (!name) continue;

    const propertyDefinition =
      store.any(propNode, oslcNS('propertyDefinition'))?.value ?? '';
    const descriptionVal =
      store.anyValue(propNode, dctermsNS('description')) ?? '';
    const valueTypeNode = store.any(propNode, oslcNS('valueType'));
    const valueType = valueTypeNode?.value ?? `${xsdNS('').value}string`;
    const occursNode = store.any(propNode, oslcNS('occurs'));
    const occurs = occursNode ? normalizeOccurs(occursNode.value) : 'zero-or-one';
    const rangeNode = store.any(propNode, oslcNS('range'));
    const range = rangeNode?.value ?? null;
    const readOnlyNode = store.any(propNode, oslcNS('readOnly'));
    const readOnly = readOnlyNode?.value === 'true';

    // Collect allowed values
    const allowedValues: string[] = [];
    const allowedValueNodes = store.each(propNode, oslcNS('allowedValue'), null);
    for (const av of allowedValueNodes) {
      allowedValues.push(av.value);
    }
    const allowedValuesNode = store.any(propNode, oslcNS('allowedValues'));
    if (allowedValuesNode) {
      const avMembers = store.each(allowedValuesNode, oslcNS('allowedValue'), null);
      for (const av of avMembers) {
        allowedValues.push(av.value);
      }
    }

    properties.push({
      name,
      predicateURI: propertyDefinition,
      description: descriptionVal,
      valueType,
      occurs,
      range,
      readOnly,
      allowedValues,
    });
  }

  return { shapeURI, title, description, properties };
}

/**
 * Discover all capabilities from an OSLC service provider catalog.
 */
export async function discover(
  client: OSLCClient,
  config: ServerConfig
): Promise<DiscoveryResult> {
  const catalogURL = config.catalogURL;

  // Test JSON-LD support
  const supportsJsonLd = await testJsonLdSupport(client, catalogURL);
  console.error(`[discovery] JSON-LD support: ${supportsJsonLd}`);

  // Fetch catalog
  console.error(`[discovery] Fetching catalog: ${catalogURL}`);
  const catalogResource = await client.getResource(catalogURL, '3.0');
  const catalogStore = catalogResource.store;
  const catalogSym = catalogStore.sym(catalogURL);

  // Find service providers
  const spNodes = catalogStore.each(
    catalogSym,
    oslcNS('serviceProvider'),
    null
  );

  const serviceProviders: DiscoveredServiceProvider[] = [];
  const shapes = new Map<string, DiscoveredShape>();

  for (const spNode of spNodes) {
    const spURI = spNode.value;
    console.error(`[discovery] Fetching service provider: ${spURI}`);

    let spResource: OSLCResource;
    try {
      spResource = await client.getResource(spURI, '3.0');
    } catch (err) {
      console.error(`[discovery] Failed to fetch SP ${spURI}:`, err);
      continue;
    }

    const spStore = spResource.store;
    const spSym = spStore.sym(spURI);
    const spTitle =
      spStore.anyValue(spSym, dctermsNS('title')) ?? spURI;

    // Collect services
    const serviceNodes = spStore.each(spSym, oslcNS('service'), null);

    const factories: DiscoveredFactory[] = [];
    const queries: DiscoveredQuery[] = [];

    for (const serviceNode of serviceNodes) {
      // Creation factories
      const factoryNodes = spStore.each(
        serviceNode,
        oslcNS('creationFactory'),
        null
      );
      for (const factoryNode of factoryNodes) {
        const factoryTitle =
          spStore.anyValue(factoryNode, dctermsNS('title')) ?? '';
        const creationNode = spStore.any(
          factoryNode,
          oslcNS('creation'),
          null
        );
        const creationURI = creationNode?.value ?? '';
        const resourceTypeNode = spStore.any(
          factoryNode,
          oslcNS('resourceType'),
          null
        );
        const resourceType = resourceTypeNode?.value ?? '';
        const shapeNode = spStore.any(
          factoryNode,
          oslcNS('resourceShape'),
          null
        );

        let shape: DiscoveredShape | null = null;
        if (shapeNode) {
          const shapeURI = shapeNode.value;
          if (shapes.has(shapeURI)) {
            shape = shapes.get(shapeURI)!;
          } else {
            try {
              // Fetch the shape document (the shape URI may be a fragment)
              const shapeDocURI = shapeURI.split('#')[0];
              console.error(`[discovery] Fetching shape: ${shapeDocURI}`);
              const shapeResource = await client.getResource(shapeDocURI, '3.0');
              // If the shape URI has a fragment, parse using the fragment URI directly
              // rather than relying on OSLCResource.getURI() which returns the document URI
              shape = parseShape(shapeResource, shapeURI !== shapeDocURI ? shapeURI : undefined);
              shapes.set(shapeURI, shape);
            } catch (err) {
              console.error(
                `[discovery] Failed to fetch shape ${shapeURI}:`,
                err
              );
            }
          }
        }

        if (creationURI) {
          factories.push({
            title: factoryTitle,
            creationURI,
            resourceType,
            shape,
          });
        }
      }

      // Query capabilities
      const queryNodes = spStore.each(
        serviceNode,
        oslcNS('queryCapability'),
        null
      );
      for (const queryNode of queryNodes) {
        const queryTitle =
          spStore.anyValue(queryNode, dctermsNS('title')) ?? '';
        const queryBaseNode = spStore.any(
          queryNode,
          oslcNS('queryBase'),
          null
        );
        const queryBase = queryBaseNode?.value ?? '';
        const resourceTypeNode = spStore.any(
          queryNode,
          oslcNS('resourceType'),
          null
        );
        const resourceType = resourceTypeNode?.value ?? '';

        if (queryBase) {
          queries.push({ title: queryTitle, queryBase, resourceType });
        }
      }
    }

    serviceProviders.push({
      title: spTitle,
      uri: spURI,
      factories,
      queries,
    });
  }

  // Build readable content for MCP resources
  const catalogContent = formatCatalogContent(serviceProviders);
  const shapesContent = formatShapesContent(shapes);
  const vocabularyContent = formatVocabularyContent(serviceProviders, shapes);

  console.error(
    `[discovery] Complete: ${serviceProviders.length} providers, ` +
    `${serviceProviders.reduce((n, sp) => n + sp.factories.length, 0)} factories, ` +
    `${shapes.size} shapes`
  );

  return {
    catalogURI: catalogURL,
    supportsJsonLd,
    serviceProviders,
    shapes,
    vocabularyContent,
    catalogContent,
    shapesContent,
  };
}

/**
 * Format catalog content as human-readable text for MCP resource.
 */
function formatCatalogContent(
  providers: DiscoveredServiceProvider[]
): string {
  const lines: string[] = ['# OSLC Service Provider Catalog\n'];

  for (const sp of providers) {
    lines.push(`## ${sp.title}`);
    lines.push(`URI: ${sp.uri}\n`);

    if (sp.factories.length > 0) {
      lines.push('### Creation Factories');
      for (const f of sp.factories) {
        lines.push(`- **${f.title}**`);
        lines.push(`  - Creation URL: ${f.creationURI}`);
        lines.push(`  - Resource Type: ${f.resourceType}`);
        if (f.shape) {
          lines.push(`  - Shape: ${f.shape.shapeURI}`);
        }
      }
      lines.push('');
    }

    if (sp.queries.length > 0) {
      lines.push('### Query Capabilities');
      for (const q of sp.queries) {
        lines.push(`- **${q.title}**`);
        lines.push(`  - Query Base: ${q.queryBase}`);
        lines.push(`  - Resource Type: ${q.resourceType}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format shapes content as human-readable text for MCP resource.
 */
function formatShapesContent(shapes: Map<string, DiscoveredShape>): string {
  const lines: string[] = ['# OSLC Resource Shapes\n'];

  for (const [uri, shape] of shapes) {
    lines.push(`## ${shape.title || uri}`);
    if (shape.description) {
      lines.push(shape.description);
    }
    lines.push(`URI: ${uri}\n`);

    lines.push('| Property | Type | Required | Description |');
    lines.push('|----------|------|----------|-------------|');
    for (const prop of shape.properties) {
      const required =
        prop.occurs === 'exactly-one' || prop.occurs === 'one-or-more';
      const typeLabel = prop.valueType.split(/[#/]/).pop() ?? prop.valueType;
      const multi =
        prop.occurs === 'zero-or-many' || prop.occurs === 'one-or-more';
      const typeStr = multi ? `${typeLabel}[]` : typeLabel;
      const ro = prop.readOnly ? ' (read-only)' : '';
      lines.push(
        `| ${prop.name} | ${typeStr} | ${required ? 'Yes' : 'No'} | ${prop.description}${ro} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format vocabulary content as human-readable text for MCP resource.
 * Extracts resource types and their relationships from the discovered data.
 */
function formatVocabularyContent(
  providers: DiscoveredServiceProvider[],
  shapes: Map<string, DiscoveredShape>
): string {
  const lines: string[] = ['# OSLC Vocabulary\n'];
  lines.push('## Resource Types\n');

  const seenTypes = new Set<string>();
  for (const sp of providers) {
    for (const f of sp.factories) {
      if (f.resourceType && !seenTypes.has(f.resourceType)) {
        seenTypes.add(f.resourceType);
        const typeName = f.resourceType.split(/[#/]/).pop() ?? f.resourceType;
        lines.push(`### ${typeName}`);
        lines.push(`URI: ${f.resourceType}`);
        lines.push(`Create via: ${f.title}\n`);

        if (f.shape) {
          const resourceProps = f.shape.properties.filter(
            (p) =>
              p.valueType === `${OSLC}Resource` ||
              p.valueType === `${OSLC}AnyResource`
          );
          if (resourceProps.length > 0) {
            lines.push('**Relationships:**');
            for (const rp of resourceProps) {
              const rangeLabel = rp.range
                ? rp.range.split(/[#/]/).pop()
                : 'any';
              lines.push(
                `- ${rp.name} → ${rangeLabel} (${rp.occurs})`
              );
            }
            lines.push('');
          }
        }
      }
    }
  }

  return lines.join('\n');
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

Expected: No errors. Note: `rdflib` is available transitively through oslc-client's dependencies.

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/discovery.ts
git commit -m "feat: add OSLC service provider catalog discovery"
```

---

### Task 5: Implement Generic Tool Handlers

**Files:**
- Create: `oslc-mcp-server/src/tools/generic.ts`

- [ ] **Step 1: Create generic.ts**

Create `oslc-mcp-server/src/tools/generic.ts`:

```typescript
import { OSLCClient } from 'oslc-client';
import { Namespace, IndexedFormula, sym, lit, NamedNode } from 'rdflib';
import type { DiscoveryResult, DiscoveredShape } from '../types.js';

const rdfNS = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

/**
 * Convert an OSLCResource's properties to a plain JSON object for tool output.
 */
function resourceToJson(store: IndexedFormula, uri: string): Record<string, any> {
  const subject = sym(uri);
  const statements = store.statementsMatching(subject, null, null);
  const result: Record<string, any> = { uri };

  const grouped: Record<string, any[]> = {};
  for (const st of statements) {
    const predicate = st.predicate.value;
    const key = predicate.split(/[#/]/).pop() ?? predicate;
    const value = st.object.termType === 'NamedNode'
      ? { uri: st.object.value }
      : st.object.value;

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(value);
  }

  for (const [key, values] of Object.entries(grouped)) {
    result[key] = values.length === 1 ? values[0] : values;
  }

  return result;
}

/**
 * Handler for get_resource tool.
 */
export async function handleGetResource(
  client: OSLCClient,
  args: { uri: string }
): Promise<string> {
  const resource = await client.getResource(args.uri, '3.0');
  const json = resourceToJson(resource.store, resource.getURI());
  return JSON.stringify(json, null, 2);
}

/**
 * Handler for update_resource tool.
 */
export async function handleUpdateResource(
  client: OSLCClient,
  discovery: DiscoveryResult,
  args: { uri: string; properties: Record<string, any> }
): Promise<string> {
  // GET current resource with ETag
  const resource = await client.getResource(args.uri, '3.0');
  const store = resource.store;
  const subject = store.sym(args.uri);

  // Find the shape for this resource to map property names to predicate URIs
  const predicateMap = buildPredicateMapForResource(store, args.uri, discovery);

  // Apply property changes
  for (const [name, value] of Object.entries(args.properties)) {
    const predicateURI = predicateMap.get(name);
    if (!predicateURI) {
      console.error(`[update] Unknown property: ${name}, using as-is`);
      continue;
    }

    const predicate = store.sym(predicateURI);

    // Remove existing values for this predicate
    const existing = store.statementsMatching(subject, predicate, null);
    for (const st of existing) {
      store.remove(st);
    }

    // Add new values
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) {
        store.add(subject, predicate, store.sym(v));
      } else {
        store.add(subject, predicate, lit(String(v)));
      }
    }
  }

  // PUT with ETag
  const updated = await client.putResource(resource, resource.etag, '3.0');
  const json = resourceToJson(updated.store, updated.getURI());
  return JSON.stringify(json, null, 2);
}

/**
 * Handler for delete_resource tool.
 */
export async function handleDeleteResource(
  client: OSLCClient,
  args: { uri: string }
): Promise<string> {
  const resource = await client.getResource(args.uri, '3.0');
  await client.deleteResource(resource, '3.0');
  return JSON.stringify({ deleted: true, uri: args.uri });
}

/**
 * Handler for list_resource_types tool.
 */
export function handleListResourceTypes(
  discovery: DiscoveryResult
): string {
  const types: any[] = [];

  for (const sp of discovery.serviceProviders) {
    for (const factory of sp.factories) {
      const matchingQuery = sp.queries.find(
        (q) => q.resourceType === factory.resourceType
      );

      types.push({
        name: factory.title,
        resourceType: factory.resourceType,
        creationFactory: factory.creationURI,
        queryCapability: matchingQuery?.queryBase ?? null,
        serviceProvider: sp.title,
        properties: factory.shape
          ? factory.shape.properties
              .filter((p) => !p.readOnly)
              .map((p) => ({
                name: p.name,
                type: p.valueType.split(/[#/]/).pop(),
                required:
                  p.occurs === 'exactly-one' || p.occurs === 'one-or-more',
              }))
          : [],
      });
    }
  }

  return JSON.stringify(types, null, 2);
}

/**
 * Handler for query_resources tool.
 */
export async function handleQueryResources(
  client: OSLCClient,
  args: { queryBase: string; filter?: string; select?: string; orderBy?: string }
): Promise<string> {
  let url = args.queryBase;
  const params = new URLSearchParams();
  if (args.filter) params.set('oslc.where', args.filter);
  if (args.select) params.set('oslc.select', args.select);
  if (args.orderBy) params.set('oslc.orderBy', args.orderBy);

  const queryString = params.toString();
  if (queryString) {
    url += (url.includes('?') ? '&' : '?') + queryString;
  }

  const resource = await client.getResource(url, '3.0');
  const store = resource.store;

  // Extract member resources from the query result
  const ldpContains = Namespace('http://www.w3.org/ns/ldp#')('contains');
  const rdfsMember = Namespace('http://www.w3.org/2000/01/rdf-schema#')('member');
  // Use the actual fetched URL as the container subject (includes query params)
  const containerSym = store.sym(url);

  let memberNodes = store.each(containerSym, ldpContains, null);
  if (memberNodes.length === 0) {
    memberNodes = store.each(containerSym, rdfsMember, null);
  }
  // Fallback: try with base URL (some servers use it as container subject)
  if (memberNodes.length === 0) {
    const baseSym = store.sym(args.queryBase);
    memberNodes = store.each(baseSym, ldpContains, null);
    if (memberNodes.length === 0) {
      memberNodes = store.each(baseSym, rdfsMember, null);
    }
  }

  const results = memberNodes.map((node: any) =>
    resourceToJson(store, node.value)
  );

  return JSON.stringify(results, null, 2);
}

/**
 * Build a property-name-to-predicate-URI map for a specific resource,
 * by finding its rdf:type and matching it to a discovered shape.
 */
function buildPredicateMapForResource(
  store: IndexedFormula,
  uri: string,
  discovery: DiscoveryResult
): Map<string, string> {
  const subject = store.sym(uri);
  const typeNodes = store.each(subject, rdfNS('type'), null);
  const typeURIs = typeNodes.map((n: any) => n.value);

  // Try to find a shape that matches one of the resource's types
  for (const sp of discovery.serviceProviders) {
    for (const factory of sp.factories) {
      if (typeURIs.includes(factory.resourceType) && factory.shape) {
        const map = new Map<string, string>();
        for (const prop of factory.shape.properties) {
          map.set(prop.name, prop.predicateURI);
        }
        return map;
      }
    }
  }

  // Fallback: return empty map
  return new Map();
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/tools/generic.ts
git commit -m "feat: add generic CRUD tool handlers"
```

---

### Task 6: Implement Per-Type Tool Factory

**Files:**
- Create: `oslc-mcp-server/src/tools/factory.ts`

This module takes the discovery results and generates MCP tool definitions for each creation factory and query capability.

- [ ] **Step 1: Create factory.ts**

Create `oslc-mcp-server/src/tools/factory.ts`:

```typescript
import { OSLCClient } from 'oslc-client';
import { graph, sym, lit, serialize, Namespace } from 'rdflib';
import type { DiscoveryResult, DiscoveredFactory, DiscoveredQuery } from '../types.js';
import { shapeToJsonSchema, buildPredicateMap } from '../schema.js';

const rdfNS = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

/**
 * A generated MCP tool definition.
 */
export interface GeneratedTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<string>;
}

/**
 * Sanitize a title into a valid tool name component.
 * Lowercases, replaces spaces/hyphens with underscores, removes other non-alphanumeric chars.
 */
function sanitizeName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Generate per-type create and query tools from discovery results.
 */
export function generateTools(
  client: OSLCClient,
  discovery: DiscoveryResult
): GeneratedTool[] {
  const tools: GeneratedTool[] = [];
  const usedNames = new Set<string>();

  for (const sp of discovery.serviceProviders) {
    // Generate create tools from factories
    for (const factory of sp.factories) {
      const baseName = sanitizeName(factory.title);
      let createName = `create_${baseName}`;

      // Disambiguate if name collision
      if (usedNames.has(createName)) {
        let counter = 2;
        while (usedNames.has(`${createName}_${counter}`)) counter++;
        createName = `${createName}_${counter}`;
      }
      usedNames.add(createName);

      if (factory.shape) {
        const inputSchema = shapeToJsonSchema(factory.shape, true);
        const predicateMap = buildPredicateMap(factory.shape);

        tools.push({
          name: createName,
          description: `Create a new ${factory.title} resource. ${factory.shape.description ?? ''}`.trim(),
          inputSchema,
          handler: createCreateHandler(
            client,
            factory,
            predicateMap,
            discovery.supportsJsonLd
          ),
        });
      }

      // Generate query tool for matching query capability
      const matchingQuery = sp.queries.find(
        (q) => q.resourceType === factory.resourceType
      );
      if (matchingQuery) {
        const queryName = `query_${baseName}`;
        if (!usedNames.has(queryName)) {
          usedNames.add(queryName);
          tools.push({
            name: queryName,
            description: `Query ${factory.title} resources.`,
            inputSchema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description:
                    'OSLC query filter (oslc.where). Example: dcterms:title="My Resource"',
                },
                select: {
                  type: 'string',
                  description:
                    'Property projection (oslc.select). Example: dcterms:title,dcterms:description',
                },
                orderBy: {
                  type: 'string',
                  description: 'Sort order (oslc.orderBy).',
                },
              },
              required: [],
            },
            handler: createQueryHandler(client, matchingQuery),
          });
        }
      }
    }
  }

  return tools;
}

/**
 * Create a handler function for a create_<type> tool.
 */
function createCreateHandler(
  client: OSLCClient,
  factory: DiscoveredFactory,
  predicateMap: Map<string, string>,
  supportsJsonLd: boolean
): (args: Record<string, any>) => Promise<string> {
  return async (args: Record<string, any>): Promise<string> => {
    // Build RDF graph from the provided properties
    const store = graph();
    // Use a blank node as subject — the server assigns the URI
    const subject = sym('urn:new-resource');

    // Set rdf:type
    if (factory.resourceType) {
      store.add(subject, rdfNS('type'), sym(factory.resourceType));
    }

    // Add properties
    for (const [name, value] of Object.entries(args)) {
      const predicateURI = predicateMap.get(name);
      if (!predicateURI) {
        console.error(`[create] Unknown property: ${name}, skipping`);
        continue;
      }
      const predicate = sym(predicateURI);

      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (
          typeof v === 'string' &&
          (v.startsWith('http://') || v.startsWith('https://'))
        ) {
          store.add(subject, predicate, sym(v));
        } else {
          store.add(subject, predicate, lit(String(v)));
        }
      }
    }

    // Serialize all statements to Turtle
    const turtle = serialize(undefined, store, undefined, 'text/turtle') ?? '';

    // POST to creation factory
    const response = await client.client.post(factory.creationURI, turtle, {
      headers: {
        'Content-Type': 'text/turtle',
        'Accept': 'text/turtle',
        'OSLC-Core-Version': '3.0',
      },
    });

    const locationHeader =
      response.headers?.['location'] ?? response.headers?.['Location'] ?? '';

    // If we got a Location header, fetch the created resource
    if (locationHeader) {
      try {
        const created = await client.getResource(locationHeader, '3.0');
        const resultStore = created.store;
        const resultSubject = resultStore.sym(created.getURI());
        const statements = resultStore.statementsMatching(resultSubject, null, null);
        const result: Record<string, any> = { uri: created.getURI() };

        for (const st of statements) {
          const key = st.predicate.value.split(/[#/]/).pop() ?? st.predicate.value;
          result[key] = st.object.value;
        }

        return JSON.stringify(result, null, 2);
      } catch {
        return JSON.stringify({ uri: locationHeader, created: true });
      }
    }

    return JSON.stringify({ created: true, status: response.status });
  };
}

/**
 * Create a handler function for a query_<type> tool.
 */
function createQueryHandler(
  client: OSLCClient,
  queryCapability: DiscoveredQuery
): (args: any) => Promise<string> {
  return async (args: {
    filter?: string;
    select?: string;
    orderBy?: string;
  }): Promise<string> => {
    let url = queryCapability.queryBase;
    const params = new URLSearchParams();
    if (args.filter) params.set('oslc.where', args.filter);
    if (args.select) params.set('oslc.select', args.select);
    if (args.orderBy) params.set('oslc.orderBy', args.orderBy);

    const queryString = params.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    const resource = await client.getResource(url, '3.0');
    const store = resource.store;

    const ldpContains = Namespace('http://www.w3.org/ns/ldp#')('contains');
    const rdfsMember = Namespace('http://www.w3.org/2000/01/rdf-schema#')('member');
    // Use the actual fetched URL as the container subject (includes query params)
    const containerSym = store.sym(url);

    let memberNodes = store.each(containerSym, ldpContains, null);
    if (memberNodes.length === 0) {
      memberNodes = store.each(containerSym, rdfsMember, null);
    }
    // Fallback: try with base URL (some servers use it as container subject)
    if (memberNodes.length === 0) {
      const baseSym = store.sym(queryCapability.queryBase);
      memberNodes = store.each(baseSym, ldpContains, null);
      if (memberNodes.length === 0) {
        memberNodes = store.each(baseSym, rdfsMember, null);
      }
    }

    const results = memberNodes.map((node: any) => {
      const memberSubject = store.sym(node.value);
      const statements = store.statementsMatching(memberSubject, null, null);
      const result: Record<string, any> = { uri: node.value };
      for (const st of statements) {
        const key = st.predicate.value.split(/[#/]/).pop() ?? st.predicate.value;
        result[key] = st.object.value;
      }
      return result;
    });

    return JSON.stringify(results, null, 2);
  };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/tools/factory.ts
git commit -m "feat: add per-type tool generation from OSLC shapes"
```

---

## Chunk 3: MCP Server Integration and Entry Point

### Task 7: Implement MCP Resources

**Files:**
- Create: `oslc-mcp-server/src/resources.ts`

- [ ] **Step 1: Create resources.ts**

Create `oslc-mcp-server/src/resources.ts`:

```typescript
import type { DiscoveryResult } from './types.js';

/**
 * MCP resource definition.
 */
export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
}

/**
 * Build MCP resource definitions from discovery results.
 */
export function buildMcpResources(discovery: DiscoveryResult): McpResource[] {
  return [
    {
      uri: 'oslc://catalog',
      name: 'OSLC Service Provider Catalog',
      description:
        'Lists all service providers, creation factories, query capabilities, and resource types available on this OSLC server.',
      mimeType: 'text/plain',
      content: discovery.catalogContent,
    },
    {
      uri: 'oslc://vocabulary',
      name: 'OSLC Vocabulary',
      description:
        'Resource types and their relationships. Read this to understand the domain model before creating resources.',
      mimeType: 'text/plain',
      content: discovery.vocabularyContent,
    },
    {
      uri: 'oslc://shapes',
      name: 'OSLC Resource Shapes',
      description:
        'Property definitions for each resource type: names, types, cardinalities, descriptions. Read this to know what fields each resource type accepts.',
      mimeType: 'text/plain',
      content: discovery.shapesContent,
    },
  ];
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/resources.ts
git commit -m "feat: add MCP resource definitions for catalog/vocabulary/shapes"
```

---

### Task 8: Implement MCP Server Setup

**Files:**
- Create: `oslc-mcp-server/src/server.ts`

- [ ] **Step 1: Create server.ts**

Create `oslc-mcp-server/src/server.ts`:

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OSLCClient } from 'oslc-client';
import type { DiscoveryResult } from './types.js';
import type { GeneratedTool } from './tools/factory.js';
import type { McpResource } from './resources.js';
import {
  handleGetResource,
  handleUpdateResource,
  handleDeleteResource,
  handleListResourceTypes,
  handleQueryResources,
} from './tools/generic.js';

/**
 * Build and start the MCP server with discovered tools and resources.
 */
export async function startServer(
  client: OSLCClient,
  discovery: DiscoveryResult,
  generatedTools: GeneratedTool[],
  mcpResources: McpResource[]
): Promise<void> {
  const server = new Server(
    { name: 'oslc-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Build the complete tool list: generated + generic
  const allTools = [
    ...generatedTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    {
      name: 'get_resource',
      description: 'Fetch an OSLC resource by URI and return all its properties.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          uri: { type: 'string', description: 'The URI of the resource to fetch' },
        },
        required: ['uri'],
      },
    },
    {
      name: 'update_resource',
      description:
        'Update an OSLC resource. Provided properties replace existing values; omitted properties are unchanged.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          uri: { type: 'string', description: 'The URI of the resource to update' },
          properties: {
            type: 'object',
            description: 'Properties to set (key-value pairs)',
          },
        },
        required: ['uri', 'properties'],
      },
    },
    {
      name: 'delete_resource',
      description: 'Delete an OSLC resource by URI.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          uri: { type: 'string', description: 'The URI of the resource to delete' },
        },
        required: ['uri'],
      },
    },
    {
      name: 'list_resource_types',
      description:
        'List all discovered OSLC resource types with their creation factories, query capabilities, and property summaries.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'query_resources',
      description: 'Query OSLC resources using a query capability URL.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          queryBase: {
            type: 'string',
            description: 'The query capability URL',
          },
          filter: {
            type: 'string',
            description:
              'OSLC query filter (oslc.where). Example: dcterms:title="My Resource"',
          },
          select: {
            type: 'string',
            description: 'Property projection (oslc.select)',
          },
          orderBy: {
            type: 'string',
            description: 'Sort order (oslc.orderBy)',
          },
        },
        required: ['queryBase'],
      },
    },
  ];

  // Build handler lookup for generated tools
  const generatedHandlers = new Map<string, (args: any) => Promise<string>>();
  for (const tool of generatedTools) {
    generatedHandlers.set(tool.name, tool.handler);
  }

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      // Check generated tools first
      const generatedHandler = generatedHandlers.get(name);
      if (generatedHandler) {
        result = await generatedHandler(args ?? {});
      } else {
        // Generic tools
        switch (name) {
          case 'get_resource':
            result = await handleGetResource(client, args as any);
            break;
          case 'update_resource':
            result = await handleUpdateResource(client, discovery, args as any);
            break;
          case 'delete_resource':
            result = await handleDeleteResource(client, args as any);
            break;
          case 'list_resource_types':
            result = await handleListResourceTypes(discovery);
            break;
          case 'query_resources':
            result = await handleQueryResources(client, args as any);
            break;
          default:
            return {
              content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
              isError: true,
            };
        }
      }

      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err: any) {
      const message = err?.response?.data
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : err?.message ?? String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Register resource list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: mcpResources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = mcpResources.find((r) => r.uri === request.params.uri);
    if (!resource) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: resource.content,
        },
      ],
    };
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[server] OSLC MCP server running on stdio');
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-mcp-server && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd oslc-mcp-server
git add src/server.ts
git commit -m "feat: add MCP server setup with tool/resource registration"
```

---

### Task 9: Implement CLI Entry Point

**Files:**
- Create: `oslc-mcp-server/src/index.ts`

- [ ] **Step 1: Create index.ts**

Create `oslc-mcp-server/src/index.ts`:

```typescript
#!/usr/bin/env node

import { OSLCClient } from 'oslc-client';
import { discover } from './discovery.js';
import { generateTools } from './tools/factory.js';
import { buildMcpResources } from './resources.js';
import { startServer } from './server.js';
import type { ServerConfig } from './types.js';

/**
 * Parse CLI arguments. Supports:
 *   --server <url>
 *   --catalog <url>
 *   --username <user>
 *   --password <pass>
 */
function parseArgs(argv: string[]): Partial<ServerConfig> {
  const config: Partial<ServerConfig> = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--server':
        config.serverURL = argv[++i];
        break;
      case '--catalog':
        config.catalogURL = argv[++i];
        break;
      case '--username':
        config.username = argv[++i];
        break;
      case '--password':
        config.password = argv[++i];
        break;
    }
  }
  return config;
}

/**
 * Build configuration from env vars + CLI args (CLI overrides env).
 */
function buildConfig(cliArgs: Partial<ServerConfig>): ServerConfig {
  const serverURL = cliArgs.serverURL ?? process.env.OSLC_SERVER_URL ?? '';
  const catalogURL =
    cliArgs.catalogURL ??
    process.env.OSLC_CATALOG_URL ??
    (serverURL ? `${serverURL}/oslc/catalog` : '');
  const username = cliArgs.username ?? process.env.OSLC_USERNAME ?? '';
  const password = cliArgs.password ?? process.env.OSLC_PASSWORD ?? '';

  if (!serverURL) {
    console.error(
      'Error: OSLC_SERVER_URL environment variable or --server argument is required.'
    );
    console.error(
      'Usage: oslc-mcp-server --server <url> [--catalog <url>] [--username <user>] [--password <pass>]'
    );
    process.exit(1);
  }

  return { serverURL, catalogURL, username, password };
}

async function main(): Promise<void> {
  const cliArgs = parseArgs(process.argv.slice(2));
  const config = buildConfig(cliArgs);

  console.error(`[startup] Connecting to OSLC server: ${config.serverURL}`);
  console.error(`[startup] Catalog URL: ${config.catalogURL}`);

  // Create oslc-client
  const client = new OSLCClient(
    config.username || undefined,
    config.password || undefined
  );

  // Discover capabilities
  console.error('[startup] Discovering OSLC capabilities...');
  const discovery = await discover(client, config);

  // Generate per-type tools
  const generatedTools = generateTools(client, discovery);
  console.error(`[startup] Generated ${generatedTools.length} per-type tools`);

  // Build MCP resources
  const mcpResources = buildMcpResources(discovery);

  // Start MCP server
  await startServer(client, discovery, generatedTools, mcpResources);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
```

- [ ] **Step 2: Build the complete project**

```bash
cd oslc-mcp-server && npx tsc
```

Expected: Compiles all files to `dist/` with no errors.

- [ ] **Step 3: Verify the built entry point exists**

```bash
ls oslc-mcp-server/dist/index.js
```

- [ ] **Step 4: Commit**

```bash
cd oslc-mcp-server
git add src/index.ts
git commit -m "feat: add CLI entry point with arg parsing and startup"
```

---

### Task 10: Integration Test with mrm-server

This task verifies the MCP server works end-to-end against a running mrm-server.

- [ ] **Step 1: Build the MCP server**

```bash
cd oslc-mcp-server && npm run build
```

- [ ] **Step 2: Test startup against mrm-server**

Start mrm-server first (requires Fuseki running on localhost:3030/mrm):

```bash
cd mrm-server && npm start &
MRM_PID=$!
sleep 3
```

Wait for mrm-server to be ready:

```bash
curl -s -o /dev/null -w "%{http_code}" http://localhost:3002/oslc/catalog
```

Expected: `200`. If not `200`, wait and retry.

Then test the MCP server startup (it will connect, discover, and exit when stdin closes):

```bash
cd oslc-mcp-server
echo '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}' | node dist/index.js --server http://localhost:3002 2>stderr.log
cat stderr.log
```

Expected in stderr.log:
- `[startup] Connecting to OSLC server: http://localhost:3002`
- `[discovery] Fetching catalog: http://localhost:3002/oslc/catalog`
- `[discovery] Complete: N providers, M factories, K shapes`
- `[startup] Generated N per-type tools`
- `[server] OSLC MCP server running on stdio`

- [ ] **Step 3: Test tools/list via MCP protocol**

```bash
printf '{"jsonrpc":"2.0","id":1,"method":"initialize","params":{"protocolVersion":"2024-11-05","capabilities":{},"clientInfo":{"name":"test","version":"1.0.0"}}}\n{"jsonrpc":"2.0","id":2,"method":"tools/list","params":{}}' | node dist/index.js --server http://localhost:3002 2>/dev/null
```

Expected: JSON output listing all tools (generic + per-type).

- [ ] **Step 4: Stop mrm-server**

```bash
kill $MRM_PID 2>/dev/null
rm -f oslc-mcp-server/stderr.log
```

- [ ] **Step 5: Update build order documentation**

Update `docs/system_patterns.md` to add oslc-mcp-server to the build order. Find the existing build order section and append `oslc-client → oslc-mcp-server` as a new entry.

- [ ] **Step 6: Commit**

```bash
git add oslc-mcp-server/package.json oslc-mcp-server/package-lock.json oslc-mcp-server/tsconfig.json oslc-mcp-server/.gitignore oslc-mcp-server/src/ docs/system_patterns.md
git commit -m "feat: oslc-mcp-server complete — OSLC MCP adapter with dynamic tool generation"
```
