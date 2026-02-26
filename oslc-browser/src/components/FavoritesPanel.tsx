import { useState } from 'react';
import {
  Box,
  Typography,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Collapse,
  Menu,
  MenuItem,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  TextField,
  Button,
  Tooltip,
} from '@mui/material';
import {
  Folder as FolderIcon,
  FolderOpen as FolderOpenIcon,
  Link as LinkIcon,
  CreateNewFolder as CreateNewFolderIcon,
  ExpandMore,
  ChevronRight,
} from '@mui/icons-material';
import type { FavoriteItem } from '../models/types.js';

interface FavoritesPanelProps {
  favorites: FavoriteItem[];
  onAddFolder: (name: string, parentId?: string) => void;
  onRemoveItem: (id: string) => void;
  onRenameItem: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  onNavigateToResource: (uri: string) => void;
}

export function FavoritesPanelComponent({
  favorites,
  onAddFolder,
  onRemoveItem,
  onRenameItem,
  onToggleFolder,
  onNavigateToResource,
}: FavoritesPanelProps) {
  const [contextMenu, setContextMenu] = useState<{ mouseX: number; mouseY: number; item: FavoriteItem } | null>(null);
  const [renameDialog, setRenameDialog] = useState<{ item: FavoriteItem; name: string } | null>(null);
  const [newFolderDialog, setNewFolderDialog] = useState<{ parentId?: string; name: string } | null>(null);

  const handleContextMenu = (e: React.MouseEvent, item: FavoriteItem) => {
    e.preventDefault();
    setContextMenu({ mouseX: e.clientX, mouseY: e.clientY, item });
  };

  const handleCloseMenu = () => setContextMenu(null);

  const renderItem = (item: FavoriteItem, depth: number): React.ReactNode => {
    const isFolder = item.type === 'folder';

    return (
      <Box key={item.id}>
        <ListItemButton
          sx={{ pl: 1.5 + depth * 2 }}
          onClick={() => {
            if (isFolder) onToggleFolder(item.id);
            else if (item.uri) onNavigateToResource(item.uri);
          }}
          onContextMenu={e => handleContextMenu(e, item)}
        >
          {isFolder && (
            <ListItemIcon sx={{ minWidth: 28 }}>
              {item.expanded ? <ExpandMore fontSize="small" /> : <ChevronRight fontSize="small" />}
            </ListItemIcon>
          )}
          <ListItemIcon sx={{ minWidth: 28 }}>
            {isFolder
              ? (item.expanded ? <FolderOpenIcon fontSize="small" color="primary" /> : <FolderIcon fontSize="small" color="primary" />)
              : <LinkIcon fontSize="small" color="action" />
            }
          </ListItemIcon>
          <ListItemText
            primary={item.name}
            primaryTypographyProps={{ fontSize: 13, noWrap: true }}
            title={item.uri ?? item.name}
          />
        </ListItemButton>

        {isFolder && item.children && (
          <Collapse in={item.expanded}>
            {item.children.map(child => renderItem(child, depth + 1))}
          </Collapse>
        )}
      </Box>
    );
  };

  return (
    <Box sx={{ width: 240, minWidth: 240, borderRight: 1, borderColor: 'divider', display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ display: 'flex', alignItems: 'center', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Typography variant="subtitle2" sx={{ flexGrow: 1, fontSize: 13, fontWeight: 600 }}>
          Favorites
        </Typography>
        <Tooltip title="New folder">
          <IconButton size="small" onClick={() => setNewFolderDialog({ name: '' })}>
            <CreateNewFolderIcon fontSize="small" />
          </IconButton>
        </Tooltip>
      </Box>

      <List dense disablePadding sx={{ overflow: 'auto', flexGrow: 1 }}>
        {favorites.length === 0 && (
          <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 12 }}>
            Right-click a resource to add it to favorites
          </Typography>
        )}
        {favorites.map(item => renderItem(item, 0))}
      </List>

      {/* Context menu */}
      <Menu
        open={contextMenu !== null}
        onClose={handleCloseMenu}
        anchorReference="anchorPosition"
        anchorPosition={contextMenu ? { top: contextMenu.mouseY, left: contextMenu.mouseX } : undefined}
      >
        <MenuItem onClick={() => {
          if (contextMenu) setRenameDialog({ item: contextMenu.item, name: contextMenu.item.name });
          handleCloseMenu();
        }}>Rename</MenuItem>
        {contextMenu?.item.type === 'folder' && (
          <MenuItem onClick={() => {
            if (contextMenu) setNewFolderDialog({ parentId: contextMenu.item.id, name: '' });
            handleCloseMenu();
          }}>New subfolder</MenuItem>
        )}
        <MenuItem onClick={() => {
          if (contextMenu) onRemoveItem(contextMenu.item.id);
          handleCloseMenu();
        }}>Delete</MenuItem>
      </Menu>

      {/* Rename dialog */}
      <Dialog open={renameDialog !== null} onClose={() => setRenameDialog(null)}>
        <DialogTitle>Rename</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            value={renameDialog?.name ?? ''}
            onChange={e => setRenameDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter' && renameDialog) {
                onRenameItem(renameDialog.item.id, renameDialog.name);
                setRenameDialog(null);
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setRenameDialog(null)}>Cancel</Button>
          <Button onClick={() => {
            if (renameDialog) onRenameItem(renameDialog.item.id, renameDialog.name);
            setRenameDialog(null);
          }}>OK</Button>
        </DialogActions>
      </Dialog>

      {/* New folder dialog */}
      <Dialog open={newFolderDialog !== null} onClose={() => setNewFolderDialog(null)}>
        <DialogTitle>New Folder</DialogTitle>
        <DialogContent>
          <TextField
            autoFocus
            fullWidth
            size="small"
            label="Folder name"
            value={newFolderDialog?.name ?? ''}
            onChange={e => setNewFolderDialog(prev => prev ? { ...prev, name: e.target.value } : null)}
            onKeyDown={e => {
              if (e.key === 'Enter' && newFolderDialog?.name) {
                onAddFolder(newFolderDialog.name, newFolderDialog.parentId);
                setNewFolderDialog(null);
              }
            }}
            sx={{ mt: 1 }}
          />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setNewFolderDialog(null)}>Cancel</Button>
          <Button onClick={() => {
            if (newFolderDialog?.name) onAddFolder(newFolderDialog.name, newFolderDialog.parentId);
            setNewFolderDialog(null);
          }}>OK</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
