import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initI18n } from './lib/i18n';
import { applyUrlFlags } from './lib/store';
import './styles/globals.css';

// Apply ?simple=1 / ?lang= before the first paint so Elder mode never flashes off.
applyUrlFlags(window.location.search);
initI18n();

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
