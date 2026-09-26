import { describe, it, expect } from 'vitest';
import { TextSearchEngine } from '../src/core/text-search';

describe('Text Search Engine Options', () => {
  it('should support case-sensitive searching', async () => {
    const searchEngine = new TextSearchEngine();

    // Mock document with text items
    const mockDoc = {
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [
            { str: 'ZephyrPDF is an amazing OpenSource software tool.', transform: [1, 0, 0, 1, 0, 0], width: 100, height: 12 },
            { str: 'zephyrpdf runs everywhere.', transform: [1, 0, 0, 1, 0, 10], width: 100, height: 12 }
          ]
        })
      })
    } as any;

    await searchEngine.setDocument(mockDoc);

    // Case-insensitive search
    const matchesAll = searchEngine.search('zephyrpdf', false, false);
    expect(matchesAll.length).toBe(2);

    // Case-sensitive search
    const matchesCase = searchEngine.search('ZephyrPDF', true, false);
    expect(matchesCase.length).toBe(1);
    expect(matchesCase[0].text).toBe('ZephyrPDF');
  });

  it('should support match whole words search', async () => {
    const searchEngine = new TextSearchEngine();

    const mockDoc = {
      numPages: 1,
      getPage: async () => ({
        getTextContent: async () => ({
          items: [
            { str: 'The cat scattered the catalog on the cat carpet.', transform: [1, 0, 0, 1, 0, 0], width: 100, height: 12 }
          ]
        })
      })
    } as any;

    await searchEngine.setDocument(mockDoc);

    // Search without whole words
    const matchesSub = searchEngine.search('cat', false, false);
    expect(matchesSub.length).toBe(4); // cat, scattered, catalog, cat

    // Search with whole words
    const matchesWhole = searchEngine.search('cat', false, true);
    expect(matchesWhole.length).toBe(2); // exactly "cat" twice
  });

  it('should extract surrounding context snippets and support direct match selection', async () => {
    const searchEngine = new TextSearchEngine();

    const mockDoc = {
      numPages: 2,
      getPage: async (i: number) => ({
        getTextContent: async () => ({
          items: [
            {
              str: i === 1
                ? 'Welcome to ZephyrPDF viewing and editing workstation.'
                : 'Section 2 contains deep specifications for ZephyrPDF.',
              transform: [1, 0, 0, 1, 0, 0],
              width: 100,
              height: 12
            }
          ]
        })
      })
    } as any;

    await searchEngine.setDocument(mockDoc);

    const matches = searchEngine.search('ZephyrPDF', false, false);
    expect(matches.length).toBe(2);

    expect(matches[0].pageIndex).toBe(0);
    expect(matches[0].snippet).toContain('ZephyrPDF');
    expect(matches[0].snippet).toContain('Welcome to');

    expect(matches[1].pageIndex).toBe(1);
    expect(matches[1].snippet).toContain('specifications');

    // Test selectMatch
    expect(searchEngine.selectMatch(1)?.pageIndex).toBe(1);
    expect(searchEngine.getState().currentMatchIndex).toBe(1);

    expect(searchEngine.selectMatch(0)?.pageIndex).toBe(0);
    expect(searchEngine.getState().currentMatchIndex).toBe(0);

    // Out of bounds
    expect(searchEngine.selectMatch(-1)).toBeNull();
    expect(searchEngine.selectMatch(99)).toBeNull();
  });
});
