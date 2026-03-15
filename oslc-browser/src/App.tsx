import { useCallback, useEffect, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Divider, Menu, MenuItem } from '@mui/material';
import { Namespace, sym } from 'rdflib';
import { ToolbarComponent } from './components/Toolbar.js';
import { MainLayoutComponent } from './components/MainLayout.js';
import { useOslcClient } from './hooks/useOslcClient.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useFavorites } from './hooks/useFavorites.js';
import { traverseLinks, generateDiagramTurtle } from './hooks/diagramGenerator.js';
import { localName } from './models/diagram-types.js';
import type { ColumnItem } from './models/types.js';

const DD_DIAGRAM = 'http://www.omg.org/spec/DD#Diagram';
const ldp = Namespace('http://www.w3.org/ns/ldp#');
const rdfNS = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
const oslcNS = Namespace('http://open-services.net/ns/core#');
const dctermsNS = Namespace('http://purl.org/dc/terms/');

interface DiagramFactory {
  title: string;
  creationURI: string;
  shapeDescription: string;
}

const theme = createTheme({
  typography: {
    fontSize: 13,
  },
});

function App() {
  const { connection, setServerURL, setUsername, setPassword, connect, fetchResource, fetchRawResource, getClient } = useOslcClient();
  const { state: navState, navigateToRoot, navigateToItem } = useNavigation();
  const {
    favorites, addFolder, addResource, removeItem, rename, toggleFolder,
  } = useFavorites();

  // Context menu state
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; item: ColumnItem } | null>(null);

  // Diagram factories discovered from catalog
  const [diagramFactories, setDiagramFactories] = useState<DiagramFactory[]>([]);
  // Matching factories for the current context menu item
  const [matchingFactories, setMatchingFactories] = useState<DiagramFactory[]>([]);

  // Discover diagram factories after connecting
  useEffect(() => {
    if (!connection.connected) {
      setDiagramFactories([]);
      return;
    }

    const client = getClient();
    if (!client) return;

    // Discover diagram creation factories from all service providers.
    // Derive the catalog URL from the connected URL — the catalog is at
    // the /oslc path segment regardless of what specific resource the user
    // connected to (e.g., a query URL or a specific service provider).
    (async () => {
      try {
        const ddDiagramSym = sym(DD_DIAGRAM);

        // Derive catalog URL: {origin}/{first-path-segment}
        // e.g. http://localhost:3002/oslc/mrmv2-1/query?... → http://localhost:3002/oslc
        const connURL = new URL(connection.serverURL);
        const pathSegments = connURL.pathname.split('/').filter(Boolean);
        const catalogPath = pathSegments.length > 0 ? `/${pathSegments[0]}` : '/oslc';
        const catalogURL = `${connURL.origin}${catalogPath}`;

        // Step 1: Fetch catalog and find service provider URIs via ldp:contains
        console.log('[DiagramFactory] Fetching catalog:', catalogURL);
        const catalogResource = await client.getResource(catalogURL);
        if (!catalogResource?.store) {
          console.warn('[DiagramFactory] Catalog has no store');
          return;
        }
        const catalogStore = catalogResource.store;

        // Debug: dump all predicates in the catalog store
        const allCatalogStmts = catalogStore.statements ?? [];
        const predicates = new Set(allCatalogStmts.map((st: any) => st.predicate?.value));
        console.log('[DiagramFactory] Catalog predicates:', [...predicates]);
        console.log('[DiagramFactory] Catalog statements count:', allCatalogStmts.length);

        const catalogSym = catalogStore.sym(catalogURL);
        const spNodes = catalogStore.each(catalogSym, ldp('contains'), null);
        console.log('[DiagramFactory] ldp:contains nodes:', spNodes.length);
        const spURIs = spNodes.map((n: any) => n.value).filter(Boolean);

        // If no ldp:contains, also try oslc:serviceProvider
        if (spURIs.length === 0) {
          const spRefNodes = catalogStore.each(null, oslcNS('serviceProvider'), null);
          console.log('[DiagramFactory] oslc:serviceProvider nodes:', spRefNodes.length);
          for (const n of spRefNodes) {
            if (n.value) spURIs.push(n.value);
          }
        }

        console.log('[DiagramFactory] Service provider URIs:', spURIs);

        // Step 2: Fetch each service provider and extract diagram factories
        const factories: DiagramFactory[] = [];

        for (const spURI of spURIs) {
          let spResource;
          try {
            spResource = await client.getResource(spURI);
          } catch (e) {
            console.warn('[DiagramFactory] Failed to fetch SP:', spURI, e);
            continue;
          }
          if (!spResource?.store) {
            console.warn('[DiagramFactory] SP has no store:', spURI);
            continue;
          }
          const store = spResource.store;

          // Walk: ServiceProvider → oslc:service → oslc:creationFactory
          const spSym = store.sym(spURI);
          const services = store.each(spSym, oslcNS('service'), null);
          console.log('[DiagramFactory] SP', spURI, '→ services:', services.length);

          for (const service of services) {
            console.log('[DiagramFactory]   service node:', service.termType, service.value);
            // Debug: show all predicates from the service blank node
            const serviceStmts = store.statementsMatching(service, null, null);
            const servicePreds = serviceStmts.map((st: any) => st.predicate.value);
            console.log('[DiagramFactory]   service predicates:', servicePreds);
            const creationFactories = store.each(service, oslcNS('creationFactory'), null);
            console.log('[DiagramFactory]   service →', creationFactories.length, 'creation factories');

            for (const factory of creationFactories) {
              // Check if this factory has oslc:resourceType dd:Diagram
              const hasDD = store.statementsMatching(factory, oslcNS('resourceType'), ddDiagramSym);
              if (hasDD.length === 0) continue;

              const titleNode = store.the(factory, dctermsNS('title'), null);
              const creationNode = store.the(factory, oslcNS('creation'), null);
              const shapeNode = store.the(factory, oslcNS('resourceShape'), null);

              const title = titleNode?.value ?? '';
              const creationURI = creationNode?.value ?? '';
              const shapeURI = shapeNode?.value ?? '';

              console.log('[DiagramFactory]   DD factory:', title, 'creation:', creationURI, 'shape:', shapeURI);
              if (!title || !creationURI) continue;

              // Fetch the shape resource to get its description
              let shapeDescription = '';
              if (shapeURI) {
                try {
                  const shapeResource = await client.getResource(shapeURI);
                  if (shapeResource) {
                    const desc = shapeResource.get(dctermsNS('description').value);
                    shapeDescription = Array.isArray(desc) ? desc[0] : desc ?? '';
                  }
                } catch {
                  // Shape may not be fetchable; continue without description
                }
              }
              factories.push({ title, creationURI, shapeDescription });
            }
          }
        }

        console.log('[DiagramFactory] Discovered factories:', factories.map(f => f.title));
        setDiagramFactories(factories);
      } catch (err) {
        console.error('[DiagramFactory] Error discovering diagram factories:', err);
      }
    })();
  }, [connection.connected, connection.serverURL, getClient]);

  const handleConnect = useCallback(async () => {
    const resource = await connect();
    if (resource) navigateToRoot(resource);
  }, [connect, navigateToRoot]);

  const handleColumnItemClick = useCallback(async (columnIndex: number, item: ColumnItem) => {
    await navigateToItem(columnIndex, item, fetchResource);
  }, [navigateToItem, fetchResource]);

  const handleNavigateToResource = useCallback(async (uri: string) => {
    const resource = await fetchResource(uri);
    if (resource) navigateToRoot(resource);
  }, [fetchResource, navigateToRoot]);

  const handleItemContextMenu = useCallback(async (event: React.MouseEvent, item: ColumnItem) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, item });

    if (diagramFactories.length === 0 || item.kind !== 'resource') {
      console.log('[ContextMenu] No factories or not a resource item. factories:', diagramFactories.length, 'kind:', item.kind);
      setMatchingFactories([]);
      return;
    }

    // Get resource types — from the item if available, otherwise fetch the resource
    let typeNames: string[] = [];
    if (item.resourceTypes && item.resourceTypes.length > 0) {
      typeNames = item.resourceTypes.map(t => localName(t));
    } else {
      // Fetch the resource to discover its types
      console.log('[ContextMenu] No types on item, fetching resource:', item.uri);
      const resource = await fetchResource(item.uri);
      if (resource && resource.resourceTypes.length > 0) {
        typeNames = resource.resourceTypes.map(t => localName(t));
      }
    }

    console.log('[ContextMenu] Resource types:', typeNames, 'Factories:', diagramFactories.length);
    if (typeNames.length > 0) {
      const matching = diagramFactories.filter(f =>
        typeNames.some(name => f.shapeDescription.includes(name))
      );
      console.log('[ContextMenu] Matching factories:', matching.map(f => f.title));
      setMatchingFactories(matching);
    } else {
      setMatchingFactories([]);
    }
  }, [diagramFactories, fetchResource]);

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setMatchingFactories([]);
  };

  const handleCreateDiagram = useCallback(async (factory: DiagramFactory) => {
    const item = contextMenu?.item;
    handleCloseContextMenu();
    if (!item) return;

    const client = getClient();
    if (!client) return;

    try {
      const resource = await fetchRawResource(item.uri);
      if (!resource) return;

      // Traverse outgoing links from the resource
      const traversal = await traverseLinks(client, resource, 2);

      // Generate diagram Turtle (empty URI — server assigns the URI)
      const diagramTitle = `${item.title} - ${factory.title}`;
      const turtle = generateDiagramTurtle(diagramTitle, traversal, '');

      // POST the Turtle to the creation factory
      const response = await fetch(factory.creationURI, {
        method: 'POST',
        headers: {
          'Content-Type': 'text/turtle',
          'Accept': 'text/turtle',
          'OSLC-Core-Version': '3.0',
        },
        body: turtle,
      });

      if (response.ok) {
        const newDiagramURI = response.headers.get('Location');
        if (newDiagramURI) {
          // Navigate to the newly created diagram resource
          handleNavigateToResource(newDiagramURI);
        }
      } else {
        console.error('Failed to create diagram, status:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Error creating diagram:', err);
    }
  }, [contextMenu, getClient, fetchRawResource, handleNavigateToResource]);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <div style={{ display: 'flex', flexDirection: 'column', height: '100vh' }}>
        <ToolbarComponent
          connection={connection}
          onServerURLChange={setServerURL}
          onUsernameChange={setUsername}
          onPasswordChange={setPassword}
          onConnect={handleConnect}
        />
        <MainLayoutComponent
          columns={navState.columns}
          selectedResource={navState.selectedResource}
          favorites={favorites}
          onColumnItemClick={handleColumnItemClick}
          onColumnItemContextMenu={handleItemContextMenu}
          onLinkClick={handleNavigateToResource}
          onNavigateToFavorite={handleNavigateToResource}
          onAddFolder={addFolder}
          onRemoveFavorite={removeItem}
          onRenameFavorite={rename}
          onToggleFolder={toggleFolder}
          fetchRawResource={fetchRawResource}
        />
      </div>

      {/* Column item context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => {
          if (contextMenu) addResource(contextMenu.item.title, contextMenu.item.uri);
          handleCloseContextMenu();
        }}>
          Add to Favorites
        </MenuItem>
        {matchingFactories.length > 0 && <Divider />}
        {matchingFactories.map((factory) => (
          <MenuItem
            key={factory.title}
            onClick={() => handleCreateDiagram(factory)}
          >
            {factory.title}
          </MenuItem>
        ))}
      </Menu>
    </ThemeProvider>
  );
}

export default App;
