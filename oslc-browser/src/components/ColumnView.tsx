import { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { ResourceColumnComponent } from './ResourceColumn.js';
import type { NavigationColumn, ColumnItem } from '../models/types.js';

interface ColumnViewProps {
  columns: NavigationColumn[];
  onItemClick: (columnIndex: number, item: ColumnItem) => void;
  onItemContextMenu: (event: React.MouseEvent, item: ColumnItem) => void;
}

export function ColumnViewComponent({ columns, onItemClick, onItemContextMenu }: ColumnViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to the right when new columns are added
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
    }
  }, [columns.length]);

  return (
    <Box
      ref={scrollRef}
      sx={{
        display: 'flex',
        flexGrow: 1,
        overflow: 'auto',
        bgcolor: 'background.paper',
      }}
    >
      {columns.map((col, i) => (
        <ResourceColumnComponent
          key={col.uri + i}
          column={col}
          onItemClick={item => onItemClick(i, item)}
          onItemContextMenu={onItemContextMenu}
        />
      ))}
    </Box>
  );
}
