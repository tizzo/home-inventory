import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useGenerateLabels, useDownloadLabelPdf, useBatches } from '../hooks';
import { Pagination } from '../components';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent } from '@/components/ui/card';
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
    <div>
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <h1 className="text-2xl font-bold">QR Code Labels</h1>
      </div>

      {/* Generate Labels Form */}
      <Card className="mb-6">
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Generate Labels</h2>
          <form onSubmit={handleGenerate} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="count">Number of Labels *</Label>
              <Input
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
              <p className="text-xs text-muted-foreground">Maximum 1000 labels per batch</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="template">Template</Label>
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
                className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
              >
                <option value="avery_18660">Avery 18660 (30 per sheet)</option>
              </select>
            </div>

            <Button
              type="submit"
              disabled={generateLabels.isPending}
            >
              {generateLabels.isPending ? 'Generating...' : 'Generate Labels'}
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Download PDF Section */}
      {lastBatchId && (
        <Card className="mb-6">
          <CardContent className="p-6">
            <h2 className="text-lg font-semibold mb-4">Download PDF</h2>
            <p className="text-muted-foreground mb-4">
              Labels generated successfully! Batch ID: <code className="bg-muted px-1 py-0.5 rounded text-sm">{lastBatchId}</code>
            </p>
            <Button
              onClick={() => handleDownloadPdf(lastBatchId)}
              disabled={downloadPdf.isPending}
            >
              {downloadPdf.isPending ? 'Downloading...' : 'Download PDF'}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Batches Table */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-4">Label Batches</h2>
          {batchesError ? (
            <div className="text-destructive">
              Error loading batches: {batchesError.message}
            </div>
          ) : batchesLoading ? (
            <div className="text-center py-12 text-muted-foreground">Loading batches...</div>
          ) : !batches || batches.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              No batches found. Generate labels to create a batch.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border">
                    <th className="text-left py-3 px-2 font-medium">Batch ID</th>
                    <th className="text-left py-3 px-2 font-medium">Created</th>
                    <th className="text-left py-3 px-2 font-medium">Label Count</th>
                    <th className="text-left py-3 px-2 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.batch_id} className="border-b border-border hover:bg-muted/50">
                      <td className="py-3 px-2">
                        <code className="text-xs bg-muted px-1 py-0.5 rounded">
                          {batch.batch_id.substring(0, 8)}...
                        </code>
                      </td>
                      <td className="py-3 px-2">{new Date(batch.created_at).toLocaleString()}</td>
                      <td className="py-3 px-2">{batch.labels.length}</td>
                      <td className="py-3 px-2">
                        <Button
                          variant="outline"
                          size="sm"
                          asChild
                        >
                          <Link to={`/labels/batches/${batch.batch_id}`}>
                            View Details
                          </Link>
                        </Button>
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
        </CardContent>
      </Card>
    </div>
  );
}
