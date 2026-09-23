import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';

/**
 * Creates an exquisite sample PDF document to demonstrate ZephyrPDF's viewing and editing prowess.
 */
export async function createSamplePdf(): Promise<Uint8Array> {
  const pdfDoc = await PDFDocument.create();
  const fontHelvetica = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontHelveticaBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontHelveticaOblique = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);

  // --- Page 1: Welcome & Overview ---
  const page1 = pdfDoc.addPage([595.28, 841.89]); // A4
  const { width, height } = page1.getSize();

  // Header background banner
  page1.drawRectangle({
    x: 0,
    y: height - 120,
    width: width,
    height: 120,
    color: rgb(0.08, 0.13, 0.22)
  });

  // Title
  page1.drawText('ZephyrPDF', {
    x: 50,
    y: height - 60,
    size: 28,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1)
  });

  page1.drawText('The Premier Open-Source PDF Viewer & Editor', {
    x: 50,
    y: height - 85,
    size: 13,
    font: fontHelveticaOblique,
    color: rgb(0.62, 0.74, 0.95)
  });

  // Section 1
  let yPos = height - 160;
  page1.drawText('Welcome to ZephyrPDF!', {
    x: 50,
    y: yPos,
    size: 18,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25)
  });

  yPos -= 25;
  const p1 = 'ZephyrPDF is designed from the ground up for speed, elegance, and complete user freedom.';
  const p2 = 'Everything happens directly in your browser or desktop container with 100% privacy:';
  const p3 = 'your documents never leave your machine.';

  page1.drawText(p1, { x: 50, y: yPos, size: 11, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
  yPos -= 16;
  page1.drawText(p2, { x: 50, y: yPos, size: 11, font: fontHelvetica, color: rgb(0.2, 0.2, 0.2) });
  yPos -= 16;
  page1.drawText(p3, { x: 50, y: yPos, size: 11, font: fontHelveticaBold, color: rgb(0.08, 0.45, 0.3) });

  // Feature Highlights Box
  yPos -= 40;
  page1.drawRectangle({
    x: 50,
    y: yPos - 140,
    width: width - 100,
    height: 140,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.85, 0.88, 0.94),
    borderWidth: 1
  });

  page1.drawText('Key Capabilities', {
    x: 70,
    y: yPos - 25,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.12, 0.2, 0.35)
  });

  const features = [
    '• Flawless Viewing: Continuous scroll, spread mode, zoom & retina rendering',
    '• Powerful Annotations: Freehand pen, text highlights, shapes, notes & custom stamps',
    '• Digital Signatures: Draw, type cursive, or import transparent signatures',
    '• Page Organizer: Visual drag-and-drop reorder, rotate, delete, insert & merge',
    '• Full-Text Search: Blazing fast search with immediate match navigation',
    '• PDF Standard Export: Clean ISO 32000-1 compliant export recognized everywhere'
  ];

  let featY = yPos - 48;
  for (const feat of features) {
    page1.drawText(feat, {
      x: 70,
      y: featY,
      size: 10,
      font: fontHelvetica,
      color: rgb(0.25, 0.3, 0.38)
    });
    featY -= 17;
  }

  // Sample Interactive Section
  yPos = featY - 40;
  page1.drawText('Sample Inspection & Markup Playground', {
    x: 50,
    y: yPos,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25)
  });

  yPos -= 22;
  const playgroundText =
    'Try using the highlighter on this sentence to mark important facts. You can also select the text ' +
    'tool to add commentary or stamp this agreement as APPROVED using the stamp tool above.';
  page1.drawText(playgroundText.slice(0, 85), { x: 50, y: yPos, size: 10, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });
  yPos -= 15;
  page1.drawText(playgroundText.slice(85), { x: 50, y: yPos, size: 10, font: fontHelvetica, color: rgb(0.3, 0.3, 0.3) });

  // Signature area box on page 1
  yPos -= 60;
  page1.drawRectangle({
    x: 50,
    y: yPos - 70,
    width: 250,
    height: 70,
    borderColor: rgb(0.7, 0.75, 0.8),
    borderWidth: 1,
    color: rgb(1, 1, 1)
  });
  page1.drawText('Sign Here (Try the Signature Tool):', {
    x: 60,
    y: yPos - 20,
    size: 9,
    font: fontHelveticaOblique,
    color: rgb(0.5, 0.5, 0.5)
  });
  page1.drawLine({
    start: { x: 60, y: yPos - 55 },
    end: { x: 280, y: yPos - 55 },
    thickness: 1,
    color: rgb(0.8, 0.8, 0.8)
  });

  // Interactive AcroForm fields
  const form = pdfDoc.getForm();
  const reviewerField = form.createTextField('reviewer_name');
  reviewerField.setText('Alex Maintainer');
  reviewerField.addToPage(page1, { x: 320, y: yPos - 35, width: 220, height: 24 });
  page1.drawText('Reviewer Name (Fillable Form Field):', {
    x: 320,
    y: yPos - 8,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  const agreeCheckbox = form.createCheckBox('terms_agree');
  agreeCheckbox.check();
  agreeCheckbox.addToPage(page1, { x: 320, y: yPos - 65, width: 16, height: 16 });
  page1.drawText('I confirm this document is verified', {
    x: 345,
    y: yPos - 62,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.3, 0.3, 0.3)
  });

  // Footer
  page1.drawText('Page 1 of 2 — ZephyrPDF Document Showcase', {
    x: 50,
    y: 35,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.6, 0.6, 0.6)
  });

  // --- Page 2: Advanced Features & Specifications ---
  const page2 = pdfDoc.addPage([595.28, 841.89]);
  
  // Header
  page2.drawRectangle({
    x: 0,
    y: height - 70,
    width: width,
    height: 70,
    color: rgb(0.12, 0.18, 0.28)
  });
  page2.drawText('ZephyrPDF Technical Specification & Features', {
    x: 50,
    y: height - 45,
    size: 16,
    font: fontHelveticaBold,
    color: rgb(1, 1, 1)
  });

  let y2 = height - 110;
  page2.drawText('1. Performance & Architecture', {
    x: 50,
    y: y2,
    size: 13,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25)
  });

  y2 -= 20;
  const archText = [
    '• Zero Latency: Rendered using WebAssembly-accelerated PDF pipelines.',
    '• Memory Efficient: Virtualized viewport rendering minimizes GPU and RAM consumption.',
    '• Multi-tier Caching: Rendered page tiles are cached intelligently for instantaneous scrolling.',
    '• Non-destructive Editing: Original document stream is preserved, edits are layered cleanly.'
  ];
  for (const line of archText) {
    page2.drawText(line, { x: 60, y: y2, size: 10, font: fontHelvetica, color: rgb(0.25, 0.25, 0.25) });
    y2 -= 16;
  }

  y2 -= 15;
  page2.drawText('2. Page Management & Transformation', {
    x: 50,
    y: y2,
    size: 13,
    font: fontHelveticaBold,
    color: rgb(0.1, 0.15, 0.25)
  });

  y2 -= 20;
  const orgText = [
    '• Drag and drop reordering of any number of pages in the visual thumbnail grid.',
    '• 90° Clockwise and Counter-Clockwise page rotations with instant viewport updates.',
    '• Deletion and blank page insertion with customized dimensions.',
    '• Multi-document merge: Combine reports, invoices, and contracts seamlessly.'
  ];
  for (const line of orgText) {
    page2.drawText(line, { x: 60, y: y2, size: 10, font: fontHelvetica, color: rgb(0.25, 0.25, 0.25) });
    y2 -= 16;
  }

  y2 -= 30;
  // A sample decorative stamp box on Page 2
  page2.drawRectangle({
    x: width - 200,
    y: y2 - 60,
    width: 150,
    height: 55,
    borderColor: rgb(0.15, 0.6, 0.3),
    borderWidth: 2,
    color: rgb(0.95, 0.99, 0.96)
  });
  page2.drawText('VERIFIED OSS', {
    x: width - 180,
    y: y2 - 35,
    size: 14,
    font: fontHelveticaBold,
    color: rgb(0.15, 0.6, 0.3)
  });

  page2.drawText('Page 2 of 2 — ZephyrPDF Document Showcase', {
    x: 50,
    y: 35,
    size: 9,
    font: fontHelvetica,
    color: rgb(0.6, 0.6, 0.6)
  });

  return await pdfDoc.save();
}
