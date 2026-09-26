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

  it('formats comprehensive human-readable annotation labels for sidebar and audit items', () => {
    const textAnn = { type: 'text', text: 'Important observation regarding clause 4' } as any;
    const measureAnn = { type: 'measure', formattedValue: '45.2 mm' } as any;
    const redactAnn = { type: 'redaction' } as any;
    const arrowAnn = { type: 'arrow' } as any;
    const stampAnn = { type: 'stamp', stampType: 'APPROVED' } as any;

    const format = (ann: any) => {
      if (ann.type === 'text') return `Text: "${ann.text.substring(0, 18)}${ann.text.length > 18 ? '...' : ''}"`;
      if (ann.type === 'stamp') return `Stamp: ${ann.stampType}`;
      if (ann.type === 'measure') return `Measure: ${ann.formattedValue || (ann.distancePt + ' pt')}`;
      if (ann.type === 'redaction') return `Redaction (Blackout)`;
      if (ann.type === 'arrow') return `Arrow`;
      return ann.type.toUpperCase();
    };

    expect(format(textAnn)).toBe('Text: "Important observat..."');
    expect(format(measureAnn)).toBe('Measure: 45.2 mm');
    expect(format(redactAnn)).toBe('Redaction (Blackout)');
    expect(format(arrowAnn)).toBe('Arrow');
    expect(format(stampAnn)).toBe('Stamp: APPROVED');
  });

  it('generates structured Markdown annotation summary reports grouped by page', () => {
    const generateReport = (annotations: any[], fileName: string) => {
      let md = `# ZephyrPDF Annotation Report\n\n`;
      md += `**Document:** ${fileName}\n`;
      md += `**Total Annotations:** ${annotations.length}\n\n`;

      const byPage = new Map<number, any[]>();
      for (const ann of annotations) {
        const p = ann.pageIndex + 1;
        if (!byPage.has(p)) byPage.set(p, []);
        byPage.get(p)!.push(ann);
      }

      const sortedPages = Array.from(byPage.keys()).sort((a, b) => a - b);
      for (const p of sortedPages) {
        md += `## Page ${p}\n\n`;
        for (const ann of byPage.get(p)!) {
          let desc = '';
          if (ann.type === 'text') desc = `"${ann.text}"`;
          else if (ann.type === 'measure') desc = `Distance: ${ann.formattedValue || (ann.distancePt + ' pt')}`;
          else if (ann.type === 'stamp') desc = `Stamp: ${ann.stampType}`;
          else if (ann.type === 'sticky_note') desc = `Comment: "${ann.content || ann.title || 'Note'}"`;
          else if (ann.type === 'redaction') desc = `Redaction: [${ann.overlayText || 'REDACTED'}]`;
          else if (ann.type === 'arrow') desc = `Arrow (${Math.round(ann.x1)}, ${Math.round(ann.y1)}) → (${Math.round(ann.x2)}, ${Math.round(ann.y2)})`;
          md += `- **[${ann.type.toUpperCase()}]** ${desc}\n`;
        }
        md += `\n`;
      }
      return md;
    };

    const items = [
      { type: 'text', pageIndex: 0, text: 'Approved section 1' },
      { type: 'stamp', pageIndex: 0, stampType: 'APPROVED' },
      { type: 'arrow', pageIndex: 0, x1: 10, y1: 20, x2: 100, y2: 20 },
      { type: 'sticky_note', pageIndex: 1, content: 'Needs revision' },
      { type: 'measure', pageIndex: 1, formattedValue: '25.4 mm' },
      { type: 'redaction', pageIndex: 1, overlayText: 'CONFIDENTIAL' }
    ];

    const report = generateReport(items, 'Contract.pdf');
    expect(report).toContain('# ZephyrPDF Annotation Report');
    expect(report).toContain('**Document:** Contract.pdf');
    expect(report).toContain('**Total Annotations:** 6');
    expect(report).toContain('## Page 1');
    expect(report).toContain('- **[TEXT]** "Approved section 1"');
    expect(report).toContain('- **[STAMP]** Stamp: APPROVED');
    expect(report).toContain('- **[ARROW]** Arrow (10, 20) → (100, 20)');
    expect(report).toContain('## Page 2');
    expect(report).toContain('- **[STICKY_NOTE]** Comment: "Needs revision"');
    expect(report).toContain('- **[MEASURE]** Distance: 25.4 mm');
    expect(report).toContain('- **[REDACTION]** Redaction: [CONFIDENTIAL]');
  });
});
