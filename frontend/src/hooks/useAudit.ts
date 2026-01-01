import { useQuery } from '@tanstack/react-query';
import { auditApi, type AuditLogsQuery } from '../api/audit';
import type { AuditLogResponse } from '../types/generated';

// Get audit logs with optional filters
export const useAuditLogs = (params?: AuditLogsQuery) => {
  return useQuery<AuditLogResponse[], Error>({
    queryKey: ['audit-logs', params],
    queryFn: () => auditApi.getLogs(params),
  });
};

// Get audit logs for a specific entity
export const useAuditLogsByEntity = (entityType: string, entityId: string) => {
  return useQuery<AuditLogResponse[], Error>({
    queryKey: ['audit-logs', 'entity', entityType, entityId],
    queryFn: () => auditApi.getByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
};
