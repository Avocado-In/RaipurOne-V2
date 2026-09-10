import axios from 'axios';
import { getOfflinePayload } from './offlineData';
import { getStoredToken } from './context/AuthContext';

const API_URL = process.env.REACT_APP_API_URL || 'http://127.0.0.1:8000';

const axiosInstance = axios.create({
  baseURL: API_URL,
  timeout: 10000,
  headers: {
    'Content-Type': 'application/json',
  },
});

axiosInstance.interceptors.request.use((config) => {
  const token = getStoredToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});

const createAbortController = () => new AbortController();

// Serving invented civic data when the backend is unreachable used to be silent - an
// operator saw fabricated tickets and stats with only a console warning as the tell.
// It is now opt-in via REACT_APP_ALLOW_DEMO_DATA and always announced on screen.
const DEMO_DATA_ENABLED = process.env.REACT_APP_ALLOW_DEMO_DATA === 'true';

export const DEMO_MODE_EVENT = 'raipurone:demo-data-served';

const shouldUseOfflineFallback = (endpoint) => {
  if (!DEMO_DATA_ENABLED) return false;
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
      // Tell the UI so it can show a banner; fake data must never look real.
      window.dispatchEvent(new CustomEvent(DEMO_MODE_EVENT, { detail: { endpoint } }));
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

export const complaintAPI = {
  getAllComplaints: (signal) => {
    return retryRequest(() => axiosInstance.get('/complaints', { signal }), '/complaints');
  },
  getComplaintById: (complaintId, signal) => {
    return retryRequest(() => axiosInstance.get(`/complaints/${complaintId}`, { signal }), `/complaints/${complaintId}`);
  },
  createComplaint: (complaintData) => {
    return axiosInstance.post('/complaints/json', complaintData);
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

// Worker endpoints require a staff token. Callers used to reach these with bare axios
// (and, in one place, the wrong /api/... prefix), so they came back 401/404 and the
// assignment UI silently showed an empty worker list.
export const workerAPI = {
  getAvailable: (department, category, signal) => {
    return axiosInstance.get('/workers/available', { params: { department, category }, signal });
  },

  assign: (assignmentData, signal) => {
    return axiosInstance.post('/workers/assign', assignmentData, { signal });
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
