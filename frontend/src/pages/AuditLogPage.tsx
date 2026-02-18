import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuditLogs } from '../hooks';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
import type { AuditLogsQuery } from '../api/audit';

export default function AuditLogPage() {
  const [filters, setFilters] = useState<AuditLogsQuery>({
    limit: 100,
    offset: 0,
  });
  const { data: logs, isLoading, error } = useAuditLogs(filters);

  const handleFilterChange = (key: keyof AuditLogsQuery, value: string | number | undefined) => {
    setFilters((prev) => ({
      ...prev,
      [key]: value || undefined,
      offset: 0, // Reset offset when filters change
    }));
  };

  const formatDetails = (changes: unknown, metadata: unknown, action: string): unknown => {
    // For MOVE actions, metadata contains the move information
    if (action === 'MOVE' && metadata) {
      return metadata;
    }
    // For UPDATE actions, changes contains the field changes
    if (action === 'UPDATE' && changes) {
      return changes;
    }
    // For other actions, prefer metadata if available, otherwise changes
    return metadata || changes || null;
  };

  const formatJson = (data: unknown): string | null => {
    if (!data) return null;
    if (typeof data === 'object') {
      return JSON.stringify(data, null, 2);
    }
    return String(data);
  };

  const getEntityLink = (entityType: string, entityId: string): string => {
    switch (entityType) {
      case 'room':
        return `/rooms/${entityId}/edit`;
      case 'shelving_unit':
        return `/units/${entityId}/edit`;
      case 'shelf':
        return `/shelves/${entityId}/edit`;
      case 'container':
        return `/containers/${entityId}/edit`;
      case 'item':
        return `/items/${entityId}/edit`;
      default:
        return '#';
    }
  };

  const getEntityDisplayName = (entityType: string): string => {
    switch (entityType) {
      case 'room':
        return 'Room';
      case 'shelving_unit':
        return 'Unit';
      case 'shelf':
        return 'Shelf';
      case 'container':
        return 'Container';
      case 'item':
        return 'Item';
      default:
        return entityType;
    }
  };

  const getActionBadgeClass = (action: string): string => {
    switch (action) {
      case 'CREATE':
        return 'bg-green-100 text-green-800';
      case 'UPDATE':
        return 'bg-blue-100 text-blue-800';
      case 'DELETE':
        return 'bg-red-100 text-red-800';
      case 'MOVE':
        return 'bg-purple-100 text-purple-800';
      default:
        return 'bg-secondary text-secondary-foreground';
    }
  };

  if (isLoading) return <div className="text-center py-12 text-muted-foreground">Loading audit logs...</div>;
  if (error) return <div className="text-destructive">Error: {error.message}</div>;

  return (
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">Audit Logs</h1>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <div className="flex flex-wrap gap-4">
            <div className="space-y-2 min-w-[150px]">
              <Label htmlFor="filter-entity-type">Entity Type</Label>
              <select
                id="filter-entity-type"
                value={filters.entity_type || ''}
                onChange={(e) => handleFilterChange('entity_type', e.target.value || undefined)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              >
                <option value="">All</option>
                <option value="room">Room</option>
                <option value="shelving_unit">Shelving Unit</option>
                <option value="shelf">Shelf</option>
                <option value="container">Container</option>
                <option value="item">Item</option>
              </select>
            </div>

            <div className="space-y-2 min-w-[150px]">
              <Label htmlFor="filter-action">Action</Label>
              <select
                id="filter-action"
                value={filters.action || ''}
                onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring md:text-sm"
              >
                <option value="">All</option>
                <option value="CREATE">Create</option>
                <option value="UPDATE">Update</option>
                <option value="DELETE">Delete</option>
                <option value="MOVE">Move</option>
              </select>
            </div>

            <div className="space-y-2 min-w-[100px]">
              <Label htmlFor="filter-limit">Limit</Label>
              <Input
                id="filter-limit"
                type="number"
                value={filters.limit || 100}
                onChange={(e) => handleFilterChange('limit', parseInt(e.target.value, 10))}
                min="1"
                max="1000"
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Audit Logs Table */}
      <Card>
        <CardContent className="p-6">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border">
                  <th className="text-left py-3 px-2 font-medium">Timestamp</th>
                  <th className="text-left py-3 px-2 font-medium">Entity</th>
                  <th className="text-left py-3 px-2 font-medium">Action</th>
                  <th className="text-left py-3 px-2 font-medium">User</th>
                  <th className="text-left py-3 px-2 font-medium">Details</th>
                </tr>
              </thead>
              <tbody>
                {logs?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="text-center py-12 text-muted-foreground">
                      No audit logs found
                    </td>
                  </tr>
                ) : (
                  logs?.map((log) => {
                    const details = formatDetails(log.changes, log.metadata, log.action);
                    const entityLink = getEntityLink(log.entity_type, log.entity_id);

                    return (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/50">
                        <td className="py-3 px-2">{new Date(log.created_at).toLocaleString()}</td>
                        <td className="py-3 px-2">
                          <Link
                            to={entityLink}
                            className="text-primary hover:underline font-medium"
                          >
                            {getEntityDisplayName(log.entity_type)}
                            <span className="text-muted-foreground ml-2 font-normal">
                              <code className="text-xs">
                                {log.entity_id.substring(0, 8)}...
                              </code>
                            </span>
                          </Link>
                        </td>
                        <td className="py-3 px-2">
                          <span
                            className={`px-2 py-0.5 rounded text-xs font-medium ${getActionBadgeClass(log.action)}`}
                          >
                            {log.action}
                          </span>
                        </td>
                        <td className="py-3 px-2">
                          {log.user_name || (log.user_id ? (
                            <code className="text-xs text-muted-foreground">
                              {log.user_id.substring(0, 8)}...
                            </code>
                          ) : (
                            '-'
                          ))}
                        </td>
                        <td className="py-3 px-2">
                          {details ? (
                            <details>
                              <summary className="cursor-pointer text-primary hover:underline">
                                {log.action === 'MOVE' ? 'View Move Details' :
                                 log.action === 'UPDATE' ? 'View Changes' :
                                 'View Details'}
                              </summary>
                              <pre className="mt-2 p-2 bg-muted rounded text-xs max-h-[200px] overflow-auto whitespace-pre-wrap break-words">
                                {formatJson(details)}
                              </pre>
                            </details>
                          ) : (
                            '-'
                          )}
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
