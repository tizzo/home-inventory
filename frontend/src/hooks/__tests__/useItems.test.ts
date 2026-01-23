import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import type { ReactNode } from 'react';
import {
  useItems,
  useItemsByShelf,
  useItemsByContainer,
  useItem,
  useItemByBarcode,
  useCreateItem,
  useUpdateItem,
  useDeleteItem,
} from '../useItems';
import { itemsApi } from '../../api/items';
import { createTestQueryClient } from '../../test/utils';
import { mockItem, createPaginatedResponse } from '../../test/mockData';

vi.mock('../../api/items');
const mockedItemsApi = vi.mocked(itemsApi);

const createWrapper = (queryClient: QueryClient) => {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>{children}</BrowserRouter>
    </QueryClientProvider>
  );
};

describe('useItems hooks', () => {
  let queryClient: QueryClient;

  beforeEach(() => {
    queryClient = createTestQueryClient();
    vi.clearAllMocks();
  });

  describe('useItems', () => {
    it('should fetch all items', async () => {
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedItemsApi.getAll.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useItems(), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(result.current.data).toEqual(mockResponse);
      expect(mockedItemsApi.getAll).toHaveBeenCalledWith(undefined);
    });

    it('should fetch items with pagination params', async () => {
      const params = { limit: 10, offset: 20 };
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedItemsApi.getAll.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useItems(params), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.getAll).toHaveBeenCalledWith(params);
    });
  });

  describe('useItemsByShelf', () => {
    it('should fetch items by shelf', async () => {
      const shelfId = 'shelf-1';
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedItemsApi.getByShelf.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useItemsByShelf(shelfId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.getByShelf).toHaveBeenCalledWith(shelfId, undefined);
    });

    it('should not fetch when shelfId is empty', () => {
      const { result } = renderHook(() => useItemsByShelf(''), {
        wrapper: createWrapper(queryClient),
      });

      expect(result.current.isFetching).toBe(false);
      expect(mockedItemsApi.getByShelf).not.toHaveBeenCalled();
    });
  });

  describe('useItemsByContainer', () => {
    it('should fetch items by container', async () => {
      const containerId = 'container-1';
      const mockResponse = createPaginatedResponse([mockItem]);
      mockedItemsApi.getByContainer.mockResolvedValue(mockResponse);

      const { result } = renderHook(() => useItemsByContainer(containerId), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.getByContainer).toHaveBeenCalledWith(containerId, undefined);
    });
  });

  describe('useItem', () => {
    it('should fetch a single item', async () => {
      mockedItemsApi.getById.mockResolvedValue(mockItem);

      const { result } = renderHook(() => useItem('item-1'), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.getById).toHaveBeenCalledWith('item-1');
      expect(result.current.data).toEqual(mockItem);
    });
  });

  describe('useItemByBarcode', () => {
    it('should fetch item by barcode', async () => {
      const barcode = '123456789';
      mockedItemsApi.getByBarcode.mockResolvedValue(mockItem);

      const { result } = renderHook(() => useItemByBarcode(barcode), {
        wrapper: createWrapper(queryClient),
      });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.getByBarcode).toHaveBeenCalledWith(barcode);
    });
  });

  describe('useCreateItem', () => {
    it('should create an item and invalidate queries', async () => {
      mockedItemsApi.create.mockResolvedValue(mockItem);

      const { result } = renderHook(() => useCreateItem(), {
        wrapper: createWrapper(queryClient),
      });

      const createData = { name: 'New Item', shelf_id: 'shelf-1' };
      result.current.mutate(createData);

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.create).toHaveBeenCalledWith(createData);
    });
  });

  describe('useUpdateItem', () => {
    it('should update an item and invalidate queries', async () => {
      mockedItemsApi.update.mockResolvedValue(mockItem);

      const { result } = renderHook(() => useUpdateItem(), {
        wrapper: createWrapper(queryClient),
      });

      const updateData = { name: 'Updated Item' };
      result.current.mutate({ id: 'item-1', data: updateData });

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.update).toHaveBeenCalledWith('item-1', updateData);
    });
  });

  describe('useDeleteItem', () => {
    it('should delete an item and invalidate queries', async () => {
      mockedItemsApi.delete.mockResolvedValue(undefined);

      const { result } = renderHook(() => useDeleteItem(), {
        wrapper: createWrapper(queryClient),
      });

      result.current.mutate('item-1');

      await waitFor(() => {
        expect(result.current.isSuccess).toBe(true);
      });

      expect(mockedItemsApi.delete).toHaveBeenCalledWith('item-1');
    });
  });
});
