# TDB Named Graph Storage, Bulk Operations, and OSLC Query Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Implement named-graph-per-resource storage with union default graph, remove BasicContainers for managed resources, add bulk import/export/backup/restore, and add full OSLC 3.0 query capability.

**Architecture:** Resources stored as named graphs in Jena TDB with `tdb:unionDefaultGraph true` for cross-resource SPARQL. OSLC query parameters parsed into an AST and translated to SPARQL CONSTRUCT queries. BasicContainers removed for creation factory resource collections; resource discovery via query capability.

**Tech Stack:** TypeScript 5.7, Node.js 22, Express 5, rdflib 2.2, Apache Jena Fuseki

**Design doc:** `docs/plans/2026-03-01-tdb-storage-and-query-design.md`

---

## Task 1: Add `constructQuery` to StorageService Interface

**Files:**
- Modify: `storage-service/src/storage.ts:53-109` (StorageService interface)
- Modify: `storage-service/src/index.ts` (exports)

**Step 1: Add `constructQuery` method to StorageService interface**

In `storage-service/src/storage.ts`, add after the `getMembershipTriples` method (line 108):

```typescript
  /**
   * Execute a SPARQL CONSTRUCT query and return the results as an IndexedFormula.
   */
  constructQuery(sparql: string): Promise<{ status: number; results: IndexedFormula | null }>;
```

**Step 2: Build to verify compilation**

Run: `cd storage-service && npm run build`
Expected: Compilation succeeds (interface-only change)

**Step 3: Commit**

```bash
git add storage-service/src/storage.ts
git commit -m "feat: add constructQuery to StorageService interface"
```

---

## Task 2: Add `exportDataset` and `importDataset` to StorageService Interface

**Files:**
- Modify: `storage-service/src/storage.ts:53-109` (StorageService interface)

**Step 1: Add bulk operation methods after `constructQuery`**

```typescript
  /**
   * Export the entire dataset in the specified format.
   * 'trig' preserves named graph structure; 'turtle' merges all into one graph.
   */
  exportDataset(format: 'trig' | 'turtle'): Promise<string>;

  /**
   * Import data into the dataset.
   * 'trig' restores named graph structure; 'turtle' parses and loads each
   * URI subject's Concise Bounded Description into its own named graph.
   */
  importDataset(data: string, format: 'trig' | 'turtle'): Promise<void>;
```

**Step 2: Build to verify compilation**

Run: `cd storage-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add storage-service/src/storage.ts
git commit -m "feat: add exportDataset and importDataset to StorageService interface"
```

---

## Task 3: Implement `constructQuery` in JenaStorageService

**Files:**
- Modify: `ldp-service-jena/src/storage.ts:68-190` (JenaStorageService class)

**Step 1: Add `constructQuery` method to JenaStorageService**

Add before the `drop()` method (line 187):

```typescript
  async constructQuery(sparql: string): Promise<{ status: number; results: rdflib.IndexedFormula | null }> {
    const res = await fetch(`${this.jenaURL}sparql`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/sparql-query',
        Accept: 'text/turtle',
      },
      body: sparql,
    });
    if (res.status !== 200) return { status: res.status, results: null };

    const body = (await res.text()).replace(/^PREFIX\s+(\S+)\s+(<[^>]+>)/gm, '@prefix $1 $2 .');
    const results = rdflib.graph();
    await parseRdf(body, results, 'urn:query-results', 'text/turtle');
    return { status: res.status, results };
  }
```

**Step 2: Build to verify compilation**

Run: `cd ldp-service-jena && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add ldp-service-jena/src/storage.ts
git commit -m "feat: implement constructQuery in JenaStorageService"
```

---

## Task 4: Remove `FROM` clause in `getMembershipTriples`

With `tdb:unionDefaultGraph true`, membership triples are visible through the union default graph without scoping to a specific named graph.

**Files:**
- Modify: `ldp-service-jena/src/storage.ts:169-185` (getMembershipTriples method)

**Step 1: Update the SPARQL query**

Replace the existing `getMembershipTriples` method (lines 169-185):

```typescript
  async getMembershipTriples(
    container: LdpDocument
  ): Promise<{ status: number; members: MemberBinding[] | null }> {
    const sparql = `SELECT ?member WHERE {<${container.membershipResource}> <${container.hasMemberRelation}> ?member .}`;
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
```

The only change is removing `FROM <${container.membershipResource}>` from the SPARQL query.

**Step 2: Build to verify**

Run: `cd ldp-service-jena && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add ldp-service-jena/src/storage.ts
git commit -m "fix: remove FROM clause in getMembershipTriples for union default graph"
```

---

## Task 5: Implement `exportDataset` and `importDataset` in JenaStorageService

**Files:**
- Modify: `ldp-service-jena/src/storage.ts` (JenaStorageService class)

**Step 1: Add `exportDataset` method**

```typescript
  async exportDataset(format: 'trig' | 'turtle'): Promise<string> {
    const accept = format === 'trig' ? 'application/trig' : 'text/turtle';
    const endpoint = format === 'trig' ? `${this.jenaURL}data` : `${this.jenaURL}data?default`;
    const res = await fetch(endpoint, {
      method: 'GET',
      headers: { Accept: accept },
    });
    if (!res.ok) throw new Error(`Export failed with status ${res.status}`);
    return res.text();
  }
```

**Step 2: Add `importDataset` method**

For TriG, upload directly to Fuseki. For Turtle, parse and distribute into named graphs:

```typescript
  async importDataset(data: string, format: 'trig' | 'turtle'): Promise<void> {
    if (format === 'trig') {
      const res = await fetch(`${this.jenaURL}data`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/trig' },
        body: data,
      });
      if (!res.ok) throw new Error(`TriG import failed with status ${res.status}`);
      return;
    }

    // Turtle: parse and load each URI subject's CBD into its own named graph
    const graph = rdflib.graph();
    await parseRdf(data, graph, 'urn:import', 'text/turtle');

    // Group triples by URI subject
    const resourceMap = new Map<string, rdflib.Statement[]>();
    for (const st of graph.statements) {
      if (st.subject.termType !== 'NamedNode') continue;
      const uri = st.subject.value;
      if (!resourceMap.has(uri)) resourceMap.set(uri, []);
      resourceMap.get(uri)!.push(st);
    }

    // Collect blank node triples reachable from each resource (CBD)
    const blankNodeOwnership = new Map<string, string>(); // blankNodeId -> owning URI
    for (const [uri, stmts] of resourceMap) {
      const queue = stmts
        .filter(st => st.object.termType === 'BlankNode')
        .map(st => st.object.value);
      while (queue.length > 0) {
        const bnId = queue.pop()!;
        if (blankNodeOwnership.has(bnId)) continue;
        blankNodeOwnership.set(bnId, uri);
        for (const st of graph.statementsMatching(rdflib.blankNode(bnId))) {
          if (st.object.termType === 'BlankNode') queue.push(st.object.value);
        }
      }
    }

    // Add blank node triples to their owning resource
    for (const st of graph.statements) {
      if (st.subject.termType !== 'BlankNode') continue;
      const owner = blankNodeOwnership.get(st.subject.value);
      if (owner && resourceMap.has(owner)) {
        resourceMap.get(owner)!.push(st);
      }
    }

    // PUT each resource as a named graph
    for (const [uri, stmts] of resourceMap) {
      const doc = rdflib.graph();
      for (const st of stmts) doc.add(st.subject, st.predicate, st.object, doc.sym(uri));
      const content = await serializeRdf(doc.sym(uri), doc, 'none:', 'text/turtle');
      await fetch(`${this.jenaURL}data?graph=${encodeURIComponent(uri)}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'text/turtle' },
        body: content,
      });
    }
  }
```

**Step 3: Build to verify**

Run: `cd ldp-service-jena && npm run build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add ldp-service-jena/src/storage.ts
git commit -m "feat: implement exportDataset and importDataset in JenaStorageService"
```

---

## Task 6: Implement Stub Methods in FS and MongoDB Storage

Both backends need the new interface methods to compile. Implement as stubs that throw "not implemented" for now.

**Files:**
- Modify: `ldp-service-fs/src/storage.ts`
- Modify: `ldp-service-mongodb/src/storage.ts`

**Step 1: Add stub methods to FsStorageService**

Add to the class in `ldp-service-fs/src/storage.ts`:

```typescript
  async constructQuery(_sparql: string): Promise<{ status: number; results: IndexedFormula | null }> {
    throw new Error('constructQuery not implemented for file system storage');
  }

  async exportDataset(_format: 'trig' | 'turtle'): Promise<string> {
    throw new Error('exportDataset not implemented for file system storage');
  }

  async importDataset(_data: string, _format: 'trig' | 'turtle'): Promise<void> {
    throw new Error('importDataset not implemented for file system storage');
  }
```

**Step 2: Add stub methods to MongoStorageService**

Add the same three stub methods to `ldp-service-mongodb/src/storage.ts`, replacing "file system" with "MongoDB".

**Step 3: Build all packages**

Run: `npm run build --workspaces`
Expected: All packages compile successfully

**Step 4: Commit**

```bash
git add ldp-service-fs/src/storage.ts ldp-service-mongodb/src/storage.ts
git commit -m "feat: add stub constructQuery/exportDataset/importDataset to FS and MongoDB storage"
```

---

## Task 7: Add `MetaQueryCapability` to Template Types

**Files:**
- Modify: `oslc-service/src/template.ts:23-46` (add MetaQueryCapability, update MetaService)

**Step 1: Add MetaQueryCapability interface**

After `MetaCreationFactory` (line 28), add:

```typescript
/** A query capability defined in the meta template. */
export interface MetaQueryCapability {
  title: string;
  resourceTypes: string[];
  resourceShapes: string[];
}
```

**Step 2: Add `queryCapabilities` to MetaService**

Update the `MetaService` interface (lines 42-46) to add the new field:

```typescript
export interface MetaService {
  domains: string[];
  creationFactories: MetaCreationFactory[];
  creationDialogs: MetaCreationDialog[];
  queryCapabilities: MetaQueryCapability[];
}
```

**Step 3: Export MetaQueryCapability from index.ts**

Add `MetaQueryCapability` to the exports in `oslc-service/src/index.ts`.

**Step 4: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation fails — `extractMetaService` doesn't return `queryCapabilities` yet. That's expected; we fix it in the next step.

---

## Task 8: Parse `oslc:queryCapability` from Template

**Files:**
- Modify: `oslc-service/src/template.ts:104-119` (extractMetaService function)

**Step 1: Add `extractQueryCapability` function**

After `extractCreationDialog` (line 138), add:

```typescript
function extractQueryCapability(graph: rdflib.IndexedFormula, node: rdflib.NamedNode): MetaQueryCapability {
  const title = graph.anyValue(node, DCTERMS('title')) ?? 'Query Capability';
  const resourceTypes = graph.each(node, OSLC('resourceType'), undefined).map(n => n.value);
  const resourceShapes = graph.each(node, OSLC('resourceShape'), undefined).map(n => n.value);
  return { title, resourceTypes, resourceShapes };
}
```

**Step 2: Update `extractMetaService` to extract query capabilities**

In `extractMetaService` (lines 104-119), add after the creation dialogs loop (line 116):

```typescript
  const queryCapabilities: MetaQueryCapability[] = [];
  for (const qcNode of graph.each(serviceNode, OSLC('queryCapability'), undefined)) {
    queryCapabilities.push(extractQueryCapability(graph, qcNode as rdflib.NamedNode));
  }
```

And update the return statement to include `queryCapabilities`:

```typescript
  return { domains, creationFactories, creationDialogs, queryCapabilities };
```

**Step 3: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add oslc-service/src/template.ts oslc-service/src/index.ts
git commit -m "feat: parse oslc:queryCapability from catalog template"
```

---

## Task 9: Add Query Capabilities to catalog-template.ttl

**Files:**
- Modify: `oslc-server/config/catalog-template.ttl`

**Step 1: Add query capability definitions to the service template**

Add after the creation dialog blocks (before the final `.` on line 61):

```turtle
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Change Requests" ;
    oslc:resourceType oslc_cm:ChangeRequest ;
    oslc:resourceShape <shapes/ChangeRequest>
  ] ;

  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Requirements" ;
    oslc:resourceType oslc_rm:Requirement ;
    oslc:resourceShape <shapes/Requirement>
  ] .
```

Note: the last creation dialog's trailing `;` stays (it joins to the new query capability), and the final query capability ends with `.`.

**Step 2: Commit**

```bash
git add oslc-server/config/catalog-template.ttl
git commit -m "feat: add query capability definitions to catalog template"
```

---

## Task 10: Instantiate Query Capabilities in catalogPostHandler

**Files:**
- Modify: `oslc-service/src/catalog.ts:282-337` (instantiateService function)

**Step 1: Add query capability instantiation to `instantiateService`**

After the creation dialogs loop (line 336), add:

```typescript
  // Query capabilities
  for (const qc of meta.queryCapabilities) {
    const qcNode = rdflib.blankNode();
    doc.add(serviceNode, OSLC('queryCapability'), qcNode, docNode);
    doc.add(qcNode, RDF('type'), OSLC('QueryCapability'), docNode);
    doc.add(qcNode, DCTERMS('title'), rdflib.lit(qc.title), docNode);

    // Build the query base URL from the first resource type's local name
    const typeName = qc.resourceTypes.length > 0
      ? qc.resourceTypes[0].replace(/.*[#/]/, '')
      : 'resources';
    const queryBaseURL = containerURI.replace(/\/resources$/, '/query/' + typeName);
    doc.add(qcNode, OSLC('queryBase'), rdflib.sym(queryBaseURL), docNode);

    for (const rt of qc.resourceTypes) {
      doc.add(qcNode, OSLC('resourceType'), rdflib.sym(rt), docNode);
    }
    for (const rs of qc.resourceShapes) {
      const shapeURI = resolveShapeURI(rs, env);
      doc.add(qcNode, OSLC('resourceShape'), rdflib.sym(shapeURI), docNode);
    }
  }
```

**Step 2: Also collect shape URIs from query capabilities in `storeResourceShapes`**

In `storeResourceShapes` (lines 108-154), after the creation dialog shape collection loop (lines 124-127), add:

```typescript
      for (const qc of svc.queryCapabilities) {
        for (const s of qc.resourceShapes) {
          shapeRefs.add(s);
        }
      }
```

**Step 3: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add oslc-service/src/catalog.ts
git commit -m "feat: instantiate query capabilities from template in ServiceProvider"
```

---

## Task 11: Remove BasicContainer Creation for Creation Factory Resources

**Files:**
- Modify: `oslc-service/src/catalog.ts:218-226` (in catalogPostHandler)

**Step 1: Remove the resource BasicContainer creation**

In `catalogPostHandler`, delete or comment out lines 218-226 that create the `/resources` BasicContainer:

```typescript
    // REMOVED: No longer creating a BasicContainer for managed resources.
    // Resources are discovered via OSLC QueryCapability, not container membership.
    const containerURI = spURI + '/resources';
```

Keep the `containerURI` variable assignment (line 219) since it's still used by creation factory `oslc:creation` URLs, but remove lines 220-226 that create and store the container document.

**Step 2: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add oslc-service/src/catalog.ts
git commit -m "refactor: remove BasicContainer creation for managed OSLC resources"
```

---

## Task 12: Update LDP POST to Skip `ldp:contains` for Creation Factory Targets

When POSTing to a creation factory URL (which is no longer a BasicContainer), skip the `ldp:contains` triple insertion.

**Files:**
- Modify: `ldp-service/src/service.ts:505-584` (POST handler)

**Step 1: Update the POST handler**

In the POST handler, the container type check is at lines 514-517. Currently it returns 405 if the target has no `interactionModel`. For creation factory URLs (which no longer have a container document), the `storage.read()` call at the top of POST will return 404.

The simplest approach: when POST target doesn't exist as a container, treat it as a creation-only endpoint. The resource is still created and stored, but no containment triples are added.

Modify the container check (lines 514-517). Replace:

```typescript
    if (!container.interactionModel) {
      res.sendStatus(405);
      return;
    }
```

With:

```typescript
    const isContainer = !!container?.interactionModel;
```

Then guard the membership/containment triple insertion (lines 562-574) with:

```typescript
    if (isContainer) {
      // existing membership triple insertion code (lines 562-574)
    }
```

The resource creation itself (lines 529-560) proceeds regardless.

**Note:** This requires also handling the case where `storage.read()` returns 404 for the POST target. Currently the POST handler reads the container document. When the target is a creation factory (not a container), we need to allow POST to proceed even if the target has no stored document. The resource still gets its own named graph via `storage.update(newMember)`.

**Step 2: Build to verify**

Run: `cd ldp-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add ldp-service/src/service.ts
git commit -m "feat: allow POST to creation factory URLs without BasicContainer"
```

---

## Task 13: Return 404/405 on GET for Creation Factory URLs

**Files:**
- Modify: `ldp-service/src/service.ts:338-389` (GET handler) or
- Modify: `oslc-service/src/service.ts:46-71` (route registration)

**Step 1: Handle GET on creation factory URLs**

This is already handled naturally: if the creation factory URL has no stored named graph (because we stopped creating the BasicContainer), `storage.read()` returns 404, and the GET handler returns 404 to the client.

No code change needed — verify this behavior is correct by reading the GET handler.

The GET handler at lines 340-344 already does:

```typescript
    const { status, document } = await storage.read(req.fullURL);
    if (status !== 200 || !document) {
      res.sendStatus(status);
      return;
    }
```

This returns 404 for creation factory URLs that have no stored document.

**Step 2: Commit (documentation only if needed)**

No code change required. Add a comment if desired.

---

## Task 14: Create OSLC Query Parser

**Files:**
- Create: `oslc-service/src/query-parser.ts`

**Step 1: Define the AST types and parser**

```typescript
/*
 * query-parser.ts parses OSLC query parameters (oslc.where, oslc.select,
 * oslc.orderBy, oslc.prefix, oslc.searchTerms) into an AST for SPARQL
 * translation.
 *
 * Reference: OSLC Core 3.0 Query Syntax
 * https://docs.oasis-open.org/oslc-core/oslc-query/v3.0/oslc-query-v3.0.html
 */

/** Resolved prefix map: prefix string -> namespace URI */
export type PrefixMap = Map<string, string>;

// --- WHERE clause AST ---

export type WhereExpression =
  | ComparisonTerm
  | InTerm
  | NestedTerm
  | CompoundTerm;

export interface ComparisonTerm {
  type: 'comparison';
  property: string;       // prefixed name, e.g. "dcterms:title"
  operator: '=' | '!=' | '<' | '>' | '<=' | '>=';
  value: OslcValue;
}

export interface InTerm {
  type: 'in';
  property: string;
  values: OslcValue[];
}

export interface NestedTerm {
  type: 'nested';
  property: string;
  inner: WhereExpression;
}

export interface CompoundTerm {
  type: 'compound';
  operator: 'and' | 'or';
  operands: WhereExpression[];
}

export interface OslcValue {
  kind: 'string' | 'number' | 'boolean' | 'uri';
  value: string;
}

// --- SELECT clause AST ---

export type SelectTerm = SimpleSelect | NestedSelect | WildcardSelect;

export interface SimpleSelect {
  type: 'property';
  property: string;
}

export interface NestedSelect {
  type: 'nested';
  property: string;
  children: SelectTerm[];
}

export interface WildcardSelect {
  type: 'wildcard';
}

// --- ORDER BY AST ---

export interface OrderByTerm {
  property: string;
  direction: 'asc' | 'desc';
}

// --- Complete parsed query ---

export interface OslcQuery {
  prefixes: PrefixMap;
  where?: WhereExpression;
  select?: SelectTerm[];
  orderBy?: OrderByTerm[];
  searchTerms?: string[];
  pageSize?: number;
  page?: number;
}

// --- Parser ---

/**
 * Parse the oslc.prefix parameter.
 * Format: "pfx1=<uri1>,pfx2=<uri2>"
 */
export function parsePrefixes(input: string): PrefixMap {
  const map = new PrefixMap();
  if (!input.trim()) return map;
  for (const binding of input.split(',')) {
    const eq = binding.indexOf('=');
    if (eq < 0) continue;
    const prefix = binding.slice(0, eq).trim();
    let uri = binding.slice(eq + 1).trim();
    if (uri.startsWith('<') && uri.endsWith('>')) {
      uri = uri.slice(1, -1);
    }
    map.set(prefix, uri);
  }
  return map;
}

/**
 * Parse the oslc.where parameter into a WhereExpression AST.
 *
 * Grammar (simplified):
 *   compound  = term (("and" | "or") term)*
 *   term      = property operator value
 *             | property "in" "[" value ("," value)* "]"
 *             | property "{" compound "}"
 */
export function parseWhere(input: string): WhereExpression {
  const tokens = tokenize(input);
  let pos = 0;

  function peek(): string | undefined { return tokens[pos]; }
  function advance(): string { return tokens[pos++]; }
  function expect(val: string): void {
    if (advance() !== val) throw new Error(`Expected '${val}' at position ${pos - 1}`);
  }

  function parseCompound(): WhereExpression {
    let left = parseTerm();
    while (peek() === 'and' || peek() === 'or') {
      const op = advance() as 'and' | 'or';
      const right = parseTerm();
      if (left.type === 'compound' && left.operator === op) {
        left.operands.push(right);
      } else {
        left = { type: 'compound', operator: op, operands: [left, right] };
      }
    }
    return left;
  }

  function parseTerm(): WhereExpression {
    const property = advance();

    // Nested: property{...}
    if (peek() === '{') {
      advance(); // consume '{'
      const inner = parseCompound();
      expect('}');
      return { type: 'nested', property, inner };
    }

    // In: property in [...]
    if (peek() === 'in') {
      advance(); // consume 'in'
      expect('[');
      const values: OslcValue[] = [];
      values.push(parseValue());
      while (peek() === ',') {
        advance(); // consume ','
        values.push(parseValue());
      }
      expect(']');
      return { type: 'in', property, values };
    }

    // Comparison: property op value
    const operator = advance() as ComparisonTerm['operator'];
    const value = parseValue();
    return { type: 'comparison', property, operator, value };
  }

  function parseValue(): OslcValue {
    const token = advance();
    if (token.startsWith('"') && token.endsWith('"')) {
      return { kind: 'string', value: token.slice(1, -1) };
    }
    if (token.startsWith('<') && token.endsWith('>')) {
      return { kind: 'uri', value: token.slice(1, -1) };
    }
    if (token === 'true' || token === 'false') {
      return { kind: 'boolean', value: token };
    }
    if (!isNaN(Number(token))) {
      return { kind: 'number', value: token };
    }
    // Treat as URI (prefixed name)
    return { kind: 'uri', value: token };
  }

  const result = parseCompound();
  return result;
}

/**
 * Parse the oslc.select parameter.
 * Format: "prop1,prop2{nested1,nested2},*"
 */
export function parseSelect(input: string): SelectTerm[] {
  const terms: SelectTerm[] = [];
  let pos = 0;

  function parseTerms(): SelectTerm[] {
    const result: SelectTerm[] = [];
    while (pos < input.length) {
      const ch = input[pos];
      if (ch === '}' || ch === undefined) break;
      if (ch === ',') { pos++; continue; }

      if (ch === '*') {
        result.push({ type: 'wildcard' });
        pos++;
        continue;
      }

      // Read property name
      let prop = '';
      while (pos < input.length && input[pos] !== ',' && input[pos] !== '{' && input[pos] !== '}') {
        prop += input[pos++];
      }
      prop = prop.trim();
      if (!prop) continue;

      if (input[pos] === '{') {
        pos++; // consume '{'
        const children = parseTerms();
        if (input[pos] === '}') pos++; // consume '}'
        result.push({ type: 'nested', property: prop, children });
      } else {
        result.push({ type: 'property', property: prop });
      }
    }
    return result;
  }

  return parseTerms();
}

/**
 * Parse the oslc.orderBy parameter.
 * Format: "+prop1,-prop2"
 */
export function parseOrderBy(input: string): OrderByTerm[] {
  return input.split(',').map(part => {
    part = part.trim();
    if (part.startsWith('+')) {
      return { property: part.slice(1), direction: 'asc' as const };
    }
    if (part.startsWith('-')) {
      return { property: part.slice(1), direction: 'desc' as const };
    }
    return { property: part, direction: 'asc' as const };
  });
}

/**
 * Parse the oslc.searchTerms parameter.
 * Format: quoted strings: "term1","term2"
 */
export function parseSearchTerms(input: string): string[] {
  const terms: string[] = [];
  const regex = /"([^"]*)"/g;
  let match;
  while ((match = regex.exec(input)) !== null) {
    terms.push(match[1]);
  }
  if (terms.length === 0 && input.trim()) {
    terms.push(input.trim());
  }
  return terms;
}

/**
 * Parse all OSLC query parameters from an Express query object.
 */
export function parseOslcQuery(params: Record<string, string | undefined>): OslcQuery {
  const prefixes = params['oslc.prefix'] ? parsePrefixes(params['oslc.prefix']) : new Map();
  const where = params['oslc.where'] ? parseWhere(params['oslc.where']) : undefined;
  const select = params['oslc.select'] ? parseSelect(params['oslc.select']) : undefined;
  const orderBy = params['oslc.orderBy'] ? parseOrderBy(params['oslc.orderBy']) : undefined;
  const searchTerms = params['oslc.searchTerms'] ? parseSearchTerms(params['oslc.searchTerms']) : undefined;
  const pageSize = params['oslc.pageSize'] ? parseInt(params['oslc.pageSize'], 10) : undefined;
  const page = params['oslc.page'] ? parseInt(params['oslc.page'], 10) : undefined;

  return { prefixes, where, select, orderBy, searchTerms, pageSize, page };
}

// --- Tokenizer ---

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let pos = 0;

  while (pos < input.length) {
    // Skip whitespace
    while (pos < input.length && /\s/.test(input[pos])) pos++;
    if (pos >= input.length) break;

    const ch = input[pos];

    // Single-character tokens
    if ('{},[]'.includes(ch)) {
      tokens.push(ch);
      pos++;
      continue;
    }

    // Quoted string
    if (ch === '"') {
      let str = '"';
      pos++;
      while (pos < input.length && input[pos] !== '"') {
        if (input[pos] === '\\') { str += input[pos++]; }
        str += input[pos++];
      }
      if (pos < input.length) str += input[pos++]; // closing quote
      tokens.push(str);
      continue;
    }

    // URI in angle brackets
    if (ch === '<') {
      let uri = '<';
      pos++;
      while (pos < input.length && input[pos] !== '>') uri += input[pos++];
      if (pos < input.length) uri += input[pos++]; // closing >
      tokens.push(uri);
      continue;
    }

    // Multi-character operators
    if (ch === '!' && input[pos + 1] === '=') { tokens.push('!='); pos += 2; continue; }
    if (ch === '<' && input[pos + 1] === '=') { tokens.push('<='); pos += 2; continue; }
    if (ch === '>' && input[pos + 1] === '=') { tokens.push('>='); pos += 2; continue; }
    if (ch === '=' || ch === '<' || ch === '>') { tokens.push(ch); pos++; continue; }

    // Word token (property name, keyword, number)
    let word = '';
    while (pos < input.length && !/[\s{},[\]<>"=!]/.test(input[pos])) {
      word += input[pos++];
    }
    if (word) tokens.push(word);
  }

  return tokens;
}
```

**Step 2: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add oslc-service/src/query-parser.ts
git commit -m "feat: add OSLC query parameter parser with full AST"
```

---

## Task 15: Create OSLC Query SPARQL Translator

**Files:**
- Create: `oslc-service/src/query-translator.ts`

**Step 1: Implement the SPARQL translator**

```typescript
/*
 * query-translator.ts converts a parsed OslcQuery AST into a SPARQL
 * CONSTRUCT query for execution against the union default graph.
 */

import type {
  OslcQuery,
  WhereExpression,
  SelectTerm,
  OslcValue,
  PrefixMap,
} from './query-parser.js';

/**
 * Translate a parsed OSLC query into a SPARQL CONSTRUCT string.
 *
 * @param query   - Parsed OSLC query AST
 * @param resourceType - The rdf:type URI for the query capability's resource type
 * @param defaultPrefixes - Default prefix map (from server config)
 */
export function toSPARQL(
  query: OslcQuery,
  resourceType: string,
  defaultPrefixes?: PrefixMap
): string {
  const ctx = new TranslationContext(query, defaultPrefixes);

  // Base type constraint
  ctx.addWhereClause(`?s <http://www.w3.org/1999/02/22-rdf-syntax-ns#type> <${resourceType}> .`);

  // WHERE conditions from oslc.where
  if (query.where) {
    translateWhere(ctx, query.where, '?s');
  }

  // Search terms
  if (query.searchTerms && query.searchTerms.length > 0) {
    for (const term of query.searchTerms) {
      const varName = ctx.freshVar();
      ctx.addWhereClause(`?s ${varName}Pred ${varName} .`);
      ctx.addWhereClause(`FILTER(isLiteral(${varName}) && CONTAINS(LCASE(STR(${varName})), LCASE("${escapeSparql(term)}"))) .`);
    }
  }

  // Build CONSTRUCT based on whether oslc.select is specified
  if (query.select) {
    return buildSelectConstruct(ctx, query);
  } else {
    return buildFullConstruct(ctx, query);
  }
}

class TranslationContext {
  private varCounter = 0;
  private whereClauses: string[] = [];
  private constructPatterns: string[] = [];
  private prefixes: PrefixMap;

  constructor(query: OslcQuery, defaultPrefixes?: PrefixMap) {
    this.prefixes = new Map([...(defaultPrefixes ?? []), ...query.prefixes]);
  }

  freshVar(): string {
    return `?_v${this.varCounter++}`;
  }

  addWhereClause(clause: string): void {
    this.whereClauses.push(clause);
  }

  addConstructPattern(pattern: string): void {
    this.constructPatterns.push(pattern);
  }

  getWhereClauses(): string[] {
    return this.whereClauses;
  }

  getConstructPatterns(): string[] {
    return this.constructPatterns;
  }

  resolvePrefix(prefixedName: string): string {
    const colon = prefixedName.indexOf(':');
    if (colon < 0) return prefixedName;
    const prefix = prefixedName.slice(0, colon);
    const local = prefixedName.slice(colon + 1);
    const ns = this.prefixes.get(prefix);
    if (ns) return `<${ns}${local}>`;
    return `<${prefixedName}>`;
  }
}

function translateWhere(ctx: TranslationContext, expr: WhereExpression, subject: string): void {
  switch (expr.type) {
    case 'comparison': {
      const predicate = ctx.resolvePrefix(expr.property);
      const varName = ctx.freshVar();
      ctx.addWhereClause(`${subject} ${predicate} ${varName} .`);
      const sparqlValue = toSparqlValue(ctx, expr.value);
      switch (expr.operator) {
        case '=':
          ctx.addWhereClause(`FILTER(${varName} = ${sparqlValue}) .`);
          break;
        case '!=':
          ctx.addWhereClause(`FILTER(${varName} != ${sparqlValue}) .`);
          break;
        default:
          ctx.addWhereClause(`FILTER(${varName} ${expr.operator} ${sparqlValue}) .`);
      }
      break;
    }

    case 'in': {
      const predicate = ctx.resolvePrefix(expr.property);
      const varName = ctx.freshVar();
      ctx.addWhereClause(`${subject} ${predicate} ${varName} .`);
      const values = expr.values.map(v => toSparqlValue(ctx, v)).join(', ');
      ctx.addWhereClause(`FILTER(${varName} IN (${values})) .`);
      break;
    }

    case 'nested': {
      const predicate = ctx.resolvePrefix(expr.property);
      const nestedVar = ctx.freshVar();
      ctx.addWhereClause(`${subject} ${predicate} ${nestedVar} .`);
      translateWhere(ctx, expr.inner, nestedVar);
      break;
    }

    case 'compound': {
      if (expr.operator === 'and') {
        for (const operand of expr.operands) {
          translateWhere(ctx, operand, subject);
        }
      } else {
        // OR: use UNION or FILTER with ||
        const filterParts: string[] = [];
        for (const operand of expr.operands) {
          if (operand.type === 'comparison') {
            const predicate = ctx.resolvePrefix(operand.property);
            const varName = ctx.freshVar();
            ctx.addWhereClause(`OPTIONAL { ${subject} ${predicate} ${varName} . }`);
            const sparqlValue = toSparqlValue(ctx, operand.value);
            filterParts.push(`(${varName} ${operand.operator === '=' ? '=' : operand.operator} ${sparqlValue})`);
          } else {
            // For complex OR operands, fall back to nested translation
            translateWhere(ctx, operand, subject);
          }
        }
        if (filterParts.length > 0) {
          ctx.addWhereClause(`FILTER(${filterParts.join(' || ')}) .`);
        }
      }
      break;
    }
  }
}

function translateSelect(ctx: TranslationContext, terms: SelectTerm[], subject: string): void {
  for (const term of terms) {
    switch (term.type) {
      case 'property': {
        const predicate = ctx.resolvePrefix(term.property);
        const varName = ctx.freshVar();
        ctx.addConstructPattern(`${subject} ${predicate} ${varName} .`);
        ctx.addWhereClause(`OPTIONAL { ${subject} ${predicate} ${varName} . }`);
        break;
      }
      case 'nested': {
        const predicate = ctx.resolvePrefix(term.property);
        const nestedVar = ctx.freshVar();
        ctx.addConstructPattern(`${subject} ${predicate} ${nestedVar} .`);
        ctx.addWhereClause(`OPTIONAL { ${subject} ${predicate} ${nestedVar} .`);
        translateSelect(ctx, term.children, nestedVar);
        ctx.addWhereClause(`}`);
        break;
      }
      case 'wildcard': {
        const pVar = ctx.freshVar();
        const oVar = ctx.freshVar();
        ctx.addConstructPattern(`${subject} ${pVar} ${oVar} .`);
        ctx.addWhereClause(`${subject} ${pVar} ${oVar} .`);
        break;
      }
    }
  }
}

function buildSelectConstruct(ctx: TranslationContext, query: OslcQuery): string {
  // Add select patterns to construct and where
  translateSelect(ctx, query.select!, '?s');

  let sparql = `CONSTRUCT {\n  ${ctx.getConstructPatterns().join('\n  ')}\n}\nWHERE {\n  ${ctx.getWhereClauses().join('\n  ')}`;

  sparql += '\n}';

  if (query.orderBy && query.orderBy.length > 0) {
    const orderClauses = query.orderBy.map(o => {
      const prop = ctx.resolvePrefix(o.property);
      // Can't directly ORDER BY in CONSTRUCT; wrap in subquery
      return `${o.direction === 'desc' ? 'DESC' : 'ASC'}(${prop})`;
    });
    // Note: SPARQL CONSTRUCT doesn't support ORDER BY directly.
    // For ordered results, we'd need a subquery pattern. This is handled below.
  }

  return sparql;
}

function buildFullConstruct(ctx: TranslationContext, query: OslcQuery): string {
  // Full representation: first find matching subjects, then get all their triples
  let subquery = `SELECT ?s WHERE {\n    ${ctx.getWhereClauses().join('\n    ')}`;

  if (query.orderBy && query.orderBy.length > 0) {
    // Need to bind the order-by properties
    for (const o of query.orderBy) {
      const predicate = ctx.resolvePrefix(o.property);
      const orderVar = ctx.freshVar();
      subquery += `\n    OPTIONAL { ?s ${predicate} ${orderVar} . }`;
      subquery = subquery.replace(
        'SELECT ?s',
        `SELECT ?s`
      );
      subquery += `\n  }\n  ORDER BY ${o.direction === 'desc' ? 'DESC' : 'ASC'}(${orderVar})`;
    }
  } else {
    subquery += '\n  }';
  }

  if (query.pageSize) {
    subquery += `\n  LIMIT ${query.pageSize}`;
    if (query.page && query.page > 0) {
      subquery += `\n  OFFSET ${query.page * query.pageSize}`;
    }
  }

  return `CONSTRUCT { ?s ?p ?o }\nWHERE {\n  { ${subquery} }\n  ?s ?p ?o .\n}`;
}

function toSparqlValue(ctx: TranslationContext, val: OslcValue): string {
  switch (val.kind) {
    case 'string': return `"${escapeSparql(val.value)}"`;
    case 'number': return val.value;
    case 'boolean': return val.value;
    case 'uri':
      if (val.value.includes(':') && !val.value.startsWith('http')) {
        return ctx.resolvePrefix(val.value);
      }
      return `<${val.value}>`;
  }
}

function escapeSparql(str: string): string {
  return str.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
}
```

**Step 2: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add oslc-service/src/query-translator.ts
git commit -m "feat: add OSLC query to SPARQL CONSTRUCT translator"
```

---

## Task 16: Create OSLC Query HTTP Handler

**Files:**
- Create: `oslc-service/src/query-handler.ts`

**Step 1: Implement the query handler**

```typescript
/*
 * query-handler.ts provides an Express handler for OSLC query capability
 * endpoints. It parses OSLC query parameters, translates to SPARQL,
 * executes against the storage backend, and returns RDF results.
 */

import type { Request, Response, RequestHandler } from 'express';
import * as rdflib from 'rdflib';
import type { StorageService } from 'storage-service';
import { parseOslcQuery } from './query-parser.js';
import { toSPARQL } from './query-translator.js';
import { oslc } from './vocab/oslc.js';

const DCTERMS = rdflib.Namespace('http://purl.org/dc/terms/');
const RDF = rdflib.Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

/**
 * Create an Express handler for an OSLC query capability endpoint.
 *
 * @param storage       - StorageService for executing queries
 * @param resourceType  - The rdf:type URI this query capability handles
 * @param appBase       - The server's base URL
 */
export function queryHandler(
  storage: StorageService,
  resourceType: string,
  appBase: string
): RequestHandler {
  return async (req: Request, res: Response): Promise<void> => {
    try {
      // Parse OSLC query parameters from the query string
      const queryParams: Record<string, string | undefined> = {};
      for (const [key, value] of Object.entries(req.query)) {
        if (typeof value === 'string') queryParams[key] = value;
      }

      const oslcQuery = parseOslcQuery(queryParams);

      // Translate to SPARQL
      const sparql = toSPARQL(oslcQuery, resourceType);

      // Execute
      const { status, results } = await storage.constructQuery(sparql);
      if (status !== 200 || !results) {
        res.sendStatus(status);
        return;
      }

      // Add ResponseInfo for paging
      if (oslcQuery.pageSize) {
        const requestURL = appBase + req.originalUrl;
        const responseInfoURI = requestURL;
        const riSym = results.sym(responseInfoURI);
        results.add(riSym, RDF('type'), results.sym(oslc.ResponseInfo), riSym);
        results.add(riSym, DCTERMS('title'), rdflib.lit('Query Results'), riSym);

        const currentPage = oslcQuery.page ?? 0;
        const nextPage = currentPage + 1;
        const nextURL = new URL(requestURL);
        nextURL.searchParams.set('oslc.page', String(nextPage));
        results.add(riSym, results.sym(oslc.ns + 'nextPage'), results.sym(nextURL.toString()), riSym);
      }

      // Content negotiation
      const accept = req.accepts(['text/turtle', 'application/ld+json', 'application/rdf+xml']);
      const contentType = (accept as string) || 'text/turtle';

      rdflib.serialize(null, results, 'none:', contentType, (err, content) => {
        if (err || !content) {
          res.sendStatus(500);
          return;
        }
        res.set('Content-Type', contentType).send(content);
      });
    } catch (err) {
      console.error('OSLC query error:', err);
      res.status(400).json({ error: String(err) });
    }
  };
}
```

**Step 2: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add oslc-service/src/query-handler.ts
git commit -m "feat: add OSLC query HTTP handler with content negotiation"
```

---

## Task 17: Register Query Capability Routes

**Files:**
- Modify: `oslc-service/src/service.ts:46-71`
- Modify: `oslc-service/src/catalog.ts:172-276` (catalogPostHandler)

**Step 1: Update `oslcService` to accept storage and register query routes**

The query handler needs access to the `StorageService`. Currently `oslcService` receives `storage` and passes it to `ldpService`. We need to also store it for query route registration.

In `oslc-service/src/service.ts`, add the import:

```typescript
import { queryHandler } from './query-handler.js';
```

**Step 2: Register query routes when ServiceProvider is created**

In `catalogPostHandler` in `catalog.ts`, after creating the ServiceProvider (after `await storage.update(spDoc)` at line 263), register Express routes for each query capability:

Add a parameter to `catalogPostHandler` for the Express app, and register routes:

```typescript
  // Register query routes for each query capability
  for (const metaSP of state.template.metaServiceProviders) {
    for (const metaService of metaSP.services) {
      for (const qc of metaService.queryCapabilities) {
        const typeName = qc.resourceTypes.length > 0
          ? qc.resourceTypes[0].replace(/.*[#/]/, '')
          : 'resources';
        const queryPath = state.catalogPath + '/' + encodeURIComponent(slug) + '/query/' + typeName;
        app.get(queryPath, queryHandler(storage, qc.resourceTypes[0], env.appBase));
      }
    }
  }
```

This requires passing the Express `app` to `catalogPostHandler`. Update the function signature and wire it through from `oslcService`.

**Step 3: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 4: Commit**

```bash
git add oslc-service/src/service.ts oslc-service/src/catalog.ts
git commit -m "feat: register query capability routes on ServiceProvider creation"
```

---

## Task 18: Export Query Types from oslc-service

**Files:**
- Modify: `oslc-service/src/index.ts`

**Step 1: Add query exports**

```typescript
export { parseOslcQuery, type OslcQuery } from './query-parser.js';
export { toSPARQL } from './query-translator.js';
export { queryHandler } from './query-handler.js';
```

**Step 2: Build to verify**

Run: `cd oslc-service && npm run build`
Expected: Compilation succeeds

**Step 3: Commit**

```bash
git add oslc-service/src/index.ts
git commit -m "feat: export query parser, translator, and handler from oslc-service"
```

---

## Task 19: Add Query Integration Tests

**Files:**
- Create: `oslc-server/testing/09-query-resources.http`

**Step 1: Create the query test file**

```http
###############################################################################
# 09-query-resources.http — Test OSLC query capability
#
# Requires a ServiceProvider to exist with resources created.
# Run 01 through 04 first to set up test data.
###############################################################################

@baseUrl = http://localhost:3001

### 1. Query all ChangeRequests (no filters)
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest
Accept: text/turtle

### 2. Query with oslc.where filter
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.where=dcterms:title="Bug+1001"&oslc.prefix=dcterms=<http://purl.org/dc/terms/>
Accept: text/turtle

### 3. Query with oslc.select for specific properties
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.select=dcterms:title,dcterms:description&oslc.prefix=dcterms=<http://purl.org/dc/terms/>
Accept: text/turtle

### 4. Query with ordering
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.orderBy=+dcterms:title&oslc.prefix=dcterms=<http://purl.org/dc/terms/>
Accept: text/turtle

### 5. Query with paging
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.pageSize=2&oslc.prefix=dcterms=<http://purl.org/dc/terms/>
Accept: text/turtle

### 6. Query Requirements
GET {{baseUrl}}/oslc/acme-webapp/query/Requirement
Accept: text/turtle

### 7. Query with in operator
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.where=dcterms:title+in+["Bug+1001","Bug+1002"]&oslc.prefix=dcterms=<http://purl.org/dc/terms/>
Accept: text/turtle

### 8. Query as JSON-LD
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest
Accept: application/ld+json

### 9. Full representation (no oslc.select)
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.where=dcterms:title="Bug+1001"&oslc.prefix=dcterms=<http://purl.org/dc/terms/>
Accept: text/turtle

### 10. Query with search terms
GET {{baseUrl}}/oslc/acme-webapp/query/ChangeRequest?oslc.searchTerms="bug"
Accept: text/turtle
```

**Step 2: Commit**

```bash
git add oslc-server/testing/09-query-resources.http
git commit -m "test: add OSLC query capability integration tests"
```

---

## Task 20: Add Bulk Import/Export Integration Tests

**Files:**
- Create: `oslc-server/testing/10-bulk-operations.http`

**Step 1: Create the bulk operations test file**

```http
###############################################################################
# 10-bulk-operations.http — Test bulk import/export/backup/restore
#
# These tests work directly with the Fuseki dataset.
###############################################################################

@baseUrl = http://localhost:3001
@fusekiUrl = http://localhost:3030/oslc

### 1. Export dataset as TriG (backup)
GET {{fusekiUrl}}/data
Accept: application/trig

### 2. Export default graph as Turtle (for exchange)
GET {{fusekiUrl}}/data?default
Accept: text/turtle

### 3. List all named graphs
GET {{fusekiUrl}}/sparql?query=SELECT+DISTINCT+?g+WHERE+{+GRAPH+?g+{+?s+?p+?o+}+}
Accept: application/sparql-results+json

### 4. Cross-resource query on union default graph
GET {{fusekiUrl}}/sparql?query=SELECT+?s+?title+WHERE+{+?s+<http://purl.org/dc/terms/title>+?title+}+LIMIT+20
Accept: application/sparql-results+json
```

**Step 2: Commit**

```bash
git add oslc-server/testing/10-bulk-operations.http
git commit -m "test: add bulk import/export integration tests"
```

---

## Task 21: Full Build and Verification

**Step 1: Build all packages**

Run: `npm run build --workspaces`
Expected: All packages compile successfully

**Step 2: Manual verification checklist**

1. Start Fuseki with `tdb:unionDefaultGraph true`
2. Start oslc-server: `cd oslc-server && npm start`
3. Run tests 01-04 to create catalog, service providers, and resources
4. Verify creation factory POST still works (resources get named graphs)
5. Verify GET on `/oslc/{sp}/resources` returns 404 (no longer a container)
6. Run test 09 to verify query capability
7. Run test 10 to verify bulk operations against Fuseki

**Step 3: Commit any fixes and final commit**

```bash
git add -A
git commit -m "feat: complete TDB named graph storage with OSLC query capability"
```
