import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Handle chunk loading errors (common in development with HMR)
window.addEventListener('error', (event) => {
  if (event.message && event.message.includes('chunk')) {
    console.warn('Chunk load error detected, reloading page...');
    // Reload page on chunk load error
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
});

// Handle unhandled promise rejections from chunk loading
window.addEventListener('unhandledrejection', (event) => {
  if (event.reason && event.reason.message && event.reason.message.includes('chunk')) {
    console.warn('Chunk load error detected in promise, reloading page...');
    event.preventDefault();
    setTimeout(() => {
      window.location.reload();
    }, 1000);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
