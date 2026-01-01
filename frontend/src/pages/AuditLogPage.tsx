import { useState } from 'react';
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

  const formatChanges = (changes: any) => {
    if (!changes) return null;
    if (typeof changes === 'object') {
      return JSON.stringify(changes, null, 2);
    }
    return String(changes);
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
              <th>Entity Type</th>
              <th>Entity ID</th>
              <th>Action</th>
              <th>User ID</th>
              <th>Changes</th>
              <th>Metadata</th>
            </tr>
          </thead>
          <tbody>
            {logs?.length === 0 ? (
              <tr>
                <td colSpan={7} style={{ textAlign: 'center', padding: '2rem' }}>
                  No audit logs found
                </td>
              </tr>
            ) : (
              logs?.map((log) => (
                <tr key={log.id}>
                  <td>{new Date(log.created_at).toLocaleString()}</td>
                  <td>{log.entity_type}</td>
                  <td>
                    <code style={{ fontSize: '0.875rem' }}>
                      {log.entity_id.substring(0, 8)}...
                    </code>
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
                    {log.changes ? (
                      <details>
                        <summary style={{ cursor: 'pointer', color: 'var(--primary-color)' }}>
                          View Changes
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
                          }}
                        >
                          {formatChanges(log.changes)}
                        </pre>
                      </details>
                    ) : (
                      '-'
                    )}
                  </td>
                  <td>
                    {log.metadata ? (
                      <details>
                        <summary style={{ cursor: 'pointer', color: 'var(--primary-color)' }}>
                          View Metadata
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
                          }}
                        >
                          {formatChanges(log.metadata)}
                        </pre>
                      </details>
                    ) : (
                      '-'
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
