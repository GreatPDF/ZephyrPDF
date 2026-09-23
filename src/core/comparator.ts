import * as pdfjsLib from 'pdfjs-dist';

export interface PageDiffResult {
  pageNumber: number;
  diffPercent: number;
  hasDifferences: boolean;
  diffImageDataUrl?: string;
  differingPixels: number;
  totalPixels: number;
}

export interface DocumentDiffSummary {
  docAName: string;
  docBName: string;
  pageCountA: number;
  pageCountB: number;
  changedPagesCount: number;
  pageDiffs: PageDiffResult[];
}

export class DocumentComparator {
  /**
   * Compares two loaded PDF.js documents and generates visual diff results.
   */
  public static async compareDocuments(
    docA: pdfjsLib.PDFDocumentProxy,
    docB: pdfjsLib.PDFDocumentProxy,
    docAName: string = 'Original',
    docBName: string = 'Modified',
    scale: number = 1.0
  ): Promise<DocumentDiffSummary> {
    const maxPages = Math.max(docA.numPages, docB.numPages);
    const pageDiffs: PageDiffResult[] = [];
    let changedPagesCount = 0;

    for (let i = 1; i <= maxPages; i++) {
      if (i > docA.numPages) {
        pageDiffs.push({
          pageNumber: i,
          diffPercent: 100,
          hasDifferences: true,
          differingPixels: 0,
          totalPixels: 0
        });
        changedPagesCount++;
        continue;
      }

      if (i > docB.numPages) {
        pageDiffs.push({
          pageNumber: i,
          diffPercent: 100,
          hasDifferences: true,
          differingPixels: 0,
          totalPixels: 0
        });
        changedPagesCount++;
        continue;
      }

      const pageA = await docA.getPage(i);
      const pageB = await docB.getPage(i);

      const diff = await this.comparePagePair(pageA, pageB, scale);
      pageDiffs.push(diff);
      if (diff.hasDifferences) {
        changedPagesCount++;
      }
    }

    return {
      docAName,
      docBName,
      pageCountA: docA.numPages,
      pageCountB: docB.numPages,
      changedPagesCount,
      pageDiffs
    };
  }

  /**
   * Compares two single pages by rendering both to off-screen canvases and analyzing pixel differences.
   */
  public static async comparePagePair(
    pageA: pdfjsLib.PDFPageProxy,
    pageB: pdfjsLib.PDFPageProxy,
    scale: number = 1.0
  ): Promise<PageDiffResult> {
    const viewportA = pageA.getViewport({ scale });
    const viewportB = pageB.getViewport({ scale });

    const width = Math.floor(Math.max(viewportA.width, viewportB.width));
    const height = Math.floor(Math.max(viewportA.height, viewportB.height));

    const canvasA = document.createElement('canvas');
    canvasA.width = width;
    canvasA.height = height;
    const ctxA = canvasA.getContext('2d', { willReadFrequently: true });

    const canvasB = document.createElement('canvas');
    canvasB.width = width;
    canvasB.height = height;
    const ctxB = canvasB.getContext('2d', { willReadFrequently: true });

    if (!ctxA || !ctxB) {
      throw new Error('Failed to create canvas 2D context for comparison');
    }

    // Fill white backgrounds
    ctxA.fillStyle = '#ffffff';
    ctxA.fillRect(0, 0, width, height);
    ctxB.fillStyle = '#ffffff';
    ctxB.fillRect(0, 0, width, height);

    await pageA.render({ canvasContext: ctxA, viewport: viewportA }).promise;
    await pageB.render({ canvasContext: ctxB, viewport: viewportB }).promise;

    const imgA = ctxA.getImageData(0, 0, width, height);
    const imgB = ctxB.getImageData(0, 0, width, height);

    const diffCanvas = document.createElement('canvas');
    diffCanvas.width = width;
    diffCanvas.height = height;
    const diffCtx = diffCanvas.getContext('2d');
    if (!diffCtx) throw new Error('Diff canvas error');

    const diffImg = diffCtx.createImageData(width, height);
    const dataA = imgA.data;
    const dataB = imgB.data;
    const out = diffImg.data;

    let differingPixels = 0;
    const totalPixels = width * height;
    const threshold = 35; // Tolerance for antialiasing differences

    for (let p = 0; p < totalPixels; p++) {
      const idx = p * 4;
      const rA = dataA[idx];
      const gA = dataA[idx + 1];
      const bA = dataA[idx + 2];

      const rB = dataB[idx];
      const gB = dataB[idx + 1];
      const bB = dataB[idx + 2];

      const diff = Math.abs(rA - rB) + Math.abs(gA - gB) + Math.abs(bA - bB);

      if (diff > threshold) {
        differingPixels++;
        const brightnessA = (rA + gA + bA) / 3;
        const brightnessB = (rB + gB + bB) / 3;

        if (brightnessA < brightnessB) {
          // Pixel was darker in A (Removed content) -> Red
          out[idx] = 239;     // R
          out[idx + 1] = 68;  // G
          out[idx + 2] = 68;  // B
          out[idx + 3] = 255; // Alpha
        } else {
          // Pixel is darker in B (Added content) -> Green
          out[idx] = 16;      // R
          out[idx + 1] = 185; // G
          out[idx + 2] = 129; // B
          out[idx + 3] = 255; // Alpha
        }
      } else {
        // Unchanged pixel: dimmed context
        out[idx] = rA;
        out[idx + 1] = gA;
        out[idx + 2] = bA;
        out[idx + 3] = 70; // Translucent
      }
    }

    diffCtx.putImageData(diffImg, 0, 0);

    const diffPercent = parseFloat(((differingPixels / totalPixels) * 100).toFixed(2));
    const hasDifferences = differingPixels > 40;

    return {
      pageNumber: pageA.pageNumber,
      diffPercent,
      hasDifferences,
      differingPixels,
      totalPixels,
      diffImageDataUrl: diffCanvas.toDataURL('image/png')
    };
  }
}
