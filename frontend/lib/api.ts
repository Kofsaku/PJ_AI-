import axios from 'axios';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers.Authorization = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Handle response errors
api.interceptors.response.use(
  (response) => response,
  (error) => {
    if (error.response?.status === 401) {
      // Redirect to login if unauthorized
      localStorage.removeItem('token');
      window.location.href = '/login';
    }
    return Promise.reject(error);
  }
);

// Auth APIs
export const authAPI = {
  login: (email: string, password: string) =>
    api.post('/auth/login', { email, password }),
  
  register: (data: any) =>
    api.post('/auth/register', data),
  
  getProfile: () =>
    api.get('/auth/profile'),
};

// Agent APIs
export const agentAPI = {
  getProfile: () =>
    api.get('/agents/profile'),
  
  updateProfile: (data: any) =>
    api.put('/agents/profile', data),
  
  updatePhone: (phoneNumber: string) =>
    api.put('/agents/phone', { phoneNumber }),
  
  updateConversation: (settings: any) =>
    api.put('/agents/conversation', settings),
  
  updateStatus: (status: string, isAvailable?: boolean) =>
    api.put('/agents/status', { status, isAvailable }),
  
  getAvailable: () =>
    api.get('/agents/available'),
  
  getStatistics: (params?: any) =>
    api.get('/agents/statistics', { params }),
  
  updateNotifications: (preferences: any) =>
    api.put('/agents/notifications', preferences),
};

// Call APIs
export const callAPI = {
  startCall: (customerId: string, agentId?: string) =>
    api.post('/calls/start', { customerId, agentId }),
  
  getActiveCalls: () =>
    api.get('/calls/active'),
  
  handoffCall: (callId: string, agentId?: string, reason?: string) =>
    api.post(`/calls/${callId}/handoff`, { agentId, reason }),
  
  endCall: (callId: string, result?: string, notes?: string) =>
    api.post(`/calls/${callId}/end`, { result, notes }),
  
  getCallHistory: (params?: any) =>
    api.get('/calls/history', { params }),
  
  getCallDetails: (callId: string) =>
    api.get(`/calls/${callId}`),
  
  updateTranscript: (callId: string, data: any) =>
    api.put(`/calls/${callId}/transcript`, data),
  
  getStatistics: (params?: any) =>
    api.get('/calls/statistics', { params }),
};

// Customer APIs
export const customerAPI = {
  getAll: (params?: any) =>
    api.get('/customers', { params }),
  
  getById: (id: string) =>
    api.get(`/customers/${id}`),
  
  create: (data: any) =>
    api.post('/customers', data),
  
  update: (id: string, data: any) =>
    api.put(`/customers/${id}`, data),
  
  delete: (id: string) =>
    api.delete(`/customers/${id}`),
  
  import: (file: File) => {
    const formData = new FormData();
    formData.append('file', file);
    return api.post('/customers/import', formData, {
      headers: { 'Content-Type': 'multipart/form-data' }
    });
  },
};

export default api;