import { useState, useCallback, useRef } from 'react';
import OSLCClient, { type OSLCResource } from 'oslc-client';
import {
  type ConnectionState,
  type LoadedResource,
  type ResourceProperty,
  type ResourceLink,
  localName,
} from '../models/types.js';

export interface UseOslcClientReturn {
  connection: ConnectionState;
  setServerURL: (url: string) => void;
  setUsername: (user: string) => void;
  setPassword: (pass: string) => void;
  connect: () => Promise<LoadedResource | null>;
  fetchResource: (uri: string) => Promise<LoadedResource | null>;
}

function parseOslcResource(resource: OSLCResource, uri: string): LoadedResource {
  const properties: ResourceProperty[] = [];
  const resourceTypes: string[] = [];
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  // The resource.uri may not match the store subjects (e.g., trailing slash mismatch).
  // If getOutgoingLinks() is empty but the store has statements, read directly from the store.
  let outgoing = resource.getOutgoingLinks();

  if (outgoing.length === 0 && resource.store?.statements?.length > 0) {
    // Build links and properties directly from the store statements
    const statements = resource.store.statements as Array<{
      subject: { value: string };
      predicate: { value: string };
      object: { value: string; termType: string };
    }>;

    for (const st of statements) {
      const pred = st.predicate.value;
      const obj = st.object;

      if (pred === RDF_TYPE) {
        resourceTypes.push(obj.value);
      } else if (obj.termType === 'NamedNode') {
        outgoing.push({
          sourceURL: st.subject.value,
          linkType: pred,
          targetURL: obj.value,
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

    const title = resource.getTitle() ?? localName(uri);
    const links: ResourceLink[] = outgoing
      .filter(link => link.linkType !== RDF_TYPE)
      .map(link => ({
        predicate: link.linkType,
        predicateLabel: localName(link.linkType),
        targetURI: link.targetURL,
        targetTitle: localName(link.targetURL),
      }));

    return { uri, title, properties, links, resourceTypes };
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
    links.push({
      predicate: link.linkType,
      predicateLabel: localName(link.linkType),
      targetURI: link.targetURL,
      targetTitle: localName(link.targetURL),
    });
    linkSet.add(link.linkType + '|' + link.targetURL);
  }

  const allProps = resource.getProperties();
  for (const [predicate, value] of Object.entries(allProps)) {
    if (predicate === RDF_TYPE) continue;
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

  return { uri, title, properties, links, resourceTypes };
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
      const resource = await client.getResource(uri);
      return parseOslcResource(resource, uri);
    } catch (err) {
      console.error('Error fetching resource:', uri, err);
      return null;
    }
  }, []);

  const connect = useCallback(async (): Promise<LoadedResource | null> => {
    setConnection(prev => ({ ...prev, connecting: true, error: undefined }));

    try {
      const client = new OSLCClient(connection.username, connection.password);
      clientRef.current = client;

      // Fetch the resource at the entered URL
      const resource = await client.getResource(connection.serverURL);
      const loaded = parseOslcResource(resource, connection.serverURL);

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
  }, [connection.serverURL, connection.username, connection.password]);

  return { connection, setServerURL, setUsername, setPassword, connect, fetchResource };
}
