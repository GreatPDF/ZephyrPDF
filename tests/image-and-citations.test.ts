import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createSamplePdf } from '../src/utils/samples';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { PdfExporter } from '../src/export/pdf-exporter';
import { ImageAnnotation } from '../src/types/annotations';

describe('Image Annotation and Citations', () => {
  it('should bake image annotations into exported PDF', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    // Create a 1x1 transparent PNG data URL for test
    const dummyPng =
      'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==';

    const imgAnn: ImageAnnotation = {
      id: 'img_test_1',
      type: 'image',
      pageIndex: 0,
      dataUrl: dummyPng,
      format: 'png',
      x: 100,
      y: 100,
      width: 50,
      height: 50,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    annotationManager.addAnnotation(imgAnn);
    expect(annotationManager.getAllAnnotations().length).toBe(1);

    const exportedBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(exportedBytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('should format search citations into structured Markdown report', () => {
    const matches = [
      { pageIndex: 0, text: 'ZephyrPDF is designed from the ground up for speed', rects: [] },
      { pageIndex: 1, text: 'Technical Specification & Features for ZephyrPDF', rects: [] }
    ];
    const query = 'ZephyrPDF';
    const fileName = 'showcase.pdf';

    let md = `# Search Citations for "${query}"\n`;
    md += `**Document:** ${fileName}\n`;
    md += `**Total Matches:** ${matches.length}\n\n`;
    md += `## Occurrences\n`;
    for (const m of matches) {
      md += `- **Page ${m.pageIndex + 1}**: "...${m.text}..."\n`;
    }

    expect(md).toContain('# Search Citations for "ZephyrPDF"');
    expect(md).toContain('**Document:** showcase.pdf');
    expect(md).toContain('**Total Matches:** 2');
    expect(md).toContain('- **Page 1**: "...ZephyrPDF is designed from the ground up for speed..."');
    expect(md).toContain('- **Page 2**: "...Technical Specification & Features for ZephyrPDF..."');
  });
});
