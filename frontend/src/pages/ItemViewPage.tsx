import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { itemsApi, photosApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import type { ItemResponse, PublicItemResponse, PhotoResponse } from '../types/generated';

export default function ItemViewPage() {
  const { itemId } = useParams<{ itemId: string }>();
  const { user } = useAuth();

  // Fetch public item data if not authenticated
  const { data: publicItem, isLoading: publicLoading } = useQuery<PublicItemResponse>({
    queryKey: ['items', itemId, 'public'],
    queryFn: () => itemsApi.getPublic(itemId!),
    enabled: !user && !!itemId,
  });

  // Fetch full item data if authenticated
  const { data: fullItem, isLoading: fullLoading } = useQuery<ItemResponse>({
    queryKey: ['items', itemId],
    queryFn: () => itemsApi.getById(itemId!),
    enabled: !!user && !!itemId,
  });

  // Fetch presigned download URLs for documents
  const { data: manualUrl } = useQuery({
    queryKey: ['file-download-url', fullItem?.product_manual_s3_key],
    queryFn: () => itemsApi.getFileDownloadUrl(fullItem!.product_manual_s3_key!),
    enabled: !!fullItem?.product_manual_s3_key,
  });

  const { data: receiptUrl } = useQuery({
    queryKey: ['file-download-url', fullItem?.receipt_s3_key],
    queryFn: () => itemsApi.getFileDownloadUrl(fullItem!.receipt_s3_key!),
    enabled: !!fullItem?.receipt_s3_key,
  });

  // Fetch photos for the item (only if authenticated or silently fail for public view)
  const { data: photos = [] } = useQuery<PhotoResponse[]>({
    queryKey: ['photos', 'item', itemId],
    queryFn: async () => {
      try {
        return await photosApi.getByEntity('item', itemId!);
      } catch (error) {
        // Silently return empty array if unauthorized (public view)
        return [];
      }
    },
    enabled: !!itemId,
    retry: false,
  });

  const isLoading = user ? fullLoading : publicLoading;

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Loading...</div>
      </div>
    );
  }

  if (!publicItem && !fullItem) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-gray-600">Item not found</div>
      </div>
    );
  }

  // Authenticated view - show full details
  if (user && fullItem) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="bg-white shadow-lg rounded-lg p-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-3xl font-bold text-gray-900">{fullItem.name}</h1>
            <Link
              to={`/items/${itemId}/edit`}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Edit
            </Link>
          </div>

          {photos.length > 0 && (
            <div className="mb-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {photos.map((photo) => (
                  <div key={photo.id} className="flex justify-center items-center">
                    <img
                      src={photo.thumbnail_url || photo.url}
                      alt={fullItem.name}
                      style={{ maxWidth: '100%', maxHeight: '384px', width: 'auto', height: 'auto' }}
                      className="rounded-lg border"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {fullItem.description && (
            <div className="mb-4">
              <h2 className="text-sm font-semibold text-gray-500 uppercase mb-2">Description</h2>
              <p className="text-gray-700">{fullItem.description}</p>
            </div>
          )}

          <div className="grid grid-cols-2 gap-4 mb-6">
            {fullItem.barcode && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Barcode</h3>
                <p className="text-gray-700">{fullItem.barcode}</p>
              </div>
            )}

            {fullItem.acquired_date && (
              <div>
                <h3 className="text-sm font-semibold text-gray-500 uppercase mb-1">Acquired Date</h3>
                <p className="text-gray-700">{new Date(fullItem.acquired_date).toLocaleDateString()}</p>
              </div>
            )}
          </div>

          {(fullItem.product_link || fullItem.product_manual_s3_key || fullItem.receipt_s3_key) && (
            <div className="border-t pt-6 mt-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Links & Documents</h2>
              <div className="flex flex-wrap gap-3">
                {fullItem.product_link && (
                  <a
                    href={fullItem.product_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-primary"
                  >
                    View Product Page
                  </a>
                )}
                {fullItem.product_manual_s3_key && (
                  <a
                    href={manualUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      if (!manualUrl) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {manualUrl ? 'View Manual' : 'Loading Manual...'}
                  </a>
                )}
                {fullItem.receipt_s3_key && (
                  <a
                    href={receiptUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary"
                    onClick={(e) => {
                      if (!receiptUrl) {
                        e.preventDefault();
                      }
                    }}
                  >
                    {receiptUrl ? 'View Receipt' : 'Loading Receipt...'}
                  </a>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Public view - limited information
  if (publicItem) {
    return (
      <div className="container mx-auto px-4 py-8 max-w-2xl">
        <div className="bg-white shadow-lg rounded-lg p-8 text-center">
          {photos.length > 0 && (
            <div className="max-w-md mx-auto mb-6">
              <img
                src={photos[0].thumbnail_url || photos[0].url}
                alt={publicItem.name}
                className="w-full h-auto max-h-96 object-contain rounded-lg border-4 border-blue-600"
              />
            </div>
          )}

          <div className="mb-6">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">{publicItem.name}</h1>
            <p className="text-lg text-gray-600">
              This item belongs to <span className="font-semibold">{publicItem.owner_display_name}</span>
            </p>
          </div>

          <div className="bg-yellow-50 border border-yellow-200 rounded-md p-4 mb-6">
            <p className="text-yellow-800 font-semibold mb-2">💰 Cash reward upon return</p>
            <p className="text-sm text-yellow-700">
              If you found this item, please contact the owner to arrange its return.
            </p>
          </div>

          {publicItem.product_link && (
            <div className="mb-6">
              <a
                href={publicItem.product_link}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline"
              >
                View product information
              </a>
            </div>
          )}

          <Link
            to={`/contact?item=${publicItem.id}`}
            className="inline-block px-6 py-3 bg-blue-600 text-white rounded-md hover:bg-blue-700 text-lg font-semibold"
          >
            Contact Owner
          </Link>
        </div>
      </div>
    );
  }

  return null;
}
