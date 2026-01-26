import apiClient from './client';
import type {
  ContactSubmissionResponse,
  CreateContactSubmissionRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

export const contactApi = {
  // Create a new contact submission (public endpoint)
  create: async (data: CreateContactSubmissionRequest): Promise<ContactSubmissionResponse> => {
    const response = await apiClient.post<ContactSubmissionResponse>('/api/contact', data);
    return response.data;
  },

  // List all contact submissions (protected endpoint)
  getAll: async (params?: PaginationQuery): Promise<PaginatedResponse<ContactSubmissionResponse>> => {
    const response = await apiClient.get<PaginatedResponse<ContactSubmissionResponse>>(
      '/api/contact',
      { params }
    );
    return response.data;
  },
};
