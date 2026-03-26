import { useCallback, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Divider, Menu, MenuItem } from '@mui/material';
import { Namespace, sym } from 'rdflib';
import type { OSLCResource } from 'oslc-client';
import { ToolbarComponent } from './Toolbar.js';
import { MainLayoutComponent } from './MainLayout.js';
import { useOslcClient } from '../hooks/useOslcClient.js';
import { useNavigation } from '../hooks/useNavigation.js';
import { useFavorites } from '../hooks/useFavorites.js';
import { traverseLinks, generateDiagramTurtle } from '../hooks/diagramGenerator.js';
import { localName } from '../models/types.js';
import type { LoadedResource, OslcBrowserAppProps } from '../models/types.js';

interface DiagramFactory {
  title: string;
  creationURI: string;
  shapeDescription: string;
}

const DD_DIAGRAM = 'http://www.omg.org/spec/DD#Diagram';
const oslcNS = Namespace('http://open-services.net/ns/core#');
const dctermsNS = Namespace('http://purl.org/dc/terms/');

const defaultTheme = createTheme({ typography: { fontSize: 13 } });

export function OslcBrowserAppComponent({
  theme,
  extraTabs,
  extraMenuItems,
}: OslcBrowserAppProps) {
  const { connection, setServerURL, setUsername, setPassword, connect, fetchResource, fetchRawResource, getClient } = useOslcClient();
  const { state: navState, navigateToRoot, navigateToItem, selectResource } = useNavigation();
  const {
    favorites, addFolder, addResource, removeItem, rename, toggleFolder,
  } = useFavorites();

  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; resource: LoadedResource } | null>(null);
  const [matchingFactories, setMatchingFactories] = useState<DiagramFactory[]>([]);
  const [diagramResource, setDiagramResource] = useState<OSLCResource | null>(null);

  const handleConnect = useCallback(async () => {
    const resource = await connect();
    if (resource) navigateToRoot(resource);
  }, [connect, navigateToRoot]);

  const handlePredicateClick = useCallback(async (columnIndex: number, resource: LoadedResource, predicate: string) => {
    await navigateToItem(columnIndex, resource, predicate, fetchResource);
  }, [navigateToItem, fetchResource]);

  const handleNavigateToResource = useCallback(async (uri: string) => {
    const resource = await fetchResource(uri);
    if (resource) navigateToRoot(resource);
  }, [fetchResource, navigateToRoot]);

  const handleResourceContextMenu = useCallback(async (event: React.MouseEvent, resource: LoadedResource) => {
    event.preventDefault();
    setContextMenu({ mouseX: event.clientX, mouseY: event.clientY, resource });
    setMatchingFactories([]);

    const client = getClient();
    if (!client) return;

    try {
      const rawResource = await client.getResource(resource.uri);
      if (!rawResource?.store) return;

      const store = rawResource.store;
      const resourceSym = store.sym(resource.uri);

      const spNode = store.the(resourceSym, oslcNS('serviceProvider'), null);
      let spURI = spNode?.value ?? '';

      if (!spURI && connection.serverURL) {
        const connURL = new URL(connection.serverURL);
        const segments = connURL.pathname.split('/').filter(Boolean);
        if (segments.length >= 2) {
          spURI = `${connURL.origin}/${segments.slice(0, 2).join('/')}`;
        }
      }
      if (!spURI) return;

      const rdfType = Namespace('http://www.w3.org/1999/02/22-rdf-syntax-ns#');
      const typeNodes = store.each(resourceSym, rdfType('type'), null);
      const typeNames: string[] = typeNodes.map((n: any) => localName(n.value)).filter(Boolean);
      if (typeNames.length === 0 && resource.resourceTypes) {
        for (const t of resource.resourceTypes) {
          const name = localName(t);
          if (name) typeNames.push(name);
        }
      }
      if (typeNames.length === 0) return;

      const spResource = await client.getResource(spURI);
      if (!spResource?.store) return;
      const spStore = spResource.store;

      const ddDiagramSym = sym(DD_DIAGRAM);
      const spSym = spStore.sym(spURI);
      const services = spStore.each(spSym, oslcNS('service'), null);

      const factories: DiagramFactory[] = [];

      for (const service of services) {
        const creationFactories = spStore.each(service, oslcNS('creationFactory'), null);

        for (const factory of creationFactories) {
          const hasDD = spStore.statementsMatching(factory, oslcNS('resourceType'), ddDiagramSym);
          if (hasDD.length === 0) continue;

          const titleNode = spStore.the(factory, dctermsNS('title'), null);
          const creationNode = spStore.the(factory, oslcNS('creation'), null);
          const shapeNode = spStore.the(factory, oslcNS('resourceShape'), null);

          const title = titleNode?.value ?? '';
          const creationURI = creationNode?.value ?? '';
          const shapeURI = shapeNode?.value ?? '';
          if (!title || !creationURI) continue;

          let shapeDescription = '';
          if (shapeURI) {
            try {
              const shapeDocURI = shapeURI.split('#')[0];
              const shapeResource = await client.getResource(shapeDocURI);
              if (shapeResource?.store) {
                const shapeSym = shapeResource.store.sym(shapeURI);
                const descNode = shapeResource.store.the(shapeSym, dctermsNS('description'), null);
                shapeDescription = descNode?.value ?? '';
              }
            } catch {
              // Shape may not be fetchable; skip
            }
          }
          factories.push({ title, creationURI, shapeDescription });
        }
      }

      const matching = factories.filter(f =>
        typeNames.some((name: string) => f.shapeDescription.includes(name))
      );
      setMatchingFactories(matching);
    } catch (err) {
      console.error('[ContextMenu] Error discovering diagram factories:', err);
    }
  }, [getClient, connection.serverURL]);

  const handleCloseContextMenu = () => {
    setContextMenu(null);
    setMatchingFactories([]);
  };

  const handleCreateDiagram = useCallback(async (factory: DiagramFactory) => {
    const resource = contextMenu?.resource;
    handleCloseContextMenu();
    if (!resource) return;

    const client = getClient();
    if (!client) return;

    try {
      const rawRes = await fetchRawResource(resource.uri);
      if (!rawRes) return;

      const traversal = await traverseLinks(client, rawRes, 2);
      const diagramTitle = `${resource.title} - ${factory.title}`;
      const turtle = generateDiagramTurtle(diagramTitle, traversal, '');

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
          const diagramRes = await fetchRawResource(newDiagramURI);
          if (diagramRes) setDiagramResource(diagramRes);
        }
      } else {
        console.error('Failed to create diagram, status:', response.status, await response.text());
      }
    } catch (err) {
      console.error('Error creating diagram:', err);
    }
  }, [contextMenu, getClient, fetchRawResource]);

  return (
    <ThemeProvider theme={theme ?? defaultTheme}>
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
          diagramResource={diagramResource}
          extraTabs={extraTabs}
          onPredicateClick={handlePredicateClick}
          onResourceSelect={(resource, columnIndex) => selectResource(resource, columnIndex)}
          onResourceContextMenu={handleResourceContextMenu}
          onLinkClick={handleNavigateToResource}
          onNavigateToFavorite={handleNavigateToResource}
          onAddFolder={addFolder}
          onRemoveFavorite={removeItem}
          onRenameFavorite={rename}
          onToggleFolder={toggleFolder}
          fetchRawResource={fetchRawResource}
        />
      </div>

      <Menu
        open={contextMenu !== null}
        onClose={handleCloseContextMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => {
          if (contextMenu) addResource(contextMenu.resource.title, contextMenu.resource.uri);
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
        {extraMenuItems && extraMenuItems.length > 0 && <Divider />}
        {extraMenuItems?.filter(item => !item.visible || (contextMenu?.resource && item.visible(contextMenu.resource)))
          .map((item, i) => (
            <MenuItem key={`extra-${i}`} onClick={() => {
              if (contextMenu?.resource) item.onClick(contextMenu.resource);
              handleCloseContextMenu();
            }}>
              {item.label}
            </MenuItem>
          ))}
      </Menu>
    </ThemeProvider>
  );
}
