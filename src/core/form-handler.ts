import { PDFDocument, PDFTextField, PDFCheckBox, PDFDropdown } from 'pdf-lib';

export interface FormFieldInfo {
  name: string;
  type: 'text' | 'checkbox' | 'dropdown' | 'radio';
  value: string | boolean;
  pageIndex: number;
  bounds: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export class FormHandler {
  private fields: Map<string, FormFieldInfo> = new Map();
  private values: Map<string, string | boolean> = new Map();
  private listeners: Array<() => void> = [];

  public loadFromPdf(pdfDoc: PDFDocument): FormFieldInfo[] {
    this.fields.clear();
    this.values.clear();

    try {
      const form = pdfDoc.getForm();
      const rawFields = form.getFields();

      for (const field of rawFields) {
        const name = field.getName();
        let type: 'text' | 'checkbox' | 'dropdown' | 'radio' = 'text';
        let value: string | boolean = '';

        if (field instanceof PDFTextField) {
          type = 'text';
          value = field.getText() || '';
        } else if (field instanceof PDFCheckBox) {
          type = 'checkbox';
          value = field.isChecked();
        } else if (field instanceof PDFDropdown) {
          type = 'dropdown';
          const sel = field.getSelected();
          value = sel && sel.length > 0 ? sel[0] : '';
        }

        // Retrieve field widgets bounding boxes if available
        const widgets = field.acroField.getWidgets();
        let pageIndex = 0;
        let bounds = { x: 50, y: 50, width: 200, height: 25 };

        if (widgets && widgets.length > 0) {
          const rect = widgets[0].getRectangle();
          const pRef = widgets[0].P();
          if (pRef) {
            const pages = pdfDoc.getPages();
            const idx = pages.findIndex(p => p.ref === pRef);
            if (idx >= 0) pageIndex = idx;
          }
          if (rect) {
            bounds = {
              x: rect.x,
              y: rect.y,
              width: rect.width,
              height: rect.height
            };
          }
        }

        const info: FormFieldInfo = {
          name,
          type,
          value,
          pageIndex,
          bounds
        };

        this.fields.set(name, info);
        this.values.set(name, value);
      }
    } catch {
      // Document may not have AcroForm dictionary
    }

    this.notify();
    return Array.from(this.fields.values());
  }

  public setValue(fieldName: string, value: string | boolean): void {
    this.values.set(fieldName, value);
    const field = this.fields.get(fieldName);
    if (field) {
      field.value = value;
    }
    this.notify();
  }

  public getValue(fieldName: string): string | boolean | undefined {
    return this.values.get(fieldName);
  }

  public getFieldsForPage(pageIndex: number): FormFieldInfo[] {
    const res: FormFieldInfo[] = [];
    for (const f of this.fields.values()) {
      if (f.pageIndex === pageIndex) res.push(f);
    }
    return res;
  }

  public hasFields(): boolean {
    return this.fields.size > 0;
  }

  public applyToPdf(pdfDoc: PDFDocument): void {
    try {
      const form = pdfDoc.getForm();
      for (const [name, val] of this.values.entries()) {
        try {
          const field = form.getField(name);
          if (field instanceof PDFTextField && typeof val === 'string') {
            field.setText(val);
          } else if (field instanceof PDFCheckBox && typeof val === 'boolean') {
            if (val) field.check();
            else field.uncheck();
          } else if (field instanceof PDFDropdown && typeof val === 'string') {
            field.select(val);
          }
        } catch {
          // Skip missing fields
        }
      }
    } catch (e) {
      console.warn('Could not apply values to AcroForm:', e);
    }
  }

  public subscribe(callback: () => void): () => void {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter(l => l !== callback);
    };
  }

  private notify(): void {
    for (const l of this.listeners) l();
  }
}
