import { Box, Typography } from '@mui/material';
import type { OSLCResource } from 'oslc-client';
import { useDiagramData } from '../hooks/useDiagramData.js';
import { DiagramCanvasComponent } from './DiagramCanvas.js';

interface DiagramTabProps {
  resource: OSLCResource;
  onNavigate: (uri: string) => void;
}

export function DiagramTabComponent({ resource, onNavigate }: DiagramTabProps) {
  const diagram = useDiagramData(resource);

  if (!diagram) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">Unable to parse diagram data.</Typography>
      </Box>
    );
  }

  if (diagram.elements.length === 0) {
    return (
      <Box sx={{ p: 2 }}>
        <Typography color="text.secondary">
          This diagram has no elements. Use the context menu on a resource to auto-generate diagram content.
        </Typography>
      </Box>
    );
  }

  return <DiagramCanvasComponent diagram={diagram} onNavigate={onNavigate} />;
}
