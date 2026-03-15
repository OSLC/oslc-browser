import { useEffect, useRef, useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import type { OSLCResource } from 'oslc-client';
import { PropertiesTabComponent } from './PropertiesTab.js';
import { ExplorerTabComponent } from './ExplorerTab.js';
import { DiagramTabComponent } from './DiagramTab.js';
import { isDiagramType } from '../models/diagram-types.js';
import type { LoadedResource } from '../models/types.js';

interface DetailsPanelProps {
  resource: LoadedResource | null;
  diagramResource?: OSLCResource | null;
  onLinkClick: (uri: string) => void;
  fetchRawResource?: (uri: string) => Promise<OSLCResource | null>;
}

export function DetailsPanelComponent({ resource, diagramResource, onLinkClick, fetchRawResource }: DetailsPanelProps) {
  const [tab, setTab] = useState(0);
  const [rawResource, setRawResource] = useState<OSLCResource | null>(null);

  const isDiagram = resource ? isDiagramType(resource.resourceTypes) : false;

  // The Diagram tab is available when an external diagram was created for this
  // resource OR when the selected resource itself is a diagram.
  const hasDiagram = !!diagramResource || isDiagram;

  // The resource to render in the Diagram tab: prefer the externally provided
  // diagram resource; fall back to the selected resource if it is a diagram.
  const activeDiagramResource = diagramResource ?? rawResource;

  // Fetch the raw OSLCResource when the selected resource itself is a diagram
  useEffect(() => {
    if (isDiagram && resource && fetchRawResource && !diagramResource) {
      fetchRawResource(resource.uri).then(setRawResource);
    } else {
      setRawResource(null);
    }
  }, [isDiagram, resource?.uri, fetchRawResource, diagramResource]);

  // Auto-switch to the Diagram tab when a new diagram is provided
  const prevDiagramRef = useRef(diagramResource);
  useEffect(() => {
    if (diagramResource && diagramResource !== prevDiagramRef.current) {
      setTab(2);
    }
    prevDiagramRef.current = diagramResource;
  }, [diagramResource]);

  if (!resource) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary" fontSize={13}>Select a resource to view details</Typography>
      </Box>
    );
  }

  // If the tab points to Diagram but there's no diagram, fall back to Properties
  const effectiveTab = (tab === 2 && !hasDiagram) ? 0 : tab;

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs value={effectiveTab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}>
        <Tab label="Properties" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />
        <Tab label="Explorer" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />
        {hasDiagram && <Tab label="Diagram" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />}
      </Tabs>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {effectiveTab === 0 && <PropertiesTabComponent resource={resource} onLinkClick={onLinkClick} />}
        {effectiveTab === 1 && <ExplorerTabComponent resource={resource} onNodeClick={onLinkClick} />}
        {effectiveTab === 2 && hasDiagram && activeDiagramResource && (
          <DiagramTabComponent resource={activeDiagramResource} onNavigate={onLinkClick} />
        )}
      </Box>
    </Box>
  );
}
