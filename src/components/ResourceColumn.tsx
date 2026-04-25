import { useCallback, useRef, useState } from 'react';
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
import { ChevronRight } from '@mui/icons-material';
import type { NavigationColumn, ColumnResource, LoadedResource } from '../models/types.js';

interface ResourceColumnProps {
  column: NavigationColumn;
  columnIndex: number;
  width: number;
  minWidth?: number;
  maxWidth?: number;
  onResize: (columnIndex: number, newWidth: number) => void;
  onPredicateClick: (resource: LoadedResource, predicate: string, direction: 'outgoing' | 'incoming') => void;
  onResourceSelect: (resource: LoadedResource, columnIndex: number) => void;
  onResourceContextMenu: (event: React.MouseEvent, resource: LoadedResource) => void;
}

const DEFAULT_MIN_WIDTH = 200;
const DEFAULT_MAX_WIDTH = 800;

export function ResourceColumnComponent({
  column,
  columnIndex,
  width,
  minWidth = DEFAULT_MIN_WIDTH,
  maxWidth = DEFAULT_MAX_WIDTH,
  onResize,
  onPredicateClick,
  onResourceSelect,
  onResourceContextMenu,
}: ResourceColumnProps) {
  const dragRef = useRef<{ startX: number; startWidth: number } | null>(null);

  // Drag the right edge to resize the column. The mousemove/mouseup
  // listeners are attached at document level so a fast drag that leaves
  // the handle does not get dropped mid-drag.
  const handleMouseDown = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      dragRef.current = { startX: e.clientX, startWidth: width };

      const onMove = (ev: MouseEvent) => {
        if (!dragRef.current) return;
        const delta = ev.clientX - dragRef.current.startX;
        const next = Math.min(
          maxWidth,
          Math.max(minWidth, dragRef.current.startWidth + delta)
        );
        onResize(columnIndex, next);
      };
      const onUp = () => {
        dragRef.current = null;
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
        document.body.style.cursor = '';
        document.body.style.userSelect = '';
      };

      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
    },
    [width, minWidth, maxWidth, onResize, columnIndex]
  );

  // Shared container that also renders the resize handle on the right.
  const containerSx = {
    position: 'relative' as const,
    width,
    minWidth: width,
    flexShrink: 0,
    borderRight: 1,
    borderColor: 'divider',
  };

  const resizeHandle = (
    <Box
      onMouseDown={handleMouseDown}
      sx={{
        position: 'absolute',
        top: 0,
        right: -2,
        width: 5,
        height: '100%',
        cursor: 'col-resize',
        zIndex: 1,
        '&:hover': { bgcolor: 'primary.light' },
      }}
      aria-label="Resize column"
      role="separator"
    />
  );

  if (column.loading) {
    return (
      <Box sx={{ ...containerSx, display: 'flex', justifyContent: 'center', alignItems: 'center' }}>
        <CircularProgress size={24} />
        {resizeHandle}
      </Box>
    );
  }

  if (column.error) {
    return (
      <Box sx={{ ...containerSx, p: 1 }}>
        <Alert severity="error" sx={{ fontSize: 12 }}>{column.error}</Alert>
        {resizeHandle}
      </Box>
    );
  }

  return (
    <Box sx={{ ...containerSx, overflow: 'auto' }}>
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
      {resizeHandle}
    </Box>
  );
}

interface ResourceAccordionProps {
  colRes: ColumnResource;
  columnIndex: number;
  isSelected: boolean;
  selectedPredicate?: string;
  onPredicateClick: (resource: LoadedResource, predicate: string, direction: 'outgoing' | 'incoming') => void;
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

  // Fully controlled expansion state. The default Accordion behavior
  // toggles whenever AccordionSummary is clicked, but the user wants
  // a row click to *select* the resource (so menu items, properties,
  // etc., apply to the selected resource) and reserve expansion to
  // explicit chevron clicks.
  const [expanded, setExpanded] = useState(false);

  const handleSummaryClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      // Determine whether the click landed on the expand-icon wrapper.
      // If so, toggle expansion; otherwise, just select the resource.
      const iconEl = e.currentTarget.querySelector(
        '.MuiAccordionSummary-expandIconWrapper'
      );
      const onIcon = iconEl !== null && iconEl.contains(e.target as Node);
      if (onIcon) {
        const next = !expanded;
        setExpanded(next);
        // Selecting on expand keeps the details panel in sync with
        // the row whose links the user just opened.
        if (next) onResourceSelect(resource, columnIndex);
      } else {
        onResourceSelect(resource, columnIndex);
      }
    },
    [expanded, resource, columnIndex, onResourceSelect]
  );

  return (
    <Accordion
      disableGutters
      square
      elevation={0}
      expanded={expanded}
      sx={{ '&::before': { display: 'none' } }}
    >
      <AccordionSummary
        // ChevronRight rotates 90deg when expanded — cleaner than
        // ExpandMore when the icon sits at the left of the row.
        expandIcon={<ChevronRight fontSize="small" />}
        onClick={handleSummaryClick}
        onContextMenu={(e) => onResourceContextMenu(e, resource)}
        sx={{
          minHeight: 36,
          pl: 0,
          pr: 1,
          bgcolor: isSelected ? 'primary.light' : 'grey.50',
          color: isSelected ? 'primary.contrastText' : 'text.primary',
          borderBottom: 1,
          borderColor: 'divider',
          cursor: 'pointer',
          // Put the expand icon on the left of the row and left-align
          // the title immediately next to it. Without these overrides,
          // MUI default styles (margin/padding around content) push the
          // title inward and the row reads as visually centered.
          flexDirection: 'row-reverse',
          '& .MuiAccordionSummary-content': {
            my: 0.5,
            ml: 0,
            mr: 0,
            justifyContent: 'flex-start',
          },
          '& .MuiAccordionSummary-expandIconWrapper': {
            color: isSelected ? 'primary.contrastText' : undefined,
            transform: 'rotate(0deg)',
            p: 0.25,
          },
          '& .MuiAccordionSummary-expandIconWrapper.Mui-expanded': {
            transform: 'rotate(90deg)',
          },
        }}
      >
        <Typography
          variant="subtitle2"
          sx={{
            fontSize: 13,
            fontWeight: 600,
            textAlign: 'left',
            flex: 1,
            minWidth: 0,
          }}
          noWrap
          title={resource.title}
        >
          {resource.title}
        </Typography>
      </AccordionSummary>
      <AccordionDetails sx={{ p: 0 }}>
        {predicates.length === 0 && (
          <Typography sx={{ p: 2, color: 'text.secondary', fontSize: 13 }}>
            No links
          </Typography>
        )}
        <List dense disablePadding>
          {predicates.map((pred) => {
            const isIncoming = pred.direction === 'incoming';
            // Incoming predicates share a URI with the forward direction
            // in the cache key space — include direction to avoid collisions.
            const key = `${pred.predicate}|${pred.direction ?? 'outgoing'}`;
            return (
              <ListItemButton
                key={key}
                selected={isSelected && selectedPredicate === pred.predicate}
                onClick={() => onPredicateClick(resource, pred.predicate, pred.direction ?? 'outgoing')}
                // Indent predicate items so they visually align under the
                // accordion title text, past where the expand icon sat.
                // Matches the chevron+padding width used in
                // AccordionSummary above.
                sx={{ py: 0.5, pl: 3, pr: 1 }}
              >
                <ListItemText
                  primary={pred.predicateLabel}
                  primaryTypographyProps={{
                    fontSize: 13,
                    noWrap: true,
                    textAlign: 'left',
                    ...(isIncoming ? { fontStyle: 'italic' } : {}),
                  }}
                  title={isIncoming ? `${pred.predicate} (incoming — stored on source)` : pred.predicate}
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
            );
          })}
        </List>
      </AccordionDetails>
    </Accordion>
  );
}
