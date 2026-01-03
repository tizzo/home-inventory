import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shelvesApi } from '../api';
import type {
  ShelfResponse,
  CreateShelfRequest,
  UpdateShelfRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

// Get all shelves
export const useShelves = (params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ShelfResponse>, Error>({
    queryKey: ['shelves', params],
    queryFn: () => shelvesApi.getAll(params),
  });
};

// Get shelves by unit
export const useShelvesByUnit = (unitId: string, params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ShelfResponse>, Error>({
    queryKey: ['shelves', 'unit', unitId, params],
    queryFn: () => shelvesApi.getByUnit(unitId, params),
    enabled: !!unitId,
  });
};

// Get a single shelf
export const useShelf = (id: string) => {
  return useQuery<ShelfResponse, Error>({
    queryKey: ['shelves', id],
    queryFn: () => shelvesApi.getById(id),
    enabled: !!id,
  });
};

// Create a shelf
export const useCreateShelf = () => {
  const queryClient = useQueryClient();

  return useMutation<ShelfResponse, Error, CreateShelfRequest>({
    mutationFn: shelvesApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      queryClient.invalidateQueries({
        queryKey: ['shelves', 'unit', data.shelving_unit_id],
      });
    },
  });
};

// Update a shelf
export const useUpdateShelf = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ShelfResponse,
    Error,
    { id: string; data: UpdateShelfRequest }
  >({
    mutationFn: ({ id, data }) => shelvesApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
      queryClient.invalidateQueries({ queryKey: ['shelves', data.id] });
      queryClient.invalidateQueries({
        queryKey: ['shelves', 'unit', data.shelving_unit_id],
      });
    },
  });
};

// Delete a shelf
export const useDeleteShelf = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: shelvesApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
    },
  });
};
