import { RakutenClient } from '../src/lib/rakuten/client';
import { createMockRakutenResponse } from './utils/factories';

// Mock global fetch
const mockFetch = jest.fn();
global.fetch = mockFetch;

describe('RakutenClient', () => {
  let client: RakutenClient;

  beforeEach(() => {
    client = new RakutenClient('test-app-id', 'test-affiliate-id');
    mockFetch.mockReset();
  });

  describe('constructor', () => {
    it('should create client with appId and affiliateId', () => {
      const clientWithAffiliate = new RakutenClient('app-id', 'affiliate-id');
      expect(clientWithAffiliate).toBeInstanceOf(RakutenClient);
    });

    it('should create client with only appId', () => {
      const clientWithoutAffiliate = new RakutenClient('app-id');
      expect(clientWithoutAffiliate).toBeInstanceOf(RakutenClient);
    });
  });

  describe('getRanking', () => {
    it('should fetch ranking data successfully', async () => {
      const mockResponse = createMockRakutenResponse(30);
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => mockResponse,
      });

      const result = await client.getRanking('100227');

      expect(result).toEqual(mockResponse);
      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('should include correct query parameters', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockRakutenResponse(),
      });

      await client.getRanking('100227', 'realtime');

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('applicationId=test-app-id');
      expect(calledUrl).toContain('genreId=100227');
      expect(calledUrl).toContain('affiliateId=test-affiliate-id');
      expect(calledUrl).toContain('formatVersion=2');
    });

    it('should use default genreId when not specified', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockRakutenResponse(),
      });

      await client.getRanking();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).toContain('genreId=0');
    });

    it('should not include affiliateId when not provided', async () => {
      const clientNoAffiliate = new RakutenClient('test-app-id');
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockRakutenResponse(),
      });

      await clientNoAffiliate.getRanking();

      const calledUrl = mockFetch.mock.calls[0][0] as string;
      expect(calledUrl).not.toContain('affiliateId');
    });

    it('should throw error on non-ok response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 400,
        statusText: 'Bad Request',
      });

      await expect(client.getRanking('invalid')).rejects.toThrow(
        'Rakuten API Error: 400 Bad Request'
      );
    });

    it('should throw error on API error in response body', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({
          error: 'wrong_parameter',
          error_description: 'Invalid parameter',
        }),
      });

      await expect(client.getRanking()).rejects.toThrow(
        'Rakuten API Error Body: wrong_parameter - Invalid parameter'
      );
    });

    it('should handle network error', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));

      await expect(client.getRanking()).rejects.toThrow('Network error');
    });

    it('should return correct number of items', async () => {
      const itemCount = 50;
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => createMockRakutenResponse(itemCount),
      });

      const result = await client.getRanking();

      expect(result.Items).toHaveLength(itemCount);
    });
  });
});
