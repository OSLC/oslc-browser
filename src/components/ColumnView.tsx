import { useRef, useEffect, useState, useCallback } from 'react';
import { Box } from '@mui/material';
import { ResourceColumnComponent } from './ResourceColumn.js';
import type { NavigationColumn, LoadedResource } from '../models/types.js';

interface ColumnViewProps {
  columns: NavigationColumn[];
  onPredicateClick: (columnIndex: number, resource: LoadedResource, predicate: string, direction?: 'outgoing' | 'incoming') => void;
  onResourceSelect: (resource: LoadedResource, columnIndex: number) => void;
  onResourceContextMenu: (event: React.MouseEvent, resource: LoadedResource) => void;
}

const DEFAULT_COLUMN_WIDTH = 280;

export function ColumnViewComponent({ columns, onPredicateClick, onResourceSelect, onResourceContextMenu }: ColumnViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null);

  // Per-column widths. Defaults to DEFAULT_COLUMN_WIDTH; user drags the
  // right edge of a column to resize it. Widths persist as long as the
  // column index exists; when a new column is added it starts at the
  // default width.
  const [widths, setWidths] = useState<number[]>([]);

  // Keep the widths array length in sync with columns.length — preserve
  // existing values for columns that stayed, default new ones.
  useEffect(() => {
    setWidths((prev) => {
      if (prev.length === columns.length) return prev;
      const next = [...prev];
      while (next.length < columns.length) next.push(DEFAULT_COLUMN_WIDTH);
      if (next.length > columns.length) next.length = columns.length;
      return next;
    });
  }, [columns.length]);

  const setColumnWidth = useCallback((i: number, w: number) => {
    setWidths((prev) => {
      const next = [...prev];
      next[i] = w;
      return next;
    });
  }, []);

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
          width={widths[i] ?? DEFAULT_COLUMN_WIDTH}
          onResize={setColumnWidth}
          onPredicateClick={(resource, predicate, direction) => onPredicateClick(i, resource, predicate, direction)}
          onResourceSelect={onResourceSelect}
          onResourceContextMenu={onResourceContextMenu}
        />
      ))}
    </Box>
  );
}
