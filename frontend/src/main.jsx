import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import App from './App.jsx';
import { useAuth } from './store/useAuth.js';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // 401s are handled by the axios interceptor (refresh + retry once).
      // Retrying here as well would multiply requests and could trip the rate limit.
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

// Register the QueryClient with the auth store BEFORE bootstrap().
// This means the very first setSession / setAnonymous call already has access to
// queryClient.clear(), so even the initial session restore can clean up if needed.
useAuth.getState().setQueryClient(queryClient);

// Restore the session from the httpOnly refresh cookie before the first render
// settles. Until this resolves, useAuth.status === 'loading' and ProtectedRoute
// holds off on deciding anything.
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
