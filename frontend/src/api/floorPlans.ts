import apiClient from './client';
import type {
  FloorPlanResponse,
  CreateFloorPlanRequest,
  UpdateFloorPlanRequest,
  FloorPlanWithPositionsResponse,
  CreatePositionRequest,
  UpdatePositionRequest,
  PositionResponse,
  PresignedUploadUrl,
  PlacementSuggestionsResponse,
} from '../types/generated';

export const floorPlansApi = {
  // Get presigned upload URL for floor plan
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

  // Get floor plan with positions and linked rooms
  getById: async (id: string): Promise<FloorPlanWithPositionsResponse> => {
    const response = await apiClient.get<FloorPlanWithPositionsResponse>(
      `/api/floor-plans/${id}`
    );
    return response.data;
  },

  // Create floor plan record after S3 upload
  create: async (data: CreateFloorPlanRequest): Promise<FloorPlanResponse> => {
    const response = await apiClient.post<FloorPlanResponse>('/api/floor-plans', data);
    return response.data;
  },

  // Update floor plan metadata
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

  // Delete floor plan
  delete: async (id: string): Promise<void> => {
    await apiClient.delete(`/api/floor-plans/${id}`);
  },

  // Get all positions for a floor plan
  getPositions: async (floorPlanId: string): Promise<PositionResponse[]> => {
    const response = await apiClient.get<PositionResponse[]>(
      `/api/floor-plans/${floorPlanId}/positions`
    );
    return response.data;
  },

  // Add a position for a shelving unit
  addPosition: async (
    floorPlanId: string,
    data: CreatePositionRequest
  ): Promise<PositionResponse> => {
    const response = await apiClient.post<PositionResponse>(
      `/api/floor-plans/${floorPlanId}/positions`,
      data
    );
    return response.data;
  },

  // Update a position (e.g., after dragging)
  updatePosition: async (
    floorPlanId: string,
    positionId: string,
    data: UpdatePositionRequest
  ): Promise<PositionResponse> => {
    const response = await apiClient.put<PositionResponse>(
      `/api/floor-plans/${floorPlanId}/positions/${positionId}`,
      data
    );
    return response.data;
  },

  // Remove a position
  removePosition: async (floorPlanId: string, positionId: string): Promise<void> => {
    await apiClient.delete(`/api/floor-plans/${floorPlanId}/positions/${positionId}`);
  },

  // Get AI-suggested placements for shelving units
  suggestPlacements: async (
    floorPlanId: string
  ): Promise<PlacementSuggestionsResponse> => {
    const response = await apiClient.post<PlacementSuggestionsResponse>(
      `/api/floor-plans/${floorPlanId}/suggest-placements`
    );
    return response.data;
  },
};
