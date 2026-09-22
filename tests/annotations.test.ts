import { describe, it, expect, beforeEach } from 'vitest';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { HighlightAnnotation, TextAnnotation, StampAnnotation } from '../src/types/annotations';

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
});
