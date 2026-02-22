# OSLC4JS TypeScript Conversion Design

## Date: 2026-02-22

## Overview

Convert the oslc4js JavaScript codebase to TypeScript with ESM modules, async/await, and strict typing. Includes an architectural refactoring to extract a shared `storage-service` module.

## Architecture

### Current State

- All modules are plain JavaScript (CommonJS, callback-based)
- `oslc-service` and `ldp-service` each contain duplicate copies of `storage.js`, `media.js`, and `vocab/`
- `ldp-service-fs` has a standalone `service.js` instead of reusing the base middleware
- `ldp-service-jena` uses the deprecated `request` library

### Target Architecture

```
storage-service (NEW — shared abstract interface)
       |
       +-- oslc-service      (OSLC middleware, consumes StorageService)
       +-- ldp-service       (LDP middleware, consumes StorageService)
       +-- ldp-service-fs    (implements StorageService on file system)
       +-- ldp-service-mongodb (implements StorageService on MongoDB)
       +-- ldp-service-jena  (implements StorageService on Jena/Fuseki)
```

**Key principle:** `storage-service` defines the abstract `StorageService` interface. `oslc-service` and `ldp-service` are Express middleware that consume a `StorageService`. The three backends (`-fs`, `-mongodb`, `-jena`) each implement `StorageService` directly.

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Module system | ESM (`import`/`export`) | Modern standard, natural for TypeScript |
| Async pattern | `async`/`await` with Promises | Replaces callback-based APIs throughout |
| Type strictness | `strict: true` | Maximum type safety, catches real bugs |
| HTTP client (jena) | Node built-in `fetch` | Node 22 global, zero dependencies, replaces deprecated `request` |
| Backend alignment | All backends implement StorageService | `ldp-service-fs` refactored to match `mongodb`/`jena` pattern |
| Shared types | Extracted to `storage-service` | Eliminates duplication of vocab, media, types across modules |
| Typing approach | Strongly-typed interfaces | Compile-time contract enforcement across all modules |

## Module Design

### storage-service (new)

```
storage-service/
  src/
    index.ts           # Re-exports
    storage.ts         # StorageService interface
    types.ts           # Shared types (StorageEnv, etc.)
    media.ts           # Media type constants
    vocab/
      ldp.ts           # LDP vocabulary constants
      rdf.ts           # RDF vocabulary constants
  package.json
  tsconfig.json
```

**StorageService interface:**

```typescript
import { IndexedFormula } from 'rdflib';

export interface StorageEnv {
  appBase: string;
  [key: string]: unknown;
}

export interface StorageService {
  init(env: StorageEnv): Promise<void>;
  drop(): Promise<void>;
  reserveURI(uri: string): Promise<void>;
  releaseURI(uri: string): Promise<void>;
  read(uri: string): Promise<IndexedFormula | null>;
  update(resource: IndexedFormula): Promise<void>;
  remove(uri: string): Promise<void>;
  insertData(data: string, uri: string): Promise<void>;
  getMembershipTriples(container: IndexedFormula): Promise<IndexedFormula>;
}
```

### oslc-service

Convert `service.js`, `ldp.js` to TypeScript. Remove local `storage.js`, `media.js`, `vocab/` — import from `storage-service`. Add `vocab/oslc.ts` (OSLC-specific vocabulary stays here).

### ldp-service

Convert `service.js` to TypeScript. Remove local `storage.js`, `media.js`, `vocab/` — import from `storage-service`. The middleware accepts a `StorageService` parameter via dependency injection.

### ldp-service-fs

Refactor to implement `StorageService` interface directly (aligning with mongodb/jena pattern). Convert `db.js`, `jsonld.js`, `turtle.js` to TypeScript.

### ldp-service-mongodb

Convert `storage.js`, `jsonld.js`, `turtle.js` to TypeScript. Replace callbacks with async/await. Use mongodb native driver types.

### ldp-service-jena

Convert `storage.js` to TypeScript. Replace `request` with Node built-in `fetch`. Remove duplicate `storage-jena.js`.

## Project Structure (each module)

```
<module>/
  src/           # TypeScript source
  dist/          # Compiled output (gitignored)
  package.json   # "type": "module", "main": "dist/index.js", "types": "dist/index.d.ts"
  tsconfig.json  # strict: true, target: ES2022, module: Node16
```

## Dependencies

Each module uses local path references:

```json
{ "dependencies": { "storage-service": "../storage-service" } }
```

Shared dev dependencies: `typescript`, `@types/express` (where applicable), `@types/node`.

## Conversion Order

1. **storage-service** — foundation, no dependencies on other oslc4js modules
2. **oslc-service** — depends only on storage-service
3. **ldp-service** — depends only on storage-service
4. **ldp-service-fs** — depends on storage-service
5. **ldp-service-mongodb** — depends on storage-service
6. **ldp-service-jena** — depends on storage-service

## Original Files

Original `.js` files are kept alongside `src/` during conversion as reference. They will be removed in a cleanup pass after each module is verified.
