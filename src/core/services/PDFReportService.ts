import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Test, UIStep } from '@/types/test';

interface TestRunData {
  test: Test;
  dataSets: Record<string, string>[];
  results: Array<{
    dataSetIndex: number;
    stepId: string;
    status: 'passed' | 'failed';
    error?: string;
    duration?: number;
  }>;
  startedAt: number;
  completedAt: number;
}

export class PDFReportService {
  /**
   * Generate PDF test report
   */
  static async generateReport(runData: TestRunData): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();

    // Calculate totals
    const totalSteps = runData.test.steps.length;
    const totalDataSets = runData.dataSets.length;
    const passedSteps = runData.results.filter((r) => r.status === 'passed').length;
    const failedSteps = runData.results.filter((r) => r.status === 'failed').length;
    const duration = runData.completedAt - runData.startedAt;
    const overallStatus = failedSteps === 0 ? 'PASSED' : 'FAILED';

    // Header
    doc.setFillColor(37, 99, 235); // Blue
    doc.rect(0, 0, pageWidth, 40, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFontSize(24);
    doc.setFont('helvetica', 'bold');
    doc.text('QAerx Test Report', 20, 25);

    // Test Info Section
    let yPosition = 55;
    doc.setTextColor(0, 0, 0);
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Information', 20, yPosition);

    yPosition += 10;
    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');

    const testInfo = [
      ['Test Name:', runData.test.name],
      ['URL:', runData.test.url || 'N/A'],
      ['Executed At:', new Date(runData.startedAt).toLocaleString()],
      ['Duration:', this.formatDuration(duration)],
      ['Status:', overallStatus],
    ];

    testInfo.forEach(([label, value]) => {
      doc.setFont('helvetica', 'bold');
      doc.text(label, 20, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.text(value, 60, yPosition);
      yPosition += 7;
    });

    // Summary Section
    yPosition += 10;
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Summary', 20, yPosition);

    yPosition += 10;
    autoTable(doc, {
      startY: yPosition,
      head: [['Metric', 'Value']],
      body: [
        ['Total Steps', totalSteps.toString()],
        ['Total Data Sets', totalDataSets.toString()],
        ['Passed Steps', passedSteps.toString()],
        ['Failed Steps', failedSteps.toString()],
        ['Success Rate', `${((passedSteps / (passedSteps + failedSteps)) * 100).toFixed(1)}%`],
      ],
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
    });

    // Test Steps Section
    yPosition = (doc as any).lastAutoTable.finalY + 20;

    // Check if we need a new page
    if (yPosition > pageHeight - 60) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Steps', 20, yPosition);

    yPosition += 10;

    // Create steps table (only UI steps)
    const stepsData = runData.test.steps
      .filter((step): step is UIStep => step.type === 'ui')
      .map((step, index) => {
        const stepResults = runData.results.filter((r) => r.stepId === step.id);
        const passed = stepResults.filter((r) => r.status === 'passed').length;
        const avgDuration = stepResults.length > 0
          ? stepResults.reduce((sum, r) => sum + (r.duration || 0), 0) / stepResults.length
          : 0;

        return [
          (index + 1).toString(),
          step.name,
          this.getActionDescription(step),
          `${passed}/${stepResults.length}`,
          this.formatDuration(avgDuration),
        ];
      });

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Step Name', 'Action', 'Pass Rate', 'Avg Duration']],
      body: stepsData,
      theme: 'grid',
      headStyles: {
        fillColor: [37, 99, 235],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        0: { cellWidth: 10 },
        1: { cellWidth: 60 },
        2: { cellWidth: 50 },
        3: { cellWidth: 25 },
        4: { cellWidth: 30 },
      },
    });

    // Data Sets Section (if multiple)
    if (totalDataSets > 1) {
      yPosition = (doc as any).lastAutoTable.finalY + 20;

      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.text('Data Sets', 20, yPosition);

      yPosition += 10;

      const dataSetHeaders = ['Set #', ...Object.keys(runData.dataSets[0] || {})];
      const dataSetData = runData.dataSets.map((dataSet, index) => {
        return [(index + 1).toString(), ...Object.values(dataSet)];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [dataSetHeaders],
        body: dataSetData,
        theme: 'grid',
        headStyles: {
          fillColor: [37, 99, 235],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
      });
    }

    // Failures Section (if any)
    const failures = runData.results.filter((r) => r.status === 'failed');
    if (failures.length > 0) {
      yPosition = (doc as any).lastAutoTable.finalY + 20;

      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(18);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(220, 38, 38); // Red
      doc.text('Failed Steps', 20, yPosition);

      yPosition += 10;

      const failureData = failures.map((failure) => {
        const step = runData.test.steps.find((s) => s.id === failure.stepId);
        const dataSet = failure.dataSetIndex + 1;
        return [
          step?.name || 'Unknown',
          `Data Set ${dataSet}`,
          failure.error || 'Unknown error',
        ];
      });

      doc.setTextColor(0, 0, 0);

      autoTable(doc, {
        startY: yPosition,
        head: [['Step', 'Data Set', 'Error']],
        body: failureData,
        theme: 'grid',
        headStyles: {
          fillColor: [220, 38, 38],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242],
        },
        columnStyles: {
          0: { cellWidth: 60 },
          1: { cellWidth: 30 },
          2: { cellWidth: 85 },
        },
      });
    }

    // Footer on all pages
    const totalPages = doc.internal.pages.length - 1; // Exclude the first placeholder page
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);
      doc.setFontSize(9);
      doc.setTextColor(128, 128, 128);
      doc.text(
        `Generated by QAerx • Page ${i} of ${totalPages}`,
        pageWidth / 2,
        pageHeight - 10,
        { align: 'center' }
      );
    }

    // Save the PDF
    const fileName = `${runData.test.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  /**
   * Get human-readable action description
   */
  private static getActionDescription(step: UIStep): string {
    const action = step.action as any;

    switch (action.type) {
      case 'click':
        return 'Click element';
      case 'type':
        return `Type text`;
      case 'navigate':
        return `Navigate to ${action.url}`;
      case 'select':
        return 'Select option';
      case 'waitTime':
        return `Wait ${action.duration}ms`;
      case 'waitForElement':
        return 'Wait for element';
      default:
        return action.type;
    }
  }

  /**
   * Format duration in ms to human-readable format
   */
  private static formatDuration(ms: number): string {
    if (ms < 1000) {
      return `${Math.round(ms)}ms`;
    }
    const seconds = ms / 1000;
    if (seconds < 60) {
      return `${seconds.toFixed(1)}s`;
    }
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
  }
}
