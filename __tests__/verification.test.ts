// Import mock setup first
import '../__tests__/utils/prisma-mock';

import { VerificationService } from '../src/lib/verification/service';

describe('VerificationService', () => {
  describe('calculatePriority', () => {
    it('should assign highest score (+50) to Top 3 items', () => {
      const score = VerificationService.calculatePriority(1, null, null);
      expect(score).toBeGreaterThanOrEqual(50);
    });

    it('should assign high score (+30) to Top 10 items', () => {
      const score = VerificationService.calculatePriority(10, null, null);
      expect(score).toBeGreaterThanOrEqual(30);
      expect(score).toBeLessThan(50);
    });

    it('should assign medium score (+10) to Top 50 items', () => {
      const score = VerificationService.calculatePriority(50, null, null);
      expect(score).toBeGreaterThanOrEqual(10);
      expect(score).toBeLessThan(30);
    });

    it('should assign base score (+1) to items below rank 50', () => {
      const score = VerificationService.calculatePriority(51, null, null);
      expect(score).toBe(1);
    });

    it('should boost score (+40) if rate diff is large (>= 5.0)', () => {
      // Rank > 50 (Base 1) + Diff >= 5.0 (40) = 41
      const score = VerificationService.calculatePriority(51, 15.0, 10.0);
      expect(score).toBe(41);
    });

    it('should boost score (+20) if rate diff is medium (>= 1.0)', () => {
      // Rank > 50 (Base 1) + Diff >= 1.0 (20) = 21
      const score = VerificationService.calculatePriority(51, 11.0, 10.0);
      expect(score).toBe(21);
    });

    it('should not boost score if rate diff is small (< 1.0)', () => {
      // Rank > 50 (Base 1) + Diff < 1.0 (0) = 1
      const score = VerificationService.calculatePriority(51, 10.5, 10.0);
      expect(score).toBe(1);
    });

    // Additional edge case tests
    it('should handle null apiRate correctly', () => {
      const score = VerificationService.calculatePriority(1, null, 5.0);
      expect(score).toBe(50); // Only rank score, no diff boost
    });

    it('should handle null verifiedRate correctly', () => {
      const score = VerificationService.calculatePriority(1, 5.0, null);
      expect(score).toBe(50); // Only rank score, no diff boost
    });

    it('should combine rank and diff scores correctly', () => {
      // Top 3 (50) + Large diff (40) = 90
      const score = VerificationService.calculatePriority(1, 10.0, 3.0);
      expect(score).toBe(90);
    });

    it('should handle rank boundary at 3', () => {
      expect(VerificationService.calculatePriority(3, null, null)).toBe(50);
      expect(VerificationService.calculatePriority(4, null, null)).toBe(30);
    });

    it('should handle rank boundary at 10', () => {
      expect(VerificationService.calculatePriority(10, null, null)).toBe(30);
      expect(VerificationService.calculatePriority(11, null, null)).toBe(10);
    });

    it('should handle rank boundary at 50', () => {
      expect(VerificationService.calculatePriority(50, null, null)).toBe(10);
      expect(VerificationService.calculatePriority(51, null, null)).toBe(1);
    });
  });
});
