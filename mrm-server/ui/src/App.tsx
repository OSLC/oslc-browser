import { OslcBrowserApp } from 'oslc-browser';
import type { ExtraTab, ExtraMenuItem } from 'oslc-browser';

// MRM-specific tabs and menu items will be added here later.
// For now, the app renders the default OSLC browser.
const mrmTabs: ExtraTab[] = [];
const mrmMenuItems: ExtraMenuItem[] = [];

export default function App() {
  return (
    <OslcBrowserApp
      extraTabs={mrmTabs}
      extraMenuItems={mrmMenuItems}
    />
  );
}
