import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { labelsApi } from '../api';
import type {
  LabelResponse,
  GenerateLabelsRequest,
  GenerateLabelsResponse,
  AssignLabelRequest,
} from '../types/generated';

// Get a single label
export const useLabel = (id: string) => {
  return useQuery<LabelResponse, Error>({
    queryKey: ['labels', id],
    queryFn: () => labelsApi.getById(id),
    enabled: !!id,
  });
};

// Generate labels
export const useGenerateLabels = () => {
  const queryClient = useQueryClient();

  return useMutation<GenerateLabelsResponse, Error, GenerateLabelsRequest>({
    mutationFn: labelsApi.generate,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['labels'] });
    },
  });
};

// Assign a label
export const useAssignLabel = () => {
  const queryClient = useQueryClient();

  return useMutation<
    LabelResponse,
    Error,
    { id: string; data: AssignLabelRequest }
  >({
    mutationFn: ({ id, data }) => labelsApi.assign(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['labels', data.id] });
    },
  });
};

// Download PDF helper hook
export const useDownloadLabelPdf = () => {
  return useMutation<Blob, Error, { batchId: string; template?: string }>({
    mutationFn: ({ batchId, template }) =>
      labelsApi.downloadPdf(batchId, template),
  });
};
