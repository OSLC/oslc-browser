import { useCallback, useState } from 'react';
import { CssBaseline, ThemeProvider, createTheme, Menu, MenuItem } from '@mui/material';
import { ToolbarComponent } from './components/Toolbar.js';
import { MainLayoutComponent } from './components/MainLayout.js';
import { useOslcClient } from './hooks/useOslcClient.js';
import { useNavigation } from './hooks/useNavigation.js';
import { useFavorites } from './hooks/useFavorites.js';
import type { ColumnItem } from './models/types.js';

const theme = createTheme({
  typography: {
    fontSize: 13,
  },
});

function App() {
  const { connection, setServerURL, setUsername, setPassword, connect, fetchResource } = useOslcClient();
  const { state: navState, navigateToRoot, navigateToItem } = useNavigation();
  const {
    favorites, addFolder, addResource, removeItem, rename, toggleFolder,
  } = useFavorites();

  // Context menu state for "Add to Favorites"
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; item: ColumnItem } | null>(null);

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
  }, []);

  const handleCloseContextMenu = () => setContextMenu(null);

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
        />
      </div>

      {/* Column item context menu -- Add to Favorites */}
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
      </Menu>
    </ThemeProvider>
  );
}

export default App;
