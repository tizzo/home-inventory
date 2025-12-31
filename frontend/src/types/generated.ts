// Generated TypeScript types from Rust
// To regenerate: npm run generate-types

export interface User {
  id: string;
  email: string;
  name: string;
  cognito_sub: string;
  created_at: string;
  updated_at: string;
}

export interface CreateUserRequest {
  email: string;
  name: string;
  cognito_sub: string;
}

export interface Room {
  id: string;
  name: string;
  description?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateRoomRequest {
  name: string;
  description?: string;
}

export interface UpdateRoomRequest {
  name?: string;
  description?: string;
}

export interface RoomResponse {
  id: string;
  name: string;
  description?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
}

export interface ShelvingUnit {
  id: string;
  room_id: string;
  name: string;
  description?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateShelvingUnitRequest {
  room_id: string;
  name: string;
  description?: string;
}

export interface UpdateShelvingUnitRequest {
  name?: string;
  description?: string;
  room_id?: string;
}

export interface ShelvingUnitResponse {
  id: string;
  room_id: string;
  name: string;
  description?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
}
