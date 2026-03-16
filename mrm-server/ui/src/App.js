import { OslcBrowserApp } from 'oslc-browser';
// MRM-specific tabs and menu items will be added here later.
// For now, the app renders the default OSLC browser.
const mrmTabs = [];
const mrmMenuItems = [];
export default function App() {
    return (<OslcBrowserApp extraTabs={mrmTabs} extraMenuItems={mrmMenuItems}/>);
}
//# sourceMappingURL=App.js.map