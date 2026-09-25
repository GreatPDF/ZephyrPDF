import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { AnnotationManager } from '../annotations/manager';
import { PageManager } from '../organizer/page-manager';
import { FormHandler } from '../core/form-handler';
import { hexToPdfRgb } from '../utils/color';
import { WatermarkOptions, PageNumberOptions, DocumentMetadata } from '../types/document';

export class PdfExporter {
  public static async exportDocument(
    sourceBytes: Uint8Array,
    pageManager: PageManager,
    annotationManager: AnnotationManager,
    formHandler?: FormHandler,
    mergedDocs?: Map<string, Uint8Array>,
    flattenForm: boolean = false,
    watermarkOptions?: WatermarkOptions,
    pageNumberOptions?: PageNumberOptions,
    metadata?: DocumentMetadata
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

    if (metadata) {
      try {
        if (metadata.title) newDoc.setTitle(metadata.title);
        if (metadata.author) newDoc.setAuthor(metadata.author);
        if (metadata.subject) newDoc.setSubject(metadata.subject);
        if (metadata.keywords) newDoc.setKeywords(metadata.keywords.split(',').map(k => k.trim()).filter(Boolean));
        if (metadata.creator) newDoc.setCreator(metadata.creator);
        newDoc.setProducer('ZephyrPDF (https://github.com/GreatPDF/GreatPDF)');
        newDoc.setModificationDate(new Date());
      } catch {
        // Ignore metadata setting errors
      }
    }

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
          } else if (ann.type === 'underline' || ann.type === 'strikeout') {
            const strokeColor = hexToPdfRgb(ann.color || (ann.type === 'strikeout' ? '#ef4444' : '#2563eb'));
            for (const r of ann.rects) {
              const lineY = ann.type === 'underline'
                ? pageHeight - (r.y + r.height - 1)
                : pageHeight - (r.y + r.height / 2);
              targetPage.drawLine({
                start: { x: r.x, y: lineY },
                end: { x: r.x + r.width, y: lineY },
                thickness: ann.strokeWidth || 1.5,
                color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
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
            const fontSize = 16;
            const textWidth = fontHelveticaBold.widthOfTextAtSize(textToDraw, fontSize);
            const textX = ann.x + Math.max(4, (ann.width - textWidth) / 2);
            targetPage.drawText(textToDraw, {
              x: textX,
              y: pageHeight - (ann.y + ann.height / 2 + 5),
              size: fontSize,
              font: fontHelveticaBold,
              color: rgb(stampColor.r, stampColor.g, stampColor.b)
            });
          } else if (ann.type === 'signature' || ann.type === 'image') {
            try {
              const [header, base64Data] = ann.dataUrl.split(',');
              const binaryStr = atob(base64Data);
              const bytes = new Uint8Array(binaryStr.length);
              for (let i = 0; i < binaryStr.length; i++) {
                bytes[i] = binaryStr.charCodeAt(i);
              }
              const isJpg = header && (header.includes('jpeg') || header.includes('jpg'));
              let image;
              if (isJpg) {
                try {
                  image = await newDoc.embedJpg(bytes);
                } catch {
                  image = await newDoc.embedPng(bytes);
                }
              } else {
                try {
                  image = await newDoc.embedPng(bytes);
                } catch {
                  image = await newDoc.embedJpg(bytes);
                }
              }

              targetPage.drawImage(image, {
                x: ann.x,
                y: pageHeight - (ann.y + ann.height),
                width: ann.width,
                height: ann.height
              });
            } catch (err) {
              console.warn('Failed to embed image:', err);
            }
          } else if (ann.type === 'sticky_note') {
            const noteColor = hexToPdfRgb(ann.color || '#ffca28');
            // Draw note pin circle
            targetPage.drawCircle({
              x: ann.x,
              y: pageHeight - ann.y,
              size: 10,
              color: rgb(noteColor.r, noteColor.g, noteColor.b),
              borderColor: rgb(0.2, 0.2, 0.2),
              borderWidth: 1.2
            });
            // Draw note text preview if content exists
            if (ann.content && ann.content.trim()) {
              const preview = ann.content.length > 40 ? ann.content.substring(0, 37) + '...' : ann.content;
              const boxW = Math.min(220, Math.max(70, preview.length * 5.5 + 14));
              const boxH = 18;
              targetPage.drawRectangle({
                x: ann.x + 14,
                y: pageHeight - (ann.y + boxH / 2),
                width: boxW,
                height: boxH,
                color: rgb(1, 0.98, 0.85),
                borderColor: rgb(noteColor.r, noteColor.g, noteColor.b),
                borderWidth: 1,
                opacity: 0.95
              });
              targetPage.drawText(preview, {
                x: ann.x + 18,
                y: pageHeight - (ann.y + 3.5),
                size: 8,
                font: fontHelvetica,
                color: rgb(0.15, 0.15, 0.15)
              });
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
              const text = ann.overlayText || 'REDACTED';
              const fontSize = Math.min(8, ann.height * 0.5);
              const textWidth = fontHelveticaBold.widthOfTextAtSize(text, fontSize);
              const textX = ann.x + Math.max(2, (ann.width - textWidth) / 2);
              targetPage.drawText(text, {
                x: textX,
                y: pageHeight - (ann.y + ann.height / 2 + fontSize * 0.35),
                size: fontSize,
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

            // Perpendicular end ticks
            const angle = Math.atan2(ann.y2 - ann.y1, ann.x2 - ann.x1);
            const tickLen = 5;
            const perpX = Math.sin(angle) * tickLen;
            const perpY = -Math.cos(angle) * tickLen;

            targetPage.drawLine({
              start: { x: ann.x1 - perpX, y: pageHeight - (ann.y1 - perpY) },
              end: { x: ann.x1 + perpX, y: pageHeight - (ann.y1 + perpY) },
              thickness: 1.5,
              color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
            });

            targetPage.drawLine({
              start: { x: ann.x2 - perpX, y: pageHeight - (ann.y2 - perpY) },
              end: { x: ann.x2 + perpX, y: pageHeight - (ann.y2 + perpY) },
              thickness: 1.5,
              color: rgb(strokeColor.r, strokeColor.g, strokeColor.b)
            });

            // Draw label badge at midpoint
            const midX = (ann.x1 + ann.x2) / 2;
            const midY = (ann.y1 + ann.y2) / 2;
            const textWidth = fontHelveticaBold.widthOfTextAtSize(ann.formattedValue, 8);
            const badgeW = textWidth + 8;
            const badgeH = 14;

            targetPage.drawRectangle({
              x: midX - badgeW / 2,
              y: pageHeight - (midY + badgeH / 2),
              width: badgeW,
              height: badgeH,
              color: rgb(0.12, 0.16, 0.23),
              borderColor: rgb(strokeColor.r, strokeColor.g, strokeColor.b),
              borderWidth: 1
            });

            targetPage.drawText(ann.formattedValue, {
              x: midX - textWidth / 2,
              y: pageHeight - (midY + 3),
              size: 8,
              font: fontHelveticaBold,
              color: rgb(1, 1, 1)
            });
          }
        } catch (e) {
          console.error('Failed to bake annotation into exported PDF:', e);
        }
      }

      // Draw watermark if enabled
      if (watermarkOptions?.enabled && watermarkOptions.text) {
        const wmColor = hexToPdfRgb(watermarkOptions.color || '#94a3b8');
        const { width: pageWidth, height: pHeight } = targetPage.getSize();
        const fontSize = watermarkOptions.fontSize || 48;
        targetPage.drawText(watermarkOptions.text, {
          x: pageWidth / 2 - (watermarkOptions.text.length * fontSize * 0.28),
          y: pHeight / 2,
          size: fontSize,
          font: fontHelveticaBold,
          color: rgb(wmColor.r, wmColor.g, wmColor.b),
          opacity: watermarkOptions.opacity || 0.15,
          rotate: degrees(watermarkOptions.rotationDegrees || -45)
        });
      }

      // Draw page numbers if enabled
      if (pageNumberOptions?.enabled) {
        const { width: pageWidth, height: pHeight } = targetPage.getSize();
        const currentNum = newPageIndex + 1;
        const totalNum = activePages.length;
        let pnText = `${currentNum}`;
        if (pageNumberOptions.format === 'Page X of Y') {
          pnText = `Page ${currentNum} of ${totalNum}`;
        } else if (pageNumberOptions.format === 'X of Y') {
          pnText = `${currentNum} of ${totalNum}`;
        }

        let pnX = pageWidth / 2 - 25;
        let pnY = 20;
        if (pageNumberOptions.position === 'bottom-right') {
          pnX = pageWidth - 90;
          pnY = 20;
        } else if (pageNumberOptions.position === 'top-right') {
          pnX = pageWidth - 90;
          pnY = pHeight - 25;
        } else if (pageNumberOptions.position === 'top-center') {
          pnX = pageWidth / 2 - 25;
          pnY = pHeight - 25;
        }

        targetPage.drawText(pnText, {
          x: pnX,
          y: pnY,
          size: pageNumberOptions.fontSize || 9,
          font: fontHelvetica,
          color: rgb(0.35, 0.35, 0.35)
        });
      }
    }

    if (formHandler) {
      formHandler.applyToPdf(newDoc);
      if (flattenForm) {
        try {
          const form = newDoc.getForm();
          form.flatten();
        } catch (err) {
          console.warn('Could not flatten form:', err);
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
