import { useEffect, useState } from 'react';
import { Box, Tab, Tabs, Typography } from '@mui/material';
import type { OSLCResource } from 'oslc-client';
import { PropertiesTabComponent } from './PropertiesTab.js';
import { ExplorerTabComponent } from './ExplorerTab.js';
import { DiagramTabComponent } from './DiagramTab.js';
import { isDiagramType } from '../models/diagram-types.js';
import type { LoadedResource } from '../models/types.js';

interface DetailsPanelProps {
  resource: LoadedResource | null;
  onLinkClick: (uri: string) => void;
  fetchRawResource?: (uri: string) => Promise<OSLCResource | null>;
}

export function DetailsPanelComponent({ resource, onLinkClick, fetchRawResource }: DetailsPanelProps) {
  const [tab, setTab] = useState(0);
  const [rawResource, setRawResource] = useState<OSLCResource | null>(null);

  const isDiagram = resource ? isDiagramType(resource.resourceTypes) : false;

  // Fetch the raw OSLCResource when viewing a diagram
  useEffect(() => {
    if (isDiagram && resource && fetchRawResource) {
      fetchRawResource(resource.uri).then(setRawResource);
    } else {
      setRawResource(null);
    }
  }, [isDiagram, resource?.uri, fetchRawResource]);

  if (!resource) {
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%' }}>
        <Typography color="text.secondary" fontSize={13}>Select a resource to view details</Typography>
      </Box>
    );
  }

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ borderBottom: 1, borderColor: 'divider', minHeight: 36 }}>
        <Tab label="Properties" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />
        <Tab label="Explorer" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />
        {isDiagram && <Tab label="Diagram" sx={{ minHeight: 36, fontSize: 12, textTransform: 'none' }} />}
      </Tabs>
      <Box sx={{ flexGrow: 1, overflow: 'hidden' }}>
        {tab === 0 && <PropertiesTabComponent resource={resource} onLinkClick={onLinkClick} />}
        {tab === 1 && <ExplorerTabComponent resource={resource} onNodeClick={onLinkClick} />}
        {tab === 2 && isDiagram && rawResource && (
          <DiagramTabComponent resource={rawResource} onNavigate={onLinkClick} />
        )}
      </Box>
    </Box>
  );
}
