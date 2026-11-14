import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { initI18n } from './lib/i18n';
import { applyUrlFlags } from './lib/store';
import './styles/globals.css';

// Apply ?simple=1 / ?lang= before the first paint so Elder mode never flashes off.
applyUrlFlags(window.location.search);

const root = document.getElementById('root');
if (!root) throw new Error('#root missing from index.html');

// Render once the stored language is loaded, so Hindi/Telugu/Bengali users never see an English flash.
void initI18n().then(() => {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  );
});
