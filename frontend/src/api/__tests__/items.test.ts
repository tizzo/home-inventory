import { describe, it, expect, vi, beforeEach } from 'vitest';
import { itemsApi } from '../items';
import apiClient from '../client';
import { mockItem, createPaginatedResponse } from '../../test/mockData';

vi.mock('../client');

describe('itemsApi', () => {
  const mockedApiClient = vi.mocked(apiClient);

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('getAll', () => {
    it('should fetch all items', async () => {
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await itemsApi.getAll();

      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/items', { params: undefined });
      expect(result).toEqual(mockResponse);
    });

    it('should fetch items with pagination params', async () => {
      const params = { limit: 10, offset: 20 };
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await itemsApi.getAll(params);

      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/items', { params });
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getByShelf', () => {
    it('should fetch items by shelf', async () => {
      const shelfId = 'shelf-1';
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await itemsApi.getByShelf(shelfId);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/api/shelves/${shelfId}/items`,
        { params: undefined }
      );
      expect(result).toEqual(mockResponse);
    });

    it('should fetch items by shelf with pagination', async () => {
      const shelfId = 'shelf-1';
      const params = { limit: 5, offset: 10 };
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await itemsApi.getByShelf(shelfId, params);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/api/shelves/${shelfId}/items`,
        { params }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getByContainer', () => {
    it('should fetch items by container', async () => {
      const containerId = 'container-1';
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedApiClient.get.mockResolvedValue({ data: mockResponse });

      const result = await itemsApi.getByContainer(containerId);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/api/containers/${containerId}/items`,
        { params: undefined }
      );
      expect(result).toEqual(mockResponse);
    });
  });

  describe('getById', () => {
    it('should fetch a single item by ID', async () => {
      mockedApiClient.get.mockResolvedValue({ data: mockItem });

      const result = await itemsApi.getById('item-1');

      expect(mockedApiClient.get).toHaveBeenCalledWith('/api/items/item-1');
      expect(result).toEqual(mockItem);
    });
  });

  describe('getByBarcode', () => {
    it('should fetch item by barcode', async () => {
      const barcode = '123456789';
      mockedApiClient.get.mockResolvedValue({ data: mockItem });

      const result = await itemsApi.getByBarcode(barcode);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/api/items/barcode/${encodeURIComponent(barcode)}`
      );
      expect(result).toEqual(mockItem);
    });

    it('should encode special characters in barcode', async () => {
      const barcode = 'ABC-123/456';
      mockedApiClient.get.mockResolvedValue({ data: mockItem });

      await itemsApi.getByBarcode(barcode);

      expect(mockedApiClient.get).toHaveBeenCalledWith(
        `/api/items/barcode/${encodeURIComponent(barcode)}`
      );
    });
  });

  describe('create', () => {
    it('should create a new item', async () => {
      const createData = { name: 'New Item', shelf_id: 'shelf-1' };
      mockedApiClient.post.mockResolvedValue({ data: mockItem });

      const result = await itemsApi.create(createData);

      expect(mockedApiClient.post).toHaveBeenCalledWith('/api/items', createData);
      expect(result).toEqual(mockItem);
    });
  });

  describe('update', () => {
    it('should update an item', async () => {
      const id = 'item-1';
      const updateData = { name: 'Updated Item' };
      mockedApiClient.put.mockResolvedValue({ data: mockItem });

      const result = await itemsApi.update(id, updateData);

      expect(mockedApiClient.put).toHaveBeenCalledWith(`/api/items/${id}`, updateData);
      expect(result).toEqual(mockItem);
    });
  });

  describe('delete', () => {
    it('should delete an item', async () => {
      const id = 'item-1';
      mockedApiClient.delete.mockResolvedValue(undefined);

      await itemsApi.delete(id);

      expect(mockedApiClient.delete).toHaveBeenCalledWith(`/api/items/${id}`);
    });
  });
});
