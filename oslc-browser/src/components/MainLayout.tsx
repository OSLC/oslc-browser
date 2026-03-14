import { Box } from '@mui/material';
import type { OSLCResource } from 'oslc-client';
import { ColumnViewComponent } from './ColumnView.js';
import { FavoritesPanelComponent } from './FavoritesPanel.js';
import { DetailsPanelComponent } from './DetailsPanel.js';
import type { NavigationColumn, ColumnItem, LoadedResource, FavoriteItem } from '../models/types.js';

interface MainLayoutProps {
  columns: NavigationColumn[];
  selectedResource: LoadedResource | null;
  favorites: FavoriteItem[];
  onColumnItemClick: (columnIndex: number, item: ColumnItem) => void;
  onColumnItemContextMenu: (event: React.MouseEvent, item: ColumnItem) => void;
  onLinkClick: (uri: string) => void;
  onNavigateToFavorite: (uri: string) => void;
  onAddFolder: (name: string, parentId?: string) => void;
  onRemoveFavorite: (id: string) => void;
  onRenameFavorite: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  fetchRawResource?: (uri: string) => Promise<OSLCResource | null>;
}

export function MainLayoutComponent({
  columns,
  selectedResource,
  favorites,
  onColumnItemClick,
  onColumnItemContextMenu,
  onLinkClick,
  onNavigateToFavorite,
  onAddFolder,
  onRemoveFavorite,
  onRenameFavorite,
  onToggleFolder,
  fetchRawResource,
}: MainLayoutProps) {
  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
      {/* Top: Favorites + Columns */}
      <Box sx={{ display: 'flex', flexGrow: 1, overflow: 'hidden', minHeight: 0 }}>
        <FavoritesPanelComponent
          favorites={favorites}
          onAddFolder={onAddFolder}
          onRemoveItem={onRemoveFavorite}
          onRenameItem={onRenameFavorite}
          onToggleFolder={onToggleFolder}
          onNavigateToResource={onNavigateToFavorite}
        />
        <ColumnViewComponent
          columns={columns}
          onItemClick={onColumnItemClick}
          onItemContextMenu={onColumnItemContextMenu}
        />
      </Box>

      {/* Bottom: Details panel */}
      <Box sx={{ height: 280, minHeight: 200, borderTop: 1, borderColor: 'divider' }}>
        <DetailsPanelComponent
          resource={selectedResource}
          onLinkClick={onLinkClick}
          fetchRawResource={fetchRawResource}
        />
      </Box>
    </Box>
  );
}
