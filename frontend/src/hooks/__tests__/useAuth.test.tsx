import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import { useAuth } from '../useAuth';
import { createTestQueryClient } from '../../test/utils';
import { mockUser } from '../../test/mockData';
import apiClient from '../../api/client';

// Mock the apiClient module to prevent interceptor setup issues
vi.mock('../../api/client', () => ({
  default: {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
  },
}));

const mockedApiClient = vi.mocked(apiClient);

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('useAuth', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  it('should fetch user successfully', async () => {
    mockedApiClient.get.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

    expect(result.current.isLoading).toBe(true);
    expect(result.current.user).toBeUndefined();

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toEqual(mockUser);
    expect(mockedApiClient.get).toHaveBeenCalledWith('/api/auth/me');
  });

  it('should return null when user fetch fails', async () => {
    mockedApiClient.get.mockRejectedValue(new Error('Not authenticated'));

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.isLoading).toBe(false);
    });

    expect(result.current.user).toBeNull();
  });

  it('should logout user successfully', async () => {
    mockedApiClient.post.mockResolvedValue({});
    mockedApiClient.get.mockResolvedValue({ data: mockUser });

    const { result } = renderHook(() => useAuth(), {
      wrapper: createWrapper(queryClient),
    });

    await waitFor(() => {
      expect(result.current.user).toBeDefined();
    });

    result.current.logout();

    await waitFor(() => {
      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/auth/logout');
    });

    // Check that user data is cleared
    await waitFor(() => {
      const userData = queryClient.getQueryData(['auth', 'user']);
      expect(userData).toBeNull();
    });
  });
});
