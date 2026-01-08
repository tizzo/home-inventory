import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { photosApi } from '../api';
import type { PhotoResponse, CreatePhotoRequest } from '../types/generated';

// Get photos for an entity
export const usePhotos = (entityType: string, entityId: string) => {
  return useQuery<PhotoResponse[], Error>({
    queryKey: ['photos', entityType, entityId],
    queryFn: () => photosApi.getByEntity(entityType, entityId),
    enabled: !!entityType && !!entityId,
  });
};

// Create a photo
export const useCreatePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation<PhotoResponse, Error, CreatePhotoRequest>({
    mutationFn: photosApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({
        queryKey: ['photos', data.entity_type, data.entity_id],
      });
    },
  });
};

// Get a single photo by ID
export const usePhoto = (photoId: string) => {
  return useQuery<PhotoResponse, Error>({
    queryKey: ['photo', photoId],
    queryFn: () => photosApi.getById(photoId),
    enabled: !!photoId,
  });
};

// Delete a photo
export const useDeletePhoto = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, { id: string; entityType: string; entityId: string }>({
    mutationFn: ({ id }) => photosApi.delete(id),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: ['photos', variables.entityType, variables.entityId],
      });
    },
  });
};
