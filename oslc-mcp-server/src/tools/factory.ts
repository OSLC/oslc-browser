import { OSLCClient } from 'oslc-client';
import { graph, sym, lit, serialize, Namespace } from 'rdflib';
import type { DiscoveryResult, DiscoveredFactory, DiscoveredQuery } from '../types.js';
import { shapeToJsonSchema, buildPredicateMap } from '../schema.js';

const rdfNS = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

/**
 * A generated MCP tool definition.
 */
export interface GeneratedTool {
  name: string;
  description: string;
  inputSchema: any;
  handler: (args: any) => Promise<string>;
}

/**
 * Sanitize a title into a valid tool name component.
 * Lowercases, replaces spaces/hyphens with underscores, removes other non-alphanumeric chars.
 */
function sanitizeName(title: string): string {
  return title
    .toLowerCase()
    .replace(/[\s-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '');
}

/**
 * Generate per-type create and query tools from discovery results.
 */
export function generateTools(
  client: OSLCClient,
  discovery: DiscoveryResult
): GeneratedTool[] {
  const tools: GeneratedTool[] = [];
  const usedNames = new Set<string>();

  for (const sp of discovery.serviceProviders) {
    // Generate create tools from factories
    for (const factory of sp.factories) {
      const baseName = sanitizeName(factory.title);
      let createName = `create_${baseName}`;

      // Disambiguate if name collision
      if (usedNames.has(createName)) {
        let counter = 2;
        while (usedNames.has(`${createName}_${counter}`)) counter++;
        createName = `${createName}_${counter}`;
      }
      usedNames.add(createName);

      if (factory.shape) {
        const inputSchema = shapeToJsonSchema(factory.shape, true);
        const predicateMap = buildPredicateMap(factory.shape);

        tools.push({
          name: createName,
          description: `Create a new ${factory.title} resource. ${factory.shape.description ?? ''}`.trim(),
          inputSchema,
          handler: createCreateHandler(
            client,
            factory,
            predicateMap,
            discovery.supportsJsonLd
          ),
        });
      }

      // Generate query tool for matching query capability
      const matchingQuery = sp.queries.find(
        (q) => q.resourceType === factory.resourceType
      );
      if (matchingQuery) {
        const queryName = `query_${baseName}`;
        if (!usedNames.has(queryName)) {
          usedNames.add(queryName);
          tools.push({
            name: queryName,
            description: `Query ${factory.title} resources.`,
            inputSchema: {
              type: 'object',
              properties: {
                filter: {
                  type: 'string',
                  description:
                    'OSLC query filter (oslc.where). Example: dcterms:title="My Resource"',
                },
                select: {
                  type: 'string',
                  description:
                    'Property projection (oslc.select). Example: dcterms:title,dcterms:description',
                },
                orderBy: {
                  type: 'string',
                  description: 'Sort order (oslc.orderBy).',
                },
              },
              required: [],
            },
            handler: createQueryHandler(client, matchingQuery),
          });
        }
      }
    }
  }

  return tools;
}

/**
 * Create a handler function for a create_<type> tool.
 */
function createCreateHandler(
  client: OSLCClient,
  factory: DiscoveredFactory,
  predicateMap: Map<string, string>,
  _supportsJsonLd: boolean
): (args: Record<string, any>) => Promise<string> {
  return async (args: Record<string, any>): Promise<string> => {
    // Build RDF graph from the provided properties
    const store = graph();
    // Use a blank node as subject — the server assigns the URI
    const subject = sym('urn:new-resource');

    // Set rdf:type
    if (factory.resourceType) {
      store.add(subject, rdfNS('type'), sym(factory.resourceType));
    }

    // Add properties
    for (const [name, value] of Object.entries(args)) {
      const predicateURI = predicateMap.get(name);
      if (!predicateURI) {
        console.error(`[create] Unknown property: ${name}, skipping`);
        continue;
      }
      const predicate = sym(predicateURI);

      const values = Array.isArray(value) ? value : [value];
      for (const v of values) {
        if (
          typeof v === 'string' &&
          (v.startsWith('http://') || v.startsWith('https://'))
        ) {
          store.add(subject, predicate, sym(v));
        } else {
          store.add(subject, predicate, lit(String(v)));
        }
      }
    }

    // Serialize all statements to Turtle
    const turtle = serialize(null, store, undefined, 'text/turtle') ?? '';

    // POST to creation factory
    const response = await (client as any).client.post(factory.creationURI, turtle, {
      headers: {
        'Content-Type': 'text/turtle',
        'Accept': 'text/turtle',
        'OSLC-Core-Version': '3.0',
      },
    });

    const locationHeader =
      response.headers?.['location'] ?? response.headers?.['Location'] ?? '';

    // If we got a Location header, fetch the created resource
    if (locationHeader) {
      try {
        const created = await client.getResource(locationHeader, '3.0');
        const resultStore = created.store;
        const resultSubject = resultStore.sym(created.getURI());
        const statements = resultStore.statementsMatching(resultSubject, null, null);
        const result: Record<string, any> = { uri: created.getURI() };

        for (const st of statements) {
          const key = st.predicate.value.split(/[#/]/).pop() ?? st.predicate.value;
          result[key] = st.object.value;
        }

        return JSON.stringify(result, null, 2);
      } catch {
        return JSON.stringify({ uri: locationHeader, created: true });
      }
    }

    return JSON.stringify({ created: true, status: response.status });
  };
}

/**
 * Create a handler function for a query_<type> tool.
 */
function createQueryHandler(
  client: OSLCClient,
  queryCapability: DiscoveredQuery
): (args: any) => Promise<string> {
  return async (args: {
    filter?: string;
    select?: string;
    orderBy?: string;
  }): Promise<string> => {
    let url = queryCapability.queryBase;
    const params = new URLSearchParams();
    if (args.filter) params.set('oslc.where', args.filter);
    if (args.select) params.set('oslc.select', args.select);
    if (args.orderBy) params.set('oslc.orderBy', args.orderBy);

    const queryString = params.toString();
    if (queryString) {
      url += (url.includes('?') ? '&' : '?') + queryString;
    }

    const resource = await client.getResource(url, '3.0');
    const store = resource.store;

    const ldpContains = Namespace('http://www.w3.org/ns/ldp#')('contains');
    const rdfsMember = Namespace('http://www.w3.org/2000/01/rdf-schema#')('member');
    // Use the actual fetched URL as the container subject (includes query params)
    const containerSym = store.sym(url);

    let memberNodes = store.each(containerSym, ldpContains, null);
    if (memberNodes.length === 0) {
      memberNodes = store.each(containerSym, rdfsMember, null);
    }
    // Fallback: try with base URL (some servers use it as container subject)
    if (memberNodes.length === 0) {
      const baseSym = store.sym(queryCapability.queryBase);
      memberNodes = store.each(baseSym, ldpContains, null);
      if (memberNodes.length === 0) {
        memberNodes = store.each(baseSym, rdfsMember, null);
      }
    }

    const results = memberNodes.map((node: any) => {
      const memberSubject = store.sym(node.value);
      const statements = store.statementsMatching(memberSubject, null, null);
      const result: Record<string, any> = { uri: node.value };
      for (const st of statements) {
        const key = st.predicate.value.split(/[#/]/).pop() ?? st.predicate.value;
        result[key] = st.object.value;
      }
      return result;
    });

    return JSON.stringify(results, null, 2);
  };
}
