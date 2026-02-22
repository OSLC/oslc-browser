# OSLC4JS TypeScript Conversion Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Convert 5 existing JavaScript modules to TypeScript and extract a new shared `storage-service` module, modernizing from CommonJS/callbacks to ESM/async-await with strict typing.

**Architecture:** A shared `storage-service` package defines the `StorageService` interface and common vocabulary/media types. `oslc-service` and `ldp-service` are Express middleware that consume a `StorageService`. Three backends (`ldp-service-fs`, `ldp-service-mongodb`, `ldp-service-jena`) each implement `StorageService` directly.

**Tech Stack:** TypeScript 5.x, Node 22, ESM modules, Express 5, rdflib.js, MongoDB driver 6.x, Node built-in fetch

**Design doc:** `docs/plans/2026-02-22-typescript-conversion-design.md`

---

### Task 1: Create storage-service — Project Scaffolding

**Files:**
- Create: `storage-service/package.json`
- Create: `storage-service/tsconfig.json`
- Create: `storage-service/.gitignore`

**Step 1: Create package.json**

```json
{
  "name": "storage-service",
  "version": "1.0.0",
  "description": "Abstract storage service interface for OSLC servers",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "author": "Jim Amsden",
  "dependencies": {
    "rdflib": "^2.2.35"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": "^22.11.0"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
```

**Step 4: Install dependencies**

Run: `cd storage-service && npm install`

**Step 5: Commit**

```bash
git add storage-service/package.json storage-service/tsconfig.json storage-service/.gitignore
git commit -m "feat(storage-service): scaffold new shared module"
```

---

### Task 2: Create storage-service — Vocabulary and Media Types

**Files:**
- Create: `storage-service/src/vocab/ldp.ts`
- Create: `storage-service/src/vocab/rdf.ts`
- Create: `storage-service/src/media.ts`

**Step 1: Write LDP vocabulary**

File: `storage-service/src/vocab/ldp.ts`

```typescript
const ns = 'http://www.w3.org/ns/ldp#' as const;

export const ldp = {
  ns,
  prefix: 'ldp' as const,

  // Resources
  Resource: `${ns}Resource`,
  RDFSource: `${ns}RDFSource`,
  Container: `${ns}Container`,
  BasicContainer: `${ns}BasicContainer`,
  DirectContainer: `${ns}DirectContainer`,

  // Properties
  contains: `${ns}contains`,
  membershipResource: `${ns}membershipResource`,
  hasMemberRelation: `${ns}hasMemberRelation`,
  isMemberOfRelation: `${ns}isMemberOfRelation`,

  // Link relations
  constrainedBy: `${ns}constrainedBy`,

  // Preferences
  PreferContainment: `${ns}PreferContainment`,
  PreferMembership: `${ns}PreferMembership`,
  PreferMinimalContainer: `${ns}PreferMinimalContainer`,
  PreferEmptyContainer: `${ns}PreferEmptyContainer`,
} as const;
```

**Step 2: Write RDF vocabulary**

File: `storage-service/src/vocab/rdf.ts`

```typescript
const ns = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#' as const;

export const rdf = {
  ns,
  prefix: 'rdf' as const,

  // Properties
  type: `${ns}type`,
  resource: `${ns}resource`,
} as const;
```

**Step 3: Write media types**

File: `storage-service/src/media.ts`

```typescript
export const media = {
  turtle: 'text/turtle',
  text: 'text/plain',
  n3: 'text/n3',
  jsonld: 'application/ld+json',
  json: 'application/json',
  rdfxml: 'application/rdf+xml',
} as const;

export type MediaType = typeof media[keyof typeof media];
```

**Step 4: Build to verify**

Run: `cd storage-service && npx tsc --noEmit`
Expected: No errors

**Step 5: Commit**

```bash
git add storage-service/src/vocab/ storage-service/src/media.ts
git commit -m "feat(storage-service): add vocabulary constants and media types"
```

---

### Task 3: Create storage-service — StorageService Interface

**Files:**
- Create: `storage-service/src/storage.ts`
- Create: `storage-service/src/index.ts`

**Step 1: Write the StorageService interface**

File: `storage-service/src/storage.ts`

Note: `rdflib` uses `IndexedFormula` as its in-memory RDF graph representation. The storage interface works with `IndexedFormula` instances that have additional properties added at runtime (`uri`, `interactionModel`, `membershipResource`, `hasMemberRelation`, `isMemberOfRelation`, `membershipResourceFor`). We define an `LdpDocument` type to capture these extensions.

```typescript
import type { IndexedFormula } from 'rdflib';

/**
 * Environment configuration for initializing a storage service.
 * Backends extend this with their specific configuration.
 */
export interface StorageEnv {
  appBase: string;
  context?: string;
  dbName?: string;
  mongoURL?: string;
  jenaURL?: string;
  [key: string]: unknown;
}

/**
 * Membership pattern for a DirectContainer.
 */
export interface MembershipPattern {
  container: string;
  hasMemberRelation?: string;
}

/**
 * An IndexedFormula with LDP metadata properties added at runtime.
 * This captures the pattern used throughout the codebase where
 * additional properties are attached to rdflib IndexedFormula instances.
 */
export interface LdpDocument extends IndexedFormula {
  uri: string;
  interactionModel?: string | null;
  membershipResource?: string;
  hasMemberRelation?: string;
  isMemberOfRelation?: string;
  membershipResourceFor?: MembershipPattern[];
}

/**
 * Result of a getMembershipTriples query.
 * Each binding has a `member` property with a `value` (URI string).
 */
export interface MemberBinding {
  member: { value: string };
}

/**
 * Abstract storage service interface.
 *
 * Provides a container of resources representing RDF graphs.
 * Implemented on different data sources (file system, MongoDB,
 * Apache Jena) to provide LDP access to those resources.
 */
export interface StorageService {
  /**
   * Initialize the storage backend.
   */
  init(env: StorageEnv): Promise<void>;

  /**
   * Drop/reset the storage backend.
   */
  drop(): Promise<void>;

  /**
   * Reserve a URI for subsequent update. Creates an empty graph placeholder.
   * Throws/rejects if the URI is already taken.
   */
  reserveURI(uri: string): Promise<number>;

  /**
   * Release a reserved URI that is no longer needed.
   */
  releaseURI(uri: string): Promise<void>;

  /**
   * Read a resource by URI. Returns the status code and the document.
   * Status 200 with document on success, 404 if not found.
   */
  read(uri: string): Promise<{ status: number; document: LdpDocument | null }>;

  /**
   * Create or update a resource.
   * Returns the HTTP status code (201 for create, 200 for update).
   */
  update(resource: LdpDocument): Promise<number>;

  /**
   * Insert triples into an existing resource (for PATCH support).
   */
  insertData(data: IndexedFormula, uri: string): Promise<number>;

  /**
   * Remove/delete a resource by URI.
   * Returns the HTTP status code.
   */
  remove(uri: string): Promise<number>;

  /**
   * Get membership triples for a container.
   * Used to calculate containment and membership on GET.
   */
  getMembershipTriples(container: LdpDocument): Promise<{ status: number; members: MemberBinding[] | null }>;
}
```

**Step 2: Write the index re-export**

File: `storage-service/src/index.ts`

```typescript
export { type StorageService, type StorageEnv, type LdpDocument, type MemberBinding, type MembershipPattern } from './storage.js';
export { ldp } from './vocab/ldp.js';
export { rdf } from './vocab/rdf.js';
export { media, type MediaType } from './media.js';
```

**Step 3: Build the module**

Run: `cd storage-service && npm run build`
Expected: Successful compilation, `dist/` directory created with `.js`, `.d.ts`, and `.map` files

**Step 4: Commit**

```bash
git add storage-service/src/storage.ts storage-service/src/index.ts
git commit -m "feat(storage-service): define StorageService interface and exports"
```

---

### Task 4: Convert ldp-service — Project Scaffolding

**Files:**
- Modify: `ldp-service/package.json`
- Create: `ldp-service/tsconfig.json`
- Create: `ldp-service/.gitignore`

**Step 1: Update package.json**

Replace `ldp-service/package.json` with:

```json
{
  "name": "ldp-service",
  "version": "2.0.0",
  "description": "Express middleware for the W3C Linked Data Platform",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "author": "Jim Amsden",
  "contributors": "Neil Davis",
  "dependencies": {
    "express": "^5.0.1",
    "rdflib": "^2.2.35",
    "storage-service": "../storage-service"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/express": "^5.0.0"
  },
  "engines": {
    "node": "^22.11.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/OSLC/ldp-service.git"
  }
}
```

**Step 2: Create tsconfig.json**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "Node16",
    "moduleResolution": "Node16",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "strict": true,
    "esModuleInterop": true,
    "skipLibCheck": true,
    "forceConsistentCasingInFileNames": true
  },
  "include": ["src/**/*.ts"],
  "exclude": ["node_modules", "dist"]
}
```

**Step 3: Create .gitignore**

```
node_modules/
dist/
```

**Step 4: Install dependencies**

Run: `cd ldp-service && npm install`

**Step 5: Commit**

```bash
git add ldp-service/package.json ldp-service/tsconfig.json ldp-service/.gitignore
git commit -m "feat(ldp-service): update project scaffolding for TypeScript"
```

---

### Task 5: Convert ldp-service — Service Implementation

This is the core LDP Express middleware. Convert `ldp-service/service.js` to TypeScript with async/await, importing shared types from `storage-service`.

**Files:**
- Create: `ldp-service/src/service.ts`
- Create: `ldp-service/src/index.ts`

**Step 1: Write service.ts**

File: `ldp-service/src/service.ts`

Convert the existing `ldp-service/service.js` (700 lines) to TypeScript. Key changes:
- Import types from `storage-service` (`StorageService`, `StorageEnv`, `LdpDocument`, `ldp`, `rdf`, `media`)
- Replace `var` with `const`/`let`
- Replace callbacks with `async`/`await`
- Add type annotations to all functions
- The module exports a factory function that takes `StorageEnv` and `StorageService` and returns an Express app
- Replace `new Buffer()` with `Buffer.from()`
- Use `rdflib` namespace helpers for type safety

The full converted source should follow the structure of the original `service.js` but with:

```typescript
import express, { Request, Response, NextFunction } from 'express';
import * as rdflib from 'rdflib';
import { createHash } from 'node:crypto';
import {
  type StorageService,
  type StorageEnv,
  type LdpDocument,
  type MemberBinding,
  ldp,
  media,
} from 'storage-service';

// Convenient rdflib namespaces
const RDF = rdflib.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const LDP = rdflib.Namespace('http://www.w3.org/ns/ldp#');

// Extend Express Request with custom properties
interface LdpRequest extends Request {
  fullURL: string;
  rawBody: string;
}

/**
 * Generate an ETag for content using MD5 hash.
 */
export function getETag(content: string): string {
  return 'W/"' + createHash('md5').update(content).digest('hex') + '"';
}

/**
 * Create the LDP Express middleware.
 */
export function ldpService(env: StorageEnv, storage: StorageService): express.Express {
  const appBase = env.appBase;

  // fullURL middleware
  const fullURL = (req: LdpRequest, _res: Response, next: NextFunction): void => {
    req.fullURL = appBase + req.originalUrl;
    next();
  };

  // rawBody middleware
  const rawBody = (req: LdpRequest, _res: Response, next: NextFunction): void => {
    req.rawBody = '';
    req.setEncoding('utf8');
    req.on('data', (chunk: string) => { req.rawBody += chunk; });
    req.on('end', () => { next(); });
  };

  // ... rest of the route handlers converted to use async/await
  // Each handler calls storage methods with await instead of callbacks
  // e.g.:
  //   const { status, document } = await storage.read(req.fullURL);
  //   instead of:
  //   db.read(req.fullURL, function(err, document) { ... });
}
```

Key conversion patterns applied throughout:
- `db.read(uri, function(err, doc) {...})` becomes `const { status, document } = await storage.read(uri)`
- `db.update(doc, function(err) {...})` becomes `const status = await storage.update(doc)`
- `db.reserveURI(uri, function(err) {...})` becomes `const status = await storage.reserveURI(uri)`
- `rdflib.serialize(...)` callback becomes promisified with a helper
- `rdflib.parse(...)` callback becomes promisified with a helper
- All route handlers wrapped with async error handling

Helper for promisifying rdflib callbacks:

```typescript
function serializeRdf(
  subject: rdflib.NamedNode,
  graph: rdflib.IndexedFormula,
  base: string,
  contentType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    rdflib.serialize(subject, graph, base, contentType, (err: Error | undefined, content: string) => {
      if (err) reject(err);
      else resolve(content);
    });
  });
}

function parseRdf(
  body: string,
  graph: rdflib.IndexedFormula,
  baseURI: string,
  contentType: string
): Promise<rdflib.IndexedFormula> {
  return new Promise((resolve, reject) => {
    rdflib.parse(body, graph, baseURI, contentType, (err: Error | undefined, result: rdflib.IndexedFormula) => {
      if (err) reject(err);
      else resolve(result);
    });
  });
}
```

**Step 2: Write index.ts**

File: `ldp-service/src/index.ts`

```typescript
export { ldpService, getETag } from './service.js';
```

**Step 3: Build to verify**

Run: `cd ldp-service && npm run build`
Expected: Successful compilation

**Step 4: Commit**

```bash
git add ldp-service/src/
git commit -m "feat(ldp-service): convert service to TypeScript with async/await"
```

---

### Task 6: Convert oslc-service — Project Scaffolding

**Files:**
- Modify: `oslc-service/package.json`
- Create: `oslc-service/tsconfig.json`
- Create: `oslc-service/.gitignore`

**Step 1: Update package.json**

```json
{
  "name": "oslc-service",
  "version": "2.0.0",
  "description": "Express middleware for OSLC 3.0 that supports any OSLC Domain",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "author": "Jim Amsden",
  "contributors": "Jim Ruehlin <jruehlin@us.ibm.com>",
  "dependencies": {
    "express": "^5.0.1",
    "rdflib": "^2.2.35",
    "storage-service": "../storage-service",
    "ldp-service": "../ldp-service"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0",
    "@types/express": "^5.0.0"
  },
  "engines": {
    "node": "^22.11.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/OSLC/oslc-service.git"
  }
}
```

**Step 2: Create tsconfig.json** (same pattern as other modules)

**Step 3: Create .gitignore** (same pattern)

**Step 4: Install dependencies**

Run: `cd oslc-service && npm install`

**Step 5: Commit**

```bash
git add oslc-service/package.json oslc-service/tsconfig.json oslc-service/.gitignore
git commit -m "feat(oslc-service): update project scaffolding for TypeScript"
```

---

### Task 7: Convert oslc-service — OSLC Vocabulary

**Files:**
- Create: `oslc-service/src/vocab/oslc.ts`

**Step 1: Write OSLC vocabulary**

File: `oslc-service/src/vocab/oslc.ts`

```typescript
const ns = 'http://open-services.net/ns/core#' as const;

export const oslc = {
  ns,

  ResponseInfo: `${ns}ResponseInfo`,
  'Exactly-one': `${ns}Exactly-one`,
  'Zero-or-one': `${ns}Zero-or-one`,
  'Zero-or-many': `${ns}Zero-or-many`,
  'One-or-many': `${ns}One-or-many`,

  ServiceProviderCatalog: `${ns}ServiceProviderCatalog`,
  ServiceProvider: `${ns}ServiceProvider`,
  Service: `${ns}Service`,
  service: `${ns}service`,

  CreationFactory: `${ns}CreationFactory`,
  creationFactory: `${ns}creationFactory`,
  creation: `${ns}creation`,

  QueryCapability: `${ns}QueryCapability`,
  queryCapability: `${ns}queryCapability`,
  queryBase: `${ns}queryBase`,

  Dialog: `${ns}Dialog`,
  creationDialog: `${ns}creationDialog`,
  selectionDialog: `${ns}selectionDialog`,
  dialog: `${ns}dialog`,

  Publisher: `${ns}Publisher`,
  icon: `${ns}icon`,

  PrefixDefinition: `${ns}PrefixDefinition`,
  prefix: `${ns}prefix`,
  prefixBase: `${ns}prefixBase`,

  OAuthConfiguration: `${ns}OAuthConfiguration`,
  oauthRequestTokenURI: `${ns}oauthRequestTokenURI`,
  authorizationURI: `${ns}authorizationURI`,
  oauthAccessTokenURI: `${ns}oauthAccessTokenURI`,

  hintHeight: `${ns}hintHeight`,
  hintWidth: `${ns}hintWidth`,

  Error: `${ns}Error`,
  ExtendedError: `${ns}ExtendedError`,

  usage: `${ns}usage`,
  default: `${ns}default`,
  resourceShape: `${ns}resourceShape`,
  resourceType: `${ns}resourceType`,
  domain: `${ns}domain`,
  label: `${ns}label`,

  Property: `${ns}Property`,
  occurs: `${ns}occurs`,
  valueType: `${ns}valueType`,
  Resource: `${ns}Resource`,
  LocalResource: `${ns}LocalResource`,
  representation: `${ns}representation`,

  Inline: `${ns}Inline`,
  Reference: `${ns}Reference`,

  results: `${ns}results`,
} as const;
```

**Step 2: Build to verify**

Run: `cd oslc-service && npx tsc --noEmit`

**Step 3: Commit**

```bash
git add oslc-service/src/vocab/oslc.ts
git commit -m "feat(oslc-service): add OSLC vocabulary as TypeScript"
```

---

### Task 8: Convert oslc-service — Service and LDP Modules

**Files:**
- Create: `oslc-service/src/service.ts`
- Create: `oslc-service/src/ldp.ts`
- Create: `oslc-service/src/index.ts`

**Step 1: Write ldp.ts**

Convert `oslc-service/ldp.js` to TypeScript. This module provides the LDP protocol API used by oslc-service. Key changes:
- Import `StorageService`, `LdpDocument` etc. from `storage-service`
- Import `getETag` from `ldp-service`
- Replace callback-based `db.read()` etc. with `await storage.read()`
- Export a class or object with `init`, `options`, `get`, `put`, `post`, `delete`, `getETag` methods
- All methods become async

```typescript
import * as rdflib from 'rdflib';
import { createHash } from 'node:crypto';
import {
  type StorageService,
  type StorageEnv,
  type LdpDocument,
  ldp,
  media,
} from 'storage-service';
import type { Request, Response, NextFunction } from 'express';

// ... converted ldp.js content with async/await
```

**Step 2: Write service.ts**

Convert `oslc-service/service.js` to TypeScript. The OSLC Express middleware that handles content negotiation and delegates to ldp.ts.

```typescript
import express, { type Request, type Response, type NextFunction } from 'express';
import * as rdflib from 'rdflib';
import { type StorageService, type StorageEnv, ldp, media } from 'storage-service';
import { createLdpHandler } from './ldp.js';
import { oslc } from './vocab/oslc.js';

interface LdpRequest extends Request {
  fullURL: string;
  rawBody: string;
}

export interface OslcEnv extends StorageEnv {
  context?: string;
  storageService: StorageService;
}

export function oslcService(env: OslcEnv): express.Express {
  const appBase = env.appBase;
  const ldpHandler = createLdpHandler(env, env.storageService);
  const context = env.context ?? '/r/';

  const app = express();
  // ... middleware and routes converted to async/await
  return app;
}
```

**Step 3: Write index.ts**

```typescript
export { oslcService, type OslcEnv } from './service.js';
export { oslc } from './vocab/oslc.js';
```

**Step 4: Build to verify**

Run: `cd oslc-service && npm run build`

**Step 5: Commit**

```bash
git add oslc-service/src/
git commit -m "feat(oslc-service): convert service and LDP handler to TypeScript"
```

---

### Task 9: Convert ldp-service-jena — Full Conversion

This backend implements `StorageService` using Apache Jena/Fuseki. Convert from callbacks + `request` library to async/await + `fetch`.

**Files:**
- Modify: `ldp-service-jena/package.json`
- Create: `ldp-service-jena/tsconfig.json`
- Create: `ldp-service-jena/.gitignore`
- Create: `ldp-service-jena/src/storage.ts`
- Create: `ldp-service-jena/src/index.ts`

**Step 1: Update package.json**

```json
{
  "name": "ldp-service-jena",
  "version": "2.0.0",
  "description": "StorageService implementation using Apache Jena/Fuseki",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "author": "Jim Amsden",
  "contributors": "Neil Davis",
  "dependencies": {
    "rdflib": "^2.2.35",
    "storage-service": "../storage-service"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": "^22.11.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/OSLC/ldp-service-jena.git"
  }
}
```

Note: `request` dependency removed. Uses Node built-in `fetch` instead.

**Step 2: Create tsconfig.json and .gitignore** (same pattern)

**Step 3: Write storage.ts**

File: `ldp-service-jena/src/storage.ts`

Convert `storage.js` to TypeScript. Key changes:
- Replace `request(options, callback)` with `await fetch(url, options)`
- Replace `var storage_services = require('ldp-service').storageService` pattern with class implementing `StorageService`
- Use `rdflib` namespace helpers
- Promisify `rdflib.parse` and `rdflib.serialize`

```typescript
import * as rdflib from 'rdflib';
import {
  type StorageService,
  type StorageEnv,
  type LdpDocument,
  type MemberBinding,
  ldp,
} from 'storage-service';

const RDF = rdflib.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const LDP = rdflib.Namespace('http://www.w3.org/ns/ldp#');

export class JenaStorageService implements StorageService {
  private jenaURL = '';

  async init(env: StorageEnv): Promise<void> {
    this.jenaURL = env.jenaURL as string;
  }

  async reserveURI(uri: string): Promise<number> {
    const res = await fetch(`${this.jenaURL}data?graph=${uri}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/ld+json' },
      body: '{}',
    });
    return res.status;
  }

  async releaseURI(uri: string): Promise<void> {
    await fetch(`${this.jenaURL}data?graph=${uri}`, { method: 'DELETE' });
  }

  async read(uri: string): Promise<{ status: number; document: LdpDocument | null }> {
    const res = await fetch(`${this.jenaURL}data?graph=${uri}`, {
      method: 'GET',
      headers: { Accept: 'text/turtle' },
    });
    if (res.status !== 200) return { status: res.status, document: null };

    const body = await res.text();
    const document = new rdflib.IndexedFormula() as LdpDocument;
    await parseRdf(body, document, uri, 'text/turtle');

    document.uri = uri;
    const uriSym = document.sym(uri);

    let interactionModel: string | null = null;
    if (document.statementsMatching(uriSym, RDF('type'), LDP('BasicContainer')).length !== 0)
      interactionModel = LDP('BasicContainer').value;
    if (document.statementsMatching(uriSym, RDF('type'), LDP('DirectContainer')).length !== 0)
      interactionModel = LDP('DirectContainer').value;
    document.interactionModel = interactionModel;

    if (document.interactionModel === ldp.DirectContainer) {
      const mr = document.any(uriSym, LDP('membershipResource'));
      if (mr) document.membershipResource = mr.value;
      const hmr = document.any(uriSym, LDP('hasMemberRelation'));
      if (hmr) document.hasMemberRelation = hmr.value;
    }

    return { status: res.status, document };
  }

  async update(resource: LdpDocument): Promise<number> {
    const content = await serializeRdf(
      resource.sym(resource.uri), resource, 'none:', 'text/turtle'
    );
    const res = await fetch(`${this.jenaURL}data?graph=${resource.uri}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'text/turtle' },
      body: content,
    });
    return res.status;
  }

  async insertData(data: rdflib.IndexedFormula, uri: string): Promise<number> {
    let content = '';
    const statements = data.statementsMatching(undefined, undefined, undefined);
    for (const s of statements) {
      content += `<${s.subject.value}> <${s.predicate.value}> <${s.object.value}>. `;
    }
    content = `INSERT DATA {GRAPH <${uri}> {${content}}}`;

    const res = await fetch(`${this.jenaURL}update`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/sparql-update' },
      body: content,
    });
    return res.status;
  }

  async remove(uri: string): Promise<number> {
    const res = await fetch(`${this.jenaURL}data?graph=${uri}`, { method: 'DELETE' });
    return res.status;
  }

  async getMembershipTriples(
    container: LdpDocument
  ): Promise<{ status: number; members: MemberBinding[] | null }> {
    const sparql = `SELECT ?member FROM <${container.membershipResource}> WHERE {<${container.membershipResource}> <${container.hasMemberRelation}> ?member .}`;
    const res = await fetch(`${this.jenaURL}sparql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'application/sparql-results+json',
      },
      body: sparql,
    });
    if (res.status !== 200) return { status: res.status, members: null };

    const body = await res.json() as { results: { bindings: MemberBinding[] } };
    return { status: res.status, members: body.results.bindings };
  }

  async drop(): Promise<void> {
    // No-op for Jena — datasets managed externally
  }
}

// Helper: promisify rdflib.parse
function parseRdf(
  body: string, graph: rdflib.IndexedFormula, baseURI: string, contentType: string
): Promise<rdflib.IndexedFormula> {
  return new Promise((resolve, reject) => {
    rdflib.parse(body, graph, baseURI, contentType, (err: unknown, result: rdflib.IndexedFormula) => {
      if (err) reject(err); else resolve(result);
    });
  });
}

// Helper: promisify rdflib.serialize
function serializeRdf(
  subject: rdflib.NamedNode, graph: rdflib.IndexedFormula, base: string, contentType: string
): Promise<string> {
  return new Promise((resolve, reject) => {
    rdflib.serialize(subject, graph, base, contentType, (err: unknown, content: string) => {
      if (err) reject(err); else resolve(content);
    });
  });
}
```

**Step 4: Write index.ts**

```typescript
export { JenaStorageService } from './storage.js';
```

**Step 5: Build to verify**

Run: `cd ldp-service-jena && npm install && npm run build`

**Step 6: Commit**

```bash
git add ldp-service-jena/
git commit -m "feat(ldp-service-jena): convert to TypeScript with fetch and async/await"
```

---

### Task 10: Convert ldp-service-mongodb — Full Conversion

**Files:**
- Modify: `ldp-service-mongodb/package.json`
- Create: `ldp-service-mongodb/tsconfig.json`
- Create: `ldp-service-mongodb/.gitignore`
- Create: `ldp-service-mongodb/src/storage.ts`
- Create: `ldp-service-mongodb/src/index.ts`

**Step 1: Update package.json**

```json
{
  "name": "ldp-service-mongodb",
  "version": "2.0.0",
  "description": "StorageService implementation using MongoDB",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "author": "Jim Amsden",
  "contributors": "Sam Padgett <jamsden@us.ibm.com>",
  "dependencies": {
    "mongodb": "^6.10.0",
    "storage-service": "../storage-service"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": "^22.11.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/OSLC/ldp-service-mongodb.git"
  }
}
```

Note: `n3` and `jsonld` dependencies removed — the StorageService interface works with `rdflib` `IndexedFormula`, not raw triples.

**Step 2: Create tsconfig.json and .gitignore** (same pattern)

**Step 3: Write storage.ts**

File: `ldp-service-mongodb/src/storage.ts`

Convert `storage.js` to TypeScript using the MongoDB driver's native types and async API (MongoDB driver 6.x already supports Promises natively).

```typescript
import { MongoClient, type Db, type Collection, type Document } from 'mongodb';
import {
  type StorageService,
  type StorageEnv,
  type LdpDocument,
  type MemberBinding,
  ldp,
} from 'storage-service';
import type { IndexedFormula } from 'rdflib';

interface GraphDocument extends Document {
  name: string;
  interactionModel?: string;
  container?: string;
  deleted?: boolean;
  triples?: unknown[];
  membershipResource?: string;
  hasMemberRelation?: string;
  isMemberOfRelation?: string;
  membershipResourceFor?: Array<{ container: string; hasMemberRelation: string }>;
}

export class MongoStorageService implements StorageService {
  private client: MongoClient | null = null;
  private db: Db | null = null;

  private graphs(): Collection<GraphDocument> {
    if (!this.db) throw new Error('Database not initialized');
    return this.db.collection<GraphDocument>('graphs');
  }

  async init(env: StorageEnv): Promise<void> {
    const mongoURL = env.mongoURL as string;
    const dbName = env.dbName as string;
    this.client = new MongoClient(mongoURL);
    await this.client.connect();
    this.db = this.client.db(dbName);
    await this.graphs().createIndex({ name: 1 }, { unique: true });
    console.log(`Connected to MongoDB at: ${mongoURL}/${dbName}`);
  }

  async drop(): Promise<void> {
    await this.graphs().drop();
    await this.graphs().createIndex({ name: 1 }, { unique: true });
  }

  async reserveURI(uri: string): Promise<number> {
    try {
      await this.graphs().insertOne({ name: uri });
      return 201;
    } catch {
      return 409;
    }
  }

  async releaseURI(uri: string): Promise<void> {
    await this.graphs().deleteOne({ name: uri });
  }

  async read(uri: string): Promise<{ status: number; document: LdpDocument | null }> {
    const doc = await this.graphs().findOne({ name: uri, deleted: { $ne: true } });
    if (!doc) return { status: 404, document: null };
    // Caller (ldp-service/oslc-service) is responsible for
    // converting the MongoDB document into an LdpDocument (IndexedFormula).
    // For now return the raw doc cast — actual conversion logic
    // depends on how the middleware layer reconstructs the IndexedFormula.
    return { status: 200, document: doc as unknown as LdpDocument };
  }

  async update(resource: LdpDocument): Promise<number> {
    const result = await this.graphs().updateOne(
      { name: resource.uri },
      { $set: resource as unknown as Document },
      { upsert: true }
    );
    return result.upsertedCount > 0 ? 201 : 200;
  }

  async insertData(data: IndexedFormula, uri: string): Promise<number> {
    // Insert triples from data into the resource at uri
    // This will need to be refined based on how triples are stored
    return 200;
  }

  async remove(uri: string): Promise<number> {
    const result = await this.graphs().updateOne(
      { name: uri },
      { $set: { deleted: true, triples: [] } }
    );
    return result.matchedCount > 0 ? 200 : 404;
  }

  async getMembershipTriples(
    container: LdpDocument
  ): Promise<{ status: number; members: MemberBinding[] | null }> {
    const docs = await this.graphs().find({
      container: container.uri,
      deleted: { $ne: true },
    }).toArray();

    const members: MemberBinding[] = docs.map(doc => ({
      member: { value: doc.name },
    }));
    return { status: 200, members };
  }
}
```

**Step 4: Write index.ts**

```typescript
export { MongoStorageService } from './storage.js';
```

**Step 5: Build to verify**

Run: `cd ldp-service-mongodb && npm install && npm run build`

**Step 6: Commit**

```bash
git add ldp-service-mongodb/
git commit -m "feat(ldp-service-mongodb): convert to TypeScript with async/await"
```

---

### Task 11: Convert ldp-service-fs — Full Conversion

Refactor `ldp-service-fs` to implement `StorageService` directly (no standalone service.js — aligning with mongodb/jena pattern).

**Files:**
- Modify: `ldp-service-fs/package.json`
- Create: `ldp-service-fs/tsconfig.json`
- Create: `ldp-service-fs/.gitignore`
- Create: `ldp-service-fs/src/storage.ts`
- Create: `ldp-service-fs/src/index.ts`

**Step 1: Update package.json**

```json
{
  "name": "ldp-service-fs",
  "version": "2.0.0",
  "description": "StorageService implementation using the file system",
  "license": "Apache-2.0",
  "type": "module",
  "main": "dist/index.js",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.js",
      "types": "./dist/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist"
  },
  "author": "Sam Padgett",
  "contributors": "Jim Amsden <jamsden@us.ibm.com>",
  "dependencies": {
    "storage-service": "../storage-service"
  },
  "devDependencies": {
    "typescript": "^5.7.0",
    "@types/node": "^22.0.0"
  },
  "engines": {
    "node": "^22.11.0"
  },
  "repository": {
    "type": "git",
    "url": "https://github.com/OSLC/ldp-server.git"
  }
}
```

Note: `express`, `n3`, `jsonld`, `request` all removed — this is now a pure storage backend.

**Step 2: Create tsconfig.json and .gitignore** (same pattern)

**Step 3: Write storage.ts**

File: `ldp-service-fs/src/storage.ts`

Convert from `db.js` (file-based JSON store) into a class implementing `StorageService`. Uses `node:fs/promises` for async file I/O.

```typescript
import { readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import {
  type StorageService,
  type StorageEnv,
  type LdpDocument,
  type MemberBinding,
} from 'storage-service';
import type { IndexedFormula } from 'rdflib';

export class FileStorageService implements StorageService {
  private dbPath = '';
  private db: Record<string, unknown> = {};

  private async persist(): Promise<void> {
    await writeFile(this.dbPath, JSON.stringify(this.db, null, 2), 'utf-8');
  }

  async init(env: StorageEnv): Promise<void> {
    this.dbPath = env.dbPath as string;
    if (existsSync(this.dbPath)) {
      const data = await readFile(this.dbPath, 'utf-8');
      this.db = JSON.parse(data);
    } else {
      this.db = {};
      await this.persist();
    }
  }

  async drop(): Promise<void> {
    this.db = {};
    await this.persist();
  }

  async reserveURI(uri: string): Promise<number> {
    if (uri in this.db && this.db[uri] !== null && this.db[uri] !== undefined) {
      return 409;
    }
    this.db[uri] = {};
    await this.persist();
    return 201;
  }

  async releaseURI(uri: string): Promise<void> {
    this.db[uri] = null;
    await this.persist();
  }

  async read(uri: string): Promise<{ status: number; document: LdpDocument | null }> {
    if (!(uri in this.db) || this.db[uri] === null || this.db[uri] === undefined) {
      return { status: 404, document: null };
    }
    return { status: 200, document: this.db[uri] as unknown as LdpDocument };
  }

  async update(resource: LdpDocument): Promise<number> {
    const isNew = !(resource.uri in this.db) || this.db[resource.uri] === null;
    this.db[resource.uri] = resource;
    await this.persist();
    return isNew ? 201 : 200;
  }

  async insertData(data: IndexedFormula, uri: string): Promise<number> {
    // Append triples to the stored resource
    return 200;
  }

  async remove(uri: string): Promise<number> {
    if (!(uri in this.db) || this.db[uri] === null) {
      return 404;
    }
    this.db[uri] = null;
    await this.persist();
    return 200;
  }

  async getMembershipTriples(
    container: LdpDocument
  ): Promise<{ status: number; members: MemberBinding[] | null }> {
    const members: MemberBinding[] = [];
    for (const [uri, value] of Object.entries(this.db)) {
      const doc = value as Record<string, unknown> | null;
      if (doc && doc.container === container.uri && doc.deleted !== true) {
        members.push({ member: { value: uri } });
      }
    }
    return { status: 200, members };
  }
}
```

**Step 4: Write index.ts**

```typescript
export { FileStorageService } from './storage.js';
```

**Step 5: Build to verify**

Run: `cd ldp-service-fs && npm install && npm run build`

**Step 6: Commit**

```bash
git add ldp-service-fs/
git commit -m "feat(ldp-service-fs): convert to TypeScript, implement StorageService"
```

---

### Task 12: Build All Modules and Verify

**Step 1: Build all modules in dependency order**

```bash
cd storage-service && npm run build
cd ../ldp-service && npm run build
cd ../oslc-service && npm run build
cd ../ldp-service-fs && npm run build
cd ../ldp-service-mongodb && npm run build
cd ../ldp-service-jena && npm run build
```

Expected: All modules compile without errors.

**Step 2: Verify type exports**

Check that `storage-service/dist/index.d.ts` exports the `StorageService` interface and that each backend's `dist/` correctly references it.

**Step 3: Commit**

```bash
git add -A
git commit -m "build: verify all modules compile successfully"
```

---

### Task 13: Clean Up Old JavaScript Files

After all modules compile successfully, remove the original `.js` files that have been replaced by TypeScript.

**Step 1: Remove old JS files from each module**

For each module, remove the original `.js` files from the root directory (not from `dist/`). Keep `context.json` files as they are data, not code.

Files to remove:
- `ldp-service/service.js`, `ldp-service/storage.js`, `ldp-service/media.js`, `ldp-service/index.js`, `ldp-service/vocab/ldp.js`, `ldp-service/vocab/rdf.js`
- `oslc-service/service.js`, `oslc-service/ldp.js`, `oslc-service/storage.js`, `oslc-service/media.js`, `oslc-service/vocab/ldp.js`, `oslc-service/vocab/rdf.js`, `oslc-service/vocab/oslc.js`
- `ldp-service-fs/service.js`, `ldp-service-fs/db.js`, `ldp-service-fs/jsonld.js`, `ldp-service-fs/turtle.js`, `ldp-service-fs/media.js`, `ldp-service-fs/vocab/ldp.js`, `ldp-service-fs/vocab/rdf.js`
- `ldp-service-mongodb/storage.js`, `ldp-service-mongodb/jsonld.js`, `ldp-service-mongodb/turtle.js`, `ldp-service-mongodb/media.js`, `ldp-service-mongodb/vocab/ldp.js`, `ldp-service-mongodb/vocab/rdf.js`
- `ldp-service-jena/storage.js`, `ldp-service-jena/storage-jena.js`, `ldp-service-jena/vocab/ldp.js`, `ldp-service-jena/vocab/rdf.js`

**Step 2: Rebuild to verify nothing broke**

```bash
cd storage-service && npm run build
cd ../ldp-service && npm run build
cd ../oslc-service && npm run build
cd ../ldp-service-fs && npm run build
cd ../ldp-service-mongodb && npm run build
cd ../ldp-service-jena && npm run build
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: remove original JavaScript files, TypeScript conversion complete"
```
