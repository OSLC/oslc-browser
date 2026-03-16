import { OSLCClient } from 'oslc-client';
import { Namespace, lit, type IndexedFormula, type NamedNode } from 'rdflib';
import type { DiscoveryResult } from '../types.js';

const rdfNS = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');

/**
 * Convert an OSLCResource's properties to a plain JSON object for tool output.
 */
function resourceToJson(store: IndexedFormula, uri: string): Record<string, any> {
  const subject = store.sym(uri);
  const statements = store.statementsMatching(subject, null, null);
  const result: Record<string, any> = { uri };

  const grouped: Record<string, any[]> = {};
  for (const st of statements) {
    const predicate = st.predicate.value;
    const key = predicate.split(/[#/]/).pop() ?? predicate;
    const value = st.object.termType === 'NamedNode'
      ? { uri: st.object.value }
      : st.object.value;

    if (!grouped[key]) {
      grouped[key] = [];
    }
    grouped[key].push(value);
  }

  for (const [key, values] of Object.entries(grouped)) {
    result[key] = values.length === 1 ? values[0] : values;
  }

  return result;
}

/**
 * Handler for get_resource tool.
 */
export async function handleGetResource(
  client: OSLCClient,
  args: { uri: string }
): Promise<string> {
  const resource = await client.getResource(args.uri, '3.0');
  const json = resourceToJson(resource.store, resource.getURI());
  return JSON.stringify(json, null, 2);
}

/**
 * Handler for update_resource tool.
 */
export async function handleUpdateResource(
  client: OSLCClient,
  discovery: DiscoveryResult,
  args: { uri: string; properties: Record<string, any> }
): Promise<string> {
  // GET current resource with ETag
  const resource = await client.getResource(args.uri, '3.0');
  const store = resource.store;
  const subject = store.sym(args.uri);

  // Find the shape for this resource to map property names to predicate URIs
  const predicateMap = buildPredicateMapForResource(store, args.uri, discovery);

  // Apply property changes
  for (const [name, value] of Object.entries(args.properties)) {
    const predicateURI = predicateMap.get(name);
    if (!predicateURI) {
      console.error(`[update] Unknown property: ${name}, using as-is`);
      continue;
    }

    const predicate = store.sym(predicateURI);

    // Remove existing values for this predicate
    const existing = store.statementsMatching(subject, predicate, null);
    for (const st of existing) {
      store.remove(st);
    }

    // Add new values
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) {
        store.add(subject, predicate, store.sym(v));
      } else {
        store.add(subject, predicate, lit(String(v)));
      }
    }
  }

  // PUT with ETag
  const updated = await client.putResource(resource, resource.etag, '3.0');
  const json = resourceToJson(updated.store, updated.getURI());
  return JSON.stringify(json, null, 2);
}

/**
 * Handler for delete_resource tool.
 */
export async function handleDeleteResource(
  client: OSLCClient,
  args: { uri: string }
): Promise<string> {
  const resource = await client.getResource(args.uri, '3.0');
  await client.deleteResource(resource, '3.0');
  return JSON.stringify({ deleted: true, uri: args.uri });
}

/**
 * Handler for list_resource_types tool.
 */
export function handleListResourceTypes(
  discovery: DiscoveryResult
): string {
  const types: any[] = [];

  for (const sp of discovery.serviceProviders) {
    for (const factory of sp.factories) {
      const matchingQuery = sp.queries.find(
        (q) => q.resourceType === factory.resourceType
      );

      types.push({
        name: factory.title,
        resourceType: factory.resourceType,
        creationFactory: factory.creationURI,
        queryCapability: matchingQuery?.queryBase ?? null,
        serviceProvider: sp.title,
        properties: factory.shape
          ? factory.shape.properties
              .filter((p) => !p.readOnly)
              .map((p) => ({
                name: p.name,
                type: p.valueType.split(/[#/]/).pop(),
                required:
                  p.occurs === 'exactly-one' || p.occurs === 'one-or-more',
              }))
          : [],
      });
    }
  }

  return JSON.stringify(types, null, 2);
}

/**
 * Handler for query_resources tool.
 */
export async function handleQueryResources(
  client: OSLCClient,
  args: { queryBase: string; filter?: string; select?: string; orderBy?: string }
): Promise<string> {
  let url = args.queryBase;
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

  // Extract member resources from the query result
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
    const baseSym = store.sym(args.queryBase);
    memberNodes = store.each(baseSym, ldpContains, null);
    if (memberNodes.length === 0) {
      memberNodes = store.each(baseSym, rdfsMember, null);
    }
  }

  const results = memberNodes.map((node) =>
    resourceToJson(store, node.value)
  );

  return JSON.stringify(results, null, 2);
}

/**
 * Build a property-name-to-predicate-URI map for a specific resource,
 * by finding its rdf:type and matching it to a discovered shape.
 */
function buildPredicateMapForResource(
  store: IndexedFormula,
  uri: string,
  discovery: DiscoveryResult
): Map<string, string> {
  const subject = store.sym(uri);
  const typeNodes = store.each(subject, rdfNS('type'), null);
  const typeURIs = typeNodes.map((n) => n.value);

  // Try to find a shape that matches one of the resource's types
  for (const sp of discovery.serviceProviders) {
    for (const factory of sp.factories) {
      if (typeURIs.includes(factory.resourceType) && factory.shape) {
        const map = new Map<string, string>();
        for (const prop of factory.shape.properties) {
          map.set(prop.name, prop.predicateURI);
        }
        return map;
      }
    }
  }

  // Fallback: return empty map
  return new Map();
}
