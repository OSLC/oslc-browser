# Instance Shape Link Classification Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add `oslc:instanceShape` to created resources and use it in oslc-browser to distinguish navigable links from enumeration/non-link NamedNode values.

**Architecture:** Two independent changes: (1) oslc-service's property injector adds `oslc:instanceShape` during POST, derived from the creation factory's `oslc:resourceShape`; (2) oslc-browser's resource parser fetches the shape and uses `oslc:valueType` to classify NamedNode values as links or properties.

**Tech Stack:** TypeScript, Express middleware (oslc-service), React hooks (oslc-browser), rdflib, oslc-client

**Spec:** Design approved in conversation — no separate spec document.

---

## File Structure

### Files to Modify

| File | Responsibility |
|------|---------------|
| `oslc-service/src/service.ts` | Add `oslc:instanceShape` injection in `oslcPropertyInjector` |
| `oslc-browser/src/hooks/useOslcClient.ts` | Fetch shape, classify NamedNode values by `oslc:valueType` |
| `oslc-browser/src/models/types.ts` | Add shape cache type |

### Files to Create

| File | Responsibility |
|------|---------------|
| `oslc-browser/src/hooks/useShapeCache.ts` | Cache fetched resource shapes to avoid redundant requests |

---

## Chunk 1: oslc-service — Inject oslc:instanceShape on POST

### Task 1: Add oslc:instanceShape to oslcPropertyInjector

**Files:**
- Modify: `oslc-service/src/service.ts` (the `oslcPropertyInjector` function)

The existing `oslcPropertyInjector` already adds `dcterms:created`, `dcterms:creator`, and `oslc:serviceProvider` to POST request bodies. We add `oslc:instanceShape` using the same pattern.

The shape URI must be looked up from the ServiceProvider document. The service provider slug is already extracted (for `oslc:serviceProvider` injection). We need to:
1. Read the ServiceProvider RDF from storage
2. Find the CreationFactory whose `oslc:creation` URL matches the POST target
3. Get the `oslc:resourceShape` value from that factory
4. Append `oslc:instanceShape` to the request body

- [ ] **Step 1: Read the current oslcPropertyInjector code**

Read `oslc-service/src/service.ts` and understand the existing property injection pattern, especially how `oslc:serviceProvider` is derived from the URL.

- [ ] **Step 2: Add shape lookup logic**

In `oslcPropertyInjector`, after the `oslc:serviceProvider` injection block, add logic to look up the shape URI. The approach:

1. The service provider URI is already computed (e.g., `http://localhost:3002/oslc/mrmv2-1`)
2. The POST target container URL is `req.originalUrl` resolved against `env.appBase`
3. Read the ServiceProvider document from storage using `storage.read(spURI)`
4. Parse it with rdflib to find the creation factory matching the POST container
5. Extract the `oslc:resourceShape` value

Add after the existing `oslc:serviceProvider` injection (approximately line 177):

```typescript
// Add oslc:instanceShape if not already present
if (req.method === 'POST' && !req.body.includes('oslc:instanceShape')) {
  try {
    // The container URI is where we're POSTing to
    const containerURI = env.appBase + req.originalUrl.split('?')[0];

    // Read the service provider document to find the matching creation factory
    const spDoc = await storage.read(spURI);
    if (spDoc) {
      const spStore = rdflib.graph();
      rdflib.parse(spDoc.content, spStore, spURI, spDoc.contentType || 'text/turtle');

      const oslcNS = rdflib.Namespace('http://open-services.net/ns/core#');

      // Walk services → creationFactory → find one whose oslc:creation matches containerURI
      const spNode = spStore.sym(spURI);
      const services = spStore.each(spNode, oslcNS('service'), null);

      let shapeURI: string | null = null;
      for (const svc of services) {
        const factories = spStore.each(svc, oslcNS('creationFactory'), null);
        for (const factory of factories) {
          const creation = spStore.any(factory, oslcNS('creation'), null);
          if (creation && creation.value === containerURI) {
            const shape = spStore.any(factory, oslcNS('resourceShape'), null);
            if (shape) {
              shapeURI = shape.value;
            }
            break;
          }
        }
        if (shapeURI) break;
      }

      if (shapeURI) {
        req.body += `\n<> <http://open-services.net/ns/core#instanceShape> <${shapeURI}> .\n`;
      }
    }
  } catch (err) {
    console.error('[oslc-service] Failed to inject instanceShape:', err);
    // Non-fatal — continue without instanceShape
  }
}
```

Note: The `storage` parameter needs to be available in the injector. Check how the existing code accesses storage — it may be passed through `env` or through closure. Adapt accordingly.

- [ ] **Step 3: Verify the storage API is accessible**

Check how `oslcPropertyInjector` currently accesses storage. The function signature is `oslcPropertyInjector(env)` — storage may need to be passed as an additional parameter or accessed via `env`. Look at how `ldpService(env, storage)` receives storage and ensure the injector has the same access.

If storage isn't available in the injector, modify the function signature to accept it:

```typescript
function oslcPropertyInjector(env: OslcEnv, storage: StorageService) {
```

And update the mount point in the service setup to pass storage through.

- [ ] **Step 4: Build and verify**

```bash
cd oslc-service && npm run build
```

Expected: No TypeScript errors.

- [ ] **Step 5: Test manually**

Start mrm-server with Fuseki running. POST a new resource:

```bash
curl -X POST http://localhost:3002/oslc/mrmv2-1/resources \
  -H "Content-Type: text/turtle" \
  -H "Slug: test-instance-shape" \
  -d '@prefix dcterms: <http://purl.org/dc/terms/> .
      @prefix mrm: <http://www.misa.org.ca/mrm#> .
      @prefix rdf: <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
      <> rdf:type mrm:Program ;
         dcterms:title "Test Program" .'
```

Then GET the created resource and verify `oslc:instanceShape` is present:

```bash
curl -H "Accept: text/turtle" http://localhost:3002/oslc/mrmv2-1/resources/test-instance-shape
```

Expected: The resource should contain `oslc:instanceShape <http://localhost:3002/shapes/MRMS-Shapes#ProgramShape>` (or whichever shape matches Programs).

- [ ] **Step 6: Commit**

```bash
cd oslc-service
git add src/service.ts
git commit -m "feat: inject oslc:instanceShape on resource creation

Automatically adds oslc:instanceShape to POST request bodies by
looking up the creation factory's resourceShape from the service
provider document."
```

---

## Chunk 2: oslc-browser — Use instanceShape to classify links

### Task 2: Create shape cache hook

**Files:**
- Create: `oslc-browser/src/hooks/useShapeCache.ts`

A simple in-memory cache for fetched resource shapes, keyed by shape URI. Shapes are immutable during a session so we cache aggressively.

- [ ] **Step 1: Create useShapeCache.ts**

Create `oslc-browser/src/hooks/useShapeCache.ts`:

```typescript
import { useRef, useCallback } from 'react';

/**
 * Parsed property from an OSLC ResourceShape.
 */
export interface ShapePropertyInfo {
  /** Short name from oslc:name */
  name: string;
  /** Full predicate URI from oslc:propertyDefinition */
  predicateURI: string;
  /** Value type URI (e.g., oslc:Resource, xsd:string) */
  valueType: string;
}

/**
 * Parsed OSLC ResourceShape.
 */
export interface ParsedShape {
  shapeURI: string;
  properties: ShapePropertyInfo[];
  /** Quick lookup: predicate URI → valueType */
  predicateValueTypes: Map<string, string>;
}

const OSLC_NS = 'http://open-services.net/ns/core#';

/**
 * Returns true if the valueType indicates a navigable resource link.
 */
export function isLinkValueType(valueType: string): boolean {
  return (
    valueType === `${OSLC_NS}Resource` ||
    valueType === `${OSLC_NS}AnyResource`
  );
}

/**
 * Hook providing a cache for parsed OSLC resource shapes.
 * Shapes are fetched once and cached for the lifetime of the component.
 */
export function useShapeCache() {
  const cache = useRef<Map<string, ParsedShape | null>>(new Map());
  const pending = useRef<Map<string, Promise<ParsedShape | null>>>(new Map());

  const getShape = useCallback(
    async (
      shapeURI: string,
      fetchFn: (uri: string) => Promise<any>
    ): Promise<ParsedShape | null> => {
      // Return cached result
      if (cache.current.has(shapeURI)) {
        return cache.current.get(shapeURI)!;
      }

      // Return pending fetch if already in flight
      if (pending.current.has(shapeURI)) {
        return pending.current.get(shapeURI)!;
      }

      // Fetch and parse
      const promise = (async () => {
        try {
          const resource = await fetchFn(shapeURI);
          if (!resource || !resource.store) {
            cache.current.set(shapeURI, null);
            return null;
          }

          const store = resource.store;
          const oslcNS = store.sym(OSLC_NS);
          const shapeSym = store.sym(shapeURI);

          // Find all oslc:property nodes
          const propNodes = store.each(
            shapeSym,
            store.sym(`${OSLC_NS}property`),
            null
          );

          const properties: ShapePropertyInfo[] = [];
          const predicateValueTypes = new Map<string, string>();

          for (const propNode of propNodes) {
            const propDefNode = store.any(
              propNode,
              store.sym(`${OSLC_NS}propertyDefinition`),
              null
            );
            const valueTypeNode = store.any(
              propNode,
              store.sym(`${OSLC_NS}valueType`),
              null
            );
            const nameNode = store.anyValue(
              propNode,
              store.sym(`${OSLC_NS}name`)
            );

            const predicateURI = propDefNode?.value ?? '';
            const valueType = valueTypeNode?.value ?? '';
            const name = nameNode ?? '';

            if (predicateURI) {
              properties.push({ name, predicateURI, valueType });
              predicateValueTypes.set(predicateURI, valueType);
            }
          }

          const parsed: ParsedShape = {
            shapeURI,
            properties,
            predicateValueTypes,
          };
          cache.current.set(shapeURI, parsed);
          return parsed;
        } catch (err) {
          console.error(`[shape-cache] Failed to fetch shape ${shapeURI}:`, err);
          cache.current.set(shapeURI, null);
          return null;
        }
      })();

      pending.current.set(shapeURI, promise);
      const result = await promise;
      pending.current.delete(shapeURI);
      return result;
    },
    []
  );

  return { getShape };
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd oslc-browser && npx tsc --noEmit
```

- [ ] **Step 3: Commit**

```bash
cd oslc-browser
git add src/hooks/useShapeCache.ts
git commit -m "feat: add shape cache hook for resource shape lookups"
```

---

### Task 3: Modify parseOslcResource to use shape for link classification

**Files:**
- Modify: `oslc-browser/src/hooks/useOslcClient.ts`

This is the core change. When parsing a resource that has `oslc:instanceShape`, fetch the shape and use it to decide whether each NamedNode value is a link or a property.

- [ ] **Step 1: Read the current parseOslcResource code**

Read `oslc-browser/src/hooks/useOslcClient.ts` and understand:
- How `parseOslcResource()` currently splits NamedNode values into links
- Where `oslc:instanceShape` would be found (it's a NamedNode property on the resource, predicate `http://open-services.net/ns/core#instanceShape`)
- How the function returns `LoadedResource`

- [ ] **Step 2: Add shape-aware link classification**

The key change is in the section where NamedNode objects are categorized. Currently, ALL NamedNodes (except rdf:type) become links. With the shape:

1. Extract `oslc:instanceShape` from the resource's statements
2. If present, fetch the shape via the cache
3. For each NamedNode property value, check `shape.predicateValueTypes.get(predicateURI)`:
   - If valueType is `oslc:Resource` or `oslc:AnyResource` → ResourceLink (navigable)
   - If valueType is anything else (enum class, xsd type, or unknown) → ResourceProperty (display as label)
   - If predicate not in shape → fall back to current behavior (treat as link)
4. If no `oslc:instanceShape` → fall back to current behavior entirely

The shape fetch function needs to be passed into `parseOslcResource`. Since this function is called from within the `useOslcClient` hook, we need to:
- Import and use `useShapeCache` in the hook
- Pass `getShape` to `parseOslcResource` (or make it available via closure)
- Make `parseOslcResource` async (it may already be, or callers may need updating)

Modify the NamedNode handling section. Replace the current unconditional link creation with:

```typescript
// For NamedNode objects (not rdf:type):
if (shape && predicateURI !== RDF_TYPE) {
  const valueType = shape.predicateValueTypes.get(predicateURI);
  if (valueType && !isLinkValueType(valueType)) {
    // Shape says this is NOT a resource link — treat as property
    const label = obj.value.split(/[#/]/).pop() ?? obj.value;
    properties.push({
      predicate: predicateURI,
      predicateLabel: localName(predicateURI),
      value: label,
      isLink: false,
    });
    continue; // Skip adding to links
  }
}
// Fall through to existing link behavior
links.push({ ... });
```

- [ ] **Step 3: Handle the oslc:instanceShape property itself**

The `oslc:instanceShape` triple should NOT appear as a navigable link in the UI. Add it to the filtered predicates (alongside `rdf:type`):

```typescript
const OSLC_INSTANCE_SHAPE = 'http://open-services.net/ns/core#instanceShape';

// In the statement loop, alongside the rdf:type check:
if (predicateURI === OSLC_INSTANCE_SHAPE) {
  // Extract shape URI for later use, don't add to links or properties
  instanceShapeURI = obj.value;
  continue;
}
```

- [ ] **Step 4: Wire up the shape cache in useOslcClient**

In the `useOslcClient` hook function body:

```typescript
import { useShapeCache, isLinkValueType } from './useShapeCache';

// Inside the hook:
const { getShape } = useShapeCache();
```

Pass a fetch function to `getShape` that uses the existing oslc-client:

```typescript
const fetchShapeFn = async (uri: string) => {
  const client = getClient();
  return client.getResource(uri, '3.0', 'text/turtle');
};
```

- [ ] **Step 5: Build and verify**

```bash
cd oslc-browser && npx tsc --noEmit
```

Expected: No errors.

- [ ] **Step 6: Test manually**

1. Start Fuseki and mrm-server
2. Create a test resource with POST (which now adds `oslc:instanceShape`)
3. Open the browser UI and navigate to the resource
4. Verify that enumeration-valued properties show as text, not clickable links
5. Verify that real resource links (e.g., `mrm:accountableFor` pointing to a Program) still show as clickable links
6. Check the graph/diagram view — enumeration values should not create edges

- [ ] **Step 7: Commit**

```bash
cd oslc-browser
git add src/hooks/useOslcClient.ts src/hooks/useShapeCache.ts
git commit -m "feat: use oslc:instanceShape to classify links vs property values

Fetch the resource shape when oslc:instanceShape is present and
use oslc:valueType to determine whether NamedNode values are
navigable resource links or non-link values (enumerations, etc.).
Falls back to treating all NamedNodes as links when no shape is
available."
```

---

### Task 4: Export useShapeCache from library

**Files:**
- Modify: `oslc-browser/src/index.ts`

- [ ] **Step 1: Add export**

Add to `oslc-browser/src/index.ts`:

```typescript
export { useShapeCache, isLinkValueType } from './hooks/useShapeCache';
export type { ParsedShape, ShapePropertyInfo } from './hooks/useShapeCache';
```

- [ ] **Step 2: Build the library**

```bash
cd oslc-browser && npm run build
```

- [ ] **Step 3: Commit**

```bash
cd oslc-browser
git add src/index.ts
git commit -m "feat: export shape cache hook and types from library"
```

---

### Task 5: Rebuild UI app shells and verify end-to-end

**Files:**
- Build: `oslc-server/ui`, `mrm-server/ui`

- [ ] **Step 1: Rebuild oslc-server UI**

```bash
cd oslc-server/ui && npm run build
```

- [ ] **Step 2: Rebuild mrm-server UI**

```bash
cd mrm-server/ui && npm run build
```

- [ ] **Step 3: End-to-end test**

1. Start Fuseki with the mrm dataset
2. Start mrm-server: `cd mrm-server && npm start`
3. Open `http://localhost:3002/` in browser
4. Navigate to a service provider, then to a resource
5. Verify: properties with enumeration values (once MRM uses them) show as text, not links
6. Verify: real relationships still show as clickable links
7. Check Explorer tab graph — enumeration edges should not appear

- [ ] **Step 4: Commit rebuilt UIs**

```bash
cd oslc-server
git add public/
git commit -m "chore: rebuild UI with shape-aware link classification"

cd ../mrm-server
git add public/
git commit -m "chore: rebuild UI with shape-aware link classification"
```
