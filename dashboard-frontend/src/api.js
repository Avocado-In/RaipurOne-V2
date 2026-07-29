import axios from 'axios';
import { getOfflinePayload } from './offlineData';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

const createAbortController = () => new AbortController();

const shouldUseOfflineFallback = (endpoint) => {
  const normalized = endpoint || '';
  return normalized.includes('/dashboard/stats')
    || normalized.includes('/tickets')
    || normalized.includes('/analysis/departments/stats')
    || normalized.includes('/workers')
    || normalized.includes('/notifications')
    || normalized.includes('/images');
};

const runWithFallback = async (requestFn, endpoint) => {
  try {
    return await requestFn();
  } catch (error) {
    if (shouldUseOfflineFallback(endpoint)) {
      console.warn(`Using offline demo data for ${endpoint}`);
      return getOfflinePayload(endpoint);
    }
    throw error;
  }
};

const retryRequest = async (requestFn, endpointOrRetries = 3, delay = 1000, endpoint = '') => {
  let retries = 3;
  if (typeof endpointOrRetries === 'string') {
    endpoint = endpointOrRetries;
  } else {
    retries = endpointOrRetries;
  }

  for (let i = 0; i < retries; i++) {
    try {
      return await runWithFallback(requestFn, endpoint);
    } catch (error) {
      if (i === retries - 1) throw error;
      
      if (error.response?.status >= 500 || !error.response) {
        await new Promise(resolve => setTimeout(resolve, delay * Math.pow(2, i)));
      } else {
        throw error;
      }
    }
  }
};

axiosInstance.interceptors.response.use(
  (response) => response,
  (error) => {
    if (axios.isCancel(error)) {
      console.log('Request cancelled:', error.message);
      return Promise.reject({ cancelled: true, message: 'Request cancelled' });
    }
    
    if (!error.response) {
      console.error('Network error:', error.message);
      return Promise.reject({
        message: 'Network error. Please check your connection.',
        error,
      });
    }
    
    return Promise.reject(error);
  }
);

export const ticketAPI = {
  createTicket: (ticketData, signal) => {
    return retryRequest(() => axiosInstance.post('/tickets', ticketData, { signal }), '/tickets');
  },

  getAllTickets: (filters = {}, signal) => {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([key, value]) => {
      if (value) params.append(key, value);
    });
    return retryRequest(() => 
      axiosInstance.get(`/tickets?${params.toString()}`, { signal })
    , '/tickets');
  },

  getTicketById: (ticketId, signal) => {
    return retryRequest(() => axiosInstance.get(`/tickets/${ticketId}`, { signal }), `/tickets/${ticketId}`);
  },

  getUserTickets: (userId, signal) => {
    return retryRequest(() => axiosInstance.get(`/user/${userId}/tickets`, { signal }), '/tickets');
  },

  updateTicketStatus: (ticketId, status) => {
    return axiosInstance.patch(`/tickets/${ticketId}/status`, { status });
  },

  addTicketResponse: (ticketId, message) => {
    return axiosInstance.post(`/tickets/${ticketId}/response`, { message });
  },

  getDashboardStats: (signal) => {
    return retryRequest(() => axiosInstance.get('/dashboard/stats', { signal }), '/dashboard/stats');
  },
};

export const analysisAPI = {
  analyzeSingleTicket: (ticketId, signal) => {
    return axiosInstance.post(`/analysis/analyze/${ticketId}`, {}, { signal });
  },

  analyzeAllTickets: (signal) => {
    return axiosInstance.post('/analysis/analyze-all', {}, { signal });
  },

  getDepartmentStats: (signal) => {
    return retryRequest(() => axiosInstance.get('/analysis/departments/stats', { signal }), '/analysis/departments/stats');
  },

  getTicketsByDepartment: (department, signal) => {
    return retryRequest(() => 
      axiosInstance.get(`/analysis/departments/${department}`, { signal })
    , '/analysis/departments/stats');
  },
};

export const geminiAPI = {
  transcribeImage: (imageUrl, signal) => {
    return axiosInstance.post('/gemini/transcribe', { imageUrl }, { signal });
  },

  analyzeTicket: (ticketId, query, signal) => {
    return axiosInstance.post('/gemini/analyze', { ticketId, query }, { signal });
  },
};

export const imageAPI = {
  getTicketImages: (ticketId, signal) => {
    return retryRequest(() => axiosInstance.get(`/images/ticket/${ticketId}`, { signal }), `/images/ticket/${ticketId}`);
  },

  getUserImages: (userId, signal) => {
    return retryRequest(() => axiosInstance.get(`/images/user/${userId}`, { signal }), `/images/user/${userId}`);
  },

  deleteImage: (imageId) => {
    return axiosInstance.delete(`/images/${imageId}`);
  },
};

export { createAbortController };
export default axiosInstance;
