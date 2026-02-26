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
  const title = resource.getTitle() ?? localName(uri);
  const properties: ResourceProperty[] = [];
  const links: ResourceLink[] = [];
  const resourceTypes: string[] = [];

  const allProps = resource.getProperties();
  const RDF_TYPE = 'http://www.w3.org/1999/02/22-rdf-syntax-ns#type';

  for (const [predicate, value] of Object.entries(allProps)) {
    const values = Array.isArray(value) ? value : [value];
    for (const v of values) {
      if (predicate === RDF_TYPE) {
        resourceTypes.push(v);
        continue;
      }
      // Heuristic: if value looks like a URI, treat as link
      if (v.startsWith('http://') || v.startsWith('https://') || v.startsWith('urn:')) {
        links.push({
          predicate,
          predicateLabel: localName(predicate),
          targetURI: v,
          targetTitle: localName(v),
        });
      } else {
        properties.push({
          predicate,
          predicateLabel: localName(predicate),
          value: v,
          isLink: false,
        });
      }
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
