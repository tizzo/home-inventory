import apiClient from './client';
import type {
  TagResponse,
  CreateTagRequest,
  UpdateTagRequest,
  AssignTagsRequest,
  BulkAssignTagsRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export const tagsApi = {
  // List all tags
  list: async (params?: PaginationQuery): Promise<PaginatedResponse<TagResponse>> => {
    const response = await apiClient.get<PaginatedResponse<TagResponse>>('/api/tags', { params });
    return response.data;
  },

  // Get a single tag by ID
  getById: async (id: string): Promise<TagResponse> => {
    const response = await apiClient.get<TagResponse>(`/api/tags/${id}`);
    return response.data;
  },

  // Create a new tag
  create: async (data: CreateTagRequest): Promise<TagResponse> => {
    const response = await apiClient.post<TagResponse>('/api/tags', data);
    return response.data;
  },

  // Update a tag
  update: async (id: string, data: UpdateTagRequest): Promise<TagResponse> => {
    const response = await apiClient.put<TagResponse>(`/api/tags/${id}`, data);
    return response.data;
  },

  // Delete a tag
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/tags/${id}`);
  },

  // Get tags for a specific entity
  getEntityTags: async (entityType: string, entityId: string): Promise<TagResponse[]> => {
    const response = await apiClient.get<TagResponse[]>(
      `/api/tags/entity/${entityType}/${entityId}`
    );
    return response.data;
  },

  // Assign tags to an entity
  assignTags: async (data: AssignTagsRequest): Promise<void> => {
    await apiClient.post('/api/tags/assign', data);
  },

  // Bulk assign tags to multiple entities
  bulkAssignTags: async (data: BulkAssignTagsRequest): Promise<void> => {
    await apiClient.post('/api/tags/bulk-assign', data);
  },
};
