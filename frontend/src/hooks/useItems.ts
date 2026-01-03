import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../api';
import type {
  ItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

// Get all items
export const useItems = (params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ItemResponse>, Error>({
    queryKey: ['items', params],
    queryFn: () => itemsApi.getAll(params),
  });
};

// Get items by shelf
export const useItemsByShelf = (shelfId: string, params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ItemResponse>, Error>({
    queryKey: ['items', 'shelf', shelfId, params],
    queryFn: () => itemsApi.getByShelf(shelfId, params),
    enabled: !!shelfId,
  });
};

// Get items by container
export const useItemsByContainer = (containerId: string, params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ItemResponse>, Error>({
    queryKey: ['items', 'container', containerId, params],
    queryFn: () => itemsApi.getByContainer(containerId, params),
    enabled: !!containerId,
  });
};

// Get a single item
export const useItem = (id: string) => {
  return useQuery<ItemResponse, Error>({
    queryKey: ['items', id],
    queryFn: () => itemsApi.getById(id),
    enabled: !!id,
  });
};

// Get item by barcode
export const useItemByBarcode = (barcode: string) => {
  return useQuery<ItemResponse, Error>({
    queryKey: ['items', 'barcode', barcode],
    queryFn: () => itemsApi.getByBarcode(barcode),
    enabled: !!barcode,
  });
};

// Create an item
export const useCreateItem = () => {
  const queryClient = useQueryClient();

  return useMutation<ItemResponse, Error, CreateItemRequest>({
    mutationFn: itemsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      if (data.shelf_id) {
        queryClient.invalidateQueries({
          queryKey: ['items', 'shelf', data.shelf_id],
        });
      }
      if (data.container_id) {
        queryClient.invalidateQueries({
          queryKey: ['items', 'container', data.container_id],
        });
      }
    },
  });
};

// Update an item
export const useUpdateItem = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ItemResponse,
    Error,
    { id: string; data: UpdateItemRequest }
  >({
    mutationFn: ({ id, data }) => itemsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
      queryClient.invalidateQueries({ queryKey: ['items', data.id] });
      if (data.shelf_id) {
        queryClient.invalidateQueries({
          queryKey: ['items', 'shelf', data.shelf_id],
        });
      }
      if (data.container_id) {
        queryClient.invalidateQueries({
          queryKey: ['items', 'container', data.container_id],
        });
      }
    },
  });
};

// Delete an item
export const useDeleteItem = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: itemsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};
