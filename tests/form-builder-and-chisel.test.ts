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

  it('should create multiline textarea fields with enableMultiline() when height > 35', async () => {
    const doc = await PDFDocument.create();
    doc.addPage([600, 800]);

    const formHandler = new FormHandler();

    formHandler.createField({
      name: 'notes_and_comments',
      type: 'text',
      value: 'Line 1: Observations\nLine 2: Recommendations',
      pageIndex: 0,
      bounds: { x: 50, y: 200, width: 220, height: 70 }
    });

    formHandler.applyToPdf(doc);
    const savedBytes = await doc.save();

    const reloaded = await PDFDocument.load(savedBytes);
    const field = reloaded.getForm().getTextField('notes_and_comments');
    expect(field.getText()).toBe('Line 1: Observations\nLine 2: Recommendations');
    expect(field.isMultiline()).toBe(true);
  });

  it('should retrieve all fields via getAllFields and support field deletion', () => {
    const formHandler = new FormHandler();
    formHandler.createField({
      name: 'field_a',
      type: 'text',
      value: 'val A',
      pageIndex: 0,
      bounds: { x: 10, y: 10, width: 100, height: 20 }
    });
    formHandler.createField({
      name: 'field_b',
      type: 'checkbox',
      value: true,
      pageIndex: 1,
      bounds: { x: 20, y: 20, width: 15, height: 15 }
    });

    const all = formHandler.getAllFields();
    expect(all.length).toBe(2);
    expect(all.map(f => f.name)).toContain('field_a');
    expect(all.map(f => f.name)).toContain('field_b');

    formHandler.deleteField('field_a');
    expect(formHandler.getAllFields().length).toBe(1);
    expect(formHandler.getAllFields()[0].name).toBe('field_b');
    expect(formHandler.getValue('field_a')).toBeUndefined();
  });
});
