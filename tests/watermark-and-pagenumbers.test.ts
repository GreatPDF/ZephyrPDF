import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createSamplePdf } from '../src/utils/samples';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { PdfExporter } from '../src/export/pdf-exporter';
import { WatermarkOptions, PageNumberOptions } from '../src/types/document';

describe('Watermark and Page Numbering', () => {
  it('should export PDF with rotated watermark text', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const watermark: WatermarkOptions = {
      enabled: true,
      text: 'TOP SECRET DRAFT',
      opacity: 0.2,
      fontSize: 54,
      rotationDegrees: -45,
      color: '#ef4444'
    };

    const exported = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      undefined,
      undefined,
      false,
      watermark
    );

    expect(exported).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(exported);
    expect(doc.getPageCount()).toBe(2);
  });

  it('should export PDF with dynamic page numbering across all pages', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const pageNumbers: PageNumberOptions = {
      enabled: true,
      format: 'Page X of Y',
      position: 'bottom-center',
      fontSize: 10,
      color: '#000000'
    };

    const exported = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      undefined,
      undefined,
      false,
      undefined,
      pageNumbers
    );

    expect(exported).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(exported);
    expect(doc.getPageCount()).toBe(2);
  });

  it('should support combining watermark, page numbering, and annotations', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const watermark: WatermarkOptions = {
      enabled: true,
      text: 'OFFICIAL',
      opacity: 0.15,
      fontSize: 48,
      rotationDegrees: 0,
      color: '#0284c7'
    };

    const pageNumbers: PageNumberOptions = {
      enabled: true,
      format: 'X of Y',
      position: 'bottom-right',
      fontSize: 9,
      color: '#333333'
    };

    const exported = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      undefined,
      undefined,
      false,
      watermark,
      pageNumbers
    );

    expect(exported).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(exported);
    expect(doc.getPageCount()).toBe(2);
  });
});
