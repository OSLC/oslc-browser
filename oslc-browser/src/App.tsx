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
    // The catalog at connection.serverURL contains ldp:contains references
    // to individual ServiceProviders. We fetch each one and extract its
    // creation factories that have oslc:resourceType dd:Diagram.
    (async () => {
      try {
        const ddDiagramSym = sym(DD_DIAGRAM);

        // Step 1: Fetch catalog and find service provider URIs via ldp:contains
        const catalogResource = await client.getResource(connection.serverURL);
        if (!catalogResource?.store) return;
        const catalogStore = catalogResource.store;

        const spNodes = catalogStore.each(null, ldp('contains'), null);
        const spURIs = spNodes.map((n: any) => n.value).filter(Boolean);

        // Step 2: Fetch each service provider and extract diagram factories
        const factories: DiagramFactory[] = [];

        for (const spURI of spURIs) {
          let spResource;
          try {
            spResource = await client.getResource(spURI);
          } catch {
            continue; // Skip unreachable service providers
          }
          if (!spResource?.store) continue;
          const store = spResource.store;

          // Walk: ServiceProvider → oslc:service → oslc:creationFactory
          const spSym = store.sym(spURI);
          const services = store.each(spSym, oslcNS('service'), null);
          for (const service of services) {
            const creationFactories = store.each(service, oslcNS('creationFactory'), null);
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

        setDiagramFactories(factories);
      } catch (err) {
        console.error('Error discovering diagram factories:', err);
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
      setMatchingFactories([]);
      return;
    }

    // Get resource types — from the item if available, otherwise fetch the resource
    let typeNames: string[] = [];
    if (item.resourceTypes && item.resourceTypes.length > 0) {
      typeNames = item.resourceTypes.map(t => localName(t));
    } else {
      // Fetch the resource to discover its types
      const resource = await fetchResource(item.uri);
      if (resource && resource.resourceTypes.length > 0) {
        typeNames = resource.resourceTypes.map(t => localName(t));
      }
    }

    if (typeNames.length > 0) {
      const matching = diagramFactories.filter(f =>
        typeNames.some(name => f.shapeDescription.includes(name))
      );
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
