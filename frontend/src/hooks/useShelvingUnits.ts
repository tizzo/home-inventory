import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { shelvingUnitsApi } from '../api';
import type {
  ShelvingUnitResponse,
  CreateShelvingUnitRequest,
  UpdateShelvingUnitRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

// Get all shelving units
export const useShelvingUnits = (params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ShelvingUnitResponse>, Error>({
    queryKey: ['shelving-units', params],
    queryFn: () => shelvingUnitsApi.getAll(params),
  });
};

// Get shelving units for a specific room
export const useShelvingUnitsByRoom = (roomId: string, params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<ShelvingUnitResponse>, Error>({
    queryKey: ['shelving-units', 'room', roomId, params],
    queryFn: () => shelvingUnitsApi.getByRoom(roomId, params),
    enabled: !!roomId,
  });
};

// Get a single shelving unit
export const useShelvingUnit = (id: string) => {
  return useQuery<ShelvingUnitResponse, Error>({
    queryKey: ['shelving-units', id],
    queryFn: () => shelvingUnitsApi.getById(id),
    enabled: !!id,
  });
};

// Create a shelving unit
export const useCreateShelvingUnit = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ShelvingUnitResponse,
    Error,
    CreateShelvingUnitRequest
  >({
    mutationFn: shelvingUnitsApi.create,
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shelving-units'] });
      queryClient.invalidateQueries({
        queryKey: ['shelving-units', 'room', data.room_id],
      });
    },
  });
};

// Update a shelving unit
export const useUpdateShelvingUnit = () => {
  const queryClient = useQueryClient();

  return useMutation<
    ShelvingUnitResponse,
    Error,
    { id: string; data: UpdateShelvingUnitRequest }
  >({
    mutationFn: ({ id, data }) => shelvingUnitsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['shelving-units'] });
      queryClient.invalidateQueries({
        queryKey: ['shelving-units', data.id],
      });
      queryClient.invalidateQueries({
        queryKey: ['shelving-units', 'room', data.room_id],
      });
    },
  });
};

// Delete a shelving unit
export const useDeleteShelvingUnit = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: shelvingUnitsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelving-units'] });
    },
  });
};
