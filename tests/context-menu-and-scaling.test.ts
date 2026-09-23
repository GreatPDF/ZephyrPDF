import { describe, it, expect } from 'vitest';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { ImageAnnotation, ShapeAnnotation } from '../src/types/annotations';

describe('Annotation Context Menu and Scaling', () => {
  it('should scale image annotations up and down accurately', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const imgAnn: ImageAnnotation = {
      id: 'img_scale_1',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      x: 100,
      y: 100,
      width: 100,
      height: 80,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(imgAnn);

    // Scale up 1.25x (+25%)
    manager.updateAnnotation(imgAnn.id, {
      width: Math.round(imgAnn.width * 1.25),
      height: Math.round(imgAnn.height * 1.25)
    });

    const scaledUp = manager.getAnnotation(imgAnn.id) as ImageAnnotation;
    expect(scaledUp.width).toBe(125);
    expect(scaledUp.height).toBe(100);

    // Scale down 0.8x (-20%)
    manager.updateAnnotation(imgAnn.id, {
      width: Math.round(scaledUp.width * 0.8),
      height: Math.round(scaledUp.height * 0.8)
    });

    const scaledDown = manager.getAnnotation(imgAnn.id) as ImageAnnotation;
    expect(scaledDown.width).toBe(100);
    expect(scaledDown.height).toBe(80);
  });

  it('should duplicate shape annotations with clean offsets', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const origShape: ShapeAnnotation = {
      id: 'orig_rect_1',
      type: 'rectangle',
      pageIndex: 0,
      x: 50,
      y: 50,
      width: 120,
      height: 60,
      strokeColor: '#38bdf8',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(origShape);

    // Duplicate logic matching ContextMenu
    const duplicate: ShapeAnnotation = {
      ...origShape,
      id: 'dup_rect_1',
      x: origShape.x + 20,
      y: origShape.y + 20,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(duplicate);

    expect(manager.getAllAnnotations().length).toBe(2);
    expect(manager.getAnnotation('dup_rect_1')?.type).toBe('rectangle');
    expect((manager.getAnnotation('dup_rect_1') as ShapeAnnotation).x).toBe(70);
    expect((manager.getAnnotation('dup_rect_1') as ShapeAnnotation).y).toBe(70);
  });
});
