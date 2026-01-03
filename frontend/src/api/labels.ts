import apiClient from './client';
import type {
  LabelResponse,
  GenerateLabelsRequest,
  GenerateLabelsResponse,
  AssignLabelRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export interface BatchWithLabels {
  batch_id: string;
  labels: LabelResponse[];
  created_at: string;
}

export const labelsApi = {
  // List all batches with their labels
  listBatches: async (params?: PaginationQuery): Promise<PaginatedResponse<BatchWithLabels>> => {
    const response = await apiClient.get<PaginatedResponse<BatchWithLabels>>('/api/labels', { params });
    return response.data;
  },

  // Get a single batch by ID
  getBatchById: async (batchId: string): Promise<BatchWithLabels> => {
    // Find the batch from the list (we could add a dedicated endpoint later)
    const batchesResponse = await labelsApi.listBatches({ limit: 1000 });
    const batch = batchesResponse.data.find((b) => b.batch_id === batchId);
    if (!batch) {
      throw new Error(`Batch ${batchId} not found`);
    }
    return batch;
  },

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
