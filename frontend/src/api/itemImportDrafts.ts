import apiClient from './client';
import type {
  ItemImportDraftResponse,
  CreateItemImportDraftRequest,
  UpdateItemImportDraftRequest,
  CommitItemImportDraftResponse,
  AnalyzePhotoRequest,
} from '../types/generated';

export const itemImportDraftsApi = {
  // Get a draft by ID
  getById: async (id: string): Promise<ItemImportDraftResponse> => {
    const response = await apiClient.get<ItemImportDraftResponse>(
      `/api/item-import-drafts/${id}`
    );
    return response.data;
  },

  // Create a new draft
  create: async (
    data: CreateItemImportDraftRequest
  ): Promise<ItemImportDraftResponse> => {
    const response = await apiClient.post<ItemImportDraftResponse>(
      '/api/item-import-drafts',
      data
    );
    return response.data;
  },

  // Update a draft
  update: async (
    id: string,
    data: UpdateItemImportDraftRequest
  ): Promise<ItemImportDraftResponse> => {
    const response = await apiClient.put<ItemImportDraftResponse>(
      `/api/item-import-drafts/${id}`,
      data
    );
    return response.data;
  },

  // Commit a draft (creates the items)
  commit: async (id: string): Promise<CommitItemImportDraftResponse> => {
    const response = await apiClient.post<CommitItemImportDraftResponse>(
      `/api/item-import-drafts/${id}/commit`
    );
    return response.data;
  },

  // Analyze a photo with AI and create a draft
  analyzePhoto: async (
    data: AnalyzePhotoRequest
  ): Promise<ItemImportDraftResponse> => {
    const response = await apiClient.post<ItemImportDraftResponse>(
      '/api/item-import-drafts/analyze',
      data
    );
    return response.data;
  },
};
