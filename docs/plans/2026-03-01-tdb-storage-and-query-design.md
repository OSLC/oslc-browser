# TDB Named Graph Storage, Bulk Operations, and OSLC Query Design

## Date: 2026-03-01

## Problem Statement

The oslc4js server needs a clear strategy for how OSLC resources are stored in
Apache Jena TDB, how bulk data is loaded and exchanged, and how OSLC query
capability is supported. Key concerns include:

- **Managed vs. unmanaged resources**: Managed OSLC resources have discoverable
  service provider services (creation factories, query capabilities, etc.).
  Unmanaged resources (e.g., foaf:Person, skos:Concept) are referenced entities
  that should still be individually GETtable.
- **Bulk loading**: Large instance models (e.g., MRMv2.1.ttl with ~1350
  resources) need to be loadable efficiently.
- **Cross-resource queries**: SPARQL queries must span multiple resources.
- **Blank node support**: Data may contain inline blank node structures that
  must be preserved in GET/PUT operations.
- **OSLC query**: Full OSLC 3.0 query syntax support backed by SPARQL.

## Design Decisions

### 1. Named Graphs with Union Default Graph

Every resource (managed and unmanaged) is stored in its own named graph, keyed
by its URI. The Fuseki dataset is configured with `tdb:unionDefaultGraph true`.

**Rationale**: Named graphs provide clean resource boundaries for GET (fetch
entire graph) and PUT (replace entire graph). The union default graph makes all
triples visible for cross-resource SPARQL queries without requiring `FROM`
clauses. Blank nodes within a named graph are naturally contained, making GET
and PUT correct without recursive blank node handling.

**Alternatives considered**:

- *Default graph only*: Bulk loading is trivial, but GET/PUT for resources with
  blank nodes requires recursive CONSTRUCT/DELETE operations. PUT atomicity
  depends on combining DELETE+INSERT in a single SPARQL Update. Resource
  boundaries are implicit (defined by subject URI) rather than explicit.
- *Named graphs for managed + shared graph for unmanaged*: Adds two code paths
  for GET without clear benefit over uniform named graphs.

### 2. Resource Boundary: Concise Bounded Description

A resource's named graph contains its Concise Bounded Description (CBD): all
triples with the resource URI as subject, plus all triples reachable by
recursively following blank node objects.

### 3. Remove BasicContainers for Managed OSLC Resources

LDP BasicContainers are removed for managed OSLC resource collections.

**Retained**:
- Root LDP container (`/oslc`) -- structural
- ServiceProviderCatalog -- structural BasicContainer
- ServiceProviders -- created via POST to catalog
- DirectContainers -- domain relationships (e.g., university students)

**Removed**:
- Per-ServiceProvider "resources" BasicContainer
- `ldp:contains` maintenance for managed OSLC resources

**Rationale**: With the union default graph, resource discovery is handled by
OSLC QueryCapability backed by SPARQL (e.g.,
`SELECT ?s WHERE { ?s rdf:type mrms:Service }`). The BasicContainer's
`ldp:contains` member list is a redundant materialized index that adds
bookkeeping overhead on every create/delete and complicates bulk loading.

Creation factory URLs accept POST only; GET returns 404 or 405.

### 4. Fuseki Configuration

```turtle
:dataset a tdb:DatasetTDB ;
    tdb:location "/path/to/tdb" ;
    tdb:unionDefaultGraph true .
```

## StorageService Interface

### Existing Methods (Unchanged)

| Method | Jena Implementation |
|--------|---------------------|
| `read(uri)` | `GET /data?graph=<uri>` |
| `update(resource)` | `PUT /data?graph=<uri>` with Turtle body |
| `insertData(data, uri)` | `INSERT DATA { GRAPH <uri> { ... } }` |
| `removeData(data, uri)` | `DELETE DATA { GRAPH <uri> { ... } }` |
| `remove(uri)` | `DELETE /data?graph=<uri>` |
| `reserveURI(uri)` | `PUT /data?graph=<uri>` with empty body |
| `releaseURI(uri)` | `DELETE /data?graph=<uri>` |

### Modified Method

| Method | Change |
|--------|--------|
| `getMembershipTriples(container)` | Remove `FROM <graph>` clause -- membership triples are visible through the union default graph |

### New Methods

```typescript
/** Execute a SPARQL CONSTRUCT query, return results as an IndexedFormula */
constructQuery(sparql: string): Promise<{ status: number; results: IndexedFormula | null }>

/** Export entire dataset */
exportDataset(format: 'trig' | 'turtle'): Promise<string>

/** Import dataset from TriG (restore) or Turtle (bulk load) */
importDataset(data: string, format: 'trig' | 'turtle'): Promise<void>
```

## Bulk Operations

### Backup (TriG)

Export the entire dataset preserving named graph structure. Fuseki supports this
natively via the Graph Store Protocol:

```
GET /dataset/data HTTP/1.1
Accept: application/trig
```

Returns all named graphs in TriG format, including container structure and
membership triples.

### Restore (TriG)

Reload a backup, recreating all named graphs:

```
PUT /dataset/data HTTP/1.1
Content-Type: application/trig
```

Zero custom logic required -- Fuseki handles it directly.

### Import External Data (Turtle)

Load a flat Turtle file (e.g., MRMv2.1.ttl) into per-resource named graphs:

1. Parse the entire Turtle file into an rdflib `IndexedFormula`
2. Identify all unique URI subjects (`FILTER(isURI(?s))`)
3. For each URI subject, compute its CBD:
   - Collect all triples `<uri> ?p ?o`
   - For any blank node object, recursively collect its triples
4. PUT each CBD as a named graph via `PUT /data?graph=<uri>`

No container membership management is needed since BasicContainers are removed
for managed resources. Resources are discoverable via OSLC QueryCapability.

### Export for Exchange (Turtle)

Produce a flat Turtle file for interoperability:

```sparql
CONSTRUCT { ?s ?p ?o } WHERE { ?s ?p ?o }
```

Executed on the union default graph, which merges all named graphs.

## OSLC Query Capability

### Template Definition

Query capabilities are defined in `catalog-template.ttl` alongside creation
factories:

```turtle
<urn:oslc:template/sp/service>
    oslc:creationFactory [
        a oslc:CreationFactory ;
        dcterms:title "Create MRM Resources" ;
        oslc:resourceType mrms:Service ;
        oslc:resourceShape <shapes/Service>
    ] ;
    oslc:queryCapability [
        a oslc:QueryCapability ;
        dcterms:title "Query MRM Services" ;
        oslc:queryBase <urn:oslc:template/sp/query/Service> ;
        oslc:resourceType mrms:Service ;
        oslc:resourceShape <shapes/Service>
    ] .
```

When a ServiceProvider is instantiated, the `oslc:queryBase` URL is resolved to
a concrete URL (e.g., `/oslc/mrm/query/Service`).

### Supported Query Parameters (Full OSLC 3.0)

| Parameter | Example | Purpose |
|-----------|---------|---------|
| `oslc.prefix` | `dcterms=<http://purl.org/dc/terms/>` | Namespace bindings |
| `oslc.where` | `dcterms:title="Bug" and oslc_cm:status!="Closed"` | Filter conditions |
| `oslc.select` | `dcterms:title,dcterms:creator{foaf:name}` | Properties to return |
| `oslc.orderBy` | `+dcterms:modified` | Sort (+ ascending, - descending) |
| `oslc.searchTerms` | `"meeting notes"` | Full-text search |
| `oslc.pageSize` | `20` | Page size for paging |

### Where Clause Operators

- Comparison: `=`, `!=`, `<`, `>`, `<=`, `>=`
- Logical: `and`, `or`
- Nested properties: `dcterms:creator{foaf:name="Jim"}`
- In operator: `dcterms:type in ["Bug","Enhancement"]`

### Response Format

- **With `oslc.select`**: Return only the selected properties via SPARQL
  CONSTRUCT.
- **Without `oslc.select`**: Return full resource representations.
- Paging: Server-driven via `oslc:ResponseInfo` with `oslc:nextPage` link.

### SPARQL Translation Examples

**With `oslc.select` (selected properties)**:

```
GET /oslc/mrm/query/Service?oslc.where=dcterms:title="Accounting"&oslc.select=dcterms:title,mrms:administeredBy
```

Translates to:

```sparql
CONSTRUCT {
    ?s dcterms:title ?v1 .
    ?s mrms:administeredBy ?v2 .
}
WHERE {
    ?s rdf:type mrms:Service .
    ?s dcterms:title "Accounting" .
    ?s dcterms:title ?v1 .
    ?s mrms:administeredBy ?v2 .
}
```

**Without `oslc.select` (full representation)**:

```
GET /oslc/mrm/query/Service?oslc.where=mrms:administeredBy=<http://...>
```

Translates to:

```sparql
CONSTRUCT { ?s ?p ?o }
WHERE {
    { SELECT ?s WHERE {
        ?s rdf:type mrms:Service .
        ?s mrms:administeredBy <http://...> .
      }
    }
    ?s ?p ?o .
}
```

**Nested properties in `oslc.where`**:

```
oslc.where=dcterms:creator{foaf:name="Jim"}
```

Translates to:

```sparql
?s dcterms:creator ?_nested1 .
?_nested1 foaf:name "Jim" .
```

**Nested properties in `oslc.select`**:

```
oslc.select=dcterms:creator{foaf:name,foaf:mbox}
```

Translates to:

```sparql
CONSTRUCT {
    ?s dcterms:creator ?_n1 .
    ?_n1 foaf:name ?v1 .
    ?_n1 foaf:mbox ?v2 .
}
WHERE {
    ...
    ?s dcterms:creator ?_n1 .
    ?_n1 foaf:name ?v1 .
    ?_n1 foaf:mbox ?v2 .
}
```

**In operator**:

```
oslc.where=dcterms:type in ["Bug","Enhancement"]
```

Translates to:

```sparql
?s dcterms:type ?_type .
FILTER(?_type IN ("Bug", "Enhancement"))
```

**OrderBy + Paging**:

```
oslc.orderBy=+dcterms:title&oslc.pageSize=20
```

Translates to:

```sparql
ORDER BY ASC(?title)
LIMIT 20 OFFSET 0
```

**searchTerms**: Uses Jena text search index if configured, or falls back to
regex FILTER(CONTAINS(...)) across string-valued properties.

### Query Processing Architecture

```
HTTP GET /oslc/mrm/query/Service?oslc.where=...&oslc.select=...
    |
    v
query-handler.ts  (Express handler: extract params, determine resourceType)
    |
    v
query-parser.ts   (Parse oslc.where/select/orderBy/prefix into AST)
    |
    v
query-translator.ts  (Convert AST + resourceType to SPARQL CONSTRUCT)
    |
    v
StorageService.constructQuery(sparql)  (Execute against Fuseki)
    |
    v
RDF response (Turtle/JSON-LD/RDF-XML via content negotiation)
```

## Code Changes

### New Files

| File | Responsibility |
|------|---------------|
| `oslc-service/src/query-parser.ts` | Parse OSLC query parameters into AST |
| `oslc-service/src/query-translator.ts` | Convert AST to SPARQL |
| `oslc-service/src/query-handler.ts` | Express handler for query routes |

### Modified Files

| File | Change |
|------|--------|
| `storage-service/src/storage.ts` | Add `constructQuery`, `exportDataset`, `importDataset` to interface |
| `ldp-service-jena/src/storage.ts` | Implement new methods; remove `FROM` in `getMembershipTriples` |
| `ldp-service/src/service.ts` | POST: skip `ldp:contains` for creation factory targets; GET: return 404/405 for creation factory URLs |
| `oslc-service/src/catalog.ts` | Handle `oslc:queryCapability` in template instantiation; stop creating BasicContainer for creation factory paths |
| `oslc-service/src/template.ts` | Parse `oslc:queryCapability` from template |
| `ldp-service-fs/src/storage.ts` | Implement new interface methods |
| `ldp-service-mongodb/src/storage.ts` | Implement new interface methods |

### New Utility

Bulk loader tool for importing flat Turtle files into per-resource named graphs.
Location: `oslc-server/src/loader.ts` or a standalone script.
