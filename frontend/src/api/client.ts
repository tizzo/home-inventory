import axios from 'axios';

const apiClient = axios.create({
  baseURL: import.meta.env.VITE_API_URL || '',
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add request interceptor for debugging
apiClient.interceptors.request.use(
  (config) => {
    console.log(`${config.method?.toUpperCase()} ${config.url}`);
    return config;
  },
  (error) => Promise.reject(error)
);

// Add response interceptor for error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Only redirect to login for protected endpoints (not public endpoints or auth check)
    const isPublicEndpoint = error.config?.url?.includes('/public') ||
                             (error.config?.url?.includes('/contact') && error.config?.method === 'post') ||
                             error.config?.url?.includes('/api/auth/me');

    if (error.response?.status === 401 && !isPublicEndpoint) {
      // Redirect to login if unauthorized
      window.location.href = '/api/auth/login';
    }
    return Promise.reject(error);
  }
);

export default apiClient;
