import apiClient from './client';
import type {
  ContainerResponse,
  CreateContainerRequest,
  UpdateContainerRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export const containersApi = {
  // Get all containers
  getAll: async (params?: PaginationQuery): Promise<PaginatedResponse<ContainerResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ContainerResponse>>('/api/containers', { params });
    return response.data;
  },

  // Get containers by shelf
  getByShelf: async (shelfId: string, params?: PaginationQuery): Promise<PaginatedResponse<ContainerResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ContainerResponse>>(
      `/api/shelves/${shelfId}/containers`,
      { params }
    );
    return response.data;
  },

  // Get containers by parent
  getByParent: async (parentId: string, params?: PaginationQuery): Promise<PaginatedResponse<ContainerResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ContainerResponse>>(
      `/api/containers/${parentId}/children`,
      { params }
    );
    return response.data;
  },

  // Get a single container by ID
  getById: async (id: string): Promise<ContainerResponse> => {
    const response = await apiClient.get<ContainerResponse>(
      `/api/containers/${id}`
    );
    return response.data;
  },

  // Create a new container
  create: async (data: CreateContainerRequest): Promise<ContainerResponse> => {
    const response = await apiClient.post<ContainerResponse>(
      '/api/containers',
      data
    );
    return response.data;
  },

  // Update a container
  update: async (
    id: string,
    data: UpdateContainerRequest
  ): Promise<ContainerResponse> => {
    const response = await apiClient.put<ContainerResponse>(
      `/api/containers/${id}`,
      data
    );
    return response.data;
  },

  // Delete a container
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/containers/${id}`);
  },
};
