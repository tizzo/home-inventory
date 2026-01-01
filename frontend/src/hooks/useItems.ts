import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemsApi } from '../api';
import type {
  ItemResponse,
  CreateItemRequest,
  UpdateItemRequest,
} from '../types/generated';

// Get all items
export const useItems = () => {
  return useQuery<ItemResponse[], Error>({
    queryKey: ['items'],
    queryFn: itemsApi.getAll,
  });
};

// Get items by shelf
export const useItemsByShelf = (shelfId: string) => {
  return useQuery<ItemResponse[], Error>({
    queryKey: ['items', 'shelf', shelfId],
    queryFn: () => itemsApi.getByShelf(shelfId),
    enabled: !!shelfId,
  });
};

// Get items by container
export const useItemsByContainer = (containerId: string) => {
  return useQuery<ItemResponse[], Error>({
    queryKey: ['items', 'container', containerId],
    queryFn: () => itemsApi.getByContainer(containerId),
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
