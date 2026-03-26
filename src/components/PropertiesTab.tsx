import {
  Box,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
  Typography,
  Link,
  Chip,
  Divider,
} from '@mui/material';
import type { LoadedResource } from '../models/types.js';
import { localName } from '../models/types.js';

interface PropertiesTabProps {
  resource: LoadedResource;
  onLinkClick: (uri: string) => void;
}

export function PropertiesTabComponent({ resource, onLinkClick }: PropertiesTabProps) {
  return (
    <Box sx={{ overflow: 'auto', height: '100%', p: 1 }}>
      {/* Resource header */}
      <Typography variant="subtitle2" sx={{ mb: 0.5 }}>
        {resource.title}
      </Typography>
      <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block', wordBreak: 'break-all' }}>
        {resource.uri}
      </Typography>

      {/* Resource types */}
      {resource.resourceTypes.length > 0 && (
        <Box sx={{ mb: 1, display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
          {resource.resourceTypes.map(t => (
            <Chip key={t} label={localName(t)} size="small" title={t} sx={{ fontSize: 11, height: 20 }} />
          ))}
        </Box>
      )}

      {/* Literal properties */}
      {resource.properties.length > 0 && (
        <>
          <Typography variant="overline" sx={{ fontSize: 11 }}>Properties</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 12, fontWeight: 600, width: '30%' }}>Property</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Value</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resource.properties.map((prop, i) => (
                <TableRow key={prop.predicate + i}>
                  <TableCell sx={{ fontSize: 12 }} title={prop.predicate}>
                    {prop.predicateLabel}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12, wordBreak: 'break-word' }}>
                    {prop.value}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}

      {/* Link properties */}
      {resource.links.length > 0 && (
        <>
          <Divider sx={{ my: 1 }} />
          <Typography variant="overline" sx={{ fontSize: 11 }}>Links</Typography>
          <Table size="small">
            <TableHead>
              <TableRow>
                <TableCell sx={{ fontSize: 12, fontWeight: 600, width: '30%' }}>Relationship</TableCell>
                <TableCell sx={{ fontSize: 12, fontWeight: 600 }}>Target</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {resource.links.map((link, i) => (
                <TableRow key={link.predicate + link.targetURI + i}>
                  <TableCell sx={{ fontSize: 12 }} title={link.predicate}>
                    {link.predicateLabel}
                  </TableCell>
                  <TableCell sx={{ fontSize: 12 }}>
                    <Link
                      component="button"
                      onClick={() => onLinkClick(link.targetURI)}
                      sx={{ fontSize: 12, textAlign: 'left' }}
                      title={link.targetURI}
                    >
                      {link.targetTitle ?? link.targetURI}
                    </Link>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </Box>
  );
}
