import { IconButton, Toolbar, Tooltip } from '@mui/material';
import ZoomInIcon from '@mui/icons-material/ZoomIn';
import ZoomOutIcon from '@mui/icons-material/ZoomOut';
import FitScreenIcon from '@mui/icons-material/FitScreen';

interface DiagramToolbarProps {
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFitToView: () => void;
}

export function DiagramToolbarComponent({ onZoomIn, onZoomOut, onFitToView }: DiagramToolbarProps) {
  return (
    <Toolbar variant="dense" sx={{ minHeight: 36, gap: 0.5 }}>
      <Tooltip title="Zoom In">
        <IconButton size="small" onClick={onZoomIn}><ZoomInIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Tooltip title="Zoom Out">
        <IconButton size="small" onClick={onZoomOut}><ZoomOutIcon fontSize="small" /></IconButton>
      </Tooltip>
      <Tooltip title="Fit to View">
        <IconButton size="small" onClick={onFitToView}><FitScreenIcon fontSize="small" /></IconButton>
      </Tooltip>
    </Toolbar>
  );
}
