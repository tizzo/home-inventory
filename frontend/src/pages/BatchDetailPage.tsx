import { useState } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useBatch, useDownloadLabelPdf } from '../hooks';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export default function BatchDetailPage() {
  const { batchId } = useParams<{ batchId: string }>();
  const { data: batch, isLoading, error } = useBatch(batchId || '');
  const downloadPdf = useDownloadLabelPdf();
  const navigate = useNavigate();
  const [reprintTemplate, setReprintTemplate] = useState('avery_18660');

  const getLabelLink = (label: { assigned_to_type?: string; assigned_to_id?: string }): string | null => {
    if (!label.assigned_to_type || !label.assigned_to_id) {
      return null;
    }

    switch (label.assigned_to_type) {
      case 'room':
        return `/rooms/${label.assigned_to_id}/edit`;
      case 'unit':
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
        template: reprintTemplate,
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
      <div className="text-center py-12 text-muted-foreground">Loading batch details...</div>
    );
  }

  if (error || !batch) {
    return (
      <div className="text-center py-12">
        <div className="text-destructive mb-4">
          {error ? `Error: ${error.message}` : 'Batch not found'}
        </div>
        <Button asChild>
          <Link to="/labels">Back to Labels</Link>
        </Button>
      </div>
    );
  }

  return (
    <div>
      {/* Page Header */}
      <div className="mb-6">
        <div className="flex items-center gap-4 mb-4">
          <Button variant="outline" size="sm" asChild>
            <Link to="/labels">← Back</Link>
          </Button>
          <h1 className="text-2xl font-bold">Batch Details</h1>
        </div>

        <div className="flex flex-wrap gap-6 mb-4">
          <div>
            <span className="text-sm text-muted-foreground">Batch ID:</span>
            <br />
            <code className="text-sm bg-muted px-2 py-0.5 rounded">
              {batch.batch_id}
            </code>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Created:</span>
            <br />
            <span className="text-sm">{new Date(batch.created_at).toLocaleString()}</span>
          </div>
          <div>
            <span className="text-sm text-muted-foreground">Labels:</span>
            <br />
            <span className="text-sm font-semibold">{batch.labels.length}</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <select
            value={reprintTemplate}
            onChange={(e) => setReprintTemplate(e.target.value)}
            className="flex h-9 rounded-md border border-input bg-background text-foreground px-3 py-1 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          >
            <option value="avery_18660">Avery 18660 (30/sheet)</option>
            <option value="avery_94103">Avery 94103 (48/sheet, 1" square)</option>
          </select>
          <Button
            onClick={handleReprint}
            disabled={downloadPdf.isPending}
          >
            {downloadPdf.isPending ? 'Generating PDF...' : 'Re-print PDF'}
          </Button>
        </div>
      </div>

      {/* QR Code Labels */}
      <Card>
        <CardContent className="p-6">
          <h2 className="text-lg font-semibold mb-6">QR Code Labels</h2>
          {batch.labels.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">No labels in this batch.</div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
              {batch.labels.map((label) => {
                const labelLink = getLabelLink(label);
                // If assigned, link to entity; if unassigned, link to assignment page
                const clickTarget = labelLink || `/l/${label.id}`;

                return (
                  <div
                    key={label.id}
                    className="flex flex-col items-center gap-4 p-6 bg-card rounded-xl border-2 border-border shadow-sm cursor-pointer transition-all hover:shadow-lg hover:-translate-y-1 hover:border-primary"
                    onClick={() => {
                      navigate(clickTarget);
                    }}
                  >
                    <div className="p-3 bg-white rounded-lg flex items-center justify-center">
                      <QRCodeSVG
                        value={label.qr_data}
                        size={140}
                        level="M"
                        includeMargin={true}
                      />
                    </div>
                    <div className="text-center w-full">
                      <div className="text-base font-bold text-primary underline mb-2">
                        #{label.number}
                      </div>
                      {label.assigned_to_type && label.assigned_to_id ? (
                        <div className="text-xs text-muted-foreground px-2 py-1 bg-muted rounded inline-block">
                          ✓ Assigned to {label.assigned_to_type}
                          <span className="ml-2 text-[0.7rem]">
                            (click to view)
                          </span>
                        </div>
                      ) : (
                        <div className="text-xs text-primary italic font-semibold">
                          Unassigned (click to assign)
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
