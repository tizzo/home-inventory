import apiClient from './client';
import type {
  CreateFloorPlanRequest,
  FloorPlanDetailResponse,
  FloorPlanResponse,
  PlacementSuggestionsResponse,
  PresignedUploadUrl,
  UnitPosition,
  UpdateFloorPlanRequest,
} from '../types/generated';

export const floorPlansApi = {
  // Get a presigned URL for uploading a floor plan image
  getUploadUrl: async (contentType: string): Promise<PresignedUploadUrl> => {
    const response = await apiClient.post<PresignedUploadUrl>(
      '/api/floor-plans/upload-url',
      { content_type: contentType }
    );
    return response.data;
  },

  // Get all floor plans
  getAll: async (): Promise<FloorPlanResponse[]> => {
    const response = await apiClient.get<FloorPlanResponse[]>('/api/floor-plans');
    return response.data;
  },

  // Get a floor plan with its linked rooms, units and positions
  getById: async (id: string): Promise<FloorPlanDetailResponse> => {
    const response = await apiClient.get<FloorPlanDetailResponse>(
      `/api/floor-plans/${id}`
    );
    return response.data;
  },

  // Create the floor plan record after the image has been uploaded
  create: async (data: CreateFloorPlanRequest): Promise<FloorPlanResponse> => {
    const response = await apiClient.post<FloorPlanResponse>('/api/floor-plans', data);
    return response.data;
  },

  // Rename a floor plan or change its description
  update: async (
    id: string,
    data: UpdateFloorPlanRequest
  ): Promise<FloorPlanResponse> => {
    const response = await apiClient.put<FloorPlanResponse>(
      `/api/floor-plans/${id}`,
      data
    );
    return response.data;
  },

  // Delete a floor plan
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/floor-plans/${id}`);
  },

  // Place a shelving unit on the plan, or move it if already placed
  setUnitPosition: async (
    floorPlanId: string,
    unitId: string,
    position: UnitPosition
  ): Promise<UnitPosition> => {
    const response = await apiClient.put<UnitPosition>(
      `/api/floor-plans/${floorPlanId}/positions/${unitId}`,
      position
    );
    return response.data;
  },

  // Take a shelving unit off the plan
  removeUnitPosition: async (floorPlanId: string, unitId: string): Promise<void> => {
    await apiClient.delete(`/api/floor-plans/${floorPlanId}/positions/${unitId}`);
  },

  // Ask the AI where the unplaced units belong
  suggestPlacements: async (
    floorPlanId: string
  ): Promise<PlacementSuggestionsResponse> => {
    const response = await apiClient.post<PlacementSuggestionsResponse>(
      `/api/floor-plans/${floorPlanId}/suggest-placements`
    );
    return response.data;
  },
};
