import apiClient from './client';
import type {
  ContainerResponse,
  CreateContainerRequest,
  UpdateContainerRequest,
} from '../types/generated';

export const containersApi = {
  // Get all containers
  getAll: async (): Promise<ContainerResponse[]> => {
    const response = await apiClient.get<ContainerResponse[]>('/api/containers');
    return response.data;
  },

  // Get containers by shelf
  getByShelf: async (shelfId: string): Promise<ContainerResponse[]> => {
    const response = await apiClient.get<ContainerResponse[]>(
      `/api/shelves/${shelfId}/containers`
    );
    return response.data;
  },

  // Get containers by parent
  getByParent: async (parentId: string): Promise<ContainerResponse[]> => {
    const response = await apiClient.get<ContainerResponse[]>(
      `/api/containers/${parentId}/children`
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
