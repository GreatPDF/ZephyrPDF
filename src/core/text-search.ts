import * as pdfjsLib from 'pdfjs-dist';
import { SearchMatch, SearchState } from '../types/document';

export class TextSearchEngine {
  private pageTexts: {
    pageIndex: number;
    text: string;
    items: {
      str: string;
      transform: number[];
      width: number;
      height: number;
    }[];
  }[] = [];
  private state: SearchState = {
    query: '',
    caseSensitive: false,
    matchWholeWords: false,
    totalMatches: 0,
    currentMatchIndex: -1,
    matches: []
  };

  private listeners: Array<(state: SearchState) => void> = [];

  public async setDocument(pdfDoc: pdfjsLib.PDFDocumentProxy): Promise<void> {
    this.pageTexts = [];
    this.reset();

    // Pre-extract text from pages in background
    for (let i = 1; i <= pdfDoc.numPages; i++) {
      const page = await pdfDoc.getPage(i);
      const textContent = await page.getTextContent();
      let fullText = '';
      const items: any[] = [];

      for (const item of textContent.items as any[]) {
        if ('str' in item) {
          fullText += item.str + ' ';
          items.push({
            str: item.str,
            transform: item.transform,
            width: item.width,
            height: item.height
          });
        }
      }

      this.pageTexts.push({
        pageIndex: i - 1,
        text: fullText,
        items
      });
    }
  }

  public search(
    query: string,
    caseSensitive: boolean = false,
    matchWholeWords: boolean = false
  ): SearchMatch[] {
    if (!query || query.trim() === '') {
      this.reset();
      return [];
    }

    const matches: SearchMatch[] = [];
    const flags = caseSensitive ? 'g' : 'gi';
    const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regexPattern = matchWholeWords ? `\\b${escaped}\\b` : escaped;
    const regex = new RegExp(regexPattern, flags);

    let globalMatchCount = 0;

    for (const page of this.pageTexts) {
      let match: RegExpExecArray | null;
      while ((match = regex.exec(page.text)) !== null) {
        // Extract surrounding context snippet
        const start = Math.max(0, match.index - 35);
        const end = Math.min(page.text.length, match.index + match[0].length + 35);
        let snippet = page.text.slice(start, end).replace(/\s+/g, ' ').trim();
        if (start > 0) snippet = '...' + snippet;
        if (end < page.text.length) snippet = snippet + '...';

        matches.push({
          pageIndex: page.pageIndex,
          matchIndex: globalMatchCount,
          text: match[0],
          snippet,
          bounds: [
            {
              left: 50, // default approximate coordinate before exact glyph mapping
              top: 50,
              width: 100,
              height: 20
            }
          ]
        });
        globalMatchCount++;
      }
    }

    this.state = {
      query,
      caseSensitive,
      matchWholeWords,
      totalMatches: matches.length,
      currentMatchIndex: matches.length > 0 ? 0 : -1,
      matches
    };

    this.notify();
    return matches;
  }

  public next(): SearchMatch | null {
    if (this.state.matches.length === 0) return null;
    this.state.currentMatchIndex =
      (this.state.currentMatchIndex + 1) % this.state.matches.length;
    this.notify();
    return this.state.matches[this.state.currentMatchIndex];
  }

  public previous(): SearchMatch | null {
    if (this.state.matches.length === 0) return null;
    this.state.currentMatchIndex =
      (this.state.currentMatchIndex - 1 + this.state.matches.length) %
      this.state.matches.length;
    this.notify();
    return this.state.matches[this.state.currentMatchIndex];
  }

  public selectMatch(index: number): SearchMatch | null {
    if (index < 0 || index >= this.state.matches.length) return null;
    this.state.currentMatchIndex = index;
    this.notify();
    return this.state.matches[index];
  }

  public reset(): void {
    this.state = {
      query: '',
      caseSensitive: false,
      matchWholeWords: false,
      totalMatches: 0,
      currentMatchIndex: -1,
      matches: []
    };
    this.notify();
  }

  public getState(): SearchState {
    return { ...this.state };
  }

  public subscribe(callback: (state: SearchState) => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    for (const l of this.listeners) {
      l(this.getState());
    }
  }
}
