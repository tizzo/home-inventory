import apiClient from './client';
import type {
  ItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export const itemsApi = {
  // Get all items
  getAll: async (params?: PaginationQuery): Promise<PaginatedResponse<ItemResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ItemResponse>>('/api/items', { params });
    return response.data;
  },

  // Get items by shelf
  getByShelf: async (shelfId: string, params?: PaginationQuery): Promise<PaginatedResponse<ItemResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ItemResponse>>(
      `/api/shelves/${shelfId}/items`,
      { params }
    );
    return response.data;
  },

  // Get items by container
  getByContainer: async (containerId: string, params?: PaginationQuery): Promise<PaginatedResponse<ItemResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ItemResponse>>(
      `/api/containers/${containerId}/items`,
      { params }
    );
    return response.data;
  },

  // Get a single item by ID
  getById: async (id: string): Promise<ItemResponse> => {
    const response = await apiClient.get<ItemResponse>(`/api/items/${id}`);
    return response.data;
  },

  // Get item by barcode
  getByBarcode: async (barcode: string): Promise<ItemResponse> => {
    const response = await apiClient.get<ItemResponse>(
      `/api/items/barcode/${encodeURIComponent(barcode)}`
    );
    return response.data;
  },

  // Create a new item
  create: async (data: CreateItemRequest): Promise<ItemResponse> => {
    const response = await apiClient.post<ItemResponse>('/api/items', data);
    return response.data;
  },

  // Update an item
  update: async (
    id: string,
    data: UpdateItemRequest
  ): Promise<ItemResponse> => {
    const response = await apiClient.put<ItemResponse>(`/api/items/${id}`, data);
    return response.data;
  },

  // Delete an item
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/items/${id}`);
  },
};
