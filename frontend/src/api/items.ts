import apiClient from './client';
import type {
  ItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
} from '../types/generated';

export const itemsApi = {
  // Get all items
  getAll: async (): Promise<ItemResponse[]> => {
    const response = await apiClient.get<ItemResponse[]>('/api/items');
    return response.data;
  },

  // Get items by shelf
  getByShelf: async (shelfId: string): Promise<ItemResponse[]> => {
    const response = await apiClient.get<ItemResponse[]>(
      `/api/shelves/${shelfId}/items`
    );
    return response.data;
  },

  // Get items by container
  getByContainer: async (containerId: string): Promise<ItemResponse[]> => {
    const response = await apiClient.get<ItemResponse[]>(
      `/api/containers/${containerId}/items`
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
