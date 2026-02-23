import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { allowedEmailsApi } from '../api/allowedEmails';
import type { AllowedEmailResponse, CreateAllowedEmailRequest } from '../types/generated';

export const useAllowedEmails = () => {
  return useQuery<AllowedEmailResponse[], Error>({
    queryKey: ['allowed-emails'],
    queryFn: allowedEmailsApi.list,
  });
};

export const useAddAllowedEmail = () => {
  const queryClient = useQueryClient();

  return useMutation<AllowedEmailResponse, Error, CreateAllowedEmailRequest>({
    mutationFn: allowedEmailsApi.add,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowed-emails'] });
    },
  });
};

export const useRemoveAllowedEmail = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: allowedEmailsApi.remove,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['allowed-emails'] });
    },
  });
};
