import { api } from './client.js';

export async function login(email, password) {
  const { data } = await api.post('/auth/login', { email, password });
  return data; // { accessToken, refreshToken, user }
}

export async function register(payload) {
  const { data } = await api.post('/auth/register', payload);
  return data;
}
