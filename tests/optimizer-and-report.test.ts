import { describe, it, expect } from 'vitest';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { TextAnnotation, StampAnnotation, MeasureAnnotation } from '../src/types/annotations';

describe('Optimizer and Annotation Report', () => {
  it('should group annotations by page for summary reporting', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const textAnn: TextAnnotation = {
      id: 't_rep_1',
      type: 'text',
      pageIndex: 0,
      x: 10,
      y: 20,
      width: 100,
      height: 20,
      text: 'Verified Clause A',
      fontSize: 12,
      fontFamily: 'Helvetica',
      color: '#000000',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const stampAnn: StampAnnotation = {
      id: 's_rep_1',
      type: 'stamp',
      pageIndex: 1,
      stampType: 'APPROVED',
      x: 50,
      y: 50,
      width: 120,
      height: 40,
      color: '#2e7d32',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const measureAnn: MeasureAnnotation = {
      id: 'm_rep_1',
      type: 'measure',
      pageIndex: 1,
      x1: 10,
      y1: 10,
      x2: 100,
      y2: 10,
      distancePt: 90,
      unit: 'mm',
      formattedValue: '31.8 mm',
      color: '#0284c7',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    manager.addAnnotation(textAnn);
    manager.addAnnotation(stampAnn);
    manager.addAnnotation(measureAnn);

    const all = manager.getAllAnnotations();
    expect(all.length).toBe(3);

    const page0 = manager.getAnnotationsForPage(0);
    expect(page0.length).toBe(1);
    expect(page0[0].type).toBe('text');

    const page1 = manager.getAnnotationsForPage(1);
    expect(page1.length).toBe(2);
    expect(page1.map(a => a.type)).toContain('stamp');
    expect(page1.map(a => a.type)).toContain('measure');
  });

  it('should compute size reduction percentages accurately', () => {
    const origSize = 10000000; // 10 MB
    const newSize = 2500000;   // 2.5 MB
    const diff = origSize - newSize;
    const percent = Math.round((diff / origSize) * 100);

    expect(percent).toBe(75);
  });

  it('formats byte quantities into clean human-readable strings', () => {
    const formatBytes = (bytes: number) => {
      if (bytes === 0) return '0 B';
      const k = 1024;
      const sizes = ['B', 'KB', 'MB', 'GB'];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return `${(bytes / Math.pow(k, i)).toFixed(2)} ${sizes[i]}`;
    };

    expect(formatBytes(0)).toBe('0 B');
    expect(formatBytes(1024)).toBe('1.00 KB');
    expect(formatBytes(1048576)).toBe('1.00 MB');
    expect(formatBytes(2500000)).toBe('2.38 MB');
  });
});
