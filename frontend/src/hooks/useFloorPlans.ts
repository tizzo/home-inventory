import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { floorPlansApi } from '../api';
import type {
  CreateFloorPlanRequest,
  UpdateFloorPlanRequest,
  CreatePositionRequest,
  UpdatePositionRequest,
} from '../types/generated';

// Query keys
const FLOOR_PLANS_KEY = 'floor-plans';

// List all floor plans
export function useFloorPlans() {
  return useQuery({
    queryKey: [FLOOR_PLANS_KEY],
    queryFn: () => floorPlansApi.getAll(),
  });
}

// Get single floor plan with positions and linked rooms
export function useFloorPlan(id: string | undefined) {
  return useQuery({
    queryKey: [FLOOR_PLANS_KEY, id],
    queryFn: () => floorPlansApi.getById(id!),
    enabled: !!id,
  });
}

// Create floor plan
export function useCreateFloorPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: CreateFloorPlanRequest) => floorPlansApi.create(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY] });
    },
  });
}

// Update floor plan
export function useUpdateFloorPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateFloorPlanRequest }) =>
      floorPlansApi.update(id, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY] });
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY, variables.id] });
    },
  });
}

// Delete floor plan
export function useDeleteFloorPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => floorPlansApi.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY] });
    },
  });
}

// Add position
export function useAddPosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      floorPlanId,
      data,
    }: {
      floorPlanId: string;
      data: CreatePositionRequest;
    }) => floorPlansApi.addPosition(floorPlanId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FLOOR_PLANS_KEY, variables.floorPlanId],
      });
    },
  });
}

// Update position
export function useUpdatePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      floorPlanId,
      positionId,
      data,
    }: {
      floorPlanId: string;
      positionId: string;
      data: UpdatePositionRequest;
    }) => floorPlansApi.updatePosition(floorPlanId, positionId, data),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FLOOR_PLANS_KEY, variables.floorPlanId],
      });
    },
  });
}

// Remove position
export function useRemovePosition() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      floorPlanId,
      positionId,
    }: {
      floorPlanId: string;
      positionId: string;
    }) => floorPlansApi.removePosition(floorPlanId, positionId),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({
        queryKey: [FLOOR_PLANS_KEY, variables.floorPlanId],
      });
    },
  });
}

// AI suggest placements
export function useSuggestPlacements() {
  return useMutation({
    mutationFn: (floorPlanId: string) => floorPlansApi.suggestPlacements(floorPlanId),
  });
}
