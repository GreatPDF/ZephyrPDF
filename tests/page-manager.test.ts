import { describe, it, expect, beforeEach } from 'vitest';
import { PageManager } from '../src/organizer/page-manager';
import { HistoryManager } from '../src/core/history';
import { AnnotationManager } from '../src/annotations/manager';
import { PdfExporter } from '../src/export/pdf-exporter';
import { PDFDocument } from 'pdf-lib';

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

  it('should restore page manager state from snapshot on cancellation', () => {
    const snapshot = pageManager.getAllPages().map(p => ({ ...p }));
    expect(pageManager.getPageCount()).toBe(3);

    pageManager.insertBlankPage(3);
    pageManager.rotatePage(0, 90);
    expect(pageManager.getPageCount()).toBe(4);
    expect(pageManager.getPages()[0].rotation).toBe(90);

    // Restore state
    pageManager.restorePages(snapshot);
    expect(pageManager.getPageCount()).toBe(3);
    expect(pageManager.getPages()[0].rotation).toBe(0);
  });

  it('should export document with inserted blank page and preserve annotations on blank page', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([595, 842]);
    const originalBytes = await doc.save();

    const pm = new PageManager(new HistoryManager());
    pm.initFromDocument(1, [{ width: 595, height: 842, rotation: 0 }]);
    pm.insertBlankPage(1, 595, 842);
    expect(pm.getPageCount()).toBe(2);

    const am = new AnnotationManager(new HistoryManager());
    am.addAnnotation({
      id: 'blank_text_1',
      type: 'text',
      pageIndex: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 30,
      text: 'Notes on blank page',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#ff0000',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const exportedBytes = await PdfExporter.exportDocument(originalBytes, pm, am);
    expect(exportedBytes).toBeInstanceOf(Uint8Array);

    const reloaded = await PDFDocument.load(exportedBytes);
    expect(reloaded.getPageCount()).toBe(2);
    expect(reloaded.getPage(1).getSize().width).toBeCloseTo(595, 0);
  });

  it('should append pages from another document and export merged PDF', async () => {
    const doc1 = await PDFDocument.create();
    doc1.addPage([595, 842]);
    const doc1Bytes = await doc1.save();

    const doc2 = await PDFDocument.create();
    doc2.addPage([612, 792]);
    doc2.addPage([612, 792]);
    const doc2Bytes = await doc2.save();

    const pm = new PageManager(new HistoryManager());
    pm.initFromDocument(1, [{ width: 595, height: 842, rotation: 0 }]);

    const mergedDocId = 'merged_doc_abc';
    pm.appendDocumentPages(mergedDocId, 2, [
      { width: 612, height: 792, rotation: 0 },
      { width: 612, height: 792, rotation: 0 }
    ]);
    expect(pm.getPageCount()).toBe(3);

    const mergedDocs = new Map<string, Uint8Array>();
    mergedDocs.set(mergedDocId, doc2Bytes);

    const am = new AnnotationManager(new HistoryManager());
    const exportedBytes = await PdfExporter.exportDocument(
      doc1Bytes,
      pm,
      am,
      undefined,
      mergedDocs
    );

    const reloaded = await PDFDocument.load(exportedBytes);
    expect(reloaded.getPageCount()).toBe(3);
    expect(reloaded.getPage(0).getSize().width).toBeCloseTo(595, 0);
    expect(reloaded.getPage(1).getSize().width).toBeCloseTo(612, 0);
    expect(reloaded.getPage(2).getSize().width).toBeCloseTo(612, 0);
  });
});
