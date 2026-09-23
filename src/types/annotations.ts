export type AnnotationType =
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'squiggle'
  | 'freehand'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'stamp'
  | 'signature'
  | 'sticky_note'
  | 'redaction'
  | 'measure'
  | 'image';

export interface BaseAnnotation {
  id: string;
  type: AnnotationType;
  pageIndex: number;
  createdAt: number;
  updatedAt: number;
  author?: string;
  locked?: boolean;
}

export interface HighlightAnnotation extends BaseAnnotation {
  type: 'highlight';
  rects: { x: number; y: number; width: number; height: number }[];
  color: string;
  opacity: number;
}

export interface MarkupAnnotation extends BaseAnnotation {
  type: 'underline' | 'strikeout' | 'squiggle';
  rects: { x: number; y: number; width: number; height: number }[];
  color: string;
  strokeWidth: number;
}

export interface Point {
  x: number;
  y: number;
  pressure?: number;
}

export interface FreehandAnnotation extends BaseAnnotation {
  type: 'freehand';
  points: Point[];
  color: string;
  strokeWidth: number;
  opacity: number;
  isEraser?: boolean;
  isHighlighter?: boolean;
}

export interface TextAnnotation extends BaseAnnotation {
  type: 'text';
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  fontSize: number;
  fontFamily: string;
  color: string;
  backgroundColor?: string;
  borderColor?: string;
  bold?: boolean;
  italic?: boolean;
}

export interface ShapeAnnotation extends BaseAnnotation {
  type: 'rectangle' | 'ellipse';
  x: number;
  y: number;
  width: number;
  height: number;
  strokeColor: string;
  fillColor?: string;
  strokeWidth: number;
  borderStyle?: 'solid' | 'dashed' | 'dotted';
}

export interface LineAnnotation extends BaseAnnotation {
  type: 'line' | 'arrow';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  strokeColor: string;
  strokeWidth: number;
  arrowHead?: boolean;
}

export interface StampAnnotation extends BaseAnnotation {
  type: 'stamp';
  stampType: 'APPROVED' | 'DRAFT' | 'CONFIDENTIAL' | 'REJECTED' | 'FINAL' | 'CUSTOM';
  customText?: string;
  x: number;
  y: number;
  width: number;
  height: number;
  color: string;
}

export interface SignatureAnnotation extends BaseAnnotation {
  type: 'signature';
  dataUrl: string; // PNG base64
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickyNoteAnnotation extends BaseAnnotation {
  type: 'sticky_note';
  x: number;
  y: number;
  title: string;
  content: string;
  color: string;
  isOpen?: boolean;
}

export interface RedactionAnnotation extends BaseAnnotation {
  type: 'redaction';
  x: number;
  y: number;
  width: number;
  height: number;
  overlayText?: string;
}

export type MeasureUnit = 'mm' | 'cm' | 'in' | 'pt';

export interface MeasureAnnotation extends BaseAnnotation {
  type: 'measure';
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  distancePt: number;
  unit: MeasureUnit;
  formattedValue: string;
  color: string;
}

export interface ImageAnnotation extends BaseAnnotation {
  type: 'image';
  dataUrl: string;
  format?: 'png' | 'jpeg';
  x: number;
  y: number;
  width: number;
  height: number;
}

export type Annotation =
  | HighlightAnnotation
  | MarkupAnnotation
  | FreehandAnnotation
  | TextAnnotation
  | ShapeAnnotation
  | LineAnnotation
  | StampAnnotation
  | SignatureAnnotation
  | StickyNoteAnnotation
  | RedactionAnnotation
  | MeasureAnnotation
  | ImageAnnotation;

export type ToolType =
  | 'select'
  | 'hand'
  | 'highlight'
  | 'underline'
  | 'strikeout'
  | 'freehand'
  | 'eraser'
  | 'text'
  | 'rectangle'
  | 'ellipse'
  | 'line'
  | 'arrow'
  | 'stamp'
  | 'signature'
  | 'sticky_note'
  | 'redaction'
  | 'measure'
  | 'image'
  | 'freehand_highlight'
  | 'loupe';
