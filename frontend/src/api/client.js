import axios from 'axios';

export const api = axios.create({
  baseURL: '/api',
});

// Attach the access token to every request once auth is wired up.
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('accessToken'); // swap for in-memory store later — see note in useAuth.js
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

// A 401 means the token is missing/expired — clear it and bounce to
// login rather than letting every page silently fail its queries.
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      localStorage.removeItem('accessToken');
      if (window.location.pathname !== '/login') {
        window.location.href = '/login';
      }
    }
    return Promise.reject(error);
  }
);
