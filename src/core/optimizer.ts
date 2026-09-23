import * as pdfjsLib from 'pdfjs-dist';
import { PDFDocument } from 'pdf-lib';

export type CompressionLevel = 'high' | 'medium' | 'low';

export interface OptimizationResult {
  bytes: Uint8Array;
  originalSize: number;
  optimizedSize: number;
  percentSaved: number;
  pageCount: number;
}

export class PdfOptimizer {
  /**
   * Optimizes and compresses a PDF document entirely client-side.
   */
  public static async optimizeDocument(
    pdfjsDoc: pdfjsLib.PDFDocumentProxy,
    originalSizeBytes: number,
    level: CompressionLevel = 'medium',
    onProgress?: (current: number, total: number) => void
  ): Promise<OptimizationResult> {
    const newDoc = await PDFDocument.create();

    let scale = 1.2;
    let jpegQuality = 0.65;

    if (level === 'high') {
      scale = 1.5;
      jpegQuality = 0.8;
    } else if (level === 'low') {
      scale = 0.9;
      jpegQuality = 0.45;
    }

    const totalPages = pdfjsDoc.numPages;

    for (let i = 1; i <= totalPages; i++) {
      if (onProgress) onProgress(i, totalPages);

      const page = await pdfjsDoc.getPage(i);
      const baseViewport = page.getViewport({ scale: 1 });
      const renderViewport = page.getViewport({ scale });

      const canvas = document.createElement('canvas');
      canvas.width = Math.floor(renderViewport.width);
      canvas.height = Math.floor(renderViewport.height);

      const ctx = canvas.getContext('2d');
      if (!ctx) continue;

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      await page.render({ canvasContext: ctx, viewport: renderViewport }).promise;

      const dataUrl = canvas.toDataURL('image/jpeg', jpegQuality);
      const base64Data = dataUrl.split(',')[1];
      const binaryStr = atob(base64Data);
      const imgBytes = new Uint8Array(binaryStr.length);
      for (let j = 0; j < binaryStr.length; j++) {
        imgBytes[j] = binaryStr.charCodeAt(j);
      }

      const embeddedImg = await newDoc.embedJpg(imgBytes);
      const newPage = newDoc.addPage([baseViewport.width, baseViewport.height]);
      newPage.drawImage(embeddedImg, {
        x: 0,
        y: 0,
        width: baseViewport.width,
        height: baseViewport.height
      });
    }

    const optimizedBytes = await newDoc.save();
    const optimizedSize = optimizedBytes.length;
    const diff = originalSizeBytes - optimizedSize;
    const percentSaved = Math.max(0, Math.round((diff / (originalSizeBytes || 1)) * 100));

    return {
      bytes: optimizedBytes,
      originalSize: originalSizeBytes,
      optimizedSize,
      percentSaved,
      pageCount: totalPages
    };
  }
}
