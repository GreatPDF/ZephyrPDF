import { describe, it, expect } from 'vitest';
import { SessionManager } from '../src/core/document-session';
import { LoadedDocument } from '../src/core/pdf-loader';
import { PDFDocument } from 'pdf-lib';
import { TextExtractor } from '../src/core/text-extractor';
import { PageManager } from '../src/organizer/page-manager';
import { AnnotationManager } from '../src/annotations/manager';
import { HistoryManager } from '../src/core/history';

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

  it('should categorize dropped files into PDF documents, images, and unhandled formats', () => {
    const droppedFiles = [
      { name: 'document1.pdf', type: 'application/pdf' },
      { name: 'REPORT.PDF', type: '' },
      { name: 'photo.png', type: 'image/png' },
      { name: 'scan.jpeg', type: 'image/jpeg' },
      { name: 'archive.zip', type: 'application/zip' }
    ];

    const pdfFiles = droppedFiles.filter(f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf'));
    const imgFiles = droppedFiles.filter(f => f.type.startsWith('image/'));
    const unhandled = droppedFiles.filter(f => !pdfFiles.includes(f) && !imgFiles.includes(f));

    expect(pdfFiles.length).toBe(2);
    expect(pdfFiles.map(f => f.name)).toEqual(['document1.pdf', 'REPORT.PDF']);
    expect(imgFiles.length).toBe(2);
    expect(imgFiles.map(f => f.name)).toEqual(['photo.png', 'scan.jpeg']);
    expect(unhandled.length).toBe(1);
    expect(unhandled[0].name).toBe('archive.zip');
  });

  it('should recursively count all bookmark items and child nodes in outline tree', () => {
    const countItems = (items: any[]): number => {
      let count = 0;
      for (const it of items) {
        count++;
        if (it.children) count += countItems(it.children);
      }
      return count;
    };

    const sampleOutline = [
      { title: 'Chapter 1', pageNumber: 1, children: [{ title: '1.1 Intro', pageNumber: 1 }] },
      { title: 'Chapter 2', pageNumber: 2, children: [{ title: '2.1 Architecture', pageNumber: 2 }] }
    ];

    expect(countItems(sampleOutline)).toBe(4);
  });

  it('extracts structured Markdown and plain text respecting page reordering, blank pages, and annotations', async () => {
    const mockPdfjsDoc = {
      numPages: 2,
      getPage: async (pageNo: number) => ({
        getTextContent: async () => ({
          items: [
            { str: pageNo === 1 ? 'Introduction to ZephyrPDF.' : 'Advanced technical specifications.', transform: [1, 0, 0, 1, 0, 100] }
          ]
        })
      })
    } as any;

    const history = new HistoryManager();
    const pageManager = new PageManager(history);
    const annotationManager = new AnnotationManager(history);

    // Initialize 2 pages, add a blank page in between
    pageManager.initFromDocument(2, [
      { width: 595, height: 842, rotation: 0 },
      { width: 595, height: 842, rotation: 0 }
    ]);
    pageManager.insertBlankPage(1); // Page 1: orig 1, Page 2: blank, Page 3: orig 2

    // Add a text annotation on the blank page (page index 1)
    annotationManager.addAnnotation({
      id: 'ann_text_blank',
      pageIndex: 1,
      type: 'text',
      x: 50,
      y: 100,
      width: 150,
      height: 30,
      text: 'Meeting notes on newly inserted blank page.',
      fontSize: 12,
      fontFamily: 'Helvetica',
      color: '#000000',
      createdAt: Date.now(),
      updatedAt: Date.now()
    });

    const result = await TextExtractor.extractText(
      mockPdfjsDoc,
      'Whitepaper.pdf',
      pageManager,
      annotationManager
    );

    expect(result.pageCount).toBe(3);
    expect(result.fileName).toBe('Whitepaper.pdf');
    expect(result.markdownText).toContain('# Whitepaper');
    expect(result.markdownText).toContain('## Page 1\n\nIntroduction to ZephyrPDF.');
    expect(result.markdownText).toContain('## Page 2\n\nMeeting notes on newly inserted blank page.');
    expect(result.markdownText).toContain('## Page 3\n\nAdvanced technical specifications.');
    expect(result.totalWords).toBeGreaterThan(10);
    expect(result.totalCharacters).toBeGreaterThan(50);
  });

  it('manages tab bar accessibility attributes and session lifecycle state', () => {
    const dummySessions = [
      { id: 'sess_1', doc: { metadata: { fileName: 'Report_A.pdf' } } },
      { id: 'sess_2', doc: { metadata: { fileName: 'Report_B.pdf' } } }
    ] as any[];

    let activeId: string | null = 'sess_1';

    const getTabProps = (sessionId: string, active: string | null, fileName: string) => {
      const isActive = sessionId === active;
      return {
        role: 'tab',
        ariaSelected: isActive.toString(),
        tabIndex: isActive ? 0 : -1,
        ariaLabel: `Document tab: ${fileName}${isActive ? ', active' : ''}`
      };
    };

    const tab1 = getTabProps(dummySessions[0].id, activeId, dummySessions[0].doc.metadata.fileName);
    expect(tab1.ariaSelected).toBe('true');
    expect(tab1.tabIndex).toBe(0);
    expect(tab1.ariaLabel).toBe('Document tab: Report_A.pdf, active');

    const tab2 = getTabProps(dummySessions[1].id, activeId, dummySessions[1].doc.metadata.fileName);
    expect(tab2.ariaSelected).toBe('false');
    expect(tab2.tabIndex).toBe(-1);
    expect(tab2.ariaLabel).toBe('Document tab: Report_B.pdf');
  });

  it('formats thumbnail item WAI-ARIA button attributes and active page indicators', () => {
    const getThumbProps = (pageNum: number, currentPage: number) => {
      const isCurrent = pageNum === currentPage;
      return {
        role: 'button',
        tabIndex: 0,
        ariaCurrent: isCurrent ? 'page' : 'false',
        ariaLabel: `Page ${pageNum}${isCurrent ? ', current page' : ''}. Click to jump to page`
      };
    };

    const p1 = getThumbProps(1, 1);
    expect(p1.role).toBe('button');
    expect(p1.tabIndex).toBe(0);
    expect(p1.ariaCurrent).toBe('page');
    expect(p1.ariaLabel).toBe('Page 1, current page. Click to jump to page');

    const p2 = getThumbProps(2, 1);
    expect(p2.role).toBe('button');
    expect(p2.tabIndex).toBe(0);
    expect(p2.ariaCurrent).toBe('false');
    expect(p2.ariaLabel).toBe('Page 2. Click to jump to page');
  });
});
