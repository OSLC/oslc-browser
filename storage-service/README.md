# storage-service

Abstract TypeScript interface defining the contract for storage backend implementations used by `ldp-service`. This module provides the `StorageService` interface along with supporting types, RDF vocabulary constants, and media type definitions. Backend modules implement this interface to provide LDP (Linked Data Platform) access to resources stored in different data sources such as the file system, MongoDB, or Apache Jena.

## Build

```bash
npm install
npm run build
```

The build compiles TypeScript sources to ES2022 JavaScript modules with declaration files, output to `dist/`.

## API

### `StorageService` interface

The core abstraction. Each method is asynchronous and returns a `Promise`.

```typescript
interface StorageService {
  init(env: StorageEnv): Promise<void>;
  drop(): Promise<void>;
  reserveURI(uri: string): Promise<number>;
  releaseURI(uri: string): Promise<void>;
  read(uri: string): Promise<{ status: number; document: LdpDocument | null }>;
  update(resource: LdpDocument): Promise<number>;
  insertData(data: IndexedFormula, uri: string): Promise<number>;
  removeData(data: IndexedFormula, uri: string): Promise<number>;
  remove(uri: string): Promise<number>;
  getMembershipTriples(container: LdpDocument): Promise<{ status: number; members: MemberBinding[] | null }>;
  constructQuery(sparql: string): Promise<{ status: number; results: IndexedFormula | null }>;
  sparqlQuery?(sparql: string, accept: string): Promise<{ status: number; contentType: string; body: string }>;
  exportDataset(format: 'trig' | 'turtle'): Promise<string>;
  importDataset(data: string, format: 'trig' | 'turtle'): Promise<void>;
}
```

- `init` / `drop` -- lifecycle management for the storage backend.
- `reserveURI` / `releaseURI` -- URI reservation to prevent conflicts during resource creation.
- `read` / `update` / `remove` -- standard CRUD operations on RDF resources.
- `insertData` / `removeData` -- partial graph updates (PATCH support).
- `getMembershipTriples` -- returns membership bindings for LDP containers.
- `constructQuery` -- executes a SPARQL CONSTRUCT query.
- `sparqlQuery` -- optional raw SPARQL query pass-through (only backends with native SPARQL support).
- `exportDataset` / `importDataset` -- bulk export and import in TriG or Turtle format.

### `StorageEnv`

```typescript
interface StorageEnv {
  appBase: string;
  context?: string;
  dbName?: string;
  mongoURL?: string;
  jenaURL?: string;
  [key: string]: unknown;
}
```

Environment configuration passed to `StorageService.init()`. Backends extend this with their own fields via the index signature.

### `LdpDocument`

```typescript
interface LdpDocument extends IndexedFormula {
  uri: string;
  interactionModel?: string | null;
  membershipResource?: string;
  hasMemberRelation?: string;
  isMemberOfRelation?: string;
  membershipResourceFor?: MembershipPattern[];
}
```

An `rdflib` `IndexedFormula` augmented with LDP metadata properties.

### `MemberBinding`

```typescript
interface MemberBinding {
  member: { value: string };
}
```

Represents a single membership triple result from `getMembershipTriples`.

### `MembershipPattern`

```typescript
interface MembershipPattern {
  container: string;
  hasMemberRelation?: string;
}
```

Describes a DirectContainer membership pattern.

### Vocabulary constants

- `ldp` -- LDP namespace URIs (`ldp.BasicContainer`, `ldp.contains`, `ldp.hasMemberRelation`, etc.)
- `rdf` -- RDF namespace URIs (`rdf.type`, `rdf.resource`)

### Media types

```typescript
const media: {
  turtle: 'text/turtle';
  text: 'text/plain';
  n3: 'text/n3';
  jsonld: 'application/ld+json';
  json: 'application/json';
  rdfxml: 'application/rdf+xml';
};

type MediaType = typeof media[keyof typeof media];
```

## Implementations

Three backend modules implement the `StorageService` interface:

- **`ldp-service-fs`** -- file-system-based storage, one Turtle file per resource.
- **`ldp-service-jena`** -- Apache Jena Fuseki triplestore backend with native SPARQL support.
- **`ldp-service-mongodb`** -- MongoDB-backed storage using document collections.

## Usage

`ldp-service` accepts a `StorageService` implementation at initialization time. This allows the LDP protocol layer to remain independent of the underlying persistence mechanism.

```typescript
import type { StorageService, StorageEnv } from 'storage-service';

function createLdpService(storage: StorageService, env: StorageEnv) {
  // ldp-service delegates all persistence calls through the StorageService interface
  storage.init(env);
  // ...
}
```

## License

Apache-2.0
