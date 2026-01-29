import { mockDeep, mockReset, DeepMockProxy } from 'jest-mock-extended';
import { PrismaClient } from '@prisma/client';

// Create a deeply mocked PrismaClient
export type MockPrismaClient = DeepMockProxy<PrismaClient>;

export const prismaMock = mockDeep<PrismaClient>();

// Reset mock before each test
beforeEach(() => {
  mockReset(prismaMock);
});

// This is used to mock the actual prisma import
jest.mock('@/lib/prisma', () => ({
  prisma: prismaMock,
}));

export { prismaMock as prisma };
