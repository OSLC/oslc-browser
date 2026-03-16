import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { OslcBrowserApp } from 'oslc-browser';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <OslcBrowserApp />
  </StrictMode>,
);
