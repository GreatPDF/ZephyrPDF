import { describe, it, expect } from 'vitest';
import { FeedbackDialog } from '../src/ui/dialogs/feedback-dialog';
import { APP_VERSION } from '../src/version';

describe('FeedbackDialog', () => {
  it('formats report with default and custom context', () => {
    const dialog = new FeedbackDialog({
      version: '2.9.0',
      currentPage: 3,
      pageCount: 10,
      zoom: 1.5,
      theme: 'sepia',
      viewMode: 'continuous',
    });

    const reportWithDiag = dialog.formatReport(
      'Bug Report',
      'Annotation handle off by 2px',
      'When zoomed at 150%, clicking the handle misses by 2px.',
      true
    );

    expect(reportWithDiag.subject).toBe('[ZephyrPDF Bug Report] Annotation handle off by 2px');
    expect(reportWithDiag.body).toContain('Type: Bug Report');
    expect(reportWithDiag.body).toContain('Subject: Annotation handle off by 2px');
    expect(reportWithDiag.body).toContain('When zoomed at 150%, clicking the handle misses by 2px.');
    expect(reportWithDiag.body).toContain('--- System & Environment Diagnostics ---');
    expect(reportWithDiag.body).toContain('App: ZephyrPDF v2.9.0');
    expect(reportWithDiag.body).toContain('Document State: Page 3 / 10, Zoom: 150%');
    expect(reportWithDiag.body).toContain('Theme: sepia, View Mode: continuous');

    // Without diagnostics
    const reportWithoutDiag = dialog.formatReport(
      'Feature Request',
      'Add Dark Mode Sepia blend',
      'Would love more color options.',
      false
    );

    expect(reportWithoutDiag.subject).toBe('[ZephyrPDF Feature Request] Add Dark Mode Sepia blend');
    expect(reportWithoutDiag.body).not.toContain('--- System & Environment Diagnostics ---');
  });

  it('uses robust fallback values when context is empty or partially specified', () => {
    const dialog = new FeedbackDialog();
    const diagText = dialog.getDiagnosticsText();

    expect(diagText).toContain(`App: ZephyrPDF v${APP_VERSION}`);
    expect(diagText).toContain('Document State: Page 1 / 1, Zoom: 100%');
    expect(diagText).toContain('Theme: dark, View Mode: continuous');

    const defaultReport = dialog.formatReport('General Feedback', '', '', true);
    expect(defaultReport.subject).toBe('[ZephyrPDF General Feedback] User Feedback');
    expect(defaultReport.body).toContain('Subject: N/A');
    expect(defaultReport.body).toContain('Description:\n(No details provided)');
  });

  it('formats email subjects cleanly across all feedback categories', () => {
    const dialog = new FeedbackDialog({ version: '2.9.0' });

    const bug = dialog.formatReport('Bug Report', 'Broken scroll', 'Details here', false);
    const feature = dialog.formatReport('Feature Request', 'Tabbed comparison', 'Details here', false);
    const general = dialog.formatReport('General Feedback', 'Loving ZephyrPDF', 'Details here', false);

    expect(bug.subject).toBe('[ZephyrPDF Bug Report] Broken scroll');
    expect(feature.subject).toBe('[ZephyrPDF Feature Request] Tabbed comparison');
    expect(general.subject).toBe('[ZephyrPDF General Feedback] Loving ZephyrPDF');
  });

  it('builds encoded mailto URL targeting maintainer address', () => {
    const dialog = new FeedbackDialog({ version: '2.12.55' });
    const mailto = dialog.buildMailtoUrl('Bug Report', 'Canvas flickering', 'Flickers on resize', false);

    expect(mailto.startsWith('mailto:greatpdf@ik.me?subject=')).toBe(true);
    expect(mailto).toContain(encodeURIComponent('[ZephyrPDF Bug Report] Canvas flickering'));
    expect(mailto).toContain(encodeURIComponent('Flickers on resize'));
  });
});
