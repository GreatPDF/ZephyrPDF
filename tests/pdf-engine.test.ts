import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createSamplePdf } from '../src/utils/samples';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { PdfExporter } from '../src/export/pdf-exporter';
import { HighlightAnnotation, TextAnnotation, StampAnnotation, ShapeAnnotation } from '../src/types/annotations';

describe('PDF Engine End-to-End', () => {
  it('should generate a valid sample PDF with 2 pages', async () => {
    const bytes = await createSamplePdf();
    expect(bytes).toBeInstanceOf(Uint8Array);
    expect(bytes.length).toBeGreaterThan(1000);

    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('should export PDF with baked annotations and reorganized pages', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    // Reorder pages (swap page 1 and page 2)
    pageManager.movePage(0, 1);

    // Insert a blank page
    pageManager.insertBlankPage(2, 595.28, 841.89);
    expect(pageManager.getPageCount()).toBe(3);

    // Add annotations
    const highlight: HighlightAnnotation = {
      id: 'h_1',
      type: 'highlight',
      pageIndex: 0,
      rects: [{ x: 50, y: 100, width: 200, height: 20 }],
      color: '#ffeb3b',
      opacity: 0.4,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const textAnn: TextAnnotation = {
      id: 't_1',
      type: 'text',
      pageIndex: 0,
      x: 60,
      y: 150,
      width: 150,
      height: 30,
      text: 'Verified by GreatPDF Maintainer',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#1565c0',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const stampAnn: StampAnnotation = {
      id: 's_1',
      type: 'stamp',
      pageIndex: 0,
      stampType: 'APPROVED',
      x: 300,
      y: 200,
      width: 140,
      height: 45,
      color: '#2e7d32',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const rectAnn: ShapeAnnotation = {
      id: 'r_1',
      type: 'rectangle',
      pageIndex: 0,
      x: 50,
      y: 300,
      width: 100,
      height: 80,
      strokeColor: '#d32f2f',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    annotationManager.addAnnotation(highlight);
    annotationManager.addAnnotation(textAnn);
    annotationManager.addAnnotation(stampAnn);
    annotationManager.addAnnotation(rectAnn);

    // Export document
    const exportedBytes = await PdfExporter.exportDocument(sourceBytes, pageManager, annotationManager);
    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    expect(exportedBytes.length).toBeGreaterThan(sourceBytes.length / 2);

    // Verify exported PDF structure with PDFDocument loader
    const verifyDoc = await PDFDocument.load(exportedBytes);
    expect(verifyDoc.getPageCount()).toBe(3);
  });
});
