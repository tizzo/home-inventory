import apiClient from './client';
import type {
  ShelfResponse,
  CreateShelfRequest,
  UpdateShelfRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export const shelvesApi = {
  // Get all shelves
  getAll: async (params?: PaginationQuery): Promise<PaginatedResponse<ShelfResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ShelfResponse>>('/api/shelves', { params });
    return response.data;
  },

  // Get shelves by unit
  getByUnit: async (unitId: string, params?: PaginationQuery): Promise<PaginatedResponse<ShelfResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ShelfResponse>>(
      `/api/units/${unitId}/shelves`,
      { params }
    );
    return response.data;
  },

  // Get a single shelf by ID
  getById: async (id: string): Promise<ShelfResponse> => {
    const response = await apiClient.get<ShelfResponse>(`/api/shelves/${id}`);
    return response.data;
  },

  // Create a new shelf
  create: async (data: CreateShelfRequest): Promise<ShelfResponse> => {
    const response = await apiClient.post<ShelfResponse>('/api/shelves', data);
    return response.data;
  },

  // Update a shelf
  update: async (
    id: string,
    data: UpdateShelfRequest
  ): Promise<ShelfResponse> => {
    const response = await apiClient.put<ShelfResponse>(
      `/api/shelves/${id}`,
      data
    );
    return response.data;
  },

  // Delete a shelf
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/shelves/${id}`);
  },
};
