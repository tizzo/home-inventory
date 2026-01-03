import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { roomsApi } from '../api';
import type {
  RoomResponse,
  CreateRoomRequest,
  UpdateRoomRequest,
  PaginatedResponse,
  PaginationQuery,
} from '../types/generated';

// Get all rooms
export const useRooms = (params?: PaginationQuery) => {
  return useQuery<PaginatedResponse<RoomResponse>, Error>({
    queryKey: ['rooms', params],
    queryFn: () => roomsApi.getAll(params),
  });
};

// Get a single room
export const useRoom = (id: string) => {
  return useQuery<RoomResponse, Error>({
    queryKey: ['rooms', id],
    queryFn: () => roomsApi.getById(id),
    enabled: !!id,
  });
};

// Create a room
export const useCreateRoom = () => {
  const queryClient = useQueryClient();

  return useMutation<RoomResponse, Error, CreateRoomRequest>({
    mutationFn: roomsApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

// Update a room
export const useUpdateRoom = () => {
  const queryClient = useQueryClient();

  return useMutation<
    RoomResponse,
    Error,
    { id: string; data: UpdateRoomRequest }
  >({
    mutationFn: ({ id, data }) => roomsApi.update(id, data),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
      queryClient.invalidateQueries({ queryKey: ['rooms', data.id] });
    },
  });
};

// Delete a room
export const useDeleteRoom = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: roomsApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};
