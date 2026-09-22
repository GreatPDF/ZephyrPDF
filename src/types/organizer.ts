export interface PageItem {
  id: string;
  originalIndex: number; // 0-based index in the source PDF
  pageNumber: number;    // Display page number (1-based)
  rotation: number;      // 0, 90, 180, 270 degrees
  isDeleted: boolean;
  isBlank?: boolean;
  sourceDocId?: string;  // For merged documents
  thumbnailUrl?: string;
  width: number;
  height: number;
}

export interface DocumentStructure {
  pages: PageItem[];
  originalPageCount: number;
}
