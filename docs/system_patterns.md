# System Patterns

## Build Order

Packages must be built in dependency order:

```
storage-service → ldp-service → oslc-service → oslc-client → oslc-browser (library)
                                                    │           ├── oslc-server/ui
                                                    │           ├── mrm-server/ui
                                                    │           └── oslc-browser/app (Electron)
                                                    └── oslc-mcp-server
```

- **oslc-browser** is a Vite library mode package exporting React components, hooks, and types
- **oslc-server/ui** and **mrm-server/ui** are thin Vite app shells that consume the library and build to their respective server's `public/` directory
- **oslc-browser/app** is an Electron desktop app consuming the library
- **oslc-mcp-server** is a standalone MCP server that discovers OSLC capabilities and exposes them as MCP tools for LLM-driven CRUD operations
