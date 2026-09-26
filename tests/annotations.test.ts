import { describe, it, expect, beforeEach } from 'vitest';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { HighlightAnnotation, TextAnnotation, StampAnnotation, MarkupAnnotation, LineAnnotation, SignatureAnnotation } from '../src/types/annotations';
import { PdfExporter } from '../src/export/pdf-exporter';
import { PageManager } from '../src/organizer/page-manager';
import { createSamplePdf } from '../src/utils/samples';
import { PDFDocument } from 'pdf-lib';

describe('AnnotationManager', () => {
  let history: HistoryManager;
  let manager: AnnotationManager;

  beforeEach(() => {
    history = new HistoryManager();
    manager = new AnnotationManager(history);
  });

  it('should add annotations and query them by page', () => {
    const ann1: HighlightAnnotation = {
      id: 'ann_1',
      type: 'highlight',
      pageIndex: 0,
      rects: [{ x: 10, y: 20, width: 100, height: 15 }],
      color: '#ffeb3b',
      opacity: 0.4,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const ann2: TextAnnotation = {
      id: 'ann_2',
      type: 'text',
      pageIndex: 1,
      x: 50,
      y: 100,
      width: 120,
      height: 30,
      text: 'Note text',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(ann1);
    manager.addAnnotation(ann2);

    expect(manager.getAllAnnotations().length).toBe(2);
    expect(manager.getAnnotationsForPage(0).length).toBe(1);
    expect(manager.getAnnotationsForPage(1).length).toBe(1);
    expect(manager.getAnnotation('ann_1')).toBeDefined();
  });

  it('should support undo and redo when adding annotations', async () => {
    const ann: StampAnnotation = {
      id: 'stamp_1',
      type: 'stamp',
      pageIndex: 0,
      stampType: 'APPROVED',
      x: 100,
      y: 100,
      width: 140,
      height: 45,
      color: '#2e7d32',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(ann);
    expect(manager.getAllAnnotations().length).toBe(1);

    await history.undo();
    expect(manager.getAllAnnotations().length).toBe(0);

    await history.redo();
    expect(manager.getAllAnnotations().length).toBe(1);
  });

  it('should export and import annotations as JSON', () => {
    const ann: TextAnnotation = {
      id: 'ann_json',
      type: 'text',
      pageIndex: 0,
      x: 20,
      y: 40,
      width: 100,
      height: 25,
      text: 'Exported Note',
      fontSize: 12,
      fontFamily: 'sans-serif',
      color: '#ff0000',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(ann);
    const jsonStr = manager.exportJson();
    expect(jsonStr).toContain('Exported Note');

    const newManager = new AnnotationManager(new HistoryManager());
    newManager.importJson(jsonStr);
    expect(newManager.getAllAnnotations().length).toBe(1);
    expect(newManager.getAnnotation('ann_json')?.type).toBe('text');
  });

  it('should support markup annotations (underline, strikeout) with rect hit detection', () => {
    const underlineAnn: MarkupAnnotation = {
      id: 'und_1',
      type: 'underline',
      pageIndex: 0,
      rects: [{ x: 50, y: 100, width: 80, height: 14 }],
      color: '#2563eb',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const strikeAnn: MarkupAnnotation = {
      id: 'str_1',
      type: 'strikeout',
      pageIndex: 0,
      rects: [{ x: 150, y: 100, width: 60, height: 14 }],
      color: '#ef4444',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(underlineAnn);
    manager.addAnnotation(strikeAnn);

    expect(manager.getAllAnnotations().length).toBe(2);
    expect(manager.getAnnotation('und_1')?.type).toBe('underline');
    expect(manager.getAnnotation('str_1')?.type).toBe('strikeout');

    // Hit test helper logic verification
    const hitTest = (ann: MarkupAnnotation, p: { x: number; y: number }) => {
      return ann.rects.some(r => p.x >= r.x && p.x <= r.x + r.width && p.y >= r.y && p.y <= r.y + r.height);
    };

    expect(hitTest(underlineAnn, { x: 70, y: 105 })).toBe(true);
    expect(hitTest(underlineAnn, { x: 10, y: 105 })).toBe(false);
    expect(hitTest(strikeAnn, { x: 180, y: 107 })).toBe(true);
    expect(hitTest(strikeAnn, { x: 220, y: 107 })).toBe(false);
  });

  it('should support arrow and line annotations and bake them into exported PDF', async () => {
    const arrowAnn: LineAnnotation = {
      id: 'arrow_1',
      type: 'arrow',
      pageIndex: 0,
      x1: 50,
      y1: 50,
      x2: 250,
      y2: 150,
      strokeColor: '#3b82f6',
      strokeWidth: 3,
      arrowHead: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(arrowAnn);
    expect(manager.getAnnotation('arrow_1')).toBeDefined();
    expect(manager.getAnnotationsForPage(0).length).toBe(1);

    const sourceBytes = await createSamplePdf();
    const pm = new PageManager(history);
    pm.initFromDocument(1, [{ width: 595, height: 842, rotation: 0 }]);

    const exported = await PdfExporter.exportDocument(sourceBytes, pm, manager);
    expect(exported).toBeInstanceOf(Uint8Array);

    const doc = await PDFDocument.load(exported);
    expect(doc.getPageCount()).toBe(1);
  });

  it('should create, select, and manage digital signature annotations with history', () => {
    const sigAnn: SignatureAnnotation = {
      id: 'sig_test_1',
      type: 'signature',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      x: 120,
      y: 350,
      width: 160,
      height: 60,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(sigAnn);
    manager.selectAnnotation('sig_test_1');

    expect(manager.getAnnotation('sig_test_1')).toBeDefined();
    expect(manager.getSelectedId()).toBe('sig_test_1');
    expect(manager.getAnnotationsForPage(0).length).toBe(1);

    history.undo();
    expect(manager.getAllAnnotations().length).toBe(0);
    expect(manager.getSelectedId()).toBeNull();

    history.redo();
    expect(manager.getAllAnnotations().length).toBe(1);
    expect(manager.getAnnotation('sig_test_1')?.type).toBe('signature');
  });
});
