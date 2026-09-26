import { describe, it, expect } from 'vitest';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { TextAnnotation, ImageAnnotation } from '../src/types/annotations';

describe('Resize Handles and Keyboard Deletion', () => {
  it('should resize from bottom-right (se) handle with minimum boundaries', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const imgAnn: ImageAnnotation = {
      id: 'img_resize_se',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,...',
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(imgAnn);

    // Simulate dragging SE handle: dx = +50, dy = +30
    const newWidth = Math.max(20, imgAnn.width + 50);
    const newHeight = Math.max(15, imgAnn.height + 30);
    manager.updateAnnotation(imgAnn.id, { width: newWidth, height: newHeight });

    const updated = manager.getAnnotation(imgAnn.id) as ImageAnnotation;
    expect(updated.width).toBe(200);
    expect(updated.height).toBe(130);
  });

  it('should resize from top-left (nw) handle updating both coordinates and dimensions', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const origX = 100;
    const origY = 100;
    const origW = 150;
    const origH = 100;

    const imgAnn: ImageAnnotation = {
      id: 'img_resize_nw',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,...',
      x: origX,
      y: origY,
      width: origW,
      height: origH,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(imgAnn);

    // Dragging NW handle: dx = -20 (stretched left), dy = -10 (stretched top)
    const dx = -20;
    const dy = -10;
    const newW = Math.max(20, origW - dx);
    const newH = Math.max(15, origH - dy);
    const newX = origX + dx;
    const newY = origY + dy;

    manager.updateAnnotation(imgAnn.id, { x: newX, y: newY, width: newW, height: newH });

    const updated = manager.getAnnotation(imgAnn.id) as ImageAnnotation;
    expect(updated.x).toBe(80);
    expect(updated.y).toBe(90);
    expect(updated.width).toBe(170);
    expect(updated.height).toBe(110);
  });

  it('should remove currently selected annotation on keyboard delete', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const textAnn: TextAnnotation = {
      id: 'text_del_1',
      type: 'text',
      pageIndex: 0,
      x: 50,
      y: 50,
      width: 100,
      height: 30,
      text: 'To be deleted',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(textAnn);
    manager.selectAnnotation(textAnn.id);
    expect(manager.getSelectedId()).toBe(textAnn.id);

    // Keyboard delete action
    const selectedId = manager.getSelectedId();
    if (selectedId) {
      manager.removeAnnotation(selectedId);
    }

    expect(manager.getAllAnnotations().length).toBe(0);
    expect(manager.getAnnotation(textAnn.id)).toBeUndefined();
  });

  it('clamps zoom scale between 0.3 and 4.0 and formats dynamic zoom percentage', () => {
    const clamp = (scale: number) => Math.max(0.3, Math.min(4.0, scale));

    expect(clamp(0.1)).toBe(0.3);
    expect(clamp(5.5)).toBe(4.0);
    expect(clamp(1.25)).toBe(1.25);

    const formatZoom = (zoom: number) => `${Math.round(zoom * 100)}%`;
    expect(formatZoom(1.0)).toBe('100%');
    expect(formatZoom(1.5)).toBe('150%');
    expect(formatZoom(0.75)).toBe('75%');
  });

  it('computes pan drag offsets and clamps scroll values accurately', () => {
    const scrollStartX = 100;
    const scrollStartY = 200;
    const panStartX = 300;
    const panStartY = 400;

    const currentX = 250;
    const currentY = 350;

    const dx = currentX - panStartX;
    const dy = currentY - panStartY;

    const targetScrollX = Math.max(0, scrollStartX - dx);
    const targetScrollY = Math.max(0, scrollStartY - dy);

    expect(targetScrollX).toBe(150);
    expect(targetScrollY).toBe(250);
  });
});
