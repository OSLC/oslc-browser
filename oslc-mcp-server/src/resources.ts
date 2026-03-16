import type { DiscoveryResult } from './types.js';

/**
 * MCP resource definition.
 */
export interface McpResource {
  uri: string;
  name: string;
  description: string;
  mimeType: string;
  content: string;
}

/**
 * Build MCP resource definitions from discovery results.
 */
export function buildMcpResources(discovery: DiscoveryResult): McpResource[] {
  return [
    {
      uri: 'oslc://catalog',
      name: 'OSLC Service Provider Catalog',
      description:
        'Lists all service providers, creation factories, query capabilities, and resource types available on this OSLC server.',
      mimeType: 'text/plain',
      content: discovery.catalogContent,
    },
    {
      uri: 'oslc://vocabulary',
      name: 'OSLC Vocabulary',
      description:
        'Resource types and their relationships. Read this to understand the domain model before creating resources.',
      mimeType: 'text/plain',
      content: discovery.vocabularyContent,
    },
    {
      uri: 'oslc://shapes',
      name: 'OSLC Resource Shapes',
      description:
        'Property definitions for each resource type: names, types, cardinalities, descriptions. Read this to know what fields each resource type accepts.',
      mimeType: 'text/plain',
      content: discovery.shapesContent,
    },
  ];
}
