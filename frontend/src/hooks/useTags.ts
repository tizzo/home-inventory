import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { tagsApi } from '../api';
import type {
  TagResponse,
  CreateTagRequest,
  UpdateTagRequest,
  AssignTagsRequest,
  BulkAssignTagsRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

// List all tags
export const useTags = (params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<TagResponse>, Error>({
    queryKey: ['tags', params],
    queryFn: () => tagsApi.list(params),
  });
};

// Get a single tag
export const useTag = (id: string) => {
  return useQuery<TagResponse, Error>({
    queryKey: ['tags', id],
    queryFn: () => tagsApi.getById(id),
    enabled: !!id,
  });
};

// Get tags for a specific entity
export const useEntityTags = (entityType: string, entityId: string) => {
  return useQuery<TagResponse[], Error>({
    queryKey: ['tags', 'entity', entityType, entityId],
    queryFn: () => tagsApi.getEntityTags(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
};

// Create a tag
export const useCreateTag = () => {
  const queryClient = useQueryClient();

  return useMutation<TagResponse, Error, CreateTagRequest>({
    mutationFn: tagsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
    },
  });
};

// Update a tag
export const useUpdateTag = () => {
  const queryClient = useQueryClient();

  return useMutation<TagResponse, Error, { id: string; data: UpdateTagRequest }>({
    mutationFn: ({ id, data }) => tagsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags', data.id] });
    },
  });
};

// Delete a tag
export const useDeleteTag = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: tagsApi.delete,
    onSuccess: (_, id) => {
      queryClient.invalidateQueries({ queryKey: ['tags'] });
      queryClient.invalidateQueries({ queryKey: ['tags', id] });
      // Also invalidate entity tags queries since deleting a tag affects all entities
      queryClient.invalidateQueries({ queryKey: ['tags', 'entity'] });
    },
  });
};

// Assign tags to an entity
export const useAssignTags = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, AssignTagsRequest>({
    mutationFn: tagsApi.assignTags,
    onSuccess: (_, data) => {
      queryClient.invalidateQueries({
        queryKey: ['tags', 'entity', data.entity_type, data.entity_id],
      });
      // Invalidate the entity's main query as well (e.g., items, containers)
      queryClient.invalidateQueries({ queryKey: [data.entity_type, data.entity_id] });
      queryClient.invalidateQueries({ queryKey: [data.entity_type] });
    },
  });
};

// Bulk assign tags to multiple entities
export const useBulkAssignTags = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, BulkAssignTagsRequest>({
    mutationFn: tagsApi.bulkAssignTags,
    onSuccess: (_, data) => {
      // Invalidate entity tags for all affected entities
      data.entity_ids.forEach((entityId) => {
        queryClient.invalidateQueries({
          queryKey: ['tags', 'entity', data.entity_type, entityId],
        });
        queryClient.invalidateQueries({ queryKey: [data.entity_type, entityId] });
      });
      queryClient.invalidateQueries({ queryKey: [data.entity_type] });
    },
  });
};
