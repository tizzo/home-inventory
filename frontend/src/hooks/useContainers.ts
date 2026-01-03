import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { containersApi } from '../api';
import type {
  ContainerResponse,
  CreateContainerRequest,
  UpdateContainerRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

// Get all containers
export const useContainers = (params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ContainerResponse>, Error>({
    queryKey: ['containers', params],
    queryFn: () => containersApi.getAll(params),
  });
};

// Get containers by shelf
export const useContainersByShelf = (shelfId: string, params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ContainerResponse>, Error>({
    queryKey: ['containers', 'shelf', shelfId, params],
    queryFn: () => containersApi.getByShelf(shelfId, params),
    enabled: !!shelfId,
  });
};

// Get containers by parent
export const useContainersByParent = (parentId: string, params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ContainerResponse>, Error>({
    queryKey: ['containers', 'parent', parentId, params],
    queryFn: () => containersApi.getByParent(parentId, params),
    enabled: !!parentId,
  });
};

// Get a single container
export const useContainer = (id: string) => {
  return useQuery<ContainerResponse, Error>({
    queryKey: ['containers', id],
    queryFn: () => containersApi.getById(id),
    enabled: !!id,
  });
};

// Create a container
export const useCreateContainer = () => {
  const queryClient = useQueryClient();

  return useMutation<ContainerResponse, Error, CreateContainerRequest>({
    mutationFn: containersApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      if (data.shelf_id) {
        queryClient.invalidateQueries({
          queryKey: ['containers', 'shelf', data.shelf_id],
        });
      }
      if (data.parent_container_id) {
        queryClient.invalidateQueries({
          queryKey: ['containers', 'parent', data.parent_container_id],
        });
      }
    },
  });
};

// Update a container
export const useUpdateContainer = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ContainerResponse,
    Error,
    { id: string; data: UpdateContainerRequest }
  >({
    mutationFn: ({ id, data }) => containersApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
      queryClient.invalidateQueries({ queryKey: ['containers', data.id] });
      if (data.shelf_id) {
        queryClient.invalidateQueries({
          queryKey: ['containers', 'shelf', data.shelf_id],
        });
      }
      if (data.parent_container_id) {
        queryClient.invalidateQueries({
          queryKey: ['containers', 'parent', data.parent_container_id],
        });
      }
    },
  });
};

// Delete a container
export const useDeleteContainer = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: containersApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
};
