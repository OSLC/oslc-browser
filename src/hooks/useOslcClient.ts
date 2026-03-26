import { useState, useCallback, useRef } from 'react';
import OSLCClient, { type OSLCResource } from 'oslc-client';
import {
  type ConnectionState,
  type LoadedResource,
  type ResourceProperty,
  type ResourceLink,
  localName,
} from '../models/types.js';
import { useShapeCache, isLinkValueType } from './useShapeCache';
import type { ParsedShape } from './useShapeCache';

export interface UseOslcClientReturn {
  connection: ConnectionState;
  setServerURL: (url: string) => void;
  setUsername: (user: string) => void;
  setPassword: (pass: string) => void;
  connect: () => Promise<LoadedResource | null>;
  fetchResource: (uri: string) => Promise<LoadedResource | null>;
  /** Fetch the raw OSLCResource (for diagram parsing and other advanced uses) */
  fetchRawResource: (uri: string) => Promise<OSLCResource | null>;
  /** Get the underlying OSLCClient instance (for diagram auto-generation) */
  getClient: () => OSLCClient | null;
}

interface RdfStatement {
  subject: { value: string; termType: string };
  predicate: { value: string };
  object: { value: string; termType: string };
}

const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';
const DCTERMS_TITLE = 'http://purl.org/dc/terms/title';
const LDP_CONTAINS = 'http://www.w3.org/ns/ldp#contains';
const OSLC_INSTANCE_SHAPE = 'http://open-services.net/ns/core#instanceShape';
const LDP_CONTAINER_TYPES = new Set([
  'http://www.w3.org/ns/ldp#Container',
  'http://www.w3.org/ns/ldp#BasicContainer',
  'http://www.w3.org/ns/ldp#DirectContainer',
  'http://www.w3.org/ns/ldp#IndirectContainer',
]);

/**
 * Extract a blank node's properties and links from the store.
 * Recursively handles nested blank nodes.
 */
function extractBlankNode(
  statements: RdfStatement[],
  blankNodeId: string,
  inlineResources: Record<string, LoadedResource>,
  visited: Set<string>
): LoadedResource {
  const bnUri = '_:' + blankNodeId;
  if (inlineResources[bnUri]) return inlineResources[bnUri];
  visited.add(blankNodeId);

  const properties: ResourceProperty[] = [];
  const links: ResourceLink[] = [];
  const resourceTypes: string[] = [];

  for (const st of statements) {
    if (st.subject.value !== blankNodeId) continue;
    const pred = st.predicate.value;
    const obj = st.object;

    if (pred === RDF_TYPE) {
      resourceTypes.push(obj.value);
    } else if (obj.termType === 'NamedNode') {
      links.push({
        predicate: pred,
        predicateLabel: localName(pred),
        targetURI: obj.value,
        targetTitle: localName(obj.value),
      });
    } else if (obj.termType === 'BlankNode' && !visited.has(obj.value)) {
      const childUri = '_:' + obj.value;
      links.push({
        predicate: pred,
        predicateLabel: localName(pred),
        targetURI: childUri,
        targetTitle: localName(pred),
      });
      extractBlankNode(statements, obj.value, inlineResources, visited);
    } else if (obj.termType === 'Literal') {
      properties.push({
        predicate: pred,
        predicateLabel: localName(pred),
        value: obj.value,
        isLink: false,
      });
    }
  }

  // Use first rdf:type local name or blank node ID as title
  const title = resourceTypes.length > 0
    ? localName(resourceTypes[0])
    : blankNodeId;

  const loaded: LoadedResource = {
    uri: bnUri, title, properties, links, resourceTypes, inlineResources,
  };
  inlineResources[bnUri] = loaded;
  return loaded;
}

/**
 * Detect whether the response is an OSLC query result container.
 *
 * Per OSLC Query 3.0 [query-11..14], query results are returned in an
 * LDP container with ldp:contains references to each result member.
 * We detect this by checking if the fetch URI is typed as any LDP
 * container type and has ldp:contains links.
 */
function tryParseQueryResult(
  statements: RdfStatement[],
  uri: string
): LoadedResource | null {
  // Strip query string to match the container subject (queryBase URI)
  const baseUri = uri.split('?')[0];

  // Check if the base URI is typed as ldp:DirectContainer
  let isContainer = false;
  const memberURIs: string[] = [];

  for (const st of statements) {
    if (st.subject.termType !== 'NamedNode') continue;
    if (st.subject.value !== baseUri) continue;

    if (st.predicate.value === RDF_TYPE && LDP_CONTAINER_TYPES.has(st.object.value)) {
      isContainer = true;
    }
    if (st.predicate.value === LDP_CONTAINS && st.object.termType === 'NamedNode') {
      memberURIs.push(st.object.value);
    }
  }

  if (!isContainer || memberURIs.length === 0) return null;

  // Build a LoadedResource for each member from its triples in the response
  const members: LoadedResource[] = [];
  for (const memberURI of memberURIs) {
    const memberProps: ResourceProperty[] = [];
    const memberLinks: ResourceLink[] = [];
    const memberTypes: string[] = [];
    let title = localName(memberURI);

    for (const st of statements) {
      if (st.subject.value !== memberURI) continue;
      const pred = st.predicate.value;
      const obj = st.object;

      if (pred === RDF_TYPE) {
        memberTypes.push(obj.value);
      } else if (pred === DCTERMS_TITLE && obj.termType === 'Literal') {
        title = obj.value;
        memberProps.push({
          predicate: pred, predicateLabel: localName(pred),
          value: obj.value, isLink: false,
        });
      } else if (obj.termType === 'NamedNode') {
        memberLinks.push({
          predicate: pred, predicateLabel: localName(pred),
          targetURI: obj.value, targetTitle: localName(obj.value),
        });
      } else if (obj.termType === 'Literal') {
        memberProps.push({
          predicate: pred, predicateLabel: localName(pred),
          value: obj.value, isLink: false,
        });
      }
    }

    members.push({
      uri: memberURI, title,
      properties: memberProps, links: memberLinks,
      resourceTypes: memberTypes,
    });
  }

  // Sort members by title for consistent display
  members.sort((a, b) => a.title.localeCompare(b.title));

  return {
    uri,
    title: `Query Results (${members.length} resources)`,
    properties: [],
    links: [],
    resourceTypes: [],
    isQueryResult: true,
    members,
  };
}

/**
 * Classify a NamedNode value as either a link or a property, using the
 * resource shape when available.  Returns 'link' | 'property'.
 */
function classifyNamedNode(
  pred: string,
  shape: ParsedShape | null | undefined
): 'link' | 'property' {
  if (!shape) return 'link'; // No shape → legacy behaviour: treat as link
  const valueType = shape.predicateValueTypes.get(pred);
  if (valueType === undefined) return 'link'; // Predicate not in shape → assume link
  return isLinkValueType(valueType) ? 'link' : 'property';
}

/**
 * Extract the oslc:instanceShape URI from the resource's statements.
 * Returns undefined when no shape reference is present.
 */
function findInstanceShapeURI(statements: RdfStatement[]): string | undefined {
  for (const st of statements) {
    if (st.subject.termType === 'BlankNode') continue;
    if (st.predicate.value === OSLC_INSTANCE_SHAPE && st.object.termType === 'NamedNode') {
      return st.object.value;
    }
  }
  return undefined;
}

async function parseOslcResource(
  resource: OSLCResource,
  uri: string,
  shapeLookup?: (shapeURI: string) => Promise<ParsedShape | null>
): Promise<LoadedResource> {
  const properties: ResourceProperty[] = [];
  const resourceTypes: string[] = [];
  const inlineResources: Record<string, LoadedResource> = {};

  // Check for OSLC query results (multiple subjects, fetch URI not among them)
  if (resource.store?.statements?.length > 0) {
    const queryResult = tryParseQueryResult(
      resource.store.statements as RdfStatement[], uri
    );
    if (queryResult) return queryResult;
  }

  // Resolve the resource shape if present
  let shape: ParsedShape | null | undefined;
  if (resource.store?.statements?.length > 0) {
    const instanceShapeURI = findInstanceShapeURI(
      resource.store.statements as RdfStatement[]
    );
    if (instanceShapeURI && shapeLookup) {
      try {
        shape = await shapeLookup(instanceShapeURI);
      } catch {
        shape = null; // Fetch failed — fall back to link-for-all
      }
    }
  }

  // The resource.uri may not match the store subjects (e.g., trailing slash mismatch).
  // If getOutgoingLinks() is empty but the store has statements, read directly from the store.
  let outgoing = resource.getOutgoingLinks();

  if (outgoing.length === 0 && resource.store?.statements?.length > 0) {
    // Build links and properties directly from the store statements
    const statements = resource.store.statements as RdfStatement[];
    const links: ResourceLink[] = [];
    let extractedTitle: string | undefined;

    for (const st of statements) {
      // Skip statements about blank node subjects (handled by extractBlankNode)
      if (st.subject.termType === 'BlankNode') continue;

      const pred = st.predicate.value;
      const obj = st.object;

      if (pred === RDF_TYPE) {
        resourceTypes.push(obj.value);
      } else if (pred === OSLC_INSTANCE_SHAPE) {
        // Filter out instanceShape — already consumed above
        continue;
      } else if (pred === DCTERMS_TITLE && obj.termType === 'Literal') {
        extractedTitle = obj.value;
        properties.push({
          predicate: pred,
          predicateLabel: localName(pred),
          value: obj.value,
          isLink: false,
        });
      } else if (obj.termType === 'NamedNode') {
        if (classifyNamedNode(pred, shape) === 'link') {
          links.push({
            predicate: pred,
            predicateLabel: localName(pred),
            targetURI: obj.value,
            targetTitle: localName(obj.value),
          });
        } else {
          properties.push({
            predicate: pred,
            predicateLabel: localName(pred),
            value: localName(obj.value),
            isLink: false,
          });
        }
      } else if (obj.termType === 'BlankNode') {
        const bnUri = '_:' + obj.value;
        const bnResource = extractBlankNode(
          statements, obj.value, inlineResources, new Set()
        );
        links.push({
          predicate: pred,
          predicateLabel: localName(pred),
          targetURI: bnUri,
          targetTitle: bnResource.title,
        });
      } else {
        properties.push({
          predicate: pred,
          predicateLabel: localName(pred),
          value: obj.value,
          isLink: false,
        });
      }
    }

    const title = extractedTitle ?? resource.getTitle() ?? localName(uri);
    return { uri, title, properties, links, resourceTypes, inlineResources };
  }

  // Normal path: getOutgoingLinks() found results
  const title = resource.getTitle() ?? localName(uri);
  const linkSet = new Set<string>();
  const links: ResourceLink[] = [];
  for (const link of outgoing) {
    if (link.linkType === RDF_TYPE) {
      resourceTypes.push(link.targetURL);
      continue;
    }
    // Filter out instanceShape from links
    if (link.linkType === OSLC_INSTANCE_SHAPE) continue;

    if (classifyNamedNode(link.linkType, shape) === 'link') {
      links.push({
        predicate: link.linkType,
        predicateLabel: localName(link.linkType),
        targetURI: link.targetURL,
        targetTitle: localName(link.targetURL),
      });
    } else {
      properties.push({
        predicate: link.linkType,
        predicateLabel: localName(link.linkType),
        value: localName(link.targetURL),
        isLink: false,
      });
    }
    linkSet.add(link.linkType + '|' + link.targetURL);
  }

  // Check for blank node objects in the store (getOutgoingLinks skips them)
  if (resource.store?.statements?.length > 0) {
    const statements = resource.store.statements as RdfStatement[];
    for (const st of statements) {
      if (st.subject.termType === 'BlankNode') continue;
      if (st.predicate.value === RDF_TYPE) continue;
      if (st.predicate.value === OSLC_INSTANCE_SHAPE) continue;
      if (st.object.termType === 'BlankNode') {
        const bnUri = '_:' + st.object.value;
        const bnResource = extractBlankNode(
          statements, st.object.value, inlineResources, new Set()
        );
        const key = st.predicate.value + '|' + bnUri;
        if (!linkSet.has(key)) {
          links.push({
            predicate: st.predicate.value,
            predicateLabel: localName(st.predicate.value),
            targetURI: bnUri,
            targetTitle: bnResource.title,
          });
          linkSet.add(key);
        }
      }
    }
  }

  const allProps = resource.getProperties();
  for (const [predicate, value] of Object.entries(allProps)) {
    if (predicate === RDF_TYPE) continue;
    if (predicate === OSLC_INSTANCE_SHAPE) continue;
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (linkSet.has(predicate + '|' + v)) continue;
      properties.push({
        predicate,
        predicateLabel: localName(predicate),
        value: v,
        isLink: false,
      });
    }
  }

  return { uri, title, properties, links, resourceTypes, inlineResources };
}

const STORAGE_KEY = 'oslc-browser-connection';

function loadSavedConnection(): Partial<ConnectionState> {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch { /* ignore */ }
  return {};
}

function saveConnection(state: ConnectionState): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({
      serverURL: state.serverURL,
      username: state.username,
    }));
  } catch { /* ignore */ }
}

/** Cache of resolved resource titles (URI → title string). */
const titleCache = new Map<string, string>();

/**
 * Resolve human-readable titles for link targets.
 *
 * Fallback chain per link target:
 * 1. Title cache (already resolved)
 * 2. Compact representation (GET /compact?uri=... Accept: text/turtle → oslc:shortTitle or dcterms:title)
 * 3. GET the resource directly → dcterms:title
 * 4. localName(uri) — last URI path segment
 *
 * Mutates the links array in place for efficiency.
 */
async function resolveLinkTitles(
  links: ResourceLink[],
  client: OSLCClient,
  serverURL: string
): Promise<void> {
  // Collect unique URIs that need resolution (skip blank nodes and already-cached)
  const toResolve = new Map<string, ResourceLink[]>();
  for (const link of links) {
    if (link.targetURI.startsWith('_:')) continue;
    if (titleCache.has(link.targetURI)) {
      link.targetTitle = titleCache.get(link.targetURI);
      continue;
    }
    if (!toResolve.has(link.targetURI)) {
      toResolve.set(link.targetURI, []);
    }
    toResolve.get(link.targetURI)!.push(link);
  }

  if (toResolve.size === 0) return;

  const serverOrigin = serverURL ? new URL(serverURL).origin : '';

  // Resolve titles in parallel (with concurrency limit to avoid flooding)
  const entries = [...toResolve.entries()];
  const batchSize = 10;
  for (let i = 0; i < entries.length; i += batchSize) {
    const batch = entries.slice(i, i + batchSize);
    await Promise.all(batch.map(async ([uri, linkRefs]) => {
      let title: string | undefined;

      // Try compact representation first
      if (serverOrigin) {
        try {
          const compactURL = `${serverOrigin}/compact?uri=${encodeURIComponent(uri)}`;
          const compactResource = await client.getResource(compactURL, '3.0', 'text/turtle');
          title = compactResource.getTitle();
        } catch { /* compact not available, fall through */ }
      }

      // Fall back to GET the resource and extract dcterms:title
      if (!title) {
        try {
          let fetchURI = uri;
          if (serverOrigin && !uri.startsWith(serverOrigin)) {
            fetchURI = `${serverOrigin}/resource?uri=${encodeURIComponent(uri)}`;
          }
          const resource = await client.getResource(fetchURI, '3.0', 'text/turtle');
          title = resource.getTitle();
        } catch { /* resource not fetchable, fall through */ }
      }

      // Final fallback
      if (!title) {
        title = localName(uri);
      }

      // Cache and apply to all links targeting this URI
      titleCache.set(uri, title);
      for (const ref of linkRefs) {
        ref.targetTitle = title;
      }
    }));
  }
}

export function useOslcClient(): UseOslcClientReturn {
  const [connection, setConnection] = useState<ConnectionState>(() => {
    const saved = loadSavedConnection();
    return {
      serverURL: saved.serverURL ?? '',
      username: saved.username ?? '',
      password: '',
      connected: false,
      connecting: false,
    };
  });
  const clientRef = useRef<OSLCClient | null>(null);
  const { getShape } = useShapeCache();

  /** Fetch a shape using the current OSLCClient */
  const shapeLookup = useCallback(async (shapeURI: string): Promise<ParsedShape | null> => {
    const client = clientRef.current;
    if (!client) return null;
    const fetchFn = async (uri: string) => client.getResource(uri, '3.0', 'text/turtle');
    return getShape(shapeURI, fetchFn);
  }, [getShape]);

  const setServerURL = useCallback((url: string) => {
    setConnection(prev => ({ ...prev, serverURL: url }));
  }, []);

  const setUsername = useCallback((user: string) => {
    setConnection(prev => ({ ...prev, username: user }));
  }, []);

  const setPassword = useCallback((pass: string) => {
    setConnection(prev => ({ ...prev, password: pass }));
  }, []);

  const fetchResource = useCallback(async (uri: string): Promise<LoadedResource | null> => {
    const client = clientRef.current;
    if (!client) return null;

    try {
      // For URIs outside the server's origin, use the /resource?uri= lookup endpoint
      let fetchURI = uri;
      const serverURL = connection.serverURL;
      if (serverURL) {
        const serverOrigin = new URL(serverURL).origin;
        if (!uri.startsWith(serverOrigin)) {
          fetchURI = `${serverOrigin}/resource?uri=${encodeURIComponent(uri)}`;
        }
      }

      const resource = await client.getResource(fetchURI);
      const loaded = await parseOslcResource(resource, uri, shapeLookup);

      // Resolve human-readable titles for link targets
      await resolveLinkTitles(loaded.links, client, connection.serverURL);

      return loaded;
    } catch (err) {
      console.error('Error fetching resource:', uri, err);
      return null;
    }
  }, [connection.serverURL, shapeLookup]);

  const connect = useCallback(async (): Promise<LoadedResource | null> => {
    setConnection(prev => ({ ...prev, connecting: true, error: undefined }));

    try {
      const client = new OSLCClient(connection.username, connection.password);
      clientRef.current = client;

      // Fetch the resource at the entered URL
      const resource = await client.getResource(connection.serverURL);
      const loaded = await parseOslcResource(resource, connection.serverURL, shapeLookup);

      setConnection(prev => {
        const next = { ...prev, connected: true, connecting: false, error: undefined };
        saveConnection(next);
        return next;
      });
      return loaded;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Connection failed';
      setConnection(prev => ({
        ...prev,
        connected: false,
        connecting: false,
        error: message,
      }));
      clientRef.current = null;
      return null;
    }
  }, [connection.serverURL, connection.username, connection.password, shapeLookup]);

  const fetchRawResource = useCallback(async (uri: string): Promise<OSLCResource | null> => {
    const client = clientRef.current;
    if (!client) return null;

    try {
      let fetchURI = uri;
      const serverURL = connection.serverURL;
      if (serverURL) {
        const serverOrigin = new URL(serverURL).origin;
        if (!uri.startsWith(serverOrigin)) {
          fetchURI = `${serverOrigin}/resource?uri=${encodeURIComponent(uri)}`;
        }
      }

      return await client.getResource(fetchURI);
    } catch (err) {
      console.error('Error fetching raw resource:', uri, err);
      return null;
    }
  }, [connection.serverURL]);

  const getClient = useCallback((): OSLCClient | null => {
    return clientRef.current;
  }, []);

  return { connection, setServerURL, setUsername, setPassword, connect, fetchResource, fetchRawResource, getClient };
}
