import * as pdfjsLib from 'pdfjs-dist';
import { PageManager } from '../organizer/page-manager';
import { AnnotationManager } from '../annotations/manager';

export interface DocumentTextExtract {
  fileName: string;
  pageCount: number;
  plainText: string;
  markdownText: string;
  totalWords: number;
  totalCharacters: number;
}

export class TextExtractor {
  /**
   * Extracts formatted plain text and Markdown from all pages of a PDF document,
   * respecting PageManager ordering, blank pages, and user-added text annotations.
   */
  public static async extractText(
    pdfjsDoc: pdfjsLib.PDFDocumentProxy,
    fileName: string = 'document.pdf',
    pageManager?: PageManager,
    annotationManager?: AnnotationManager
  ): Promise<DocumentTextExtract> {
    const pagesText: string[] = [];
    let totalChars = 0;
    let totalWords = 0;

    const pageItems = pageManager ? pageManager.getPages() : null;
    const numPages = pageItems ? pageItems.length : pdfjsDoc.numPages;

    for (let i = 0; i < numPages; i++) {
      const pageItem = pageItems ? pageItems[i] : null;
      let pageStr = '';

      if (pageItem && (pageItem.isBlank || pageItem.originalIndex === -1)) {
        pageStr = '';
      } else {
        const origPageNum = pageItem && pageItem.originalIndex !== undefined && pageItem.originalIndex >= 0
          ? pageItem.originalIndex + 1
          : (i + 1);
        if (origPageNum >= 1 && origPageNum <= pdfjsDoc.numPages) {
          const page = await pdfjsDoc.getPage(origPageNum);
          const textContent = await page.getTextContent();
          let lastY: number | null = null;
          for (const item of textContent.items as any[]) {
            if ('str' in item) {
              const currentY = item.transform[5];
              // New line detection based on vertical jump
              if (lastY !== null && Math.abs(currentY - lastY) > 8) {
                pageStr += '\n';
              } else if (pageStr.length > 0 && !pageStr.endsWith(' ') && !pageStr.endsWith('\n')) {
                pageStr += ' ';
              }
              pageStr += item.str;
              lastY = currentY;
            }
          }
        }
      }

      // Include text annotations added to this page
      if (annotationManager) {
        const textAnns = [
          ...annotationManager.getAnnotationsForPage(i),
          ...(pageItem && pageItem.originalIndex !== undefined && pageItem.originalIndex >= 0 && pageItem.originalIndex !== i
            ? annotationManager.getAnnotationsForPage(pageItem.originalIndex)
            : [])
        ].filter(a => a.type === 'text') as any[];

        const seenIds = new Set<string>();
        const uniqueTextAnns = textAnns.filter(a => {
          if (seenIds.has(a.id)) return false;
          seenIds.add(a.id);
          return true;
        });

        if (uniqueTextAnns.length > 0) {
          const annText = uniqueTextAnns.map(a => a.text).filter(Boolean).join('\n');
          if (annText) {
            if (pageStr) pageStr += '\n\n' + annText;
            else pageStr = annText;
          }
        }
      }

      const trimmed = pageStr.trim();
      pagesText.push(trimmed);
      totalChars += trimmed.length;
      totalWords += trimmed.split(/\s+/).filter(Boolean).length;
    }

    let plainText = `Document: ${fileName}\n`;
    plainText += `Pages: ${numPages}\n\n`;
    pagesText.forEach((pText, idx) => {
      plainText += `--- Page ${idx + 1} ---\n\n${pText || '(Blank Page)'}\n\n`;
    });

    let markdownText = `# ${fileName.replace(/\.pdf$/i, '')}\n\n`;
    markdownText += `*Total Pages: ${numPages} | Word Count: ${totalWords.toLocaleString()}*\n\n`;
    pagesText.forEach((pText, idx) => {
      markdownText += `## Page ${idx + 1}\n\n${pText || '*(Blank Page)*'}\n\n`;
    });

    return {
      fileName,
      pageCount: numPages,
      plainText: plainText.trim(),
      markdownText: markdownText.trim(),
      totalWords,
      totalCharacters: totalChars
    };
  }

  public static downloadTextFile(content: string, fileName: string, mime: string = 'text/plain'): void {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 2000);
  }
}
