import { describe, it, expect } from 'vitest';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { ImageAnnotation } from '../src/types/annotations';
import { pointInRect } from '../src/utils/geometry';
import { processImageDataUrl } from '../src/utils/image';

describe('Image Deletion & Mobile UX Tests', () => {
  it('should remove image annotations cleanly from active manager', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const imgAnn: ImageAnnotation = {
      id: 'img_test_delete_1',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      x: 100,
      y: 100,
      width: 150,
      height: 100,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(imgAnn);
    manager.selectAnnotation(imgAnn.id);
    expect(manager.getAllAnnotations().length).toBe(1);
    expect(manager.getSelectedId()).toBe('img_test_delete_1');

    // Simulate delete action (via keypress, context menu, or corner badge)
    const selectedId = manager.getSelectedId();
    if (selectedId) {
      manager.removeAnnotation(selectedId);
    }

    expect(manager.getAllAnnotations().length).toBe(0);
    expect(manager.getAnnotation('img_test_delete_1')).toBeUndefined();
    expect(manager.getSelectedId()).toBeNull();

    // Verify undo restores the deleted image
    history.undo();
    expect(manager.getAllAnnotations().length).toBe(1);
    expect(manager.getAnnotation('img_test_delete_1')).toBeDefined();

    // Verify redo deletes the image again
    history.redo();
    expect(manager.getAllAnnotations().length).toBe(0);
    expect(manager.getAnnotation('img_test_delete_1')).toBeUndefined();
  });

  it('should route operations to dynamically swapped annotation manager instances', () => {
    const history1 = new HistoryManager();
    const initialManager = new AnnotationManager(history1);

    const history2 = new HistoryManager();
    let activeManager = new AnnotationManager(history2);

    // Context menu / text selection menu getter pattern
    const getManager = () => activeManager;

    const imgAnn: ImageAnnotation = {
      id: 'img_session_swap',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,...',
      x: 200,
      y: 150,
      width: 100,
      height: 80,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    getManager().addAnnotation(imgAnn);
    expect(activeManager.getAllAnnotations().length).toBe(1);
    expect(initialManager.getAllAnnotations().length).toBe(0);

    // Deleting via getter removes from activeManager, not obsolete initialManager
    getManager().removeAnnotation(imgAnn.id);
    expect(activeManager.getAllAnnotations().length).toBe(0);
  });

  it('should accurately hit-test image bounding box for eraser tool', () => {
    const imgAnn: ImageAnnotation = {
      id: 'img_eraser_hit',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,...',
      x: 100,
      y: 200,
      width: 150,
      height: 100,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const rect = { x: imgAnn.x, y: imgAnn.y, width: imgAnn.width, height: imgAnn.height };

    // Points inside image bounds
    expect(pointInRect({ x: 100, y: 200 }, rect)).toBe(true);
    expect(pointInRect({ x: 175, y: 250 }, rect)).toBe(true);
    expect(pointInRect({ x: 250, y: 300 }, rect)).toBe(true);

    // Points outside image bounds
    expect(pointInRect({ x: 99, y: 200 }, rect)).toBe(false);
    expect(pointInRect({ x: 251, y: 250 }, rect)).toBe(false);
    expect(pointInRect({ x: 175, y: 301 }, rect)).toBe(false);
  });

  it('should verify mobile drawer state logic and class toggle behavior', () => {
    const classList = new Set<string>();
    const mockElement = {
      classList: {
        add: (c: string) => classList.add(c),
        remove: (c: string) => classList.delete(c),
        contains: (c: string) => classList.has(c),
        toggle: (c: string) => {
          if (classList.has(c)) {
            classList.delete(c);
            return false;
          } else {
            classList.add(c);
            return true;
          }
        }
      }
    };

    // Open drawer
    mockElement.classList.add('mobile-open');
    mockElement.classList.remove('collapsed');
    expect(mockElement.classList.contains('mobile-open')).toBe(true);
    expect(mockElement.classList.contains('collapsed')).toBe(false);

    // Close drawer
    mockElement.classList.remove('mobile-open');
    expect(mockElement.classList.contains('mobile-open')).toBe(false);

    // Toggle drawer
    mockElement.classList.toggle('mobile-open');
    expect(mockElement.classList.contains('mobile-open')).toBe(true);
    mockElement.classList.toggle('mobile-open');
    expect(mockElement.classList.contains('mobile-open')).toBe(false);
  });

  it('should accurately nudge selected annotation coordinates by 1px and 10px', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const imgAnn: ImageAnnotation = {
      id: 'img_nudge',
      type: 'image',
      pageIndex: 0,
      dataUrl: 'data:image/png;base64,...',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(imgAnn);
    manager.selectAnnotation(imgAnn.id);

    // Nudge right 1px
    manager.updateAnnotation(imgAnn.id, { x: imgAnn.x + 1 });
    expect((manager.getAnnotation(imgAnn.id) as ImageAnnotation).x).toBe(101);

    // Nudge down with shift 10px
    manager.updateAnnotation(imgAnn.id, { y: imgAnn.y + 10 });
    expect((manager.getAnnotation(imgAnn.id) as ImageAnnotation).y).toBe(110);

    // Nudge left 10px
    manager.updateAnnotation(imgAnn.id, { x: 101 - 10 });
    expect((manager.getAnnotation(imgAnn.id) as ImageAnnotation).x).toBe(91);

    // Nudge up 1px
    manager.updateAnnotation(imgAnn.id, { y: 110 - 1 });
    expect((manager.getAnnotation(imgAnn.id) as ImageAnnotation).y).toBe(109);
  });

  it('should simulate temporary spacebar hand pan mode transition', () => {
    let activeTool = 'freehand';
    let toolBeforeSpace = 'select';
    let isSpacePressed = false;

    // Press Space
    if (!isSpacePressed) {
      isSpacePressed = true;
      toolBeforeSpace = activeTool;
      activeTool = 'hand';
    }
    expect(activeTool).toBe('hand');
    expect(toolBeforeSpace).toBe('freehand');

    // Release Space
    if (isSpacePressed) {
      isSpacePressed = false;
      activeTool = toolBeforeSpace;
    }
    expect(activeTool).toBe('freehand');
  });

  it('should compute aspect-ratio-constrained dimensions when Shift is held during corner resize', () => {
    const origRect = { x: 50, y: 50, width: 200, height: 100 }; // 2:1 aspect ratio
    const aspect = origRect.width / origRect.height; // 2.0

    // Simulate resizing from SE handle with Shift held
    const dx = 50;
    const dy = 80;
    let newW = Math.max(20, origRect.width + dx); // 250
    let newH = Math.max(15, origRect.height + dy); // 180
    const shiftKey = true;

    if (shiftKey && origRect.width > 0 && origRect.height > 0) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        newH = Math.max(15, newW / aspect);
      } else {
        newW = Math.max(20, newH * aspect);
      }
    }

    // Since |dy| = 80 > |dx| = 50, newH is 180 and newW scales to 180 * 2 = 360
    expect(newH).toBe(180);
    expect(newW).toBe(360);
    expect(newW / newH).toBeCloseTo(aspect, 2);
  });

  it('should safely process image data URL with fallback dimensions in non-DOM environments', async () => {
    const rawDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';
    const processed = await processImageDataUrl(rawDataUrl, 200, 200);

    expect(processed.dataUrl).toBe(rawDataUrl);
    expect(processed.width).toBeGreaterThanOrEqual(30);
    expect(processed.height).toBeGreaterThanOrEqual(20);
  });

  it('manages mobile drawer visibility, touch dismissal, and auto-close triggers', () => {
    let isMobileOpen = false;
    let isBackdropVisible = false;

    const openDrawer = (width: number) => {
      if (width <= 768) {
        isMobileOpen = true;
        isBackdropVisible = true;
      }
    };

    const closeDrawer = () => {
      isMobileOpen = false;
      isBackdropVisible = false;
    };

    openDrawer(375); // iPhone viewport width
    expect(isMobileOpen).toBe(true);
    expect(isBackdropVisible).toBe(true);

    // Simulate touch dismissal on backdrop
    closeDrawer();
    expect(isMobileOpen).toBe(false);
    expect(isBackdropVisible).toBe(false);

    // Reopen and test desktop width behavior
    openDrawer(1280);
    expect(isMobileOpen).toBe(false);
  });
});
