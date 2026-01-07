import { useMutation, useQueryClient } from '@tanstack/react-query';
import { moveApi, type MoveShelvingUnitRequest, type MoveShelfRequest, type MoveContainerRequest, type MoveItemRequest } from '../api/move';

// Move a shelving unit
export const useMoveShelvingUnit = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    { unitId: string; data: MoveShelvingUnitRequest }
  >({
    mutationFn: ({ unitId, data }) => moveApi.moveShelvingUnit(unitId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelving-units'] });
    },
  });
};

// Move a shelf
export const useMoveShelf = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    { shelfId: string; data: MoveShelfRequest }
  >({
    mutationFn: ({ shelfId, data }) => moveApi.moveShelf(shelfId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['shelves'] });
    },
  });
};

// Move a container
export const useMoveContainer = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    { containerId: string; data: MoveContainerRequest }
  >({
    mutationFn: ({ containerId, data }) => moveApi.moveContainer(containerId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['containers'] });
    },
  });
};

// Move an item
export const useMoveItem = () => {
  const queryClient = useQueryClient();

  return useMutation<
    { message: string },
    Error,
    { itemId: string; data: MoveItemRequest }
  >({
    mutationFn: ({ itemId, data }) => moveApi.moveItem(itemId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['items'] });
    },
  });
};
