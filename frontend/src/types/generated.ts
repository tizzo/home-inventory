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

export interface Shelf {
  id: string;
  shelving_unit_id: string;
  name: string;
  description?: string;
  position?: number;
  label_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateShelfRequest {
  shelving_unit_id: string;
  name: string;
  description?: string;
  position?: number;
}

export interface UpdateShelfRequest {
  name?: string;
  description?: string;
  position?: number;
  shelving_unit_id?: string;
}

export interface ShelfResponse {
  id: string;
  shelving_unit_id: string;
  name: string;
  description?: string;
  position?: number;
  label_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Container {
  id: string;
  shelf_id?: string;
  parent_container_id?: string;
  name: string;
  description?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateContainerRequest {
  shelf_id?: string;
  parent_container_id?: string;
  name: string;
  description?: string;
}

export interface UpdateContainerRequest {
  name?: string;
  description?: string;
  shelf_id?: string;
  parent_container_id?: string;
}

export interface ContainerResponse {
  id: string;
  shelf_id?: string;
  parent_container_id?: string;
  name: string;
  description?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
}

export interface Item {
  id: string;
  shelf_id?: string;
  container_id?: string;
  name: string;
  description?: string;
  barcode?: string;
  barcode_type?: string;
  label_id?: string;
  created_at: string;
  updated_at: string;
  created_by: string;
}

export interface CreateItemRequest {
  shelf_id?: string;
  container_id?: string;
  name: string;
  description?: string;
  barcode?: string;
  barcode_type?: string;
}

export interface UpdateItemRequest {
  name?: string;
  description?: string;
  shelf_id?: string;
  container_id?: string;
  barcode?: string;
  barcode_type?: string;
}

export interface ItemResponse {
  id: string;
  shelf_id?: string;
  container_id?: string;
  name: string;
  description?: string;
  barcode?: string;
  barcode_type?: string;
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

export interface Label {
  id: string;
  number: number;
  qr_data: string;
  batch_id?: string;
  assigned_to_type?: string;
  assigned_to_id?: string;
  created_at: string;
  assigned_at?: string;
}

export interface GenerateLabelsRequest {
  count: number;
  template?: string;
}

export interface GenerateLabelsResponse {
  batch_id: string;
  labels: LabelResponse[];
  count: number;
}

export interface LabelResponse {
  id: string;
  number: number;
  qr_data: string;
  batch_id?: string;
  assigned_to_type?: string;
  assigned_to_id?: string;
  created_at: string;
  assigned_at?: string;
}

export interface AssignLabelRequest {
  assigned_to_type: string;
  assigned_to_id: string;
}
