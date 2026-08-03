import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { useAuth } from './store/useAuth.js';
import './index.css'; // extracted directly from the proven HTML mockup

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // A 401 is handled by the axios interceptor (refresh + retry once);
      // retrying here as well would multiply the work and could trip the
      // auth rate limit. 4xx are not worth retrying at all.
      retry: (failureCount, error) => {
        const status = error?.response?.status;
        if (status >= 400 && status < 500) return false;
        return failureCount < 2;
      },
      staleTime: 30_000,
      refetchOnWindowFocus: false,
    },
  },
});

// Restore the session from the httpOnly refresh cookie before the first render
// settles. Until this resolves, useAuth.status is 'loading' and ProtectedRoute
// holds off on deciding anything — which is what stops the guard failing open.
useAuth.getState().bootstrap();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
);
