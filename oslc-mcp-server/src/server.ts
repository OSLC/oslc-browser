import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ListResourcesRequestSchema,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { OSLCClient } from 'oslc-client';
import type { DiscoveryResult } from './types.js';
import type { GeneratedTool } from './tools/factory.js';
import type { McpResource } from './resources.js';
import {
  handleGetResource,
  handleUpdateResource,
  handleDeleteResource,
  handleListResourceTypes,
  handleQueryResources,
} from './tools/generic.js';

/**
 * Build and start the MCP server with discovered tools and resources.
 */
export async function startServer(
  client: OSLCClient,
  discovery: DiscoveryResult,
  generatedTools: GeneratedTool[],
  mcpResources: McpResource[]
): Promise<void> {
  const server = new Server(
    { name: 'oslc-mcp-server', version: '1.0.0' },
    { capabilities: { tools: {}, resources: {} } }
  );

  // Build the complete tool list: generated + generic
  const allTools = [
    ...generatedTools.map((t) => ({
      name: t.name,
      description: t.description,
      inputSchema: t.inputSchema,
    })),
    {
      name: 'get_resource',
      description: 'Fetch an OSLC resource by URI and return all its properties.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          uri: { type: 'string', description: 'The URI of the resource to fetch' },
        },
        required: ['uri'],
      },
    },
    {
      name: 'update_resource',
      description:
        'Update an OSLC resource. Provided properties replace existing values; omitted properties are unchanged.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          uri: { type: 'string', description: 'The URI of the resource to update' },
          properties: {
            type: 'object',
            description: 'Properties to set (key-value pairs)',
          },
        },
        required: ['uri', 'properties'],
      },
    },
    {
      name: 'delete_resource',
      description: 'Delete an OSLC resource by URI.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          uri: { type: 'string', description: 'The URI of the resource to delete' },
        },
        required: ['uri'],
      },
    },
    {
      name: 'list_resource_types',
      description:
        'List all discovered OSLC resource types with their creation factories, query capabilities, and property summaries.',
      inputSchema: {
        type: 'object' as const,
        properties: {},
        required: [],
      },
    },
    {
      name: 'query_resources',
      description: 'Query OSLC resources using a query capability URL.',
      inputSchema: {
        type: 'object' as const,
        properties: {
          queryBase: {
            type: 'string',
            description: 'The query capability URL',
          },
          filter: {
            type: 'string',
            description:
              'OSLC query filter (oslc.where). Example: dcterms:title="My Resource"',
          },
          select: {
            type: 'string',
            description: 'Property projection (oslc.select)',
          },
          orderBy: {
            type: 'string',
            description: 'Sort order (oslc.orderBy)',
          },
        },
        required: ['queryBase'],
      },
    },
  ];

  // Build handler lookup for generated tools
  const generatedHandlers = new Map<string, (args: any) => Promise<string>>();
  for (const tool of generatedTools) {
    generatedHandlers.set(tool.name, tool.handler);
  }

  // Register tool list handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({
    tools: allTools,
  }));

  // Register tool call handler
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    const { name, arguments: args } = request.params;

    try {
      let result: string;

      // Check generated tools first
      const generatedHandler = generatedHandlers.get(name);
      if (generatedHandler) {
        result = await generatedHandler(args ?? {});
      } else {
        // Generic tools
        switch (name) {
          case 'get_resource':
            result = await handleGetResource(client, args as any);
            break;
          case 'update_resource':
            result = await handleUpdateResource(client, discovery, args as any);
            break;
          case 'delete_resource':
            result = await handleDeleteResource(client, args as any);
            break;
          case 'list_resource_types':
            result = await handleListResourceTypes(discovery);
            break;
          case 'query_resources':
            result = await handleQueryResources(client, args as any);
            break;
          default:
            return {
              content: [{ type: 'text' as const, text: `Unknown tool: ${name}` }],
              isError: true,
            };
        }
      }

      return { content: [{ type: 'text' as const, text: result }] };
    } catch (err: any) {
      const message = err?.response?.data
        ? `HTTP ${err.response.status}: ${JSON.stringify(err.response.data)}`
        : err?.message ?? String(err);
      return {
        content: [{ type: 'text' as const, text: `Error: ${message}` }],
        isError: true,
      };
    }
  });

  // Register resource list handler
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({
    resources: mcpResources.map((r) => ({
      uri: r.uri,
      name: r.name,
      description: r.description,
      mimeType: r.mimeType,
    })),
  }));

  // Register resource read handler
  server.setRequestHandler(ReadResourceRequestSchema, async (request) => {
    const resource = mcpResources.find((r) => r.uri === request.params.uri);
    if (!resource) {
      throw new Error(`Unknown resource: ${request.params.uri}`);
    }
    return {
      contents: [
        {
          uri: resource.uri,
          mimeType: resource.mimeType,
          text: resource.content,
        },
      ],
    };
  });

  // Connect stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('[server] OSLC MCP server running on stdio');
}
