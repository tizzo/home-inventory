import apiClient from './client';
import type {
  PhotoResponse,
  CreatePhotoRequest,
  PresignedUploadUrl,
} from '../types/generated';

export const photosApi = {
  // Get presigned upload URL
  getUploadUrl: async (
    entityType: string,
    entityId: string,
    contentType: string
  ): Promise<PresignedUploadUrl> => {
    const response = await apiClient.post<PresignedUploadUrl>(
      `/api/photos/upload-url?entity_type=${entityType}&entity_id=${entityId}`,
      { content_type: contentType }
    );
    return response.data;
  },

  // Get all photos for an entity
  getByEntity: async (
    entityType: string,
    entityId: string
  ): Promise<PhotoResponse[]> => {
    const response = await apiClient.get<PhotoResponse[]>(
      `/api/photos?entity_type=${entityType}&entity_id=${entityId}`
    );
    return response.data;
  },

  // Create photo record after upload
  create: async (data: CreatePhotoRequest): Promise<PhotoResponse> => {
    const response = await apiClient.post<PhotoResponse>('/api/photos', data);
    return response.data;
  },

  // Get a single photo by ID
  getById: async (id: string): Promise<PhotoResponse> => {
    const response = await apiClient.get<PhotoResponse>(`/api/photos/${id}`);
    return response.data;
  },

  // Delete a photo
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/photos/${id}`);
  },
};
