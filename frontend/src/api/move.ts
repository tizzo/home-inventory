import apiClient from './client';

export interface MoveShelvingUnitRequest {
  target_room_id: string;
}

export interface MoveShelfRequest {
  target_unit_id: string;
}

export interface MoveContainerRequest {
  target_shelf_id?: string;
  target_parent_id?: string;
}

export interface MoveItemRequest {
  target_shelf_id?: string;
  target_container_id?: string;
}

export interface MoveResponse {
  message: string;
}

export const moveApi = {
  // Move a shelving unit to a different room
  moveShelvingUnit: async (unitId: string, data: MoveShelvingUnitRequest): Promise<MoveResponse> => {
    const response = await apiClient.post<MoveResponse>(
      `/api/units/${unitId}/move`,
      data
    );
    return response.data;
  },

  // Move a shelf to a different shelving unit
  moveShelf: async (shelfId: string, data: MoveShelfRequest): Promise<MoveResponse> => {
    const response = await apiClient.post<MoveResponse>(
      `/api/shelves/${shelfId}/move`,
      data
    );
    return response.data;
  },

  // Move a container to a different location
  moveContainer: async (
    containerId: string,
    data: MoveContainerRequest
  ): Promise<MoveResponse> => {
    const response = await apiClient.post<MoveResponse>(
      `/api/containers/${containerId}/move`,
      data
    );
    return response.data;
  },

  // Move an item to a different location
  moveItem: async (itemId: string, data: MoveItemRequest): Promise<MoveResponse> => {
    const response = await apiClient.post<MoveResponse>(
      `/api/items/${itemId}/move`,
      data
    );
    return response.data;
  },
};
