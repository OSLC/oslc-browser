import { useCallback, useRef, useState } from 'react';
import { Box } from '@mui/material';
import type { OSLCResource } from 'oslc-client';
import { ColumnViewComponent } from './ColumnView.js';
import { FavoritesPanelComponent } from './FavoritesPanel.js';
import { DetailsPanelComponent } from './DetailsPanel.js';
import type { NavigationColumn, LoadedResource, FavoriteItem } from '../models/types.js';

interface MainLayoutProps {
  columns: NavigationColumn[];
  selectedResource: LoadedResource | null;
  favorites: FavoriteItem[];
  diagramResource?: OSLCResource | null;
  onPredicateClick: (columnIndex: number, resource: LoadedResource, predicate: string) => void;
  onResourceSelect: (resource: LoadedResource, columnIndex: number) => void;
  onResourceContextMenu: (event: React.MouseEvent, resource: LoadedResource) => void;
  onLinkClick: (uri: string) => void;
  onNavigateToFavorite: (uri: string) => void;
  onAddFolder: (name: string, parentId?: string) => void;
  onRemoveFavorite: (id: string) => void;
  onRenameFavorite: (id: string, name: string) => void;
  onToggleFolder: (id: string) => void;
  fetchRawResource?: (uri: string) => Promise<OSLCResource | null>;
}

const MIN_PANEL_HEIGHT = 100;
const DEFAULT_BOTTOM_HEIGHT = 280;
const DIVIDER_HEIGHT = 5;

export function MainLayoutComponent({
  columns,
  selectedResource,
  favorites,
  diagramResource,
  onPredicateClick,
  onResourceSelect,
  onResourceContextMenu,
  onLinkClick,
  onNavigateToFavorite,
  onAddFolder,
  onRemoveFavorite,
  onRenameFavorite,
  onToggleFolder,
  fetchRawResource,
}: MainLayoutProps) {
  const [bottomHeight, setBottomHeight] = useState(DEFAULT_BOTTOM_HEIGHT);
  const containerRef = useRef<HTMLDivElement>(null);
  const dragging = useRef(false);

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    dragging.current = true;

    const onMouseMove = (ev: MouseEvent) => {
      if (!dragging.current || !containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newBottom = containerRect.bottom - ev.clientY - DIVIDER_HEIGHT / 2;
      const maxBottom = containerRect.height - MIN_PANEL_HEIGHT - DIVIDER_HEIGHT;
      setBottomHeight(Math.max(MIN_PANEL_HEIGHT, Math.min(maxBottom, newBottom)));
    };

    const onMouseUp = () => {
      dragging.current = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    document.body.style.cursor = 'row-resize';
    document.body.style.userSelect = 'none';
  }, []);

  return (
    <Box ref={containerRef} sx={{ display: 'flex', flexDirection: 'column', flexGrow: 1, overflow: 'hidden' }}>
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
          onPredicateClick={onPredicateClick}
          onResourceSelect={onResourceSelect}
          onResourceContextMenu={onResourceContextMenu}
        />
      </Box>

      {/* Draggable divider */}
      <Box
        onMouseDown={handleMouseDown}
        sx={{
          height: DIVIDER_HEIGHT,
          cursor: 'row-resize',
          backgroundColor: 'divider',
          flexShrink: 0,
          '&:hover': { backgroundColor: 'primary.main', opacity: 0.5 },
        }}
      />

      {/* Bottom: Details panel */}
      <Box sx={{ height: bottomHeight, flexShrink: 0, overflow: 'hidden' }}>
        <DetailsPanelComponent
          resource={selectedResource}
          diagramResource={diagramResource}
          onLinkClick={onLinkClick}
          fetchRawResource={fetchRawResource}
        />
      </Box>
    </Box>
  );
}
