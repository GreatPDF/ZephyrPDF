import { describe, it, expect, beforeEach } from 'vitest';
import { PageManager } from '../src/organizer/page-manager';
import { HistoryManager } from '../src/core/history';

describe('PageManager', () => {
  let history: HistoryManager;
  let pageManager: PageManager;

  beforeEach(() => {
    history = new HistoryManager();
    pageManager = new PageManager(history);
    pageManager.initFromDocument(3, [
      { width: 595, height: 842, rotation: 0 },
      { width: 595, height: 842, rotation: 0 },
      { width: 595, height: 842, rotation: 0 }
    ]);
  });

  it('should initialize with correct page count and numbering', () => {
    expect(pageManager.getPageCount()).toBe(3);
    const pages = pageManager.getPages();
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[2].pageNumber).toBe(3);
  });

  it('should reorder pages and update sequential numbering', () => {
    pageManager.movePage(0, 2);
    const pages = pageManager.getPages();
    expect(pages[0].originalIndex).toBe(1);
    expect(pages[1].originalIndex).toBe(2);
    expect(pages[2].originalIndex).toBe(0);
    expect(pages[0].pageNumber).toBe(1);
    expect(pages[2].pageNumber).toBe(3);
  });

  it('should rotate a page and support undo', async () => {
    pageManager.rotatePage(0, 90);
    expect(pageManager.getPages()[0].rotation).toBe(90);

    await history.undo();
    expect(pageManager.getPages()[0].rotation).toBe(0);

    await history.redo();
    expect(pageManager.getPages()[0].rotation).toBe(90);
  });

  it('should insert blank pages at specified position', () => {
    pageManager.insertBlankPage(1, 600, 800);
    expect(pageManager.getPageCount()).toBe(4);
    const pages = pageManager.getPages();
    expect(pages[1].isBlank).toBe(true);
    expect(pages[1].pageNumber).toBe(2);
    expect(pages[2].pageNumber).toBe(3);
  });

  it('should duplicate a page and support undo/redo', async () => {
    pageManager.rotatePage(1, 90);
    pageManager.duplicatePage(1);

    expect(pageManager.getPageCount()).toBe(4);
    const pages = pageManager.getPages();
    expect(pages[1].originalIndex).toBe(1);
    expect(pages[2].originalIndex).toBe(1);
    expect(pages[2].rotation).toBe(90);
    expect(pages[2].pageNumber).toBe(3);
    expect(pages[3].pageNumber).toBe(4);

    await history.undo();
    expect(pageManager.getPageCount()).toBe(3);

    await history.redo();
    expect(pageManager.getPageCount()).toBe(4);
  });

  it('should delete a page and prevent deleting all pages', () => {
    pageManager.deletePage(0);
    expect(pageManager.getPageCount()).toBe(2);

    pageManager.deletePage(0);
    expect(pageManager.getPageCount()).toBe(1);

    expect(() => {
      pageManager.deletePage(0);
    }).toThrow('A document must contain at least one page');
  });
});
