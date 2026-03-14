import { useCallback, useEffect, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Divider, Menu, MenuItem } from '@mui/material';
import { ToolbarComponent } from './components/Toolbar.js';
import { MainLayoutComponent } from './components/MainLayout.js';
import { useOslcClient } from './hooks/useOslcClient.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useFavorites } from './hooks/useFavorites.js';
import { traverseLinks, generateDiagramTurtle } from './hooks/diagramGenerator.js';
import { localName } from './models/diagram-types.js';
import type { ColumnItem } from './models/types.js';

const DD_DIAGRAM = 'http://www.omg.org/spec/DD#Diagram';

interface DiagramFactory {
  title: string;
  factoryURI: string;
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

    // Introspect catalog for diagram creation factories
    // This relies on the catalog being loaded via OSLCClient.use()
    // For now, we scan the service provider catalog endpoint
    (async () => {
      try {
        const catalogResource = await client.getResource(connection.serverURL);
        if (!catalogResource?.store?.statements) return;

        const statements = catalogResource.store.statements as Array<{
          subject: { value: string; termType: string };
          predicate: { value: string };
          object: { value: string; termType: string };
        }>;

        // Find creation factory blank nodes that have oslc:resourceType dd:Diagram
        const OSLC_RESOURCE_TYPE = 'http://open-services.net/ns/core#resourceType';
        const OSLC_RESOURCE_SHAPE = 'http://open-services.net/ns/core#resourceShape';
        const DCTERMS_TITLE = 'http://purl.org/dc/terms/title';

        // Collect factory blank nodes with dd:Diagram type
        const factoryNodes = new Set<string>();
        for (const st of statements) {
          if (st.predicate.value === OSLC_RESOURCE_TYPE && st.object.value === DD_DIAGRAM) {
            factoryNodes.add(st.subject.value);
          }
        }

        // For each factory node, get title and shape reference
        const factories: DiagramFactory[] = [];
        for (const nodeId of factoryNodes) {
          let title = '';
          let shapeURI = '';
          for (const st of statements) {
            if (st.subject.value !== nodeId) continue;
            if (st.predicate.value === DCTERMS_TITLE) title = st.object.value;
            if (st.predicate.value === OSLC_RESOURCE_SHAPE) shapeURI = st.object.value;
          }
          if (title) {
            // Fetch shape to get description (contains type constraints)
            let shapeDescription = '';
            try {
              const shapeResource = await client.getResource(shapeURI);
              if (shapeResource) {
                const desc = shapeResource.get('http://purl.org/dc/terms/description');
                shapeDescription = Array.isArray(desc) ? desc[0] : desc ?? '';
              }
            } catch {
              // Shape may not be fetchable; use title as fallback
            }
            factories.push({ title, factoryURI: shapeURI, shapeDescription });
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

  const handleItemContextMenu = useCallback((event: React.MouseEvent, item: ColumnItem) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, item });

    // Find matching diagram factories for this item's resource type
    // We check if the selected resource's types appear in the shape description
    const selectedResource = navState.selectedResource;
    if (selectedResource && diagramFactories.length > 0) {
      const typeNames = selectedResource.resourceTypes.map(t => localName(t));
      const matching = diagramFactories.filter(f => {
        // Check if any of the resource's type local names appear in the shape description
        return typeNames.some(name => f.shapeDescription.includes(name));
      });
      setMatchingFactories(matching);
    } else {
      setMatchingFactories([]);
    }
  }, [navState.selectedResource, diagramFactories]);

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setMatchingFactories([]);
  };

  const handleCreateDiagram = useCallback(async (factory: DiagramFactory) => {
    handleCloseContextMenu();
    if (!contextMenu) return;

    const client = getClient();
    if (!client) return;

    try {
      const resource = await fetchRawResource(contextMenu.item.uri);
      if (!resource) return;

      // Traverse outgoing links
      const traversal = await traverseLinks(client, resource, 2);

      // Generate diagram Turtle
      const diagramTitle = `${contextMenu.item.title} - ${factory.title}`;
      const turtle = generateDiagramTurtle(diagramTitle, traversal, '');

      // For now, log the generated turtle (actual creation requires POST to factory)
      console.log('Generated diagram Turtle:', turtle);

      // TODO: POST turtle to creation factory and navigate to new diagram
      // const newDiagramURI = await client.createResource(DD_DIAGRAM, turtle);
      // handleNavigateToResource(newDiagramURI);
    } catch (err) {
      console.error('Error creating diagram:', err);
    }
  }, [contextMenu, getClient, fetchRawResource]);

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
