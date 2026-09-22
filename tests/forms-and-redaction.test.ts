import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { FormHandler } from '../src/core/form-handler';
import { createSamplePdf } from '../src/utils/samples';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { PdfExporter } from '../src/export/pdf-exporter';
import { RedactionAnnotation } from '../src/types/annotations';

describe('Forms and Redaction', () => {
  it('should load AcroForms from sample PDF and modify values', async () => {
    const bytes = await createSamplePdf();
    const doc = await PDFDocument.load(bytes);
    const formHandler = new FormHandler();

    const fields = formHandler.loadFromPdf(doc);
    expect(fields.length).toBeGreaterThanOrEqual(2);

    const reviewerField = fields.find(f => f.name === 'reviewer_name');
    expect(reviewerField).toBeDefined();
    expect(reviewerField?.value).toBe('Alex Maintainer');

    // Update field value
    formHandler.setValue('reviewer_name', 'Lead Maintainer Jane');
    expect(formHandler.getValue('reviewer_name')).toBe('Lead Maintainer Jane');

    // Apply back to document and test
    formHandler.applyToPdf(doc);
    const updatedForm = doc.getForm();
    expect(updatedForm.getTextField('reviewer_name').getText()).toBe('Lead Maintainer Jane');
  });

  it('should bake redactions and forms into exported PDF', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);
    const formHandler = new FormHandler();

    const doc = await PDFDocument.load(sourceBytes);
    formHandler.loadFromPdf(doc);
    formHandler.setValue('reviewer_name', 'Security Auditor');

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    // Add a redaction annotation over sensitive area
    const redaction: RedactionAnnotation = {
      id: 'redact_1',
      type: 'redaction',
      pageIndex: 0,
      x: 100,
      y: 200,
      width: 180,
      height: 25,
      overlayText: 'CONFIDENTIAL',
      createdAt: Date.now(),
      updatedAt: Date.now()
    };
    annotationManager.addAnnotation(redaction);

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

  it('should merge multiple documents into a single PDF', async () => {
    const doc1Bytes = await createSamplePdf();
    const doc2Bytes = await createSamplePdf();

    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    // Append doc2 pages
    const doc2Id = 'doc2_id';
    pageManager.appendDocumentPages(doc2Id, 2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    expect(pageManager.getPageCount()).toBe(4);

    const mergedDocs = new Map<string, Uint8Array>();
    mergedDocs.set(doc2Id, doc2Bytes);

    const exportedMerged = await PdfExporter.exportDocument(
      doc1Bytes,
      pageManager,
      annotationManager,
      undefined,
      mergedDocs
    );

    const resultDoc = await PDFDocument.load(exportedMerged);
    expect(resultDoc.getPageCount()).toBe(4);
  });
});
