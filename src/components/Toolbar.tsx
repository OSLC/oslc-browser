import {
  AppBar,
  Toolbar as MuiToolbar,
  TextField,
  Button,
  Typography,
  CircularProgress,
  Alert,
} from '@mui/material';
import type { ConnectionState } from '../models/types.js';

interface ToolbarProps {
  connection: ConnectionState;
  onServerURLChange: (url: string) => void;
  onUsernameChange: (user: string) => void;
  onPasswordChange: (pass: string) => void;
  onConnect: () => void;
}

export function ToolbarComponent({
  connection,
  onServerURLChange,
  onUsernameChange,
  onPasswordChange,
  onConnect,
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
      </MuiToolbar>

      {connection.error && (
        <Alert severity="error" sx={{ borderRadius: 0 }}>
          {connection.error}
        </Alert>
      )}
    </AppBar>
  );
}
