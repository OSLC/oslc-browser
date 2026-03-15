import { useRef, useEffect } from 'react';
import { Box } from '@mui/material';
import { ResourceColumnComponent } from './ResourceColumn.js';
import type { NavigationColumn, LoadedResource } from '../models/types.js';

interface ColumnViewProps {
  columns: NavigationColumn[];
  onPredicateClick: (columnIndex: number, resource: LoadedResource, predicate: string) => void;
  onResourceSelect: (resource: LoadedResource, columnIndex: number) => void;
  onResourceContextMenu: (event: React.MouseEvent, resource: LoadedResource) => void;
}

export function ColumnViewComponent({ columns, onPredicateClick, onResourceSelect, onResourceContextMenu }: ColumnViewProps) {
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
          columnIndex={i}
          onPredicateClick={(resource, predicate) => onPredicateClick(i, resource, predicate)}
          onResourceSelect={onResourceSelect}
          onResourceContextMenu={onResourceContextMenu}
        />
      ))}
    </Box>
  );
}
