import {
  AppBar,
  Toolbar as MuiToolbar,
  TextField,
  Button,
  Box,
  Typography,
  CircularProgress,
  Breadcrumbs,
  Link,
  Alert,
  Chip,
} from '@mui/material';
import type { ConnectionState, NavigationColumn } from '../models/types.js';

interface ToolbarProps {
  connection: ConnectionState;
  columns: NavigationColumn[];
  onServerURLChange: (url: string) => void;
  onUsernameChange: (user: string) => void;
  onPasswordChange: (pass: string) => void;
  onConnect: () => void;
  onBreadcrumbClick: (columnIndex: number) => void;
}

export function ToolbarComponent({
  connection,
  columns,
  onServerURLChange,
  onUsernameChange,
  onPasswordChange,
  onConnect,
  onBreadcrumbClick,
}: ToolbarProps) {
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') onConnect();
  };

  return (
    <AppBar position="static" color="default" elevation={1}>
      <MuiToolbar sx={{ gap: 1, flexWrap: 'wrap' }}>
        <Typography variant="h6" sx={{ mr: 2, whiteSpace: 'nowrap' }}>
          OSLC Browser
        </Typography>
        <TextField
          size="small"
          label="Server URL"
          value={connection.serverURL}
          onChange={e => onServerURLChange(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ minWidth: 300, flexGrow: 1 }}
        />
        <TextField
          size="small"
          label="Username"
          value={connection.username}
          onChange={e => onUsernameChange(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ width: 140 }}
        />
        <TextField
          size="small"
          label="Password"
          type="password"
          value={connection.password}
          onChange={e => onPasswordChange(e.target.value)}
          onKeyDown={handleKeyDown}
          sx={{ width: 140 }}
        />
        <Button
          variant="contained"
          onClick={onConnect}
          disabled={connection.connecting || !connection.serverURL}
          startIcon={connection.connecting ? <CircularProgress size={16} /> : undefined}
        >
          {connection.connecting ? 'Connecting' : 'Connect'}
        </Button>
        {connection.connected && (
          <Chip label="Connected" color="success" size="small" variant="outlined" />
        )}
      </MuiToolbar>

      {connection.error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {connection.error}
        </Alert>
      )}

      {columns.length > 0 && (
        <Box sx={{ px: 2, py: 0.5, bgcolor: 'grey.100' }}>
          <Breadcrumbs maxItems={8} sx={{ fontSize: 13 }}>
            {columns.map((col, i) => (
              <Link
                key={col.uri + i}
                component="button"
                underline="hover"
                color={i === columns.length - 1 ? 'text.primary' : 'inherit'}
                onClick={() => onBreadcrumbClick(i)}
                sx={{ fontSize: 13 }}
              >
                {col.title}
              </Link>
            ))}
          </Breadcrumbs>
        </Box>
      )}
    </AppBar>
  );
}
