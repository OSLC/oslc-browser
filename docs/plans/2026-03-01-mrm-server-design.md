# mrm-server Design

**Goal:** Create an OSLC 3.0 server for the MISA Municipal Reference Model (MRM), reusing the shared oslc-service / ldp-service-jena / storage-service infrastructure.

## Namespace Unification

Replace all `mrms:` (`http://www.misa.org.ca/mrms#`) with `mrm:` (`http://www.misa.org.ca/mrm#`) across all vocabulary, shape, and data files. The MRM uses a single namespace for both the vocabulary (classes, properties) and instance data.

**Files affected:**
- `mrm-server/config/vocab/MRMS.ttl`
- `mrm-server/config/vocab/MRMS-Shapes.ttl`
- `mrm-server/config/vocab/MRMS-SHACL-Shapes.ttl`
- `mrm-server/data/MRMv2.1.ttl`

## Server Configuration

- **Port:** 3002 (oslc-server uses 3001; both can run simultaneously)
- **Jena dataset:** `/mrm/` (separate from oslc-server's `/rmcm/`)
- **Source code:** `src/app.ts` and `src/env.ts` modeled on oslc-server
- **Workspace:** Added to root `package.json` workspaces array

## Catalog Template

Single service definition with domain `http://www.misa.org.ca/mrm`.

**8 resource types**, each with a creation factory, query capability, and creation dialog:
- Program
- Service
- Process
- Resource
- Outcome
- OrganizationUnit
- TargetGroup
- Need

Shape references use fragment URIs into a single shape document:
`<shapes/MRMS-Shapes#ProgramShape>`, `<shapes/MRMS-Shapes#ServiceShape>`, etc.

These resolve via the `urn:oslc:template/` base to document URI `urn:oslc:template/shapes/MRMS-Shapes`, which maps to the local file `config/vocab/MRMS-Shapes.ttl`.

## Shape Loading (oslc-service change)

Generalize `storeResourceShapes` in `oslc-service/src/catalog.ts` to support whole-document shape files:

1. Collect all shape refs from the template (creation factories, query capabilities, dialogs)
2. Strip fragment identifiers to get unique document URIs
3. For `urn:oslc:template/` URIs: find the local `.ttl` file, parse, and store as a single document at `{appBase}/{relative-path}`
4. For external HTTP URIs: skip (referenced as-is, not stored locally)

This replaces the current one-file-per-shape assumption. The change also applies to oslc-server, though its existing per-shape files continue to work (each is a document with one shape).

OSLC domains typically publish all resource shapes in a single document, so this is the standard pattern.

## Testing

11 `.http` test files in `mrm-server/testing/`, paralleling oslc-server but using MRM types, port 3002, and Fuseki dataset `/mrm/`:

1. **01-catalog.http** — ServiceProviderCatalog operations
2. **02-create-service-providers.http** — Create SP (e.g., "City of Ottawa")
3. **03-read-service-providers.http** — Read SP and shapes
4. **04-create-resources.http** — Create MRM resources (Services, Processes, OrganizationUnits)
5. **05-read-resources.http** — Read and navigate resources
6. **06-update-delete.http** — Update and delete operations
7. **07-dialogs-and-preview.http** — OSLC delegated UI
8. **08-error-cases.http** — Error handling
9. **09-query-resources.http** — Query by MRM types (POST with readable params)
10. **10-bulk-operations.http** — Bulk operations against Fuseki `/mrm/`
11. **11-import-data.http** — Import MRMv2.1.ttl data

## Files Summary

**New files:**
- `mrm-server/package.json`
- `mrm-server/tsconfig.json`
- `mrm-server/config.json` (port 3002, dataset /mrm/)
- `mrm-server/config/catalog-template.ttl`
- `mrm-server/src/app.ts`
- `mrm-server/src/env.ts`
- `mrm-server/testing/*.http` (11 files)

**Modified files:**
- `mrm-server/config/vocab/MRMS.ttl` — namespace rename
- `mrm-server/config/vocab/MRMS-Shapes.ttl` — namespace rename
- `mrm-server/config/vocab/MRMS-SHACL-Shapes.ttl` — namespace rename
- `mrm-server/data/MRMv2.1.ttl` — namespace rename
- `oslc-service/src/catalog.ts` — generalize storeResourceShapes
- `package.json` (root) — add mrm-server to workspaces
