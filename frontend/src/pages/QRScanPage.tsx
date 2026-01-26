import { useEffect, useRef, useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { Html5Qrcode } from 'html5-qrcode';
import { useLabel } from '../hooks';
import type { LabelResponse } from '../types/generated';

export default function QRScanPage() {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [scannedLabelId, setScannedLabelId] = useState<string | null>(null);
  const html5QrCodeRef = useRef<Html5Qrcode | null>(null);
  const navigate = useNavigate();

  // Query label data when a QR code is scanned
  const {
    data: label,
    isLoading: isLoadingLabel,
    error: labelError,
  } = useLabel(scannedLabelId || '');

  const handleLabelScanned = useCallback(
    (label: LabelResponse) => {
      // Stop scanning
      stopScanning();

      // If label is assigned to an entity, navigate to that entity
      if (label.assigned_to_type && label.assigned_to_id) {
        const entityType = label.assigned_to_type;
        const entityId = label.assigned_to_id;

        switch (entityType) {
          case 'room':
            navigate(`/rooms/${entityId}/edit`);
            break;
          case 'unit':
            // Navigate to the unit's shelves page
            navigate(`/units/${entityId}/shelves`);
            break;
          case 'shelf':
            // Navigate to shelf edit page
            // We need to get the unit ID first, but for now navigate to the shelf directly
            navigate(`/shelves/${entityId}/edit`);
            break;
          case 'container':
            // Navigate to container edit page
            navigate(`/containers/${entityId}/edit`);
            break;
          case 'item':
            // Navigate to item view page
            navigate(`/items/${entityId}/view`);
            break;
          default:
            // Unknown entity type, show label details
            navigate(`/labels?label=${label.id}`);
            break;
        }
      } else {
        // Label not assigned, show label details or assignment page
        navigate(`/labels?label=${label.id}`);
      }
    },
    [navigate]
  );

  // Navigate to entity when label is loaded
  useEffect(() => {
    if (label && scannedLabelId) {
      handleLabelScanned(label);
    }
  }, [label, scannedLabelId, handleLabelScanned]);

  // Handle label not found error
  useEffect(() => {
    if (labelError && scannedLabelId) {
      setError('Label not found. Please check the QR code and try again.');
      setScannedLabelId(null);
    }
  }, [labelError, scannedLabelId]);

  const extractLabelIdFromUrl = (url: string): string | null => {
    try {
      // QR codes contain URLs like: {base_url}/l/{label_id}
      const urlObj = new URL(url);
      const pathParts = urlObj.pathname.split('/');
      const labelIndex = pathParts.indexOf('l');
      if (labelIndex !== -1 && pathParts[labelIndex + 1]) {
        return pathParts[labelIndex + 1];
      }
      // Also try to extract UUID directly if it's just the UUID
      const uuidRegex =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = url.match(uuidRegex);
      if (match) {
        return match[0];
      }
      return null;
    } catch (e) {
      // If URL parsing fails, try to extract UUID directly
      const uuidRegex =
        /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;
      const match = url.match(uuidRegex);
      return match ? match[0] : null;
    }
  };

  const startScanning = () => {
    setError(null);
    setScanning(true);
  };

  // Start the QR scanner when scanning state becomes true and element is rendered
  useEffect(() => {
    if (!scanning) return;

    const initializeScanner = async () => {
      const qrReaderElement = document.getElementById('qr-reader');
      if (!qrReaderElement) {
        // Element not ready yet, wait a bit and try again
        setTimeout(initializeScanner, 50);
        return;
      }

      try {
        const html5QrCode = new Html5Qrcode('qr-reader');
        html5QrCodeRef.current = html5QrCode;

        await html5QrCode.start(
          { facingMode: 'environment' }, // Use back camera
          {
            fps: 10,
            qrbox: { width: 250, height: 250 },
          },
          (decodedText) => {
            // QR code scanned successfully
            const labelId = extractLabelIdFromUrl(decodedText);
            if (labelId) {
              setScannedLabelId(labelId);
            } else {
              setError(
                `Invalid QR code format. Expected label URL, got: ${decodedText}`
              );
              setScanning(false);
            }
          },
          (_errorMessage) => {
            // Ignore scanning errors (they're frequent during scanning)
          }
        );
      } catch (err) {
        console.error('Failed to start scanning:', err);
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to start camera. Please check permissions.'
        );
        setScanning(false);
      }
    };

    initializeScanner();
  }, [scanning]);

  const stopScanning = useCallback(async () => {
    if (html5QrCodeRef.current) {
      try {
        await html5QrCodeRef.current.stop();
        await html5QrCodeRef.current.clear();
      } catch (err) {
        console.error('Error stopping scanner:', err);
      }
      html5QrCodeRef.current = null;
    }
    setScanning(false);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      stopScanning();
    };
  }, [stopScanning]);

  return (
    <div className="page">
      <div className="page-header">
        <h1>QR Code Scanner</h1>
      </div>

      <div className="form">
        {!scanning && !scannedLabelId && (
          <div>
            <p>Scan a QR code label to navigate to the assigned entity.</p>
            <div className="form-actions">
              <button
                className="btn btn-primary"
                onClick={startScanning}
                disabled={scanning}
              >
                📷 Start Scanning
              </button>
            </div>
          </div>
        )}

        {scanning && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div
              id="qr-reader"
              style={{
                width: '100%',
                maxWidth: '600px',
                margin: '0 auto',
              }}
            />
            <div className="form-actions" style={{ marginTop: '1rem' }}>
              <button
                className="btn btn-secondary"
                onClick={stopScanning}
                disabled={!scanning}
              >
                Stop Scanning
              </button>
            </div>
          </div>
        )}

        {error && (
          <div className="error-message" style={{ marginTop: '1rem' }}>
            <p>{error}</p>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setError(null);
                setScannedLabelId(null);
              }}
            >
              Try Again
            </button>
          </div>
        )}

        {scannedLabelId && isLoadingLabel && (
          <div style={{ marginTop: '1rem' }}>
            <p>Loading label information...</p>
          </div>
        )}

        {scannedLabelId && label && (
          <div style={{ marginTop: '1rem' }}>
            <p>
              Label #{label.number} scanned!{' '}
              {label.assigned_to_type
                ? `Assigned to ${label.assigned_to_type}`
                : 'Not assigned'}
            </p>
            <p>Navigating...</p>
          </div>
        )}
      </div>
    </div>
  );
}

