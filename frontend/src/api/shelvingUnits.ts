import apiClient from './client';
import type {
  ShelvingUnitResponse,
  CreateShelvingUnitRequest,
  UpdateShelvingUnitRequest,
} from '../types/generated';

export const shelvingUnitsApi = {
  // Get all shelving units
  getAll: async (): Promise<ShelvingUnitResponse[]> => {
    const response =
      await apiClient.get<ShelvingUnitResponse[]>('/api/units');
    return response.data;
  },

  // Get shelving units in a specific room
  getByRoom: async (roomId: string): Promise<ShelvingUnitResponse[]> => {
    const response = await apiClient.get<ShelvingUnitResponse[]>(
      `/api/rooms/${roomId}/units`
    );
    return response.data;
  },

  // Get a single shelving unit by ID
  getById: async (id: string): Promise<ShelvingUnitResponse> => {
    const response = await apiClient.get<ShelvingUnitResponse>(
      `/api/units/${id}`
    );
    return response.data;
  },

  // Create a new shelving unit
  create: async (
    data: CreateShelvingUnitRequest
  ): Promise<ShelvingUnitResponse> => {
    const response = await apiClient.post<ShelvingUnitResponse>(
      '/api/units',
      data
    );
    return response.data;
  },

  // Update a shelving unit
  update: async (
    id: string,
    data: UpdateShelvingUnitRequest
  ): Promise<ShelvingUnitResponse> => {
    const response = await apiClient.put<ShelvingUnitResponse>(
      `/api/units/${id}`,
      data
    );
    return response.data;
  },

  // Delete a shelving unit
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/units/${id}`);
  },
};
