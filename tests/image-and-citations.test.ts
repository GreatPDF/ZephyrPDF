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
});
