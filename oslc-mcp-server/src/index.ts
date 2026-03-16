#!/usr/bin/env node

import { OSLCClient } from 'oslc-client';
import { discover } from './discovery.js';
import { generateTools } from './tools/factory.js';
import { buildMcpResources } from './resources.js';
import { startServer } from './server.js';
import type { ServerConfig } from './types.js';

/**
 * Parse CLI arguments. Supports:
 *   --server <url>
 *   --catalog <url>
 *   --username <user>
 *   --password <pass>
 */
function parseArgs(argv: string[]): Partial<ServerConfig> {
  const config: Partial<ServerConfig> = {};
  for (let i = 0; i < argv.length; i++) {
    switch (argv[i]) {
      case '--server':
        config.serverURL = argv[++i];
        break;
      case '--catalog':
        config.catalogURL = argv[++i];
        break;
      case '--username':
        config.username = argv[++i];
        break;
      case '--password':
        config.password = argv[++i];
        break;
    }
  }
  return config;
}

/**
 * Build configuration from env vars + CLI args (CLI overrides env).
 */
function buildConfig(cliArgs: Partial<ServerConfig>): ServerConfig {
  const serverURL = cliArgs.serverURL ?? process.env.OSLC_SERVER_URL ?? '';
  const catalogURL =
    cliArgs.catalogURL ??
    process.env.OSLC_CATALOG_URL ??
    (serverURL ? `${serverURL}/oslc/catalog` : '');
  const username = cliArgs.username ?? process.env.OSLC_USERNAME ?? '';
  const password = cliArgs.password ?? process.env.OSLC_PASSWORD ?? '';

  if (!serverURL) {
    console.error(
      'Error: OSLC_SERVER_URL environment variable or --server argument is required.'
    );
    console.error(
      'Usage: oslc-mcp-server --server <url> [--catalog <url>] [--username <user>] [--password <pass>]'
    );
    process.exit(1);
  }

  return { serverURL, catalogURL, username, password };
}

async function main(): Promise<void> {
  const cliArgs = parseArgs(process.argv.slice(2));
  const config = buildConfig(cliArgs);

  console.error(`[startup] Connecting to OSLC server: ${config.serverURL}`);
  console.error(`[startup] Catalog URL: ${config.catalogURL}`);

  // Create oslc-client
  const client = new OSLCClient(
    config.username || undefined,
    config.password || undefined
  );

  // Discover capabilities
  console.error('[startup] Discovering OSLC capabilities...');
  const discovery = await discover(client, config);

  // Generate per-type tools
  const generatedTools = generateTools(client, discovery);
  console.error(`[startup] Generated ${generatedTools.length} per-type tools`);

  // Build MCP resources
  const mcpResources = buildMcpResources(discovery);

  // Start MCP server
  await startServer(client, discovery, generatedTools, mcpResources);
}

main().catch((err) => {
  console.error('[fatal]', err);
  process.exit(1);
});
