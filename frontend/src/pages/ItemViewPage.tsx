import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { itemsApi, photosApi, containersApi, shelvesApi } from '../api';
import { useAuth } from '../hooks/useAuth';
import type { ItemResponse, PublicItemResponse, PhotoResponse, ContainerResponse, ShelfResponse } from '../types/generated';

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

  // Fetch parent context (container or shelf)
  const { data: parentContainer } = useQuery<ContainerResponse>({
    queryKey: ['containers', fullItem?.container_id],
    queryFn: () => containersApi.getById(fullItem!.container_id!),
    enabled: !!fullItem?.container_id,
  });

  const { data: parentShelf } = useQuery<ShelfResponse>({
    queryKey: ['shelves', fullItem?.shelf_id],
    queryFn: () => shelvesApi.getById(fullItem!.shelf_id!),
    enabled: !!fullItem?.shelf_id && !fullItem?.container_id, // Only fetch if no container
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
          {/* Header with breadcrumb, title, and edit button */}
          <div className="mb-6">
            {(parentContainer || parentShelf) && (
              <div className="text-sm text-gray-500 mb-2">
                <Link to="/items" className="hover:text-gray-700">Items</Link>
                {parentContainer && (
                  <>
                    <span className="mx-2">›</span>
                    <Link to={`/containers/${parentContainer.id}/edit`} className="hover:text-gray-700">
                      {parentContainer.name}
                    </Link>
                  </>
                )}
                {parentShelf && !parentContainer && (
                  <>
                    <span className="mx-2">›</span>
                    <Link to={`/shelves/${parentShelf.id}/edit`} className="hover:text-gray-700">
                      {parentShelf.name}
                    </Link>
                  </>
                )}
              </div>
            )}
            <div className="flex items-center justify-between gap-4">
              <h1 className="text-3xl font-bold text-gray-900 flex-1">{fullItem.name}</h1>
              <Link
                to={`/items/${itemId}/edit`}
                className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm rounded-lg hover:bg-blue-700 transition-colors shadow-md hover:shadow-lg font-medium"
              >
                <svg
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  className="flex-shrink-0"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                </svg>
                Edit
              </Link>
            </div>
          </div>

          {photos.length > 0 && (
            <div className="mb-8">
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
                {photos.map((photo) => (
                  <div key={photo.id} className="flex justify-center items-center p-4 bg-gray-50 rounded-xl">
                    <img
                      src={photo.thumbnail_url || photo.url}
                      alt={fullItem.name}
                      style={{ maxWidth: '100%', maxHeight: '384px', width: 'auto', height: 'auto' }}
                      className="rounded-lg shadow-md"
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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100">
        <div className="container mx-auto px-4 py-12 max-w-3xl">
          <div className="bg-white shadow-2xl rounded-2xl overflow-hidden">
            {photos.length > 0 && (
              <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-8">
                <div className="max-w-lg mx-auto bg-white rounded-xl shadow-lg p-4">
                  <img
                    src={photos[0].thumbnail_url || photos[0].url}
                    alt={publicItem.name}
                    className="w-full h-auto max-h-96 object-contain rounded-lg"
                  />
                </div>
              </div>
            )}

            <div className="p-10 text-center">
              <div className="mb-8">
                <h1 className="text-4xl font-bold text-gray-900 mb-4">{publicItem.name}</h1>
                <div className="inline-flex items-center gap-2 px-4 py-2 bg-blue-100 text-blue-800 rounded-full">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                  </svg>
                  <span className="font-semibold">Belongs to {publicItem.owner_display_name}</span>
                </div>
              </div>

              <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-2 border-yellow-300 rounded-xl p-6 mb-8 shadow-md">
                <div className="text-4xl mb-3">🎁</div>
                <p className="text-xl font-bold text-yellow-900 mb-2">Found this item?</p>
                <p className="text-yellow-800 mb-4">
                  The owner is offering a reward for its safe return.
                </p>
                <p className="text-sm text-yellow-700">
                  Please contact them to arrange the return and receive your reward!
                </p>
              </div>

              <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
                <Link
                  to={`/contact?item=${publicItem.id}`}
                  className="inline-flex items-center gap-2 px-8 py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-xl hover:from-blue-700 hover:to-indigo-700 text-lg font-bold shadow-lg hover:shadow-xl transition-all"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  Contact Owner
                </Link>

                {publicItem.product_link && (
                  <a
                    href={publicItem.product_link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 px-8 py-4 bg-gray-100 text-gray-700 rounded-xl hover:bg-gray-200 text-lg font-semibold transition-colors"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    Product Info
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return null;
}
