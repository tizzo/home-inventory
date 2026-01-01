import { useState } from 'react';
import { useGenerateLabels, useDownloadLabelPdf } from '../hooks';
import type { GenerateLabelsRequest } from '../types/generated';

export default function LabelsPage() {
  const generateLabels = useGenerateLabels();
  const downloadPdf = useDownloadLabelPdf();

  const [formData, setFormData] = useState<GenerateLabelsRequest>({
    count: 10,
    template: 'avery_18660',
  });

  const [lastBatchId, setLastBatchId] = useState<string | null>(null);

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const response = await generateLabels.mutateAsync(formData);
      setLastBatchId(response.batch_id);
      alert(`Generated ${response.count} labels in batch ${response.batch_id}`);
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

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `labels-${batchId}.pdf`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
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
              onChange={(e) =>
                setFormData({ ...formData, template: e.target.value })
              }
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
    </div>
  );
}
