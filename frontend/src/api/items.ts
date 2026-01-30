import apiClient from './client';
import type {
  ItemResponse,
  PublicItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

interface PresignedUploadUrl {
  upload_url: string;
  s3_key: string;
}

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

  // Get public item view (no authentication required)
  getPublic: async (id: string): Promise<PublicItemResponse> => {
    const response = await apiClient.get<PublicItemResponse>(`/api/items/${id}/public`);
    return response.data;
  },

  // Get presigned URL for file upload (manual or receipt)
  getFileUploadUrl: async (
    fileType: 'manual' | 'receipt',
    contentType: string
  ): Promise<PresignedUploadUrl> => {
    const response = await apiClient.post<PresignedUploadUrl>(
      `/api/items/file-upload-url`,
      { file_type: fileType, content_type: contentType }
    );
    return response.data;
  },

  // Get presigned URL for file download
  getFileDownloadUrl: async (s3Key: string): Promise<string> => {
    const response = await apiClient.post<{ download_url: string }>(
      `/api/items/file-download-url`,
      { s3_key: s3Key }
    );
    return response.data.download_url;
  },
};
