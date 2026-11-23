import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { floorPlansApi } from '../api';
import { withUnitPosition } from '../lib/floorPlan';
import type {
  CreateFloorPlanRequest,
  FloorPlanDetailResponse,
  FloorPlanResponse,
  PlacementSuggestionsResponse,
  UnitPosition,
  UpdateFloorPlanRequest,
} from '../types/generated';

const FLOOR_PLANS_KEY = 'floor-plans';

// Get all floor plans
export const useFloorPlans = () => {
  return useQuery<FloorPlanResponse[], Error>({
    queryKey: [FLOOR_PLANS_KEY],
    queryFn: () => floorPlansApi.getAll(),
  });
};

// Get a floor plan with its linked rooms, units and positions
export const useFloorPlan = (id: string) => {
  return useQuery<FloorPlanDetailResponse, Error>({
    queryKey: [FLOOR_PLANS_KEY, id],
    queryFn: () => floorPlansApi.getById(id),
    enabled: !!id,
  });
};

// Create a floor plan record after its image has been uploaded
export const useCreateFloorPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<FloorPlanResponse, Error, CreateFloorPlanRequest>({
    mutationFn: floorPlansApi.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY] });
    },
  });
};

// Rename a floor plan or change its description
export const useUpdateFloorPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<
    FloorPlanResponse,
    Error,
    { id: string; data: UpdateFloorPlanRequest }
  >({
    mutationFn: ({ id, data }) => floorPlansApi.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY] });
    },
  });
};

// Delete a floor plan. Rooms are unlinked by the backend, so refresh them too.
export const useDeleteFloorPlan = () => {
  const queryClient = useQueryClient();

  return useMutation<void, Error, string>({
    mutationFn: floorPlansApi.delete,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [FLOOR_PLANS_KEY] });
      queryClient.invalidateQueries({ queryKey: ['rooms'] });
    },
  });
};

interface PositionContext {
  previous?: FloorPlanDetailResponse;
}

// Shared optimistic update so a marker stays where it was dropped while the
// request is in flight, and returns to its old spot if the request fails.
function usePositionMutation<TVariables extends { unitId: string }, TData>(
  floorPlanId: string,
  mutationFn: (variables: TVariables) => Promise<TData>,
  nextPosition: (variables: TVariables) => UnitPosition | undefined
) {
  const queryClient = useQueryClient();
  const queryKey = [FLOOR_PLANS_KEY, floorPlanId];

  return useMutation<TData, Error, TVariables, PositionContext>({
    mutationFn,
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey });
      const previous = queryClient.getQueryData<FloorPlanDetailResponse>(queryKey);
      if (previous) {
        queryClient.setQueryData<FloorPlanDetailResponse>(
          queryKey,
          withUnitPosition(previous, variables.unitId, nextPosition(variables))
        );
      }
      return { previous };
    },
    onError: (_error, _variables, context) => {
      if (context?.previous) {
        queryClient.setQueryData(queryKey, context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey });
    },
  });
}

// Place a shelving unit on a floor plan, or move it
export const useSetUnitPosition = (floorPlanId: string) => {
  return usePositionMutation<{ unitId: string; position: UnitPosition }, UnitPosition>(
    floorPlanId,
    ({ unitId, position }) => floorPlansApi.setUnitPosition(floorPlanId, unitId, position),
    ({ position }) => position
  );
};

// Take a shelving unit off a floor plan
export const useRemoveUnitPosition = (floorPlanId: string) => {
  return usePositionMutation<{ unitId: string }, void>(
    floorPlanId,
    ({ unitId }) => floorPlansApi.removeUnitPosition(floorPlanId, unitId),
    () => undefined
  );
};

// Ask the AI where the unplaced units belong
export const useSuggestPlacements = (floorPlanId: string) => {
  return useMutation<PlacementSuggestionsResponse, Error, void>({
    mutationFn: () => floorPlansApi.suggestPlacements(floorPlanId),
  });
};
