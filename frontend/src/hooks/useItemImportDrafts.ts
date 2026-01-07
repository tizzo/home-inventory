import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { itemImportDraftsApi } from '../api';
import type {
  ItemImportDraftResponse,
  CreateItemImportDraftRequest,
  UpdateItemImportDraftRequest,
  CommitItemImportDraftResponse,
  AnalyzePhotoRequest,
} from '../types/generated';

// Get a single draft
export const useItemImportDraft = (id: string) => {
  return useQuery<ItemImportDraftResponse, Error>({
    queryKey: ['itemImportDrafts', id],
    queryFn: () => itemImportDraftsApi.getById(id),
    enabled: !!id,
  });
};

// Create a draft
export const useCreateItemImportDraft = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ItemImportDraftResponse,
    Error,
    CreateItemImportDraftRequest
  >({
    mutationFn: itemImportDraftsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['itemImportDrafts'] });
      queryClient.setQueryData(['itemImportDrafts', data.id], data);
    },
  });
};

// Update a draft
export const useUpdateItemImportDraft = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ItemImportDraftResponse,
    Error,
    { id: string; data: UpdateItemImportDraftRequest }
  >({
    mutationFn: ({ id, data }) => itemImportDraftsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['itemImportDrafts', data.id] });
    },
  });
};

// Commit a draft (creates items)
export const useCommitItemImportDraft = () => {
  const queryClient = useQueryClient();

  return useMutation<CommitItemImportDraftResponse, Error, string>({
    mutationFn: itemImportDraftsApi.commit,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['itemImportDrafts'] });
      queryClient.invalidateQueries({ queryKey: ['items'] });
      if (data.draft.container_id) {
        queryClient.invalidateQueries({
          queryKey: ['items', 'container', data.draft.container_id],
        });
      }
    },
  });
};

// Analyze a photo with AI and create a draft
export const useAnalyzePhotoAndCreateDraft = () => {
  const queryClient = useQueryClient();

  return useMutation<ItemImportDraftResponse, Error, AnalyzePhotoRequest>({
    mutationFn: itemImportDraftsApi.analyzePhoto,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['itemImportDrafts'] });
      queryClient.setQueryData(['itemImportDrafts', data.id], data);
    },
  });
};
