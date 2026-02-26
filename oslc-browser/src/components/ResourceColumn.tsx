import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Alert,
  Divider,
  Chip,
} from '@mui/material';
import type { NavigationColumn, ColumnItem } from '../models/types.js';

interface ResourceColumnProps {
  column: NavigationColumn;
  onItemClick: (item: ColumnItem) => void;
  onItemContextMenu: (event: React.MouseEvent, item: ColumnItem) => void;
}

export function ResourceColumnComponent({
  column,
  onItemClick,
  onItemContextMenu,
}: ResourceColumnProps) {
  if (column.loading) {
    return (
      <Box sx={{ width: 280, minWidth: 280, display: 'flex', justifyContent: 'center', alignItems: 'center', borderRight: 1, borderColor: 'divider' }}>
        <CircularProgress size={24} />
      </Box>
    );
  }

  if (column.error) {
    return (
      <Box sx={{ width: 280, minWidth: 280, p: 1, borderRight: 1, borderColor: 'divider' }}>
        <Alert severity="error" sx={{ fontSize: 12 }}>{column.error}</Alert>
      </Box>
    );
  }

  // Group items by predicate
  const groups = new Map<string, ColumnItem[]>();
  for (const item of column.items) {
    const key = item.predicateLabel ?? '';
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(item);
  }

  return (
    <Box sx={{ width: 280, minWidth: 280, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
      <Typography
        variant="subtitle2"
        sx={{ px: 1.5, py: 1, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider', fontSize: 13, fontWeight: 600 }}
        noWrap
        title={column.uri}
      >
        {column.title}
      </Typography>

      {column.items.length === 0 && (
        <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
          No outgoing links
        </Typography>
      )}

      <List dense disablePadding>
        {Array.from(groups.entries()).map(([predicateLabel, items], gi) => (
          <Box key={predicateLabel + gi}>
            {predicateLabel && (
              <>
                {gi > 0 && <Divider />}
                <Box sx={{ px: 1.5, py: 0.5, bgcolor: 'grey.50' }}>
                  <Chip label={predicateLabel} size="small" sx={{ fontSize: 11, height: 20 }} />
                </Box>
              </>
            )}
            {items.map(item => (
              <ListItemButton
                key={item.uri}
                selected={item.selected}
                onClick={() => onItemClick(item)}
                onContextMenu={e => onItemContextMenu(e, item)}
                sx={{ py: 0.5 }}
              >
                <ListItemText
                  primary={item.title}
                  primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                  title={item.uri}
                />
              </ListItemButton>
            ))}
          </Box>
        ))}
      </List>
    </Box>
  );
}
