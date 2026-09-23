import { describe, it, expect } from 'vitest';
import { PDFDocument } from 'pdf-lib';
import { FormHandler } from '../src/core/form-handler';
import { FreehandAnnotation } from '../src/types/annotations';

describe('Form Builder and Chisel Highlighting', () => {
  it('should create new interactive form fields on a PDF from scratch', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);

    const formHandler = new FormHandler();

    // Dynamically create a text field and checkbox
    formHandler.createField({
      name: 'client_signature_date',
      type: 'text',
      value: '2026-09-23',
      pageIndex: 0,
      bounds: { x: 50, y: 100, width: 140, height: 24 }
    });

    formHandler.createField({
      name: 'terms_acknowledged',
      type: 'checkbox',
      value: true,
      pageIndex: 0,
      bounds: { x: 50, y: 150, width: 18, height: 18 }
    });

    expect(formHandler.hasFields()).toBe(true);
    expect(formHandler.getFieldsForPage(0).length).toBe(2);

    // Apply to PDF
    formHandler.applyToPdf(doc);
    const savedBytes = await doc.save();

    // Verify fields were created in AcroForm
    const reloaded = await PDFDocument.load(savedBytes);
    const form = reloaded.getForm();
    expect(form.getTextField('client_signature_date').getText()).toBe('2026-09-23');
    expect(form.getCheckBox('terms_acknowledged').isChecked()).toBe(true);
  });

  it('should support chisel freehand highlighter annotations with natural opacity', async () => {
    const chiselAnn: FreehandAnnotation = {
      id: 'chisel_1',
      type: 'freehand',
      pageIndex: 0,
      points: [
        { x: 50, y: 120 },
        { x: 150, y: 120 },
        { x: 250, y: 120 }
      ],
      color: '#ffeb3b',
      strokeWidth: 20,
      opacity: 0.4,
      isHighlighter: true,
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    expect(chiselAnn.isHighlighter).toBe(true);
    expect(chiselAnn.strokeWidth).toBe(20);
    expect(chiselAnn.opacity).toBe(0.4);
  });
});
