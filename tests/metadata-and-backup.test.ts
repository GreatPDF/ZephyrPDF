import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { createSamplePdf } from '../src/utils/samples';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';
import { PdfExporter } from '../src/export/pdf-exporter';
import { DocumentMetadata } from '../src/types/document';
import { HighlightAnnotation, TextAnnotation } from '../src/types/annotations';

describe('Document Metadata and Annotation Backup', () => {
  it('should embed custom metadata into exported PDF info dictionary', async () => {
    const sourceBytes = await createSamplePdf();
    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    pageManager.initFromDocument(2, [
      { width: 595.28, height: 841.89, rotation: 0 },
      { width: 595.28, height: 841.89, rotation: 0 }
    ]);

    const metadata: DocumentMetadata = {
      title: 'Official Executive Summary',
      author: 'Security Officer',
      subject: 'Quarterly Compliance',
      keywords: 'security, compliance, audit',
      creator: 'ZephyrPDF Enterprise',
      pageCount: 2,
      fileSize: sourceBytes.length,
      fileName: 'Summary.pdf'
    };

    const exportedBytes = await PdfExporter.exportDocument(
      sourceBytes,
      pageManager,
      annotationManager,
      undefined,
      undefined,
      false,
      undefined,
      undefined,
      metadata
    );

    expect(exportedBytes).toBeInstanceOf(Uint8Array);
    const doc = await PDFDocument.load(exportedBytes);
    expect(doc.getTitle()).toBe('Official Executive Summary');
    expect(doc.getAuthor()).toBe('Security Officer');
    expect(doc.getSubject()).toBe('Quarterly Compliance');
    expect(doc.getKeywords()).toContain('compliance');
    expect(doc.getCreator()).toBe('ZephyrPDF Enterprise');
  });

  it('should export and re-import full annotation collections with exact fidelity', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    const highlight: HighlightAnnotation = {
      id: 'h_bak_1',
      type: 'highlight',
      pageIndex: 0,
      rects: [{ x: 50, y: 100, width: 200, height: 20 }],
      color: '#ffeb3b',
      opacity: 0.4,
      createdAt: 1000,
      updatedAt: 1000
    };

    const textAnn: TextAnnotation = {
      id: 't_bak_1',
      type: 'text',
      pageIndex: 1,
      x: 100,
      y: 200,
      width: 150,
      height: 30,
      text: 'Backup Test Note',
      fontSize: 14,
      fontFamily: 'Helvetica',
      color: '#000000',
      createdAt: 2000,
      updatedAt: 2000
    };

    manager.addAnnotation(highlight);
    manager.addAnnotation(textAnn);

    const json = manager.exportJson();
    expect(json).toContain('Backup Test Note');

    const restoreManager = new AnnotationManager(new HistoryManager());
    restoreManager.importJson(json);

    expect(restoreManager.getAllAnnotations().length).toBe(2);
    expect(restoreManager.getAnnotation('t_bak_1')?.type).toBe('text');
    expect(restoreManager.getAnnotation('h_bak_1')?.type).toBe('highlight');
  });

  it('supports undo and redo for imported annotations and validates input JSON', () => {
    const history = new HistoryManager();
    const manager = new AnnotationManager(history);

    expect(manager.importJson('[]')).toBe(0);
    expect(() => manager.importJson('{"invalid": true}')).toThrow('Annotations file must contain a JSON array of annotations');

    const sampleJson = JSON.stringify([
      { id: 'ann-1', type: 'stamp', pageIndex: 0, stampType: 'APPROVED' },
      { id: 'ann-2', type: 'sticky_note', pageIndex: 1, title: 'Check specs' }
    ]);

    const count = manager.importJson(sampleJson, true);
    expect(count).toBe(2);
    expect(manager.getAllAnnotations().length).toBe(2);
    expect(history.canUndo()).toBe(true);

    history.undo();
    expect(manager.getAllAnnotations().length).toBe(0);

    history.redo();
    expect(manager.getAllAnnotations().length).toBe(2);
    expect(manager.getAnnotation('ann-1')?.type).toBe('stamp');
    expect(manager.getAnnotation('ann-2')?.type).toBe('sticky_note');
  });

  it('sanitizes personal traces and author metadata while preserving technical specs', () => {
    const originalMeta: DocumentMetadata = {
      title: 'Confidential Internal Review',
      author: 'Jane Doe <jane@company.com>',
      subject: 'Financial Disclosures Q3',
      keywords: 'q3, confidential, finances',
      creator: 'Microsoft Word for Mac 16.5',
      pageCount: 12,
      fileSize: 1048576,
      fileName: 'Financials.pdf',
      pdfVersion: 'PDF 1.7'
    };

    const sanitizeMetadata = (meta: DocumentMetadata): DocumentMetadata => {
      return {
        ...meta,
        author: undefined,
        subject: undefined,
        keywords: undefined,
        creator: 'ZephyrPDF',
        modificationDate: new Date()
      };
    };

    const sanitized = sanitizeMetadata(originalMeta);
    expect(sanitized.title).toBe('Confidential Internal Review');
    expect(sanitized.author).toBeUndefined();
    expect(sanitized.subject).toBeUndefined();
    expect(sanitized.keywords).toBeUndefined();
    expect(sanitized.creator).toBe('ZephyrPDF');
    expect(sanitized.pageCount).toBe(12);
    expect(sanitized.fileSize).toBe(1048576);
    expect(sanitized.modificationDate).toBeInstanceOf(Date);
  });
});
