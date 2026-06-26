import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App.tsx';

import { ThemeProvider } from './context/ThemeContext';
import { AdminProvider } from './context/AdminContext';
import { AudioProvider } from './context/AudioContext';
import { AppProvider } from './context/AppContext';

// Register service worker for PWA
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <AdminProvider>
        <AudioProvider>
          <AppProvider>
            <App />
          </AppProvider>
        </AudioProvider>
      </AdminProvider>
    </ThemeProvider>
  </StrictMode>
);