import { OSLCClient, OSLCResource } from 'oslc-client';
import { Namespace, type NamedNode } from 'rdflib';
import type {
  ServerConfig,
  DiscoveryResult,
  DiscoveredServiceProvider,
  DiscoveredFactory,
  DiscoveredQuery,
  DiscoveredShape,
  ShapeProperty,
} from './types.js';

const oslcNS = Namespace('http://open-services.net/ns/core#');
const dctermsNS = Namespace('http://purl.org/dc/terms/');
const xsdNS = Namespace('http://www.w3.org/2001/XMLSchema#');

const OSLC = 'http://open-services.net/ns/core#';

/**
 * Map an oslc:occurs URI to a normalized string.
 */
function normalizeOccurs(occursURI: string): string {
  switch (occursURI) {
    case `${OSLC}Exactly-one`:
      return 'exactly-one';
    case `${OSLC}Zero-or-one`:
      return 'zero-or-one';
    case `${OSLC}Zero-or-many`:
      return 'zero-or-many';
    case `${OSLC}One-or-more`:
      return 'one-or-more';
    default:
      return 'zero-or-one';
  }
}

/**
 * Test if the OSLC server supports JSON-LD content negotiation.
 */
async function testJsonLdSupport(
  client: OSLCClient,
  catalogURL: string
): Promise<boolean> {
  try {
    await client.getResource(catalogURL, '3.0', 'application/ld+json');
    return true;
  } catch {
    return false;
  }
}

/**
 * Parse a resource shape document into a DiscoveredShape.
 */
function parseShape(shapeResource: OSLCResource, overrideURI?: string): DiscoveredShape {
  const store = shapeResource.store;
  const shapeURI = overrideURI ?? shapeResource.getURI();
  const shapeSym = store.sym(shapeURI);

  const title =
    store.anyValue(shapeSym, dctermsNS('title')) ?? '';
  const description =
    store.anyValue(shapeSym, dctermsNS('description')) ?? '';

  const propertyNodes = store.each(shapeSym, oslcNS('property'), null);
  const properties: ShapeProperty[] = [];

  for (const propNode of propertyNodes) {
    const pn = propNode as NamedNode;
    const name = store.anyValue(pn, oslcNS('name')) ?? '';
    if (!name) continue;

    const propertyDefinition =
      store.any(pn, oslcNS('propertyDefinition'))?.value ?? '';
    const descriptionVal =
      store.anyValue(pn, dctermsNS('description')) ?? '';
    const valueTypeNode = store.any(pn, oslcNS('valueType'));
    const valueType = valueTypeNode?.value ?? `${xsdNS('').value}string`;
    const occursNode = store.any(pn, oslcNS('occurs'));
    const occurs = occursNode ? normalizeOccurs(occursNode.value) : 'zero-or-one';
    const rangeNode = store.any(pn, oslcNS('range'));
    const range = rangeNode?.value ?? null;
    const readOnlyNode = store.any(pn, oslcNS('readOnly'));
    const readOnly = readOnlyNode?.value === 'true';

    // Collect allowed values
    const allowedValues: string[] = [];
    const allowedValueNodes = store.each(pn, oslcNS('allowedValue'), null);
    for (const av of allowedValueNodes) {
      allowedValues.push(av.value);
    }
    const allowedValuesNode = store.any(pn, oslcNS('allowedValues'));
    if (allowedValuesNode) {
      const avMembers = store.each(allowedValuesNode as NamedNode, oslcNS('allowedValue'), null);
      for (const av of avMembers) {
        allowedValues.push(av.value);
      }
    }

    properties.push({
      name,
      predicateURI: propertyDefinition,
      description: descriptionVal,
      valueType,
      occurs,
      range,
      readOnly,
      allowedValues,
    });
  }

  return { shapeURI, title, description, properties };
}

/**
 * Discover all capabilities from an OSLC service provider catalog.
 */
export async function discover(
  client: OSLCClient,
  config: ServerConfig
): Promise<DiscoveryResult> {
  const catalogURL = config.catalogURL;

  // Test JSON-LD support
  const supportsJsonLd = await testJsonLdSupport(client, catalogURL);
  console.error(`[discovery] JSON-LD support: ${supportsJsonLd}`);

  // Fetch catalog
  console.error(`[discovery] Fetching catalog: ${catalogURL}`);
  const catalogResource = await client.getResource(catalogURL, '3.0');
  const catalogStore = catalogResource.store;
  const catalogSym = catalogStore.sym(catalogURL);

  // Find service providers
  const spNodes = catalogStore.each(
    catalogSym,
    oslcNS('serviceProvider'),
    null
  );

  const serviceProviders: DiscoveredServiceProvider[] = [];
  const shapes = new Map<string, DiscoveredShape>();

  for (const spNode of spNodes) {
    const spURI = spNode.value;
    console.error(`[discovery] Fetching service provider: ${spURI}`);

    let spResource: OSLCResource;
    try {
      spResource = await client.getResource(spURI, '3.0');
    } catch (err) {
      console.error(`[discovery] Failed to fetch SP ${spURI}:`, err);
      continue;
    }

    const spStore = spResource.store;
    const spSym = spStore.sym(spURI);
    const spTitle =
      spStore.anyValue(spSym, dctermsNS('title')) ?? spURI;

    // Collect services
    const serviceNodes = spStore.each(spSym, oslcNS('service'), null);

    const factories: DiscoveredFactory[] = [];
    const queries: DiscoveredQuery[] = [];

    for (const serviceNode of serviceNodes) {
      const sn = serviceNode as NamedNode;
      // Creation factories
      const factoryNodes = spStore.each(
        sn,
        oslcNS('creationFactory'),
        null
      );
      for (const factoryNode of factoryNodes) {
        const fn = factoryNode as NamedNode;
        const factoryTitle =
          spStore.anyValue(fn, dctermsNS('title')) ?? '';
        const creationNode = spStore.any(
          fn,
          oslcNS('creation'),
          null
        );
        const creationURI = creationNode?.value ?? '';
        const resourceTypeNode = spStore.any(
          fn,
          oslcNS('resourceType'),
          null
        );
        const resourceType = resourceTypeNode?.value ?? '';
        const shapeNode = spStore.any(
          fn,
          oslcNS('resourceShape'),
          null
        );

        let shape: DiscoveredShape | null = null;
        if (shapeNode) {
          const shapeURI = shapeNode.value;
          if (shapes.has(shapeURI)) {
            shape = shapes.get(shapeURI)!;
          } else {
            try {
              // Fetch the shape document (the shape URI may be a fragment)
              const shapeDocURI = shapeURI.split('#')[0];
              console.error(`[discovery] Fetching shape: ${shapeDocURI}`);
              const shapeResource = await client.getResource(shapeDocURI, '3.0');
              // If the shape URI has a fragment, parse using the fragment URI directly
              // rather than relying on OSLCResource.getURI() which returns the document URI
              shape = parseShape(shapeResource, shapeURI !== shapeDocURI ? shapeURI : undefined);
              shapes.set(shapeURI, shape);
            } catch (err) {
              console.error(
                `[discovery] Failed to fetch shape ${shapeURI}:`,
                err
              );
            }
          }
        }

        if (creationURI) {
          factories.push({
            title: factoryTitle,
            creationURI,
            resourceType,
            shape,
          });
        }
      }

      // Query capabilities
      const queryNodes = spStore.each(
        sn,
        oslcNS('queryCapability'),
        null
      );
      for (const queryNode of queryNodes) {
        const qn = queryNode as NamedNode;
        const queryTitle =
          spStore.anyValue(qn, dctermsNS('title')) ?? '';
        const queryBaseNode = spStore.any(
          qn,
          oslcNS('queryBase'),
          null
        );
        const queryBase = queryBaseNode?.value ?? '';
        const resourceTypeNode = spStore.any(
          qn,
          oslcNS('resourceType'),
          null
        );
        const resourceType = resourceTypeNode?.value ?? '';

        if (queryBase) {
          queries.push({ title: queryTitle, queryBase, resourceType });
        }
      }
    }

    serviceProviders.push({
      title: spTitle,
      uri: spURI,
      factories,
      queries,
    });
  }

  // Build readable content for MCP resources
  const catalogContent = formatCatalogContent(serviceProviders);
  const shapesContent = formatShapesContent(shapes);
  const vocabularyContent = formatVocabularyContent(serviceProviders, shapes);

  console.error(
    `[discovery] Complete: ${serviceProviders.length} providers, ` +
    `${serviceProviders.reduce((n, sp) => n + sp.factories.length, 0)} factories, ` +
    `${shapes.size} shapes`
  );

  return {
    catalogURI: catalogURL,
    supportsJsonLd,
    serviceProviders,
    shapes,
    vocabularyContent,
    catalogContent,
    shapesContent,
  };
}

/**
 * Format catalog content as human-readable text for MCP resource.
 */
function formatCatalogContent(
  providers: DiscoveredServiceProvider[]
): string {
  const lines: string[] = ['# OSLC Service Provider Catalog\n'];

  for (const sp of providers) {
    lines.push(`## ${sp.title}`);
    lines.push(`URI: ${sp.uri}\n`);

    if (sp.factories.length > 0) {
      lines.push('### Creation Factories');
      for (const f of sp.factories) {
        lines.push(`- **${f.title}**`);
        lines.push(`  - Creation URL: ${f.creationURI}`);
        lines.push(`  - Resource Type: ${f.resourceType}`);
        if (f.shape) {
          lines.push(`  - Shape: ${f.shape.shapeURI}`);
        }
      }
      lines.push('');
    }

    if (sp.queries.length > 0) {
      lines.push('### Query Capabilities');
      for (const q of sp.queries) {
        lines.push(`- **${q.title}**`);
        lines.push(`  - Query Base: ${q.queryBase}`);
        lines.push(`  - Resource Type: ${q.resourceType}`);
      }
      lines.push('');
    }
  }

  return lines.join('\n');
}

/**
 * Format shapes content as human-readable text for MCP resource.
 */
function formatShapesContent(shapes: Map<string, DiscoveredShape>): string {
  const lines: string[] = ['# OSLC Resource Shapes\n'];

  for (const [uri, shape] of shapes) {
    lines.push(`## ${shape.title || uri}`);
    if (shape.description) {
      lines.push(shape.description);
    }
    lines.push(`URI: ${uri}\n`);

    lines.push('| Property | Type | Required | Description |');
    lines.push('|----------|------|----------|-------------|');
    for (const prop of shape.properties) {
      const required =
        prop.occurs === 'exactly-one' || prop.occurs === 'one-or-more';
      const typeLabel = prop.valueType.split(/[#/]/).pop() ?? prop.valueType;
      const multi =
        prop.occurs === 'zero-or-many' || prop.occurs === 'one-or-more';
      const typeStr = multi ? `${typeLabel}[]` : typeLabel;
      const ro = prop.readOnly ? ' (read-only)' : '';
      lines.push(
        `| ${prop.name} | ${typeStr} | ${required ? 'Yes' : 'No'} | ${prop.description}${ro} |`
      );
    }
    lines.push('');
  }

  return lines.join('\n');
}

/**
 * Format vocabulary content as human-readable text for MCP resource.
 * Extracts resource types and their relationships from the discovered data.
 */
function formatVocabularyContent(
  providers: DiscoveredServiceProvider[],
  shapes: Map<string, DiscoveredShape>
): string {
  const lines: string[] = ['# OSLC Vocabulary\n'];
  lines.push('## Resource Types\n');

  const seenTypes = new Set<string>();
  for (const sp of providers) {
    for (const f of sp.factories) {
      if (f.resourceType && !seenTypes.has(f.resourceType)) {
        seenTypes.add(f.resourceType);
        const typeName = f.resourceType.split(/[#/]/).pop() ?? f.resourceType;
        lines.push(`### ${typeName}`);
        lines.push(`URI: ${f.resourceType}`);
        lines.push(`Create via: ${f.title}\n`);

        if (f.shape) {
          const resourceProps = f.shape.properties.filter(
            (p) =>
              p.valueType === `${OSLC}Resource` ||
              p.valueType === `${OSLC}AnyResource`
          );
          if (resourceProps.length > 0) {
            lines.push('**Relationships:**');
            for (const rp of resourceProps) {
              const rangeLabel = rp.range
                ? rp.range.split(/[#/]/).pop()
                : 'any';
              lines.push(
                `- ${rp.name} → ${rangeLabel} (${rp.occurs})`
              );
            }
            lines.push('');
          }
        }
      }
    }
  }

  return lines.join('\n');
}
