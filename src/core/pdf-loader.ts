import * as pdfjsLib from 'pdfjs-dist';
import pdfjsWorker from 'pdfjs-dist/build/pdf.worker.mjs?url';
import { PDFDocument } from 'pdf-lib';
import { DocumentMetadata, OutlineItem, PageDimension } from '../types/document';

// Configure the worker for pdfjs-dist
if (typeof window !== 'undefined' && pdfjsLib.GlobalWorkerOptions) {
  pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
}

export interface LoadedDocument {
  pdfjsDoc: pdfjsLib.PDFDocumentProxy;
  pdfLibDoc: PDFDocument;
  data: Uint8Array;
  metadata: DocumentMetadata;
  outline: OutlineItem[];
  pageDimensions: PageDimension[];
}

export class PdfLoader {
  /**
   * Load a PDF document from raw byte data.
   */
  public static async loadFromBytes(
    data: Uint8Array,
    fileName: string = 'document.pdf',
    password?: string
  ): Promise<LoadedDocument> {
    // Make a copy so pdfjs doesn't detach the buffer if transferred
    const bufferCopy = data.slice().buffer;
    const loadingTask = pdfjsLib.getDocument({
      data: bufferCopy,
      password: password,
      cMapUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/cmaps/',
      cMapPacked: true,
      standardFontDataUrl: 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.4.168/standard_fonts/'
    });

    const pdfjsDoc = await loadingTask.promise;
    const pdfLibDoc = await PDFDocument.load(data.slice(), {
      ignoreEncryption: Boolean(password)
    });

    const metadata = await this.extractMetadata(pdfjsDoc, fileName, data.byteLength);
    const outline = await this.extractOutline(pdfjsDoc);
    const pageDimensions = await this.extractPageDimensions(pdfjsDoc);

    return {
      pdfjsDoc,
      pdfLibDoc,
      data,
      metadata,
      outline,
      pageDimensions
    };
  }

  /**
   * Load from a browser File object.
   */
  public static async loadFromFile(file: File, password?: string): Promise<LoadedDocument> {
    const arrayBuffer = await file.arrayBuffer();
    return this.loadFromBytes(new Uint8Array(arrayBuffer), file.name, password);
  }

  private static async extractMetadata(
    pdfjsDoc: pdfjsLib.PDFDocumentProxy,
    fileName: string,
    fileSize: number
  ): Promise<DocumentMetadata> {
    let title: string | undefined;
    let author: string | undefined;
    let subject: string | undefined;
    let keywords: string | undefined;
    let creator: string | undefined;
    let producer: string | undefined;
    let creationDate: Date | undefined;
    let modificationDate: Date | undefined;
    let pdfVersion: string | undefined;

    try {
      const data = await pdfjsDoc.getMetadata();
      const info = (data.info || {}) as Record<string, any>;

      title = info.Title || undefined;
      author = info.Author || undefined;
      subject = info.Subject || undefined;
      keywords = info.Keywords || undefined;
      creator = info.Creator || undefined;
      producer = info.Producer || undefined;
      pdfVersion = info.PDFFormatVersion || undefined;

      if (info.CreationDate) {
        creationDate = this.parsePdfDate(info.CreationDate);
      }
      if (info.ModDate) {
        modificationDate = this.parsePdfDate(info.ModDate);
      }
    } catch (e) {
      console.warn('Could not extract PDF metadata:', e);
    }

    return {
      title,
      author,
      subject,
      keywords,
      creator,
      producer,
      creationDate,
      modificationDate,
      pageCount: pdfjsDoc.numPages,
      fileSize,
      fileName,
      pdfVersion
    };
  }

  private static async extractOutline(pdfjsDoc: pdfjsLib.PDFDocumentProxy): Promise<OutlineItem[]> {
    try {
      const rawOutline = await pdfjsDoc.getOutline();
      if (!rawOutline || rawOutline.length === 0) return [];

      const convertOutlineItem = async (item: any): Promise<OutlineItem> => {
        let pageNumber: number | undefined;
        if (item.dest) {
          try {
            let dest = item.dest;
            if (typeof dest === 'string') {
              dest = await pdfjsDoc.getDestination(dest);
            }
            if (Array.isArray(dest) && dest[0]) {
              const pageIndex = await pdfjsDoc.getPageIndex(dest[0]);
              pageNumber = pageIndex + 1;
            }
          } catch {
            // Ignore destination resolving errors
          }
        }

        const children: OutlineItem[] = [];
        if (item.items && item.items.length > 0) {
          for (const subItem of item.items) {
            children.push(await convertOutlineItem(subItem));
          }
        }

        return {
          title: item.title || 'Untitled Bookmark',
          bold: item.bold,
          italic: item.italic,
          color: item.color,
          dest: item.dest,
          pageNumber,
          children: children.length > 0 ? children : undefined
        };
      };

      const result: OutlineItem[] = [];
      for (const item of rawOutline) {
        result.push(await convertOutlineItem(item));
      }
      return result;
    } catch {
      return [];
    }
  }

  private static async extractPageDimensions(
    pdfjsDoc: pdfjsLib.PDFDocumentProxy
  ): Promise<PageDimension[]> {
    const dimensions: PageDimension[] = [];
    for (let i = 1; i <= pdfjsDoc.numPages; i++) {
      const page = await pdfjsDoc.getPage(i);
      const viewport = page.getViewport({ scale: 1 });
      dimensions.push({
        pageNumber: i,
        width: viewport.width,
        height: viewport.height,
        rotation: page.rotate,
        scale: 1
      });
    }
    return dimensions;
  }

  private static parsePdfDate(pdfDateStr: string): Date | undefined {
    // PDF dates format: D:YYYYMMDDHHmmSSOHH'mm'
    try {
      if (!pdfDateStr.startsWith('D:')) return new Date(pdfDateStr);
      const clean = pdfDateStr.substring(2);
      const year = parseInt(clean.substring(0, 4), 10);
      const month = parseInt(clean.substring(4, 6), 10) - 1;
      const day = parseInt(clean.substring(6, 8), 10);
      const hour = parseInt(clean.substring(8, 10), 10) || 0;
      const minute = parseInt(clean.substring(10, 12), 10) || 0;
      const second = parseInt(clean.substring(12, 14), 10) || 0;
      return new Date(Date.UTC(year, month, day, hour, minute, second));
    } catch {
      return undefined;
    }
  }
}
