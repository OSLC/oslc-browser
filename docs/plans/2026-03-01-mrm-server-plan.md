# mrm-server Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Create an OSLC 3.0 server for the MISA Municipal Reference Model, reusing oslc-service/ldp-service-jena, with unified mrm: namespace and whole-document shape loading.

**Architecture:** mrm-server is a thin app over the shared oslc-service middleware, configured with MRM-specific catalog template, vocabulary, and shapes. The storeResourceShapes function in oslc-service is generalized to load whole shape documents (stripping fragments to deduplicate). Namespace is unified from mrms: to mrm: across all vocab and data files.

**Tech Stack:** TypeScript, Express 5, rdflib.js, Apache Jena Fuseki, oslc-service/ldp-service-jena/storage-service packages

---

### Task 1: Unify mrms: namespace to mrm: in MRMS.ttl

**Files:**
- Modify: `mrm-server/config/vocab/MRMS.ttl`

**Step 1: Replace all mrms: namespace references with mrm:**

In `mrm-server/config/vocab/MRMS.ttl`:
- Change the prefix declaration from `@prefix mrms: <http://www.misa.org.ca/mrms#> .` to `@prefix mrm: <http://www.misa.org.ca/mrm#> .`
- Replace all occurrences of `<http://www.misa.org.ca/mrms#` with `<http://www.misa.org.ca/mrm#`
- Replace all occurrences of `<http://www.misa.org.ca/mrms>` with `<http://www.misa.org.ca/mrm>`
- Replace all occurrences of `mrms:` with `mrm:` (the prefix usage throughout)

**Step 2: Verify the file is valid Turtle**

Run: `cd mrm-server && npx rdflib-cli parse config/vocab/MRMS.ttl` or manually review the file for syntax errors.

**Step 3: Commit**

```bash
cd mrm-server
git add config/vocab/MRMS.ttl
git commit -m "refactor: unify mrms: namespace to mrm: in vocabulary"
```

---

### Task 2: Unify mrms: namespace to mrm: in MRMS-Shapes.ttl

**Files:**
- Modify: `mrm-server/config/vocab/MRMS-Shapes.ttl`

**Step 1: Replace all mrms: namespace references with mrm:**

In `mrm-server/config/vocab/MRMS-Shapes.ttl`:
- Change `@prefix mrms: <http://www.misa.org.ca/mrms#> .` to `@prefix mrm: <http://www.misa.org.ca/mrm#> .`
- Replace all occurrences of `mrms:` with `mrm:` throughout the file

**Step 2: Commit**

```bash
cd mrm-server
git add config/vocab/MRMS-Shapes.ttl
git commit -m "refactor: unify mrms: namespace to mrm: in resource shapes"
```

---

### Task 3: Unify mrms: namespace to mrm: in MRMS-SHACL-Shapes.ttl

**Files:**
- Modify: `mrm-server/config/vocab/MRMS-SHACL-Shapes.ttl`

**Step 1: Replace all mrms: namespace references with mrm:**

Same pattern as Task 2: change prefix declaration and all `mrms:` usages to `mrm:`.

**Step 2: Commit**

```bash
cd mrm-server
git add config/vocab/MRMS-SHACL-Shapes.ttl
git commit -m "refactor: unify mrms: namespace to mrm: in SHACL shapes"
```

---

### Task 4: Unify mrms: namespace to mrm: in MRMv2.1.ttl

**Files:**
- Modify: `mrm-server/data/MRMv2.1.ttl`

**Step 1: Replace all mrms: namespace references with mrm:**

In `mrm-server/data/MRMv2.1.ttl`:
- Remove the `@prefix mrms: <http://www.misa.org.ca/mrms#> .` line (it's redundant once mrm: covers everything)
- Replace all occurrences of `mrms:` with `mrm:` throughout the file
- Update the `owl:imports` line from `<http://www.misa.org.ca/mrms>` to `<http://www.misa.org.ca/mrm>` (or remove the separate import since it's now the same ontology)
- Update the `# imports:` comment at the top

Note: `mrm:` prefix for instance data (e.g., `mrm:AccessToInformation`) stays unchanged — it already uses the target namespace. Only `mrms:` references to vocabulary terms (e.g., `mrms:Service`, `mrms:accountableTo`) need to change to `mrm:`.

**Step 2: Commit**

```bash
cd mrm-server
git add data/MRMv2.1.ttl
git commit -m "refactor: unify mrms: namespace to mrm: in instance data"
```

---

### Task 5: Generalize storeResourceShapes in oslc-service

**Files:**
- Modify: `oslc-service/src/catalog.ts:172-215` (the `storeResourceShapes` function)

**Step 1: Rewrite storeResourceShapes to support whole-document loading**

Replace the current `storeResourceShapes` function with:

```typescript
/**
 * Store ResourceShape documents referenced by the template.
 *
 * Shape references may include fragment identifiers (e.g.,
 * urn:oslc:template/shapes/MRMS-Shapes#ProgramShape).
 * We strip fragments to get unique document URIs, then load each
 * document file once and store it as a single resource.
 *
 * External HTTP URIs are skipped (assumed published elsewhere).
 */
async function storeResourceShapes(
  env: OslcEnv,
  storage: StorageService,
  template: CatalogTemplate
): Promise<void> {
  const configDir = dirname(env.templatePath!);

  // Collect all unique shape refs from the template
  const shapeRefs = new Set<string>();
  for (const sp of template.metaServiceProviders) {
    for (const svc of sp.services) {
      for (const cf of svc.creationFactories) {
        for (const s of cf.resourceShapes) shapeRefs.add(s);
      }
      for (const cd of svc.creationDialogs) {
        if (cd.resourceShape) shapeRefs.add(cd.resourceShape);
      }
      for (const qc of svc.queryCapabilities) {
        for (const s of qc.resourceShapes) shapeRefs.add(s);
      }
    }
  }

  // Strip fragments to get unique document URIs
  const docURIs = new Set<string>();
  for (const ref of shapeRefs) {
    const hashIdx = ref.indexOf('#');
    docURIs.add(hashIdx >= 0 ? ref.slice(0, hashIdx) : ref);
  }

  for (const docRef of docURIs) {
    // Skip external HTTP URIs — they're published elsewhere
    if (!docRef.startsWith('urn:oslc:template/')) continue;

    const relativePath = docRef.replace('urn:oslc:template/', '');
    const docURI = env.appBase + '/' + relativePath;

    const { status } = await storage.read(docURI);
    if (status === 200) continue; // already stored

    // Try to find the .ttl file on disk
    // First try: exact relative path under config dir (e.g., config/shapes/MRMS-Shapes.ttl)
    // Second try: strip 'shapes/' prefix for legacy layout (e.g., config/shapes/ChangeRequest.ttl)
    let turtleContent: string | null = null;
    const candidates = [
      join(configDir, relativePath + '.ttl'),
      join(configDir, 'shapes', relativePath.replace('shapes/', '') + '.ttl'),
    ];

    for (const filePath of candidates) {
      try {
        turtleContent = readFileSync(filePath, 'utf-8');
        break;
      } catch {
        // try next candidate
      }
    }

    if (!turtleContent) {
      console.warn(`ResourceShape file not found for ${docRef}. Tried: ${candidates.join(', ')}`);
      continue;
    }

    const shapeDoc = new rdflib.IndexedFormula() as unknown as LdpDocument;
    shapeDoc.uri = docURI;
    rdflib.parse(turtleContent, shapeDoc, docURI, 'text/turtle');
    await storage.update(shapeDoc);
    console.log(`Stored ResourceShape document at ${docURI}`);
  }
}
```

**Key changes from the original:**
- Strips `#fragment` from shape refs to get unique document URIs
- Loads each document file once (not per-shape)
- Tries multiple file path candidates to support both the new layout (e.g., `config/shapes/MRMS-Shapes.ttl` matching `shapes/MRMS-Shapes`) and the legacy layout (e.g., `config/shapes/ChangeRequest.ttl` matching `shapes/ChangeRequest`)
- Skips non-`urn:oslc:template/` refs (external HTTP URIs)

**Step 2: Build and verify oslc-service compiles**

Run: `cd oslc-service && npm run build`
Expected: Clean compilation

**Step 3: Build oslc-server to verify backward compatibility**

Run: `npm run build --workspaces`
Expected: All workspaces compile cleanly. The oslc-server catalog template uses `<shapes/ChangeRequest>` (no fragment), which becomes doc URI `urn:oslc:template/shapes/ChangeRequest`. The second candidate path `config/shapes/ChangeRequest.ttl` matches the existing file layout.

**Step 4: Commit**

```bash
cd oslc-service
git add src/catalog.ts
git commit -m "refactor: generalize shape loading to support whole-document shape files"
```

---

### Task 6: Create mrm-server package.json and tsconfig.json

**Files:**
- Create: `mrm-server/package.json`
- Create: `mrm-server/tsconfig.json`

**Step 1: Create package.json**

Create `mrm-server/package.json`:

```json
{
  "name": "mrm-server",
  "version": "1.0.0",
  "description": "An OSLC 3.0 server for the MISA Municipal Reference Model",
  "license": "Apache-2.0",
  "author": "Jim Amsden",
  "type": "module",
  "main": "dist/app.js",
  "scripts": {
    "build": "tsc",
    "clean": "rm -rf dist",
    "start": "node dist/app.js"
  },
  "dependencies": {
    "cors": "^2.8.6",
    "express": "^5.0.1",
    "ldp-service-jena": "*",
    "oslc-service": "*",
    "storage-service": "*"
  },
  "devDependencies": {
    "@types/cors": "^2.8.19",
    "@types/express": "^5.0.0",
    "@types/node": "^22.0.0",
    "typescript": "^5.7.0"
  },
  "engines": {
    "node": "^22.11.0"
  }
}
```

**Step 2: Create tsconfig.json**

Create `mrm-server/tsconfig.json`:

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
    "forceConsistentCasingInFileNames": true,
    "resolveJsonModule": true
  }
}
```

**Step 3: Commit**

```bash
cd mrm-server
git add package.json tsconfig.json
git commit -m "feat: add mrm-server package configuration"
```

---

### Task 7: Update mrm-server config.json and create src/env.ts

**Files:**
- Modify: `mrm-server/config.json`
- Create: `mrm-server/src/env.ts`

**Step 1: Update config.json for port 3002 and /mrm/ dataset**

Overwrite `mrm-server/config.json`:

```json
{
  "scheme": "http",
  "host": "localhost",
  "port": 3002,
  "context": "/",
  "jenaURL": "http://localhost:3030/mrm/"
}
```

**Step 2: Create src/env.ts**

Create `mrm-server/src/env.ts` — identical to `oslc-server/src/env.ts` except the console log and any server-name references. Copy the entire file from oslc-server verbatim (the config.json differences handle the port/dataset change).

The file reads `config.json` from `join(__dirname, '..', 'config.json')` and sets `templatePath` to `join(__dirname, '..', 'config', 'catalog-template.ttl')`.

**Step 3: Commit**

```bash
cd mrm-server
git add config.json src/env.ts
git commit -m "feat: add mrm-server environment configuration"
```

---

### Task 8: Create mrm-server src/app.ts

**Files:**
- Create: `mrm-server/src/app.ts`

**Step 1: Create app.ts**

Create `mrm-server/src/app.ts` — modeled on `oslc-server/src/app.ts`:

```typescript
/*
 * mrm-server: An OSLC 3.0 server for the MISA Municipal Reference Model.
 * Uses oslc-service Express middleware with MRM-specific configuration.
 */

import express, { type Request, type Response, type NextFunction } from 'express';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { oslcService } from 'oslc-service';
import { JenaStorageService } from 'ldp-service-jena';
import { env } from './env.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

console.log('configuration:');
console.dir(env);

const app = express();

// Serve static files
app.use(express.static(join(__dirname, '..', 'public')));
app.use('/dialog', express.static(join(__dirname, '..', 'dialog')));

// Initialize storage and mount OSLC service
const storage = new JenaStorageService();

try {
  await storage.init(env);
  app.use(await oslcService(env, storage));
} catch (err) {
  console.error(err);
  console.error("Can't initialize the Jena storage service.");
}

// Error handling
app.use((err: Error, _req: Request, res: Response, _next: NextFunction) => {
  console.error(err.stack);
  res.status(500).send('Something broke!');
});

app.listen(env.listenPort, env.listenHost, () => {
  console.log('mrm-server running on ' + env.appBase);
});
```

**Step 2: Commit**

```bash
cd mrm-server
git add src/app.ts
git commit -m "feat: add mrm-server application entry point"
```

---

### Task 9: Create MRM catalog template

**Files:**
- Modify: `mrm-server/config/catalog-template.ttl`

**Step 1: Write the MRM catalog template**

Overwrite `mrm-server/config/catalog-template.ttl` with a template that defines the MRM domain and 8 resource types. Each type gets a creation factory, query capability, and creation dialog, all referencing `<shapes/MRMS-Shapes#TypeShape>`:

```turtle
@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix oslc:    <http://open-services.net/ns/core#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

# --- Catalog properties ---

<urn:oslc:template/catalog>
  dcterms:title "MRM Service Provider Catalog" ;
  dcterms:description "ServiceProviderCatalog for the MISA Municipal Reference Model" ;
  dcterms:publisher [
    a oslc:Publisher ;
    dcterms:identifier "mrm" ;
    dcterms:title "MISA Municipal Reference Model"
  ] .

# --- Meta ServiceProvider definition ---

<urn:oslc:template/sp>
  a oslc:ServiceProvider ;
  oslc:service <urn:oslc:template/sp/service> .

<urn:oslc:template/sp/service>
  a oslc:Service ;
  oslc:domain mrm: ;

  # === Creation Factories ===

  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Programs" ;
    oslc:resourceType mrm:Program ;
    oslc:resourceShape <shapes/MRMS-Shapes#ProgramShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Services" ;
    oslc:resourceType mrm:Service ;
    oslc:resourceShape <shapes/MRMS-Shapes#ServiceShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Processes" ;
    oslc:resourceType mrm:Process ;
    oslc:resourceShape <shapes/MRMS-Shapes#ProcessShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Resources" ;
    oslc:resourceType mrm:Resource ;
    oslc:resourceShape <shapes/MRMS-Shapes#ResourceShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Outcomes" ;
    oslc:resourceType mrm:Outcome ;
    oslc:resourceShape <shapes/MRMS-Shapes#OutcomeShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Organization Units" ;
    oslc:resourceType mrm:OrganizationUnit ;
    oslc:resourceShape <shapes/MRMS-Shapes#OrganizationUnitShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Target Groups" ;
    oslc:resourceType mrm:TargetGroup ;
    oslc:resourceShape <shapes/MRMS-Shapes#TargetGroupShape>
  ] ;
  oslc:creationFactory [
    a oslc:CreationFactory ;
    dcterms:title "Needs" ;
    oslc:resourceType mrm:Need ;
    oslc:resourceShape <shapes/MRMS-Shapes#NeedShape>
  ] ;

  # === Creation Dialogs ===

  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Program" ;
    oslc:label "Program" ;
    oslc:resourceType mrm:Program ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#ProgramShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Service" ;
    oslc:label "Service" ;
    oslc:resourceType mrm:Service ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#ServiceShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Process" ;
    oslc:label "Process" ;
    oslc:resourceType mrm:Process ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#ProcessShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Resource" ;
    oslc:label "Resource" ;
    oslc:resourceType mrm:Resource ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#ResourceShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Outcome" ;
    oslc:label "Outcome" ;
    oslc:resourceType mrm:Outcome ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#OutcomeShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Organization Unit" ;
    oslc:label "Organization Unit" ;
    oslc:resourceType mrm:OrganizationUnit ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#OrganizationUnitShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Target Group" ;
    oslc:label "Target Group" ;
    oslc:resourceType mrm:TargetGroup ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#TargetGroupShape>
  ] ;
  oslc:creationDialog [
    a oslc:Dialog ;
    dcterms:title "New Need" ;
    oslc:label "Need" ;
    oslc:resourceType mrm:Need ;
    oslc:hintHeight "505px" ;
    oslc:hintWidth "680px" ;
    oslc:resourceShape <shapes/MRMS-Shapes#NeedShape>
  ] ;

  # === Query Capabilities ===

  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Programs" ;
    oslc:resourceType mrm:Program ;
    oslc:resourceShape <shapes/MRMS-Shapes#ProgramShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Services" ;
    oslc:resourceType mrm:Service ;
    oslc:resourceShape <shapes/MRMS-Shapes#ServiceShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Processes" ;
    oslc:resourceType mrm:Process ;
    oslc:resourceShape <shapes/MRMS-Shapes#ProcessShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Resources" ;
    oslc:resourceType mrm:Resource ;
    oslc:resourceShape <shapes/MRMS-Shapes#ResourceShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Outcomes" ;
    oslc:resourceType mrm:Outcome ;
    oslc:resourceShape <shapes/MRMS-Shapes#OutcomeShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Organization Units" ;
    oslc:resourceType mrm:OrganizationUnit ;
    oslc:resourceShape <shapes/MRMS-Shapes#OrganizationUnitShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Target Groups" ;
    oslc:resourceType mrm:TargetGroup ;
    oslc:resourceShape <shapes/MRMS-Shapes#TargetGroupShape>
  ] ;
  oslc:queryCapability [
    a oslc:QueryCapability ;
    dcterms:title "Query Needs" ;
    oslc:resourceType mrm:Need ;
    oslc:resourceShape <shapes/MRMS-Shapes#NeedShape>
  ] .
```

Note: The shape references `<shapes/MRMS-Shapes#ProgramShape>` resolve against the template base `urn:oslc:template/` to `urn:oslc:template/shapes/MRMS-Shapes#ProgramShape`. The loader strips the fragment to get document URI `urn:oslc:template/shapes/MRMS-Shapes`, maps to relative path `shapes/MRMS-Shapes`, and finds the file at `config/shapes/MRMS-Shapes.ttl`.

**Step 2: Create a symlink for the shapes file**

The shape loader looks for `config/shapes/MRMS-Shapes.ttl` (based on the relative path `shapes/MRMS-Shapes`). Create this symlink to the vocab directory:

```bash
cd mrm-server/config
mkdir -p shapes
ln -s ../vocab/MRMS-Shapes.ttl shapes/MRMS-Shapes.ttl
```

Alternatively, copy the file — but a symlink avoids duplication.

**Step 3: Commit**

```bash
cd mrm-server
git add config/catalog-template.ttl config/shapes/
git commit -m "feat: add MRM catalog template with 8 resource types"
```

---

### Task 10: Add mrm-server to root workspaces and install

**Files:**
- Modify: `package.json` (root)

**Step 1: Add mrm-server to the workspaces array**

In the root `package.json`, add `"mrm-server"` to the workspaces array after `"oslc-server"`.

**Step 2: Install dependencies**

Run: `npm install`

**Step 3: Build all workspaces**

Run: `npm run build --workspaces`
Expected: All workspaces build cleanly including mrm-server.

**Step 4: Commit**

```bash
git add package.json package-lock.json
git commit -m "feat: add mrm-server to workspace configuration"
```

---

### Task 11: Create testing/01-catalog.http

**Files:**
- Create: `mrm-server/testing/01-catalog.http`

**Step 1: Create catalog test file**

```http
###############################################################################
# 01-catalog.http — ServiceProviderCatalog operations
#
# Verify the MRM catalog exists and is a valid LDP BasicContainer.
# Start the mrm-server first: cd mrm-server && npm start
###############################################################################

@baseUrl = http://localhost:3002

### 1. Read catalog as Turtle
GET {{baseUrl}}/oslc
Accept: text/turtle

### 2. Read catalog as JSON-LD
GET {{baseUrl}}/oslc
Accept: application/ld+json

### 3. HEAD request to verify LDP type headers
HEAD {{baseUrl}}/oslc
```

**Step 2: Commit**

```bash
cd mrm-server
git add testing/01-catalog.http
git commit -m "test: add catalog integration test"
```

---

### Task 12: Create testing/02-create-service-providers.http

**Files:**
- Create: `mrm-server/testing/02-create-service-providers.http`

```http
###############################################################################
# 02-create-service-providers.http — Create ServiceProvider instances
#
# Each POST creates a ServiceProvider with MRM services.
###############################################################################

@baseUrl = http://localhost:3002

### 1. Create "City of Ottawa" municipality
POST {{baseUrl}}/oslc
Content-Type: text/turtle
Slug: city-of-ottawa

@prefix dcterms: <http://purl.org/dc/terms/> .
<> dcterms:title "City of Ottawa" ;
   dcterms:description "Municipal Reference Model for the City of Ottawa." .

### 2. Create "City of Toronto" municipality
POST {{baseUrl}}/oslc
Content-Type: text/turtle
Slug: city-of-toronto

@prefix dcterms: <http://purl.org/dc/terms/> .
<> dcterms:title "City of Toronto" ;
   dcterms:description "Municipal Reference Model for the City of Toronto." .

### 3. Verify catalog contains the new ServiceProviders
GET {{baseUrl}}/oslc
Accept: text/turtle

### 4. Attempt duplicate creation (should return 409 Conflict)
POST {{baseUrl}}/oslc
Content-Type: text/turtle
Slug: city-of-ottawa

@prefix dcterms: <http://purl.org/dc/terms/> .
<> dcterms:title "City of Ottawa" .
```

**Commit:**

```bash
cd mrm-server
git add testing/02-create-service-providers.http
git commit -m "test: add ServiceProvider creation tests"
```

---

### Task 13: Create testing/03-read-service-providers.http

**Files:**
- Create: `mrm-server/testing/03-read-service-providers.http`

```http
###############################################################################
# 03-read-service-providers.http — Read ServiceProvider details and shapes
###############################################################################

@baseUrl = http://localhost:3002

### 1. Read "City of Ottawa" ServiceProvider
GET {{baseUrl}}/oslc/city-of-ottawa
Accept: text/turtle

### 2. Read "City of Toronto" ServiceProvider
GET {{baseUrl}}/oslc/city-of-toronto
Accept: text/turtle

### 3. Read MRMS ResourceShapes document
GET {{baseUrl}}/shapes/MRMS-Shapes
Accept: text/turtle
```

**Commit:**

```bash
cd mrm-server
git add testing/03-read-service-providers.http
git commit -m "test: add ServiceProvider and shapes read tests"
```

---

### Task 14: Create testing/04-create-resources.http

**Files:**
- Create: `mrm-server/testing/04-create-resources.http`

```http
###############################################################################
# 04-create-resources.http — Create MRM resources in ServiceProviders
#
# POST resources to the SP's creation factory endpoint.
###############################################################################

@baseUrl = http://localhost:3002

### 1. Create a Service in "City of Ottawa"
POST {{baseUrl}}/oslc/city-of-ottawa/resources
Content-Type: text/turtle
Slug: water-distribution

@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

<> a mrm:Service ;
   dcterms:title "Water Distribution" ;
   dcterms:description "Provision of potable water to residents and businesses through the municipal water distribution network." ;
   dcterms:identifier "SVC-001" .

### 2. Create a Process in "City of Ottawa"
POST {{baseUrl}}/oslc/city-of-ottawa/resources
Content-Type: text/turtle
Slug: water-quality-testing

@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

<> a mrm:Process ;
   dcterms:title "Water Quality Testing" ;
   dcterms:description "Regular testing of water quality at treatment plants and distribution points." ;
   dcterms:identifier "PRC-001" .

### 3. Create an OrganizationUnit in "City of Ottawa"
POST {{baseUrl}}/oslc/city-of-ottawa/resources
Content-Type: text/turtle
Slug: public-works

@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

<> a mrm:OrganizationUnit ;
   dcterms:title "Public Works Department" ;
   dcterms:description "Responsible for infrastructure maintenance and public works services." ;
   dcterms:identifier "ORG-001" .

### 4. Create a Program in "City of Ottawa"
POST {{baseUrl}}/oslc/city-of-ottawa/resources
Content-Type: text/turtle
Slug: infrastructure-renewal

@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

<> a mrm:Program ;
   dcterms:title "Infrastructure Renewal Program" ;
   dcterms:description "Multi-year program for renewal of aging municipal infrastructure." ;
   dcterms:identifier "PGM-001" .

### 5. Create a Service in "City of Toronto"
POST {{baseUrl}}/oslc/city-of-toronto/resources
Content-Type: text/turtle
Slug: transit-operations

@prefix dcterms: <http://purl.org/dc/terms/> .
@prefix rdf:     <http://www.w3.org/1999/02/22-rdf-syntax-ns#> .
@prefix mrm:     <http://www.misa.org.ca/mrm#> .

<> a mrm:Service ;
   dcterms:title "Transit Operations" ;
   dcterms:description "Public transit service including buses, streetcars, and subway operations." ;
   dcterms:identifier "SVC-101" .
```

**Commit:**

```bash
cd mrm-server
git add testing/04-create-resources.http
git commit -m "test: add MRM resource creation tests"
```

---

### Task 15: Create testing/05 through 08

**Files:**
- Create: `mrm-server/testing/05-read-resources.http`
- Create: `mrm-server/testing/06-update-delete.http`
- Create: `mrm-server/testing/07-dialogs-and-preview.http`
- Create: `mrm-server/testing/08-error-cases.http`

These follow the same patterns as oslc-server's test files but use MRM resources, port 3002, and mrm: types. The content should parallel the oslc-server equivalents:

- **05**: GET the resources created in 04 (water-distribution, water-quality-testing, public-works, infrastructure-renewal, transit-operations) in Turtle and JSON-LD
- **06**: GET to obtain ETag, PUT with If-Match to update, DELETE a resource
- **07**: GET /dialog/create with shape and creation params, GET /compact for resource preview
- **08**: POST with empty body (400), POST without title (400), GET non-existent resource (404), PUT without If-Match (412)

**Commit each file as created.**

---

### Task 16: Create testing/09-query-resources.http

**Files:**
- Create: `mrm-server/testing/09-query-resources.http`

```http
###############################################################################
# 09-query-resources.http — Test OSLC query capability for MRM types
#
# Run 01 through 04 first to set up test data.
# Queries use POST with oslc.prefix on the URL and readable query params
# in the form-encoded body.
###############################################################################

@baseUrl = http://localhost:3002
@queryBase = {{baseUrl}}/oslc/city-of-ottawa/query
@prefix = oslc.prefix=dcterms%3D%3Chttp%3A%2F%2Fpurl.org%2Fdc%2Fterms%2F%3E%2Cmrm%3D%3Chttp%3A%2F%2Fwww.misa.org.ca%2Fmrm%23%3E

### 1. Query all Services (no filters)
GET {{queryBase}}/Service
Accept: text/turtle

### 2. Query Services with oslc.where filter
POST {{queryBase}}/Service?{{prefix}}
Accept: text/turtle
Content-Type: application/x-www-form-urlencoded

oslc.where=dcterms:identifier="SVC-001"

### 3. Query with oslc.select for specific properties
POST {{queryBase}}/Service?{{prefix}}
Accept: text/turtle
Content-Type: application/x-www-form-urlencoded

oslc.select=dcterms:title,dcterms:description

### 4. Query all Processes
GET {{queryBase}}/Process
Accept: text/turtle

### 5. Query all OrganizationUnits
GET {{queryBase}}/OrganizationUnit
Accept: text/turtle

### 6. Query all Programs
GET {{queryBase}}/Program
Accept: text/turtle

### 7. Query with ordering
POST {{queryBase}}/Service?{{prefix}}
Accept: text/turtle
Content-Type: application/x-www-form-urlencoded

oslc.orderBy=+dcterms:title

### 8. Query with paging
POST {{queryBase}}/Service?{{prefix}}
Accept: text/turtle
Content-Type: application/x-www-form-urlencoded

oslc.pageSize=2

### 9. Query as JSON-LD
GET {{queryBase}}/Service
Accept: application/ld+json

### 10. Query with search terms
POST {{queryBase}}/Service
Accept: text/turtle
Content-Type: application/x-www-form-urlencoded

oslc.searchTerms="water"
```

**Commit:**

```bash
cd mrm-server
git add testing/09-query-resources.http
git commit -m "test: add MRM query capability tests"
```

---

### Task 17: Create testing/10-bulk-operations.http and testing/11-import-data.http

**Files:**
- Create: `mrm-server/testing/10-bulk-operations.http`
- Create: `mrm-server/testing/11-import-data.http`

**10-bulk-operations.http** — Same as oslc-server's but targeting Fuseki at `http://localhost:3030/mrm`:
- Export dataset as TriG
- Export default graph as Turtle
- List all named graphs
- Cross-resource query for dcterms:title
- Count resources by type

**11-import-data.http** — Bulk import tests:
- PUT Turtle data with known MRM types (mrm:Service instances)
- PUT data with unknown types (warns)
- PUT TriG data
- Verify imported resources via query
- Error cases (empty body, invalid Turtle)
- Import MRMv2.1.ttl data reference (note: this large file import would be done via curl or similar, not the .http file directly)

**Commit each file.**

---

### Task 18: Build all workspaces and verify

**Step 1: Install dependencies**

Run: `npm install`

**Step 2: Build all workspaces**

Run: `npm run build --workspaces`
Expected: All workspaces including mrm-server build cleanly.

**Step 3: Commit any build artifacts or lockfile changes**

```bash
git add package-lock.json
git commit -m "chore: update lockfile after mrm-server addition"
```

---

### Task 19: Final commit — update submodule pointers

If oslc-service was modified (Task 5), update the submodule pointer in the root repo:

```bash
git add oslc-service mrm-server
git commit -m "chore: update submodule pointers for mrm-server"
```
