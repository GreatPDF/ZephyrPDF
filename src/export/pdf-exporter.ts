import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { AnnotationManager } from '../annotations/manager';
import { PageManager } from '../organizer/page-manager';
import { FormHandler } from '../core/form-handler';
import { hexToPdfRgb } from '../utils/color';

export class PdfExporter {
  public static async exportDocument(
    sourceBytes: Uint8Array,
    pageManager: PageManager,
    annotationManager: AnnotationManager,
    formHandler?: FormHandler,
    mergedDocs?: Map<string, Uint8Array>,
    flattenForm: boolean = false
  ): Promise<Uint8Array> {
    const sourceDoc = await PDFDocument.load(sourceBytes, { ignoreEncryption: true });
    if (formHandler) {
      formHandler.applyToPdf(sourceDoc);
      if (flattenForm) {
        try {
          sourceDoc.getForm().flatten();
        } catch {
          // Ignore if no form
        }
      }
    }
    const newDoc = await PDFDocument.create();

    const loadedMergedDocs = new Map<string, PDFDocument>();
    if (mergedDocs) {
      for (const [id, bytes] of mergedDocs.entries()) {
        loadedMergedDocs.set(id, await PDFDocument.load(bytes, { ignoreEncryption: true }));
      }
    }

    const fontHelvetica = await newDoc.embedFont(StandardFonts.Helvetica);
    const fontHelveticaBold = await newDoc.embedFont(StandardFonts.HelveticaBold);

    const activePages = pageManager.getPages();

    for (let newPageIndex = 0; newPageIndex < activePages.length; newPageIndex++) {
      const pageInfo = activePages[newPageIndex];
      let targetPage: any;

      if (pageInfo.isBlank) {
        targetPage = newDoc.addPage([pageInfo.width || 595.28, pageInfo.height || 841.89]);
      } else {
        const fromDoc = (pageInfo.sourceDocId && loadedMergedDocs.get(pageInfo.sourceDocId)) || sourceDoc;
        const [copied] = await newDoc.copyPages(fromDoc, [pageInfo.originalIndex]);
        targetPage = newDoc.addPage(copied);
      }

      if (pageInfo.rotation) {
        targetPage.setRotation(degrees(pageInfo.rotation));
      }

      const { height: pageHeight } = targetPage.getSize();

      // Retrieve annotations for this page (match either new index or original index)
      const annotations = [
        ...annotationManager.getAnnotationsForPage(pageInfo.originalIndex),
        ...(pageInfo.originalIndex !== newPageIndex
          ? annotationManager.getAnnotationsForPage(newPageIndex)
          : [])
      ].filter((v, i, a) => a.findIndex(t => t.id === v.id) === i);

      for (const ann of annotations) {
        try {
          if (ann.type === 'highlight') {
            const pdfColor = hexToPdfRgb(ann.color);
            for (const r of ann.rects) {
              targetPage.drawRectangle({
                x: r.x,
                y: pageHeight - (r.y + r.height),
                width: r.width,
                height: r.height,
                color: rgb(pdfColor.r, pdfColor.g, pdfColor.b),
                opacity: ann.opacity || 0.35
              });
            }
          } else if (ann.type === 'freehand') {
            const pdfColor = hexToPdfRgb(ann.color);
            const pts = ann.points;
            for (let i = 0; i < pts.length - 1; i++) {
              targetPage.drawLine({
                start: { x: pts[i].x, y: pageHeight - pts[i].y },
                end: { x: pts[i + 1].x, y: pageHeight - pts[i + 1].y },
                thickness: ann.strokeWidth || 2,
                color: rgb(pdfColor.r, pdfColor.g, pdfColor.b),
                opacity: ann.opacity || 1
              });
            }
          } else if (ann.type === 'rectangle') {
            const strokeColor = hexToPdfRgb(ann.strokeColor);
            targetPage.drawRectangle({
              x: ann.x,
              y: pageHeight - (ann.y + ann.height),
              width: ann.width,
              height: ann.height,
              borderColor: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
              borderWidth: ann.strokeWidth || 1,
              color: ann.fillColor ? rgb(hexToPdfRgb(ann.fillColor).r, hexToPdfRgb(ann.fillColor).g, hexToPdfRgb(ann.fillColor).b) : undefined
            });
          } else if (ann.type === 'ellipse') {
            const strokeColor = hexToPdfRgb(ann.strokeColor);
            targetPage.drawEllipse({
              x: ann.x + ann.width / 2,
              y: pageHeight - (ann.y + ann.height / 2),
              xScale: ann.width / 2,
              yScale: ann.height / 2,
              borderColor: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
              borderWidth: ann.strokeWidth || 1,
              color: ann.fillColor ? rgb(hexToPdfRgb(ann.fillColor).r, hexToPdfRgb(ann.fillColor).g, hexToPdfRgb(ann.fillColor).b) : undefined
            });
          } else if (ann.type === 'line' || ann.type === 'arrow') {
            const strokeColor = hexToPdfRgb(ann.strokeColor);
            targetPage.drawLine({
              start: { x: ann.x1, y: pageHeight - ann.y1 },
              end: { x: ann.x2, y: pageHeight - ann.y2 },
              thickness: ann.strokeWidth || 1.5,
              color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
            });

            if (ann.arrowHead) {
              const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
              const arrowLen = 10;
              const arrowAngle = Math.PI / 6;
              const p1x = ann.x2 - arrowLen * Math.cos(angle - arrowAngle);
              const p1y = ann.y2 - arrowLen * Math.sin(angle - arrowAngle);
              const p2x = ann.x2 - arrowLen * Math.cos(angle + arrowAngle);
              const p2y = ann.y2 - arrowLen * Math.sin(angle + arrowAngle);

              targetPage.drawLine({
                start: { x: ann.x2, y: pageHeight - ann.y2 },
                end: { x: p1x, y: pageHeight - p1y },
                thickness: ann.strokeWidth || 1.5,
                color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
              });
              targetPage.drawLine({
                start: { x: ann.x2, y: pageHeight - ann.y2 },
                end: { x: p2x, y: pageHeight - p2y },
                thickness: ann.strokeWidth || 1.5,
                color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
              });
            }
          } else if (ann.type === 'text') {
            const textColor = hexToPdfRgb(ann.color);
            targetPage.drawText(ann.text, {
              x: ann.x,
              y: pageHeight - (ann.y + ann.fontSize),
              size: ann.fontSize || 12,
              font: ann.bold ? fontHelveticaBold : fontHelvetica,
              color: rgb(textColor.r, textColor.g, textColor.b)
            });
          } else if (ann.type === 'stamp') {
            const stampColor = hexToPdfRgb(ann.color);
            targetPage.drawRectangle({
              x: ann.x,
              y: pageHeight - (ann.y + ann.height),
              width: ann.width,
              height: ann.height,
              borderColor: rgb(stampColor.r, stampColor.g, stampColor.b),
              borderWidth: 2,
              color: rgb(stampColor.r, stampColor.g, stampColor.b),
              opacity: 0.1
            });
            const textToDraw = ann.customText || ann.stampType;
            targetPage.drawText(textToDraw, {
              x: ann.x + 12,
              y: pageHeight - (ann.y + ann.height / 2 + 5),
              size: 16,
              font: fontHelveticaBold,
              color: rgb(stampColor.r, stampColor.g, stampColor.b)
            });
          } else if (ann.type === 'signature') {
            try {
              const base64Data = ann.dataUrl.split(',')[1];
              const binaryStr = atob(base64Data);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const image = await newDoc.embedPng(bytes);
              targetPage.drawImage(image, {
                x: ann.x,
                y: pageHeight - (ann.y + ann.height),
                width: ann.width,
                height: ann.height
              });
            } catch (err) {
              console.warn('Failed to embed signature image:', err);
            }
          } else if (ann.type === 'redaction') {
            targetPage.drawRectangle({
              x: ann.x,
              y: pageHeight - (ann.y + ann.height),
              width: ann.width,
              height: ann.height,
              color: rgb(0, 0, 0),
              opacity: 1
            });
            if (ann.width > 36 && ann.height > 12) {
              targetPage.drawText(ann.overlayText || 'REDACTED', {
                x: ann.x + 4,
                y: pageHeight - (ann.y + ann.height / 2 + 3),
                size: Math.min(8, ann.height * 0.5),
                font: fontHelveticaBold,
                color: rgb(1, 1, 1)
              });
            }
          } else if (ann.type === 'measure') {
            const strokeColor = hexToPdfRgb(ann.color);
            targetPage.drawLine({
              start: { x: ann.x1, y: pageHeight - ann.y1 },
              end: { x: ann.x2, y: pageHeight - ann.y2 },
              thickness: 1.5,
              color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
            });

            // Draw label at midpoint
            const midX = (ann.x1 + ann.x2) / 2;
            const midY = (ann.y1 + ann.y2) / 2;
            targetPage.drawText(ann.formattedValue, {
              x: midX - 16,
              y: pageHeight - (midY + 3),
              size: 8,
              font: fontHelveticaBold,
              color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
            });
          }
        } catch (e) {
          console.error('Failed to bake annotation into exported PDF:', e);
        }
      }
    }

    return await newDoc.save();
  }

  public static downloadBlob(bytes: Uint8Array, fileName: string): void {
    const blob = new Blob([bytes as BlobPart], { type: 'application/pdf' });
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
