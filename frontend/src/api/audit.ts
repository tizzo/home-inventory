import apiClient from './client';
import type { AuditLogResponse } from '../types/generated';

export interface AuditLogsQuery {
  entity_type?: string;
  entity_id?: string;
  user_id?: string;
  action?: string;
  limit?: number;
  offset?: number;
}

export const auditApi = {
  // Get audit logs with optional filters
  getLogs: async (params?: AuditLogsQuery): Promise<AuditLogResponse[]> => {
    const queryParams = new URLSearchParams();
    if (params?.entity_type) queryParams.append('entity_type', params.entity_type);
    if (params?.entity_id) queryParams.append('entity_id', params.entity_id);
    if (params?.user_id) queryParams.append('user_id', params.user_id);
    if (params?.action) queryParams.append('action', params.action);
    if (params?.limit) queryParams.append('limit', params.limit.toString());
    if (params?.offset) queryParams.append('offset', params.offset.toString());

    const url = `/api/audit${queryParams.toString() ? `?${queryParams.toString()}` : ''}`;
    const response = await apiClient.get<AuditLogResponse[]>(url);
    return response.data;
  },

  // Get audit logs for a specific entity
  getByEntity: async (
    entityType: string,
    entityId: string
  ): Promise<AuditLogResponse[]> => {
    const response = await apiClient.get<AuditLogResponse[]>(
      `/api/audit/entity/${entityType}/${entityId}`
    );
    return response.data;
  },
};
