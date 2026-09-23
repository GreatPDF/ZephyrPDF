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
});
