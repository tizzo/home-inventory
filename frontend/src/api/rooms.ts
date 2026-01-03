import apiClient from './client';
import type {
  RoomResponse,
  CreateRoomRequest,
  UpdateRoomRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export const roomsApi = {
  // Get all rooms
  getAll: async (params?: PaginationQuery): Promise<PaginatedResponse<RoomResponse>> => {
    const response = await apiClient.get<PaginatedResponse<RoomResponse>>('/api/rooms', {
      params,
    });
    return response.data;
  },

  // Get a single room by ID
  getById: async (id: string): Promise<RoomResponse> => {
    const response = await apiClient.get<RoomResponse>(`/api/rooms/${id}`);
    return response.data;
  },

  // Create a new room
  create: async (data: CreateRoomRequest): Promise<RoomResponse> => {
    const response = await apiClient.post<RoomResponse>('/api/rooms', data);
    return response.data;
  },

  // Update a room
  update: async (
    id: string,
    data: UpdateRoomRequest
  ): Promise<RoomResponse> => {
    const response = await apiClient.put<RoomResponse>(
      `/api/rooms/${id}`,
      data
    );
    return response.data;
  },

  // Delete a room
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/rooms/${id}`);
  },
};
