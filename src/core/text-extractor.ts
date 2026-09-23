import * as pdfjsLib from 'pdfjs-dist';

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
   * Extracts formatted plain text and Markdown from all pages of a PDF document.
   */
  public static async extractText(
    pdfjsDoc: pdfjsLib.PDFDocumentProxy,
    fileName: string = 'document.pdf'
  ): Promise<DocumentTextExtract> {
    const pagesText: string[] = [];
    let totalChars = 0;
    let totalWords = 0;

    for (let i = 1; i <= pdfjsDoc.numPages; i++) {
      const page = await pdfjsDoc.getPage(i);
      const textContent = await page.getTextContent();
      let pageStr = '';

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

      pagesText.push(pageStr.trim());
      totalChars += pageStr.length;
      totalWords += pageStr.trim().split(/\s+/).filter(Boolean).length;
    }

    let plainText = `Document: ${fileName}\n`;
    plainText += `Pages: ${pdfjsDoc.numPages}\n\n`;
    pagesText.forEach((pText, idx) => {
      plainText += `--- Page ${idx + 1} ---\n\n${pText}\n\n`;
    });

    let markdownText = `# ${fileName.replace(/\.pdf$/i, '')}\n\n`;
    markdownText += `*Total Pages: ${pdfjsDoc.numPages} | Word Count: ${totalWords.toLocaleString()}*\n\n`;
    pagesText.forEach((pText, idx) => {
      markdownText += `## Page ${idx + 1}\n\n${pText}\n\n`;
    });

    return {
      fileName,
      pageCount: pdfjsDoc.numPages,
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
