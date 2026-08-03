import { api } from './client.js';

export async function fetchInquiries(filters) {
  const { data } = await api.get('/course-inquiries', { params: filters });
  return data;
}

export async function createInquiry(payload) {
  const { data } = await api.post('/course-inquiries', payload);
  return data;
}
