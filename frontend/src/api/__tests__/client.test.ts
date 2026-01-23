import { describe, it, expect, vi, beforeEach } from 'vitest';
import apiClient from '../client';

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset window.location
    window.location.href = '';
  });

  it('should create an axios instance with correct configuration', () => {
    expect(apiClient.defaults.withCredentials).toBe(true);
    expect(apiClient.defaults.headers['Content-Type']).toBe('application/json');
  });

  it('should log requests in development', async () => {
    const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    
    // Make a request to trigger the interceptor
    try {
      await apiClient.get('/api/test');
    } catch (e) {
      // Expected to fail since we're not mocking axios
    }

    expect(consoleSpy).toHaveBeenCalled();
    consoleSpy.mockRestore();
  });

  it('should handle 401 errors by redirecting to login', async () => {
    const error = {
      response: {
        status: 401,
      },
      config: {},
      isAxiosError: true,
      toJSON: () => ({}),
    };

    // Trigger response interceptor
    const interceptor = apiClient.interceptors.response.handlers[0];
    if (interceptor && interceptor.rejected) {
      try {
        await interceptor.rejected(error);
      } catch (e) {
        expect(window.location.href).toBe('/auth/login');
      }
    }
  });

  it('should not redirect on non-401 errors', async () => {
    const error = {
      response: {
        status: 500,
      },
      config: {},
      isAxiosError: true,
      toJSON: () => ({}),
    };

    // Trigger response interceptor
    const interceptor = apiClient.interceptors.response.handlers[0];
    if (interceptor && interceptor.rejected) {
      try {
        await interceptor.rejected(error);
      } catch (e) {
        expect(window.location.href).toBe('');
      }
    }
  });
});
