import apiClient from './client';
import type {
  LabelResponse,
  GenerateLabelsRequest,
  GenerateLabelsResponse,
  AssignLabelRequest,
} from '../types/generated';

export const labelsApi = {
  // Generate a batch of labels
  generate: async (
    data: GenerateLabelsRequest
  ): Promise<GenerateLabelsResponse> => {
    const response = await apiClient.post<GenerateLabelsResponse>(
      '/api/labels/generate',
      data
    );
    return response.data;
  },

  // Get a single label by ID
  getById: async (id: string): Promise<LabelResponse> => {
    const response = await apiClient.get<LabelResponse>(`/api/labels/${id}`);
    return response.data;
  },

  // Assign a label to an entity
  assign: async (
    id: string,
    data: AssignLabelRequest
  ): Promise<LabelResponse> => {
    const response = await apiClient.post<LabelResponse>(
      `/api/labels/${id}/assign`,
      data
    );
    return response.data;
  },

  // Download PDF for a batch of labels
  downloadPdf: async (batchId: string, template?: string): Promise<Blob> => {
    const params = template ? { template } : {};
    const response = await apiClient.get(`/api/labels/print/${batchId}`, {
      params,
      responseType: 'blob', // Important: tell axios to handle binary data
    });
    return response.data;
  },
};
