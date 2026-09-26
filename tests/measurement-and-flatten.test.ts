import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { formatMeasurement } from '../src/utils/geometry';
import { createSamplePdf } from '../src/utils/samples';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { FormHandler } from '../src/core/form-handler';
import { PdfExporter } from '../src/export/pdf-exporter';
import { MeasureAnnotation, StickyNoteAnnotation, MarkupAnnotation } from '../src/types/annotations';

describe('Measurement and Flattening', () => {
  it('should accurately convert PDF points to real-world units', () => {
    // 72 pt is exactly 1 inch or 25.4 mm
    expect(formatMeasurement(72, 'in')).toBe('1.00 in');
    expect(formatMeasurement(72, 'mm')).toBe('25.4 mm');
    expect(formatMeasurement(72, 'cm')).toBe('2.54 cm');
    expect(formatMeasurement(72, 'pt')).toBe('72.0 pt');

    // 144 pt = 2.00 in = 50.8 mm
    expect(formatMeasurement(144, 'in')).toBe('2.00 in');
    expect(formatMeasurement(144, 'mm')).toBe('50.8 mm');
  });

  it('should bake measurement annotations into exported PDF', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const measureAnn: MeasureAnnotation = {
      id: 'm_1',
      type: 'measure',
      pageIndex: 0,
      x1: 50,
      y1: 150,
      x2: 250,
      y2: 150,
      distancePt: 200,
      unit: 'mm',
      formattedValue: '70.6 mm',
      color: '#0284c7',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    annotationManager.addAnnotation(measureAnn);

    const exportedBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(exportedBytes);
    expect(doc.getPageCount()).toBe(2);
  });

  it('should support flattening form fields on export', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);
    const formHandler = new FormHandler();

    const doc = await PDFDocument.load(sourceBytes);
    formHandler.loadFromPdf(doc);
    formHandler.setValue('reviewer_name', 'Final Flattened Signer');

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    // Export with flattenForm = true
    const flattenedBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      formHandler,
      undefined,
      true
    );

    expect(flattenedBytes).toBeInstanceOf(Uint8Array);
    const flattenedDoc = await PDFDocument.load(flattenedBytes);
    expect(flattenedDoc.getPageCount()).toBe(2);
    // Verified: flattened documents convert interactive AcroForms to static graphics
    expect(flattenedDoc.getForm().getFields().length).toBe(0);

    // Export without flattening (preserve interactive form fields)
    const interactiveBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      formHandler,
      undefined,
      false
    );
    const interactiveDoc = await PDFDocument.load(interactiveBytes);
    expect(interactiveDoc.getForm().getFields().length).toBeGreaterThan(0);
    expect(interactiveDoc.getForm().getTextField('reviewer_name').getText()).toBe('Final Flattened Signer');
  });

  it('should bake sticky_note annotations with pin and comment text into exported PDF', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);
    const formHandler = new FormHandler();

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const noteAnn: StickyNoteAnnotation = {
      id: 'note_export_1',
      type: 'sticky_note',
      pageIndex: 0,
      x: 120,
      y: 180,
      title: 'Review Note',
      content: 'Please verify section 2 compliance.',
      color: '#ffca28',
      isOpen: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    annotationManager.addAnnotation(noteAnn);

    const exportedBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      formHandler
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    const exportedDoc = await PDFDocument.load(exportedBytes);
    expect(exportedDoc.getPageCount()).toBe(2);
  });

  it('should bake underline and strikeout annotations into exported PDF', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);
    const formHandler = new FormHandler();

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const underlineAnn: MarkupAnnotation = {
      id: 'und_pdf_1',
      type: 'underline',
      pageIndex: 0,
      rects: [{ x: 60, y: 120, width: 100, height: 16 }],
      color: '#2563eb',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const strikeAnn: MarkupAnnotation = {
      id: 'str_pdf_1',
      type: 'strikeout',
      pageIndex: 0,
      rects: [{ x: 200, y: 120, width: 80, height: 16 }],
      color: '#ef4444',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    annotationManager.addAnnotation(underlineAnn);
    annotationManager.addAnnotation(strikeAnn);

    const exportedBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      formHandler
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    const exportedDoc = await PDFDocument.load(exportedBytes);
    expect(exportedDoc.getPageCount()).toBe(2);
  });

  it('should permanently flatten AcroForm fields into static page content when flattenForm is true', async () => {
    const doc = await PDFDocument.create();
    const page = doc.addPage([595, 842]);
    const form = doc.getForm();
    const textField = form.createTextField('client_name');
    textField.setText('Alex Maintainer');
    textField.addToPage(page, { x: 50, y: 700, width: 200, height: 24 });

    const checkbox = form.createCheckBox('agreement');
    checkbox.check();
    checkbox.addToPage(page, { x: 50, y: 650, width: 20, height: 20 });

    const unflattenedBytes = await doc.save();

    // Verify unflattened doc has interactive form fields
    const testDoc = await PDFDocument.load(unflattenedBytes);
    expect(testDoc.getForm().getFields().length).toBe(2);

    // Export with flattenForm = true
    const pm = new PageManager(new HistoryManager());
    pm.initFromDocument(1, [{ width: 595, height: 842, rotation: 0 }]);
    const am = new AnnotationManager(new HistoryManager());
    const fh = new FormHandler();
    fh.loadFromPdf(testDoc);

    const flattenedBytes = await PdfExporter.exportDocument(
      unflattenedBytes,
      pm,
      am,
      fh,
      undefined,
      true // flattenForm = true
    );

    const reloaded = await PDFDocument.load(flattenedBytes);
    // After flattening, AcroForm fields are removed from the interactive dictionary
    expect(reloaded.getForm().getFields().length).toBe(0);
  });
});
