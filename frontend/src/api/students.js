import { api } from './client.js';

export const fetchStudentProfile = () =>
  api.get('/students/profile').then((r) => r.data);

export const updateStudentProfile = (payload) =>
  api.put('/students/profile', payload).then((r) => r.data);

export const fetchStudentApplications = (params = {}) =>
  api.get('/students/applications', { params }).then((r) => r.data);

export const fetchStudentApplication = (id) =>
  api.get(`/students/applications/${id}`).then((r) => r.data);

export const createStudentApplication = (payload) =>
  api.post('/students/applications', payload).then((r) => r.data);

// Student auth
export const registerStudent = (payload) =>
  api.post('/auth/register/student', payload).then((r) => r.data);
