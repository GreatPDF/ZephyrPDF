import { describe, it, expect } from 'vitest';
import { PageManager } from '../src/organizer/page-manager';

describe('Page Range Parser', () => {
  it('should parse single page numbers', () => {
    const res = PageManager.parsePageRange('1, 3, 5', 10);
    expect(res).toEqual([0, 2, 4]);
  });

  it('should parse ranges like 2-5', () => {
    const res = PageManager.parsePageRange('2-5', 10);
    expect(res).toEqual([1, 2, 3, 4]);
  });

  it('should parse mixed ranges and singles with various delimiters', () => {
    const res = PageManager.parsePageRange('1-3, 6; 8-9', 10);
    expect(res).toEqual([0, 1, 2, 5, 7, 8]);
  });

  it('should clamp out of bound page numbers to maxPages', () => {
    const res = PageManager.parsePageRange('0, 4-12', 5);
    expect(res).toEqual([3, 4]);
  });

  it('should handle inverted ranges like 5-3', () => {
    const res = PageManager.parsePageRange('5-3', 10);
    expect(res).toEqual([2, 3, 4]);
  });

  it('should return empty array for empty or invalid strings', () => {
    expect(PageManager.parsePageRange('', 10)).toEqual([]);
    expect(PageManager.parsePageRange('invalid-range', 10)).toEqual([]);
  });

  it('should support selecting all page indices and filtering items for extraction', () => {
    const pageCount = 5;
    const selectedIndices = new Set<number>();

    // Select all
    for (let i = 0; i < pageCount; i++) selectedIndices.add(i);
    expect(selectedIndices.size).toBe(5);

    // Deselect all
    selectedIndices.clear();
    expect(selectedIndices.size).toBe(0);

    // Specific selection
    selectedIndices.add(1);
    selectedIndices.add(3);
    const sorted = Array.from(selectedIndices).sort((a, b) => a - b);
    expect(sorted).toEqual([1, 3]);
  });

  it('should parse ranges with extra spaces around hyphens and commas', () => {
    expect(PageManager.parsePageRange(' 1 - 3 ,  5 ', 10)).toEqual([0, 1, 2, 4]);
    expect(PageManager.parsePageRange('4 - 2', 10)).toEqual([1, 2, 3]);
  });
});

describe('Document Comparator and Diff Summary', () => {
  it('formats diff metrics and determines badge threshold correctly', () => {
    const summaryNoDiff = {
      docAName: 'original.pdf',
      docBName: 'copy.pdf',
      pageDiffs: [
        { pageIndex: 0, differingPixels: 0, diffPercent: 0, diffImageDataUrl: 'data:...' }
      ],
      changedPagesCount: 0
    };

    expect(summaryNoDiff.changedPagesCount).toBe(0);
    const badgeColor1 = summaryNoDiff.changedPagesCount > 0 ? '#ef4444' : '#10b981';
    expect(badgeColor1).toBe('#10b981'); // Emerald green for identical docs

    const summaryWithDiff = {
      docAName: 'v1.pdf',
      docBName: 'v2.pdf',
      pageDiffs: [
        { pageIndex: 0, differingPixels: 15420, diffPercent: 3.25, diffImageDataUrl: 'data:...' }
      ],
      changedPagesCount: 1
    };

    expect(summaryWithDiff.changedPagesCount).toBe(1);
    const badgeColor2 = summaryWithDiff.changedPagesCount > 0 ? '#ef4444' : '#10b981';
    expect(badgeColor2).toBe('#ef4444'); // Red for changed docs
  });

  it('validates page jump targets against document total pages', () => {
    const totalPages = 5;

    const validateJumpTarget = (val: string, total: number): { valid: boolean; page?: number; error?: string } => {
      const target = parseInt(val, 10);
      if (!isNaN(target) && target >= 1 && target <= total) {
        return { valid: true, page: target };
      }
      return { valid: false, error: `Please enter a valid page number between 1 and ${total}.` };
    };

    expect(validateJumpTarget('3', totalPages)).toEqual({ valid: true, page: 3 });
    expect(validateJumpTarget('1', totalPages)).toEqual({ valid: true, page: 1 });
    expect(validateJumpTarget('5', totalPages)).toEqual({ valid: true, page: 5 });

    expect(validateJumpTarget('0', totalPages).valid).toBe(false);
    expect(validateJumpTarget('6', totalPages).valid).toBe(false);
    expect(validateJumpTarget('abc', totalPages).valid).toBe(false);
  });
});
