# mrm-server

An OSLC 3.0 server for the MISA Municipal Reference Model (MRM). It exposes MRM domain resources -- Programs, Services, Processes, Resources, Outcomes, Organization Units, Target Groups, and Needs -- as linked data through standard OSLC and LDP interfaces. The server is built on the `oslc-service` Express middleware with Apache Jena Fuseki as the triple store backend.

## Prerequisites

- **Node.js** v22.11.0 or later
- **Apache Jena Fuseki** running with a dataset named `mrm` (or matching the `jenaURL` in `config.json`)
- The `oslc4js` workspace dependencies installed (this module depends on `oslc-service`, `ldp-service-jena`, and `storage-service` from the monorepo)

## Build

From the workspace root (`oslc4js/`):

```sh
npm install
npm run build --workspace=mrm-server
```

Or from within `mrm-server/`:

```sh
npm run build
```

This runs `tsc` and emits compiled JavaScript to `dist/`.

## Configuration

The server reads `config.json` at startup, with environment variables taking precedence where applicable.

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `scheme` | string | `"http"` | URL scheme for the server base URI |
| `host` | string | `"localhost"` | Hostname the server binds to |
| `port` | number | `3002` | Port the server listens on |
| `context` | string | `"/"` | LDP context path (root of the OSLC service) |
| `jenaURL` | string | `"http://localhost:3030/mrm/"` | SPARQL endpoint URL for the Jena Fuseki dataset |

The following environment variables override `config.json` values:

| Variable | Overrides |
|----------|-----------|
| `LDP_BASE` | Derives `scheme`, `host`, `port`, and `context` from a single base URL |
| `HOSTNAME` | `host` |
| `VCAP_APP_HOST` | Listen host (Cloud Foundry) |
| `VCAP_APP_PORT` | Listen port (Cloud Foundry) |

## Running

1. Start Apache Jena Fuseki with an `mrm` dataset:

   ```sh
   fuseki-server --mem /mrm
   ```

2. Start the server:

   ```sh
   npm start --workspace=mrm-server
   ```

   The server will print its configuration and listen on `http://localhost:3002/` by default.

### Web UI

mrm-server includes the [oslc-browser](../oslc-browser) web application, served as static files from `public/`. After starting the server, open your browser to:

    http://localhost:3002/

The UI provides an interactive column browser for navigating MRM service providers, resources, and their relationships. To rebuild the UI after changes to oslc-browser:

    cd mrm-server/ui
    npm run build

This builds the Vite app shell into `mrm-server/public/`.

## What It Does

### MRM Domain Resources

The MRM (Municipal Reference Model) defines a set of resource types for describing municipal government service delivery:

| Resource Type | RDF Type | Description |
|---------------|----------|-------------|
| Program | `mrm:Program` | A municipal program |
| Service | `mrm:Service` | A service delivered by a program |
| Process | `mrm:Process` | A process that implements a service |
| Resource | `mrm:Resource` | A resource used by processes |
| Outcome | `mrm:Outcome` | An outcome or result of a program or service |
| Organization Unit | `mrm:OrganizationUnit` | An organizational unit responsible for delivery |
| Target Group | `mrm:TargetGroup` | A target group served by a program or service |
| Need | `mrm:Need` | A need addressed by programs or services |

### OSLC Capabilities

For each resource type above, the server provides:

- **Creation Factories** -- POST a new resource to create it in the triple store
- **Query Capabilities** -- GET with OSLC query syntax to find resources
- **Resource Shapes** -- defined in `config/shapes/MRMS-Shapes.ttl` (referenced but managed by `oslc-service`)
- **Delegated UI Dialogs** -- creation dialogs for each resource type, served from the `dialog/` directory

### Diagram Support

The server also supports OMG DD (Diagram Definition) diagrams via the `dd:` namespace. Diagram creation factories and creation dialogs are provided for:

Organization Unit, Program, Service, Process, Resource, Need, Outcome, Output, Target Group, PLM, and SIAM diagrams.

Diagram shapes are defined in `config/shapes/MRMS-DiagramShapes.ttl`. A selection dialog is also available for choosing existing diagrams.

## Architecture

```
mrm-server
  |-- src/app.ts           Entry point: creates Express app, mounts oslc-service
  |-- src/env.ts           Configuration resolution (config.json + env vars)
  |-- config.json          Default server configuration
  |-- config/
  |     |-- catalog-template.ttl    OSLC ServiceProviderCatalog template
  |     +-- shapes/                 Resource shape definitions (Turtle)
  +-- public/              Static files (built navigator UI)
```

The server is a thin domain-specific layer on top of two shared libraries:

- **`oslc-service`** -- Express middleware that reads `catalog-template.ttl` and provides the OSLC ServiceProviderCatalog, ServiceProviders, creation factories, query capabilities, resource shapes, and delegated UI dialogs.
- **`ldp-service-jena`** -- `JenaStorageService` implementation of the `StorageService` interface. Handles all LDP container and resource CRUD operations against a Jena Fuseki SPARQL endpoint.

The `catalog-template.ttl` file in `config/` defines the full OSLC service description using placeholder URIs (`urn:oslc:template/...`). At startup, `oslc-service` processes this template, replaces placeholders with the server's actual base URL, and exposes the resulting catalog at the server root.

## REST API

The server exposes standard LDP and OSLC 3.0 REST endpoints:

- `GET /` -- OSLC ServiceProviderCatalog
- `GET /serviceProviders/{id}` -- Individual ServiceProvider
- `GET /shapes/{shapeName}` -- Resource shape documents
- `POST /{container}/` -- Create a resource (via creation factory)
- `GET /{container}/` -- Query resources (supports `oslc.where`, `oslc.select`, `oslc.prefix`)
- `GET /{container}/{resourceId}` -- Read a single resource
- `PUT /{container}/{resourceId}` -- Update a resource
- `DELETE /{container}/{resourceId}` -- Delete a resource

Content negotiation supports `text/turtle`, `application/ld+json`, and `application/rdf+xml`.

See the [`oslc-server` README](../oslc-server/README.md) for detailed LDP and OSLC protocol documentation.

## License

[Apache-2.0](https://www.apache.org/licenses/LICENSE-2.0)
