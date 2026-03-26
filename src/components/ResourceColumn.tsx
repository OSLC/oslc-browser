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
  Badge,
} from '@mui/material';
import { ExpandMore } from '@mui/icons-material';
import type { NavigationColumn, ColumnResource, LoadedResource } from '../models/types.js';

interface ResourceColumnProps {
  column: NavigationColumn;
  columnIndex: number;
  onPredicateClick: (resource: LoadedResource, predicate: string) => void;
  onResourceSelect: (resource: LoadedResource, columnIndex: number) => void;
  onResourceContextMenu: (event: React.MouseEvent, resource: LoadedResource) => void;
}

export function ResourceColumnComponent({
  column,
  columnIndex,
  onPredicateClick,
  onResourceSelect,
  onResourceContextMenu,
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

  return (
    <Box sx={{ width: 280, minWidth: 280, overflow: 'auto', borderRight: 1, borderColor: 'divider' }}>
      {column.resources.map((colRes) => (
        <ResourceAccordion
          key={colRes.resource.uri}
          colRes={colRes}
          columnIndex={columnIndex}
          isSelected={column.selectedResourceURI === colRes.resource.uri}
          selectedPredicate={column.selectedPredicate}
          onPredicateClick={onPredicateClick}
          onResourceSelect={onResourceSelect}
          onResourceContextMenu={onResourceContextMenu}
        />
      ))}
      {column.resources.length === 0 && (
        <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
          No resources
        </Typography>
      )}
    </Box>
  );
}

interface ResourceAccordionProps {
  colRes: ColumnResource;
  columnIndex: number;
  isSelected: boolean;
  selectedPredicate?: string;
  onPredicateClick: (resource: LoadedResource, predicate: string) => void;
  onResourceSelect: (resource: LoadedResource, columnIndex: number) => void;
  onResourceContextMenu: (event: React.MouseEvent, resource: LoadedResource) => void;
}

function ResourceAccordion({
  colRes,
  columnIndex,
  isSelected,
  selectedPredicate,
  onPredicateClick,
  onResourceSelect,
  onResourceContextMenu,
}: ResourceAccordionProps) {
  const { resource, predicates } = colRes;

  return (
    <Accordion
      disableGutters
      square
      elevation={0}
      onChange={(_, expanded) => {
        if (expanded) onResourceSelect(resource, columnIndex);
      }}
      sx={{ '&::before': { display: 'none' } }}
    >
      <AccordionSummary
        expandIcon={<ExpandMore />}
        onContextMenu={(e) => onResourceContextMenu(e, resource)}
        sx={{
          minHeight: 36,
          px: 1.5,
          bgcolor: isSelected ? 'primary.light' : 'grey.50',
          color: isSelected ? 'primary.contrastText' : 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'pointer',
          '& .MuiAccordionSummary-content': { my: 0.5 },
          '& .MuiAccordionSummary-expandIconWrapper': {
            color: isSelected ? 'primary.contrastText' : undefined,
          },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{ fontSize: 13, fontWeight: 600 }}
          noWrap
          title={resource.title}
        >
          {resource.title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        {predicates.length === 0 && (
          <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
            No outgoing links
          </Typography>
        )}
        <List dense disablePadding>
          {predicates.map((pred) => (
            <ListItemButton
              key={pred.predicate}
              selected={isSelected && selectedPredicate === pred.predicate}
              onClick={() => onPredicateClick(resource, pred.predicate)}
              sx={{ py: 0.5 }}
            >
              <ListItemText
                primary={pred.predicateLabel}
                primaryTypographyProps={{ fontSize: 13, noWrap: true }}
                title={pred.predicate}
              />
              {pred.targetCount > 1 && (
                <Badge
                  badgeContent={pred.targetCount}
                  color="default"
                  sx={{
                    ml: 1,
                    '& .MuiBadge-badge': { fontSize: 10, height: 16, minWidth: 16 },
                  }}
                />
              )}
            </ListItemButton>
          ))}
        </List>
      </AccordionDetails>
    </Accordion>
  );
}
