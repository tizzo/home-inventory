import type {
  ItemResponse,
  RoomResponse,
  ShelvingUnitResponse,
  ShelfResponse,
  ContainerResponse,
  LabelResponse,
  PhotoResponse,
} from '../types/generated';
import type { User } from '../types/auth';

const testDate = new Date('2024-01-01T00:00:00Z');

export const mockUser: User = {
  user_id: 'user-1',
  email: 'test@example.com',
  name: 'Test User',
};

export const mockItem: ItemResponse = {
  id: 'item-1',
  name: 'Test Item',
  description: 'A test item',
  shelf_id: 'shelf-1',
  container_id: undefined,
  created_at: testDate,
  updated_at: testDate,
};

export const mockRoom: RoomResponse = {
  id: 'room-1',
  name: 'Test Room',
  created_at: testDate,
  updated_at: testDate,
};

export const mockShelvingUnit: ShelvingUnitResponse = {
  id: 'unit-1',
  name: 'Test Shelving Unit',
  room_id: 'room-1',
  created_at: testDate,
  updated_at: testDate,
};

export const mockShelf: ShelfResponse = {
  id: 'shelf-1',
  name: 'Test Shelf',
  shelving_unit_id: 'unit-1',
  created_at: testDate,
  updated_at: testDate,
};

export const mockContainer: ContainerResponse = {
  id: 'container-1',
  name: 'Test Container',
  shelf_id: 'shelf-1',
  created_at: testDate,
  updated_at: testDate,
};

export const mockLabel: LabelResponse = {
  id: 'label-1',
  name: 'Test Label',
  created_at: testDate,
  updated_at: testDate,
};

export const mockPhoto: PhotoResponse = {
  id: 'photo-1',
  item_id: 'item-1',
  url: 'https://example.com/photo.jpg',
  created_at: testDate,
};

export const createPaginatedResponse = <T>(items: T[], total?: number) => ({
  items,
  total: total ?? items.length,
  limit: 50,
  offset: 0,
});
