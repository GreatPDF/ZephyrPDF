import { describe, it, expect } from 'vitest';
import { SessionManager } from '../src/core/document-session';
import { LoadedDocument } from '../src/core/pdf-loader';
import { PDFDocument } from 'pdf-lib';

describe('Document Session Manager', () => {
  it('should create and switch document sessions cleanly', async () => {
    const sessionManager = new SessionManager();

    const dummyDoc1 = {
      pdfjsDoc: { numPages: 2 } as any,
      pdfLibDoc: await PDFDocument.create(),
      data: new Uint8Array([1, 2, 3]),
      metadata: { pageCount: 2, fileSize: 100, fileName: 'Contract_A.pdf' },
      outline: [],
      pageDimensions: [
        { pageNumber: 1, width: 595, height: 842, rotation: 0, scale: 1 },
        { pageNumber: 2, width: 595, height: 842, rotation: 0, scale: 1 }
      ]
    } as LoadedDocument;

    const dummyDoc2 = {
      pdfjsDoc: { numPages: 1 } as any,
      pdfLibDoc: await PDFDocument.create(),
      data: new Uint8Array([4, 5, 6]),
      metadata: { pageCount: 1, fileSize: 50, fileName: 'Invoice_B.pdf' },
      outline: [],
      pageDimensions: [
        { pageNumber: 1, width: 595, height: 842, rotation: 0, scale: 1 }
      ]
    } as LoadedDocument;

    const sess1 = sessionManager.createSession(dummyDoc1);
    expect(sessionManager.getActiveSession()?.id).toBe(sess1.id);
    expect(sessionManager.getAllSessions().length).toBe(1);

    const sess2 = sessionManager.createSession(dummyDoc2);
    expect(sessionManager.getActiveSession()?.id).toBe(sess2.id);
    expect(sessionManager.getAllSessions().length).toBe(2);

    sessionManager.switchSession(sess1.id);
    expect(sessionManager.getActiveSession()?.doc.metadata.fileName).toBe('Contract_A.pdf');

    sessionManager.closeSession(sess1.id);
    expect(sessionManager.getAllSessions().length).toBe(1);
    expect(sessionManager.getActiveSession()?.id).toBe(sess2.id);
  });

  it('should maintain independent history and annotation managers across sessions', async () => {
    const sessionManager = new SessionManager();

    const docA = {
      pdfjsDoc: { numPages: 1 } as any,
      pdfLibDoc: await PDFDocument.create(),
      data: new Uint8Array([1]),
      metadata: { pageCount: 1, fileSize: 10, fileName: 'Doc_A.pdf' },
      outline: [],
      pageDimensions: [{ pageNumber: 1, width: 595, height: 842, rotation: 0, scale: 1 }]
    } as LoadedDocument;

    const docB = {
      pdfjsDoc: { numPages: 1 } as any,
      pdfLibDoc: await PDFDocument.create(),
      data: new Uint8Array([2]),
      metadata: { pageCount: 1, fileSize: 20, fileName: 'Doc_B.pdf' },
      outline: [],
      pageDimensions: [{ pageNumber: 1, width: 595, height: 842, rotation: 0, scale: 1 }]
    } as LoadedDocument;

    const sessA = sessionManager.createSession(docA);
    const sessB = sessionManager.createSession(docB);

    // Add annotation to Session A
    sessA.annotationManager.addAnnotation({
      id: 'ann_a1',
      type: 'rectangle',
      pageIndex: 0,
      x: 10,
      y: 10,
      width: 50,
      height: 50,
      strokeColor: '#38bdf8',
      strokeWidth: 2,
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    expect(sessA.history.canUndo()).toBe(true);
    expect(sessB.history.canUndo()).toBe(false);
    expect(sessA.annotationManager.getAllAnnotations().length).toBe(1);
    expect(sessB.annotationManager.getAllAnnotations().length).toBe(0);

    // Undo on Session A
    sessA.history.undo();
    expect(sessA.annotationManager.getAllAnnotations().length).toBe(0);
    expect(sessB.annotationManager.getAllAnnotations().length).toBe(0);
  });

  it('should store and preserve document outline across session switching', async () => {
    const sessionManager = new SessionManager();
    const docWithOutline = {
      pdfjsDoc: { numPages: 3 } as any,
      pdfLibDoc: await PDFDocument.create(),
      data: new Uint8Array([7, 8, 9]),
      metadata: { pageCount: 3, fileSize: 120, fileName: 'Manual.pdf' },
      outline: [
        {
          title: 'Section 1',
          pageNumber: 1,
          bold: true,
          children: [{ title: '1.1 Intro', pageNumber: 2 }]
        },
        {
          title: 'Section 2',
          pageNumber: 3
        }
      ],
      pageDimensions: [
        { pageNumber: 1, width: 595, height: 842, rotation: 0, scale: 1 },
        { pageNumber: 2, width: 595, height: 842, rotation: 0, scale: 1 },
        { pageNumber: 3, width: 595, height: 842, rotation: 0, scale: 1 }
      ]
    } as LoadedDocument;

    const sess = sessionManager.createSession(docWithOutline);
    expect(sess.doc.outline.length).toBe(2);
    expect(sess.doc.outline[0].children?.length).toBe(1);
    expect(sess.doc.outline[0].children?.[0].pageNumber).toBe(2);
  });
});
