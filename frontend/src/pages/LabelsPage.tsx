import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGenerateLabels, useDownloadLabelPdf, useBatches } from '../hooks';
import { Pagination } from '../components';
import type { GenerateLabelsRequest } from '../types/generated';

export default function LabelsPage() {
  const generateLabels = useGenerateLabels();
  const downloadPdf = useDownloadLabelPdf();
  const [pagination, setPagination] = useState({ limit: 50, offset: 0 });
  const { data: batchesResponse, isLoading: batchesLoading, error: batchesError } = useBatches(pagination);
  const batches = batchesResponse?.data || [];

  // Default count matches template (Avery 18660 = 30 labels per sheet)
  const [formData, setFormData] = useState<GenerateLabelsRequest>({
    count: 30,
    template: 'avery_18660',
  });

  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await generateLabels.mutateAsync(formData);
      setLastBatchId(response.batch_id);
      // Automatically download PDF after generation
      await handleDownloadPdf(response.batch_id);
    } catch (err) {
      console.error('Failed to generate labels:', err);
      alert('Failed to generate labels. Please try again.');
    }
  };

  const handleDownloadPdf = async (batchId: string) => {
    try {
      const blob = await downloadPdf.mutateAsync({
        batchId,
        template: formData.template,
      });

      // Create object URL and open in browser (will download or open based on browser settings)
      const url = window.URL.createObjectURL(blob);
      window.open(url, '_blank');

      // Clean up after a delay (browser needs time to open the URL)
      setTimeout(() => {
        window.URL.revokeObjectURL(url);
      }, 100);
    } catch (err) {
      console.error('Failed to download PDF:', err);
      alert('Failed to download PDF. Please try again.');
    }
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>QR Code Labels</h1>
      </div>

      <div className="form">
        <h2>Generate Labels</h2>
        <form onSubmit={handleGenerate}>
          <div className="form-group">
            <label htmlFor="count">Number of Labels *</label>
            <input
              id="count"
              type="number"
              min="1"
              max="1000"
              value={formData.count}
              onChange={(e) =>
                setFormData({ ...formData, count: parseInt(e.target.value) || 0 })
              }
              required
            />
            <small>Maximum 1000 labels per batch</small>
          </div>

          <div className="form-group">
            <label htmlFor="template">Template</label>
            <select
              id="template"
              value={formData.template || 'avery_18660'}
              onChange={(e) => {
                const newTemplate = e.target.value;
                // Update count to match template's labels per sheet
                const labelsPerSheet = newTemplate === 'avery_18660' ? 30 : 30;
                setFormData({
                  ...formData,
                  template: newTemplate,
                  count: labelsPerSheet,
                });
              }}
            >
              <option value="avery_18660">Avery 18660 (30 per sheet)</option>
            </select>
          </div>

          <div className="form-actions">
            <button
              type="submit"
              className="btn btn-primary"
              disabled={generateLabels.isPending}
            >
              {generateLabels.isPending ? 'Generating...' : 'Generate Labels'}
            </button>
          </div>
        </form>
      </div>

      {lastBatchId && (
        <div className="form" style={{ marginTop: '2rem' }}>
          <h2>Download PDF</h2>
          <p>
            Labels generated successfully! Batch ID: <code>{lastBatchId}</code>
          </p>
          <div className="form-actions">
            <button
              className="btn btn-primary"
              onClick={() => handleDownloadPdf(lastBatchId)}
              disabled={downloadPdf.isPending}
            >
              {downloadPdf.isPending ? 'Downloading...' : '📥 Download PDF'}
            </button>
          </div>
        </div>
      )}

      {/* Batches Table */}
      <div className="form" style={{ marginTop: '2rem' }}>
        <h2>Label Batches</h2>
        {batchesError ? (
          <div className="error">
            Error loading batches: {batchesError.message}
          </div>
        ) : batchesLoading ? (
          <div className="loading">Loading batches...</div>
        ) : !batches || batches.length === 0 ? (
          <div className="empty-state">No batches found. Generate labels to create a batch.</div>
        ) : (
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Batch ID</th>
                  <th>Created</th>
                  <th>Label Count</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {batches.map((batch) => (
                  <tr key={batch.batch_id}>
                    <td>
                      <code style={{ fontSize: '0.875rem' }}>
                        {batch.batch_id.substring(0, 8)}...
                      </code>
                    </td>
                    <td>{new Date(batch.created_at).toLocaleString()}</td>
                    <td>{batch.labels.length}</td>
                    <td>
                      <Link
                        to={`/labels/batches/${batch.batch_id}`}
                        className="btn btn-primary btn-sm"
                      >
                        View Details
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {batchesResponse && batchesResponse.total > 0 && (
          <Pagination
            total={batchesResponse.total}
            limit={batchesResponse.limit}
            offset={batchesResponse.offset}
            onPageChange={(newOffset) => setPagination({ ...pagination, offset: newOffset })}
          />
        )}
      </div>
    </div>
  );
}
