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

export interface Photo {
  id: string;
  entity_type: string;
  entity_id: string;
  s3_key: string;
  thumbnail_s3_key?: string;
  content_type: string;
  file_size: number;
  width?: number;
  height?: number;
  created_at: string;
  created_by: string;
}

export interface PhotoResponse {
  id: string;
  entity_type: string;
  entity_id: string;
  url: string;
  thumbnail_url?: string;
  content_type: string;
  file_size: number;
  width?: number;
  height?: number;
  created_at: string;
}

export interface CreatePhotoRequest {
  entity_type: string;
  entity_id: string;
  s3_key: string;
  thumbnail_s3_key?: string;
  content_type: string;
  file_size: number;
  width?: number;
  height?: number;
}

export interface PresignedUploadUrl {
  upload_url: string;
  s3_key: string;
  expires_in: number;
}
