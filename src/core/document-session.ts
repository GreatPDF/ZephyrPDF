import { LoadedDocument } from './pdf-loader';
import { HistoryManager } from './history';
import { AnnotationManager } from '../annotations/manager';
import { PageManager } from '../organizer/page-manager';
import { FormHandler } from './form-handler';

export interface DocumentSession {
  id: string;
  doc: LoadedDocument;
  history: HistoryManager;
  annotationManager: AnnotationManager;
  pageManager: PageManager;
  formHandler: FormHandler;
  scale: number;
  currentPageNumber: number;
  scrollTop: number;
  thumbnails: Map<number, string>;
  mergedDocs?: Map<string, Uint8Array>;
  loadedMergedPdfjsDocs?: Map<string, any>;
}

export class SessionManager {
  private sessions: Map<string, DocumentSession> = new Map();
  private activeId: string | null = null;
  private listeners: Array<() => void> = [];

  public createSession(doc: LoadedDocument): DocumentSession {
    const id = 'sess_' + Math.random().toString(36).substring(2, 9);
    const history = new HistoryManager();
    const annotationManager = new AnnotationManager(history);
    const pageManager = new PageManager(history);
    const formHandler = new FormHandler();

    pageManager.initFromDocument(doc.metadata.pageCount, doc.pageDimensions);
    formHandler.loadFromPdf(doc.pdfLibDoc);

    const session: DocumentSession = {
      id,
      doc,
      history,
      annotationManager,
      pageManager,
      formHandler,
      scale: 1.0,
      currentPageNumber: 1,
      scrollTop: 0,
      thumbnails: new Map(),
      mergedDocs: new Map(),
      loadedMergedPdfjsDocs: new Map()
    };

    this.sessions.set(id, session);
    this.activeId = id;
    this.notify();
    return session;
  }

  public getActiveSession(): DocumentSession | null {
    if (!this.activeId) return null;
    return this.sessions.get(this.activeId) || null;
  }

  public getSession(id: string): DocumentSession | undefined {
    return this.sessions.get(id);
  }

  public getAllSessions(): DocumentSession[] {
    return Array.from(this.sessions.values());
  }

  public switchSession(id: string): DocumentSession | null {
    if (this.sessions.has(id)) {
      this.activeId = id;
      this.notify();
      return this.sessions.get(id)!;
    }
    return null;
  }

  public closeSession(id: string): DocumentSession | null {
    if (!this.sessions.has(id)) return this.getActiveSession();

    this.sessions.delete(id);

    if (this.activeId === id) {
      const remaining = Array.from(this.sessions.keys());
      this.activeId = remaining.length > 0 ? remaining[remaining.length - 1] : null;
    }

    this.notify();
    return this.getActiveSession();
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}
