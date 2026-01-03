import { QRCodeSVG } from 'qrcode.react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBatch, useDownloadLabelPdf } from '../hooks';

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const { data: batch, isLoading, error } = useBatch(batchId || '');
  const downloadPdf = useDownloadLabelPdf();
  const navigate = useNavigate();

  const getLabelLink = (label: { assigned_to_type?: string; assigned_to_id?: string }): string | null => {
    if (!label.assigned_to_type || !label.assigned_to_id) {
      return null;
    }

    switch (label.assigned_to_type) {
      case 'room':
        return `/rooms/${label.assigned_to_id}/edit`;
      case 'shelving_unit':
        return `/units/${label.assigned_to_id}/edit`;
      case 'shelf':
        return `/shelves/${label.assigned_to_id}/edit`;
      case 'container':
        return `/containers/${label.assigned_to_id}/edit`;
      case 'item':
        return `/items/${label.assigned_to_id}/edit`;
      default:
        return null;
    }
  };

  const handleReprint = async () => {
    if (!batchId) return;

    try {
      const blob = await downloadPdf.mutateAsync({
        batchId,
        template: 'avery_18660',
      });

      // Create object URL and open in browser
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up after a delay
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to download PDF. Please try again.');
    }
  };

  if (isLoading) {
    return (
      <div className="page">
        <div className="loading">Loading batch details...</div>
      </div>
    );
  }

  if (error || !batch) {
    return (
      <div className="page">
        <div className="error">
          {error ? `Error: ${error.message}` : 'Batch not found'}
        </div>
        <Link to="/labels" className="btn btn-primary" style={{ marginTop: '1rem' }}>
          Back to Labels
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', marginBottom: '1rem' }}>
            <Link to="/labels" className="btn btn-secondary btn-sm">
              ← Back
            </Link>
            <h1 style={{ margin: 0 }}>Batch Details</h1>
          </div>
          <div style={{ display: 'flex', gap: '2rem', flexWrap: 'wrap', marginBottom: '1.5rem' }}>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Batch ID:</span>
              <br />
              <code style={{ fontSize: '0.875rem', background: 'var(--bg-color)', padding: '0.25rem 0.5rem', borderRadius: '0.25rem' }}>
                {batch.batch_id}
              </code>
            </div>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Created:</span>
              <br />
              <span style={{ fontSize: '0.875rem' }}>{new Date(batch.created_at).toLocaleString()}</span>
            </div>
            <div>
              <span style={{ fontSize: '0.875rem', color: 'var(--text-secondary)' }}>Labels:</span>
              <br />
              <span style={{ fontSize: '0.875rem', fontWeight: 600 }}>{batch.labels.length}</span>
            </div>
          </div>
          <div>
            <button
              className="btn btn-primary"
              onClick={handleReprint}
              disabled={downloadPdf.isPending}
            >
              {downloadPdf.isPending ? 'Generating PDF...' : '🖨️ Re-print PDF'}
            </button>
          </div>
        </div>
      </div>

      <div className="form">
        <h2 style={{ marginBottom: '1.5rem' }}>
          QR Code Labels
        </h2>
        {batch.labels.length === 0 ? (
          <div className="empty-state">No labels in this batch.</div>
        ) : (
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))',
              gap: '1.5rem',
            }}
          >
            {batch.labels.map((label) => {
              const labelLink = getLabelLink(label);
              const isClickable = labelLink !== null;
              
              return (
                <div
                  key={label.id}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    gap: '1rem',
                    padding: '1.5rem',
                    background: 'var(--surface-color)',
                    borderRadius: '0.75rem',
                    border: '2px solid var(--border-color)',
                    boxShadow: 'var(--shadow)',
                    transition: 'all 0.2s',
                    cursor: isClickable ? 'pointer' : 'default',
                  }}
                  onClick={() => {
                    if (labelLink) {
                      navigate(labelLink);
                    }
                  }}
                  onMouseEnter={(e) => {
                    if (isClickable) {
                      e.currentTarget.style.transform = 'translateY(-4px)';
                      e.currentTarget.style.boxShadow = 'var(--shadow-lg)';
                      e.currentTarget.style.borderColor = 'var(--primary-color)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (isClickable) {
                      e.currentTarget.style.transform = 'translateY(0)';
                      e.currentTarget.style.boxShadow = 'var(--shadow)';
                      e.currentTarget.style.borderColor = 'var(--border-color)';
                    }
                  }}
                >
                <div
                  style={{
                    padding: '0.75rem',
                    background: 'white',
                    borderRadius: '0.5rem',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <QRCodeSVG
                    value={label.qr_data}
                    size={140}
                    level="M"
                    includeMargin={true}
                  />
                </div>
                <div style={{ textAlign: 'center', width: '100%' }}>
                  <div
                    style={{
                      fontSize: '1rem',
                      fontWeight: 700,
                      marginBottom: '0.5rem',
                      color: isClickable ? 'var(--primary-color)' : 'var(--text-color)',
                      textDecoration: isClickable ? 'underline' : 'none',
                    }}
                  >
                    #{label.number}
                  </div>
                  {label.assigned_to_type && label.assigned_to_id ? (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        padding: '0.25rem 0.5rem',
                        background: 'var(--bg-color)',
                        borderRadius: '0.25rem',
                        display: 'inline-block',
                      }}
                    >
                      ✓ Assigned to {label.assigned_to_type}
                      {isClickable && (
                        <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem' }}>
                          (click to view)
                        </span>
                      )}
                    </div>
                  ) : (
                    <div
                      style={{
                        fontSize: '0.75rem',
                        color: 'var(--text-secondary)',
                        fontStyle: 'italic',
                      }}
                    >
                      Unassigned
                    </div>
                  )}
                </div>
              </div>
            );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
