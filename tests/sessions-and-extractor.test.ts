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
});
