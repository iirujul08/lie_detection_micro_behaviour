import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000/api';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 45000,
});

export const getHealth = async () => {
  const response = await api.get('/health');
  return response.data;
};

export const getModelInfo = async () => {
  const response = await api.get('/model-info');
  return response.data;
};

export const analyzeImage = async (file) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/analyze/image', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
  return response.data;
};

export const analyzeVideo = async (file, onUploadProgress) => {
  const formData = new FormData();
  formData.append('file', file);
  const response = await api.post('/analyze/video', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
    onUploadProgress: (progressEvent) => {
      if (onUploadProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onUploadProgress(percent);
      }
    },
  });
  return response.data;
};

export const getSessions = async () => {
  const response = await api.get('/sessions');
  return response.data;
};

export const getSession = async (id) => {
  const response = await api.get(`/sessions/${id}`);
  return response.data;
};

export const saveSession = async (sessionData) => {
  const response = await api.post('/sessions', sessionData);
  return response.data;
};

export const deleteSession = async (id) => {
  const response = await api.delete(`/sessions/${id}`);
  return response.data;
};

export default api;
