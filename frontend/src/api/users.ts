import apiClient from './client';
import type { User } from '../types/generated';

export const usersApi = {
  // Get all users (with optional search)
  getAll: async (search?: string): Promise<User[]> => {
    const response = await apiClient.get<User[]>('/api/users', {
      params: search ? { search } : undefined,
    });
    return response.data;
  },
};
