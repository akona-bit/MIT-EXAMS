import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'

const suppressExtensionErrors = (msg: string | Event) => {
  const text = typeof msg === 'string' ? msg : (msg as ErrorEvent).message || '';
  return typeof text === 'string' && text.includes('message channel closed');
};

window.addEventListener('unhandledrejection', (e) => {
  if (suppressExtensionErrors(e.reason?.message)) e.preventDefault();
});
window.addEventListener('error', (e) => {
  if (suppressExtensionErrors(e.message)) e.preventDefault();
});

const queryClient = new QueryClient()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </StrictMode>,
)
