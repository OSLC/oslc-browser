import {
  Box,
  List,
  ListItemButton,
  ListItemText,
  Typography,
  CircularProgress,
  Alert,
  Accordion,
  AccordionSummary,
  AccordionDetails,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
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

  const itemList = (
    <List dense disablePadding>
      {column.items.map(item => (
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
    </List>
  );

  // Resource column: accordion (collapsed) with predicate items inside
  if (column.resource) {
    return (
      <Box sx={{ width: 280, minWidth: 280, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
        <Accordion disableGutters square elevation={0} sx={{ '&::before': { display: 'none' } }}>
          <AccordionSummary
            expandIcon={<ExpandMore />}
            sx={{ minHeight: 36, px: 1.5, bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider', '& .MuiAccordionSummary-content': { my: 0.5 } }}
          >
            <Typography
              variant="subtitle2"
              sx={{ fontSize: 13, fontWeight: 600 }}
              noWrap
              title={column.uri}
            >
              {column.title}
            </Typography>
          </AccordionSummary>
          <AccordionDetails sx={{ p: 0 }}>
            {column.items.length === 0 && (
              <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
                No outgoing links
              </Typography>
            )}
            {itemList}
          </AccordionDetails>
        </Accordion>
      </Box>
    );
  }

  // Targets column: header + flat list of resource targets
  return (
    <Box sx={{ width: 280, minWidth: 280, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
      <Box sx={{ minHeight: 36, px: 1.5, display: 'flex', alignItems: 'center', bgcolor: 'grey.50', borderBottom: 1, borderColor: 'divider' }}>
        <Typography
          variant="subtitle2"
          sx={{ fontSize: 13, fontWeight: 600 }}
          noWrap
          title={column.uri}
        >
          {column.title}
        </Typography>
      </Box>
      {itemList}
    </Box>
  );
}
