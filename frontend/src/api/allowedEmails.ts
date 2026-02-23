import apiClient from './client';
import type { AllowedEmailResponse, CreateAllowedEmailRequest } from '../types/generated';

export const allowedEmailsApi = {
  list: async (): Promise<AllowedEmailResponse[]> => {
    const response = await apiClient.get<AllowedEmailResponse[]>('/api/allowed-emails');
    return response.data;
  },

  add: async (data: CreateAllowedEmailRequest): Promise<AllowedEmailResponse> => {
    const response = await apiClient.post<AllowedEmailResponse>('/api/allowed-emails', data);
    return response.data;
  },

  remove: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/allowed-emails/${id}`);
  },
};
