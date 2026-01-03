import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuditLogs } from '../hooks';
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

  if (isLoading) return <div className="loading">Loading audit logs...</div>;
  if (error) return <div className="error">Error: {error.message}</div>;

  return (
    <div className="page">
      <div className="page-header">
        <h1>Audit Logs</h1>
      </div>

      {/* Filters */}
      <div className="filters" style={{ marginBottom: '2rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
        <div className="form-group" style={{ minWidth: '150px' }}>
          <label htmlFor="filter-entity-type">Entity Type</label>
          <select
            id="filter-entity-type"
            value={filters.entity_type || ''}
            onChange={(e) => handleFilterChange('entity_type', e.target.value || undefined)}
          >
            <option value="">All</option>
            <option value="room">Room</option>
            <option value="shelving_unit">Shelving Unit</option>
            <option value="shelf">Shelf</option>
            <option value="container">Container</option>
            <option value="item">Item</option>
          </select>
        </div>

        <div className="form-group" style={{ minWidth: '150px' }}>
          <label htmlFor="filter-action">Action</label>
          <select
            id="filter-action"
            value={filters.action || ''}
            onChange={(e) => handleFilterChange('action', e.target.value || undefined)}
          >
            <option value="">All</option>
            <option value="CREATE">Create</option>
            <option value="UPDATE">Update</option>
            <option value="DELETE">Delete</option>
            <option value="MOVE">Move</option>
          </select>
        </div>

        <div className="form-group" style={{ minWidth: '100px' }}>
          <label htmlFor="filter-limit">Limit</label>
          <input
            id="filter-limit"
            type="number"
            value={filters.limit || 100}
            onChange={(e) => handleFilterChange('limit', parseInt(e.target.value, 10))}
            min="1"
            max="1000"
          />
        </div>
      </div>

      {/* Audit Logs Table */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Timestamp</th>
              <th>Entity</th>
              <th>Action</th>
              <th>User ID</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {logs?.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '2rem' }}>
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs?.map((log) => {
                const details = formatDetails(log.changes, log.metadata, log.action);
                const entityLink = getEntityLink(log.entity_type, log.entity_id);
                
                return (
                  <tr key={log.id}>
                    <td>{new Date(log.created_at).toLocaleString()}</td>
                    <td>
                      <Link
                        to={entityLink}
                        style={{
                          color: 'var(--primary-color)',
                          textDecoration: 'none',
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.textDecoration = 'underline';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.textDecoration = 'none';
                        }}
                      >
                        {getEntityDisplayName(log.entity_type)}
                        <span style={{ color: 'var(--text-secondary)', marginLeft: '0.5rem', fontWeight: 'normal' }}>
                          <code style={{ fontSize: '0.75rem' }}>
                            {log.entity_id.substring(0, 8)}...
                          </code>
                        </span>
                      </Link>
                    </td>
                    <td>
                      <span
                        className={`action-badge action-${log.action.toLowerCase()}`}
                      >
                        {log.action}
                      </span>
                    </td>
                    <td>
                      {log.user_id ? (
                        <code style={{ fontSize: '0.875rem' }}>
                          {log.user_id.substring(0, 8)}...
                        </code>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {details ? (
                        <details>
                          <summary style={{ cursor: 'pointer', color: 'var(--primary-color)' }}>
                            {log.action === 'MOVE' ? 'View Move Details' : 
                             log.action === 'UPDATE' ? 'View Changes' : 
                             'View Details'}
                          </summary>
                          <pre
                            style={{
                              marginTop: '0.5rem',
                              padding: '0.5rem',
                              background: 'var(--bg-color)',
                              borderRadius: '4px',
                              fontSize: '0.75rem',
                              maxHeight: '200px',
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
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
    </div>
  );
}
