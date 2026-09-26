export type ViewMode = 'single' | 'continuous' | 'two-page' | 'presentation';

export type ThemeMode = 'light' | 'dark' | 'sepia' | 'oled' | 'high-contrast';

export interface PageDimension {
  pageNumber: number;
  width: number;
  height: number;
  rotation: number;
  scale: number;
}

export interface DocumentMetadata {
  title?: string;
  author?: string;
  subject?: string;
  keywords?: string;
  creator?: string;
  producer?: string;
  creationDate?: Date;
  modificationDate?: Date;
  pageCount: number;
  fileSize: number;
  fileName: string;
  pdfVersion?: string;
}

export interface OutlineItem {
  title: string;
  bold?: boolean;
  italic?: boolean;
  color?: number[];
  dest?: string | any[];
  pageNumber?: number;
  children?: OutlineItem[];
}

export interface SearchMatch {
  pageIndex: number;
  matchIndex: number;
  text: string;
  snippet?: string;
  bounds: {
    left: number;
    top: number;
    width: number;
    height: number;
  }[];
}

export interface SearchState {
  query: string;
  caseSensitive: boolean;
  matchWholeWords: boolean;
  totalMatches: number;
  currentMatchIndex: number;
  matches: SearchMatch[];
}

export interface WatermarkOptions {
  enabled: boolean;
  text: string;
  opacity: number;
  fontSize: number;
  rotationDegrees: number;
  color: string;
}

export interface PageNumberOptions {
  enabled: boolean;
  format: 'Page X of Y' | 'X of Y' | 'X';
  position: 'bottom-center' | 'bottom-right' | 'top-right' | 'top-center';
  fontSize: number;
  color: string;
}
