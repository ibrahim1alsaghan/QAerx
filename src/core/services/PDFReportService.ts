import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { Test, UIStep } from '@/types/test';

export type ScenarioType = 'best-case' | 'worst-case' | 'edge-case' | 'boundary' | 'normal';

interface TestRunData {
  test: Test;
  dataSets: Record<string, string>[];
  dataSetScenarios?: ScenarioType[]; // Scenario labels for each data set
  results: Array<{
    dataSetIndex: number;
    stepId: string;
    status: 'passed' | 'failed';
    error?: string;
    duration?: number;
    pageResponse?: string; // Captured system response (login success/fail, etc.)
  }>;
  startedAt: number;
  completedAt: number;
}

export class PDFReportService {
  /**
   * Generate comprehensive PDF test report
   */
  static async generateReport(runData: TestRunData): Promise<void> {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const steps = runData.test.steps.filter((s): s is UIStep => s.type === 'ui');

    // Calculate totals
    const totalSteps = steps.length;
    const totalDataSets = runData.dataSets.length;
    const totalExecutions = totalSteps * totalDataSets;
    const passedSteps = runData.results.filter((r) => r.status === 'passed').length;
    const failedSteps = runData.results.filter((r) => r.status === 'failed').length;
    const duration = runData.completedAt - runData.startedAt;
    const overallStatus = failedSteps === 0 ? 'PASSED' : 'FAILED';
    const successRate = totalExecutions > 0 ? ((passedSteps / totalExecutions) * 100).toFixed(1) : '0';

    // ==================== PAGE 1: HEADER & SUMMARY ====================

    // Header with gradient effect
    doc.setFillColor(16, 185, 129); // Green accent
    doc.rect(0, 0, pageWidth, 45, 'F');

    // Title
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(28);
    doc.setFont('helvetica', 'bold');
    doc.text('QAerx', 20, 22);

    doc.setFontSize(14);
    doc.setFont('helvetica', 'normal');
    doc.text('Test Execution Report', 20, 35);

    // Status badge
    const statusColor = overallStatus === 'PASSED' ? [34, 197, 94] : [239, 68, 68];
    doc.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
    doc.roundedRect(pageWidth - 50, 15, 35, 15, 3, 3, 'F');
    doc.setFontSize(10);
    doc.setTextColor(255, 255, 255);
    doc.text(overallStatus, pageWidth - 33, 25, { align: 'center' });

    // Test Information Section
    let yPosition = 60;
    doc.setTextColor(17, 24, 39);
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.text('Test Information', 20, yPosition);

    yPosition += 5;
    doc.setDrawColor(16, 185, 129);
    doc.setLineWidth(2);
    doc.line(20, yPosition, 60, yPosition);

    yPosition += 12;
    doc.setFontSize(10);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(75, 85, 99);

    const testInfo = [
      { label: 'Test Name', value: runData.test.name },
      { label: 'Target URL', value: runData.test.url || 'N/A' },
      { label: 'Executed At', value: new Date(runData.startedAt).toLocaleString() },
      { label: 'Duration', value: this.formatDuration(duration) },
      { label: 'Data Sets', value: totalDataSets.toString() },
      { label: 'Total Steps', value: totalSteps.toString() },
    ];

    testInfo.forEach(({ label, value }) => {
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(75, 85, 99);
      doc.text(label + ':', 20, yPosition);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(17, 24, 39);
      doc.text(value, 60, yPosition);
      yPosition += 7;
    });

    // Summary Cards Section
    yPosition += 10;
    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Execution Summary', 20, yPosition);

    yPosition += 5;
    doc.setDrawColor(16, 185, 129);
    doc.line(20, yPosition, 75, yPosition);

    yPosition += 15;

    // Summary cards
    const cardWidth = 42;
    const cardHeight = 35;
    const cardGap = 5;
    const startX = 20;

    const cards = [
      { label: 'Total', value: totalExecutions.toString(), color: [59, 130, 246] },
      { label: 'Passed', value: passedSteps.toString(), color: [34, 197, 94] },
      { label: 'Failed', value: failedSteps.toString(), color: [239, 68, 68] },
      { label: 'Success', value: `${successRate}%`, color: [168, 85, 247] },
    ];

    cards.forEach((card, index) => {
      const x = startX + (cardWidth + cardGap) * index;

      // Card background
      doc.setFillColor(249, 250, 251);
      doc.roundedRect(x, yPosition, cardWidth, cardHeight, 3, 3, 'F');

      // Card border accent
      doc.setFillColor(card.color[0], card.color[1], card.color[2]);
      doc.rect(x, yPosition, cardWidth, 3, 'F');

      // Card content
      doc.setFontSize(20);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(card.color[0], card.color[1], card.color[2]);
      doc.text(card.value, x + cardWidth / 2, yPosition + 18, { align: 'center' });

      doc.setFontSize(9);
      doc.setFont('helvetica', 'normal');
      doc.setTextColor(107, 114, 128);
      doc.text(card.label, x + cardWidth / 2, yPosition + 28, { align: 'center' });
    });

    // ==================== TEST STEPS SECTION ====================

    yPosition += cardHeight + 20;

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Test Steps Details', 20, yPosition);

    yPosition += 5;
    doc.setDrawColor(16, 185, 129);
    doc.line(20, yPosition, 75, yPosition);

    yPosition += 10;

    // Steps table with detailed information
    const stepsData = steps.map((step, index) => {
      const stepResults = runData.results.filter((r) => r.stepId === step.id);
      const passCount = stepResults.filter((r) => r.status === 'passed').length;
      const avgDuration = stepResults.length > 0
        ? stepResults.reduce((sum, r) => sum + (r.duration || 0), 0) / stepResults.length
        : 0;
      const action = step.action as any;
      const selector = step.selectors[0]?.value || '-';

      // Sanitize step name for PDF display
      const displayName = this.sanitizeForPDF(step.name);

      return [
        (index + 1).toString(),
        this.truncateString(displayName, 30),
        this.getActionType(action.type),
        this.truncateString(selector, 35),
        this.getActionValue(step),
        `${passCount}/${stepResults.length}`,
        this.formatDuration(avgDuration),
        passCount === stepResults.length ? 'PASS' : 'FAIL',
      ];
    });

    autoTable(doc, {
      startY: yPosition,
      head: [['#', 'Step Name', 'Action', 'Selector', 'Value', 'Pass', 'Time', 'Status']],
      body: stepsData,
      theme: 'grid',
      styles: {
        fontSize: 8,
        cellPadding: 3,
      },
      headStyles: {
        fillColor: [16, 185, 129],
        textColor: [255, 255, 255],
        fontStyle: 'bold',
        fontSize: 8,
      },
      alternateRowStyles: {
        fillColor: [249, 250, 251],
      },
      columnStyles: {
        0: { cellWidth: 8, halign: 'center' },
        1: { cellWidth: 35 },
        2: { cellWidth: 18 },
        3: { cellWidth: 40, fontSize: 7 },
        4: { cellWidth: 30, fontSize: 7 },
        5: { cellWidth: 15, halign: 'center' },
        6: { cellWidth: 18, halign: 'center' },
        7: { cellWidth: 15, halign: 'center' },
      },
      didParseCell: (data) => {
        // Color status column
        if (data.column.index === 7 && data.section === 'body') {
          if (data.cell.text[0] === 'PASS') {
            data.cell.styles.textColor = [34, 197, 94];
            data.cell.styles.fontStyle = 'bold';
          } else if (data.cell.text[0] === 'FAIL') {
            data.cell.styles.textColor = [239, 68, 68];
            data.cell.styles.fontStyle = 'bold';
          }
        }
      },
    });

    // ==================== STEP-BY-STEP EXECUTION LOG ====================

    yPosition = (doc as any).lastAutoTable.finalY + 20;

    if (yPosition > pageHeight - 80) {
      doc.addPage();
      yPosition = 20;
    }

    doc.setFontSize(16);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(17, 24, 39);
    doc.text('Step-by-Step Execution Log', 20, yPosition);

    yPosition += 5;
    doc.setDrawColor(16, 185, 129);
    doc.line(20, yPosition, 95, yPosition);

    yPosition += 10;

    // Build detailed execution log for each data set
    for (let dataSetIdx = 0; dataSetIdx < Math.max(1, totalDataSets); dataSetIdx++) {
      const dataSetResults = runData.results.filter((r) => r.dataSetIndex === dataSetIdx);
      const dataSetPassed = dataSetResults.every((r) => r.status === 'passed');

      // Check if we need a new page
      if (yPosition > pageHeight - 60) {
        doc.addPage();
        yPosition = 20;
      }

      // Data set header
      if (totalDataSets > 1) {
        const dataSetLabel = `Data Set ${dataSetIdx + 1}`;
        const dataSetStatus = dataSetPassed ? 'PASSED' : 'FAILED';
        const statusColor = dataSetPassed ? [34, 197, 94] : [239, 68, 68];

        doc.setFillColor(249, 250, 251);
        doc.roundedRect(20, yPosition - 3, pageWidth - 40, 12, 2, 2, 'F');

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(59, 130, 246);
        doc.text(dataSetLabel, 25, yPosition + 5);

        doc.setTextColor(statusColor[0], statusColor[1], statusColor[2]);
        doc.text(dataSetStatus, pageWidth - 45, yPosition + 5);

        yPosition += 15;
      }

      // Create execution log entries
      const currentDataSet = runData.dataSets[dataSetIdx] || {};
      const executionLog = steps.map((step, index) => {
        const result = dataSetResults.find((r) => r.stepId === step.id);
        const action = step.action as any;
        const status = result?.status || 'pending';
        const duration = result?.duration ? this.formatDuration(result.duration) : '-';

        // Generate result description - prefer pageResponse if available
        let resultDescription = '';
        if (result?.pageResponse) {
          // Use actual page response (e.g., "Error: Invalid credentials", "Success: Logged in")
          resultDescription = result.pageResponse;
        } else if (status === 'passed') {
          resultDescription = this.getSuccessDescription(step, action, currentDataSet);
        } else if (status === 'failed') {
          resultDescription = result?.error || 'Step failed';
        } else {
          resultDescription = 'Not executed';
        }

        // Use sanitized step name for display
        const displayName = this.sanitizeForPDF(step.name);

        return [
          `${index + 1}`,
          this.truncateString(displayName, 30),
          this.getActionDescription(step, action, currentDataSet),
          duration,
          status === 'passed' ? 'PASS' : status === 'failed' ? 'FAIL' : '-',
          this.truncateString(resultDescription, 45),
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['#', 'Step', 'Action Performed', 'Time', 'Status', 'Result']],
        body: executionLog,
        theme: 'plain',
        styles: {
          fontSize: 8,
          cellPadding: 2,
        },
        headStyles: {
          fillColor: [243, 244, 246],
          textColor: [75, 85, 99],
          fontStyle: 'bold',
          fontSize: 8,
        },
        columnStyles: {
          0: { cellWidth: 8, halign: 'center' },
          1: { cellWidth: 32 },
          2: { cellWidth: 48 },
          3: { cellWidth: 15, halign: 'center' },
          4: { cellWidth: 15, halign: 'center' },
          5: { cellWidth: 58 },
        },
        didParseCell: (data) => {
          // Color the status column
          if (data.column.index === 4 && data.section === 'body') {
            if (data.cell.text[0] === 'PASS') {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.text[0] === 'FAIL') {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = 'bold';
            }
          }
          // Color result descriptions
          if (data.column.index === 5 && data.section === 'body') {
            const rowIndex = data.row.index;
            const stepResult = dataSetResults.find((r) => r.stepId === steps[rowIndex]?.id);
            if (stepResult?.status === 'passed') {
              data.cell.styles.textColor = [34, 197, 94];
            } else if (stepResult?.status === 'failed') {
              data.cell.styles.textColor = [185, 28, 28];
            }
          }
        },
      });

      yPosition = (doc as any).lastAutoTable.finalY + 10;
    }

    // ==================== DATA SETS SECTION ====================

    if (totalDataSets > 0 && Object.keys(runData.dataSets[0] || {}).length > 0) {
      yPosition = (doc as any).lastAutoTable.finalY + 20;

      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      doc.setFontSize(16);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(17, 24, 39);
      doc.text('Test Data Sets', 20, yPosition);

      yPosition += 5;
      doc.setDrawColor(16, 185, 129);
      doc.line(20, yPosition, 65, yPosition);

      yPosition += 10;

      const variables = Object.keys(runData.dataSets[0]).filter(v => v !== 'scenario');
      const hasScenarios = runData.dataSetScenarios && runData.dataSetScenarios.length > 0;
      const dataSetHeaders = hasScenarios
        ? ['Set #', 'Scenario', ...variables, 'Result']
        : ['Set #', ...variables, 'Result'];

      const dataSetData = runData.dataSets.map((dataSet, index) => {
        const setResults = runData.results.filter((r) => r.dataSetIndex === index);
        const setStatus = setResults.every((r) => r.status === 'passed') ? 'PASS' : 'FAIL';
        const scenario = runData.dataSetScenarios?.[index];
        const scenarioLabel = scenario ? this.getScenarioLabel(scenario) : '';

        if (hasScenarios) {
          return [(index + 1).toString(), scenarioLabel, ...variables.map(v => this.truncateString(dataSet[v] || '', 20)), setStatus];
        }
        return [(index + 1).toString(), ...variables.map(v => this.truncateString(dataSet[v] || '', 25)), setStatus];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [dataSetHeaders],
        body: dataSetData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [59, 130, 246],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [249, 250, 251],
        },
        didParseCell: (data) => {
          // Color result column
          const lastColIndex = dataSetHeaders.length - 1;
          if (data.column.index === lastColIndex && data.section === 'body') {
            if (data.cell.text[0] === 'PASS') {
              data.cell.styles.textColor = [34, 197, 94];
              data.cell.styles.fontStyle = 'bold';
            } else if (data.cell.text[0] === 'FAIL') {
              data.cell.styles.textColor = [239, 68, 68];
              data.cell.styles.fontStyle = 'bold';
            }
          }
        },
      });
    }

    // ==================== FAILURES SECTION ====================

    const failures = runData.results.filter((r) => r.status === 'failed');
    if (failures.length > 0) {
      yPosition = (doc as any).lastAutoTable.finalY + 20;

      if (yPosition > pageHeight - 80) {
        doc.addPage();
        yPosition = 20;
      }

      // Red section header
      doc.setFillColor(254, 242, 242);
      doc.roundedRect(15, yPosition - 5, pageWidth - 30, 25, 3, 3, 'F');

      doc.setFontSize(14);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(185, 28, 28);
      doc.text('Failed Steps Analysis', 20, yPosition + 8);

      yPosition += 25;

      const failureData = failures.map((failure) => {
        const step = steps.find((s) => s.id === failure.stepId);
        const dataSetNum = failure.dataSetIndex + 1;
        const selector = step?.selectors[0]?.value || '-';
        return [
          step?.name || 'Unknown',
          `Data Set ${dataSetNum}`,
          this.truncateString(selector, 30),
          this.truncateString(failure.error || 'Unknown error', 50),
        ];
      });

      autoTable(doc, {
        startY: yPosition,
        head: [['Step Name', 'Data Set', 'Selector', 'Error Message']],
        body: failureData,
        theme: 'grid',
        styles: {
          fontSize: 8,
          cellPadding: 3,
        },
        headStyles: {
          fillColor: [185, 28, 28],
          textColor: [255, 255, 255],
          fontStyle: 'bold',
        },
        alternateRowStyles: {
          fillColor: [254, 242, 242],
        },
        columnStyles: {
          0: { cellWidth: 45 },
          1: { cellWidth: 25 },
          2: { cellWidth: 40, fontSize: 7 },
          3: { cellWidth: 65, fontSize: 7 },
        },
      });
    }

    // ==================== FOOTER ON ALL PAGES ====================

    const totalPages = doc.internal.pages.length - 1;
    for (let i = 1; i <= totalPages; i++) {
      doc.setPage(i);

      // Footer line
      doc.setDrawColor(229, 231, 235);
      doc.setLineWidth(0.5);
      doc.line(20, pageHeight - 15, pageWidth - 20, pageHeight - 15);

      // Footer text
      doc.setFontSize(8);
      doc.setTextColor(156, 163, 175);
      doc.text(
        `Generated by QAerx - AI-Powered Test Automation`,
        20,
        pageHeight - 8
      );
      doc.text(
        `Page ${i} of ${totalPages}`,
        pageWidth - 20,
        pageHeight - 8,
        { align: 'right' }
      );
    }

    // Save the PDF
    const fileName = `QAerx_${runData.test.name.replace(/[^a-z0-9]/gi, '_')}_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(fileName);
  }

  /**
   * Get human-readable scenario label
   */
  private static getScenarioLabel(scenario: ScenarioType): string {
    const labels: Record<ScenarioType, string> = {
      'best-case': 'Best Case',
      'worst-case': 'Worst Case',
      'edge-case': 'Edge Case',
      'boundary': 'Boundary',
      'normal': 'Normal',
    };
    return labels[scenario] || scenario;
  }

  /**
   * Get human-readable action type
   */
  private static getActionType(type: string): string {
    const types: Record<string, string> = {
      click: 'Click',
      dblclick: 'Double Click',
      type: 'Type',
      navigate: 'Navigate',
      select: 'Select',
      check: 'Check',
      uncheck: 'Uncheck',
      waitTime: 'Wait',
      waitForElement: 'Wait Element',
      scroll: 'Scroll',
    };
    return types[type] || type;
  }

  /**
   * Get action value/parameter (shows template variables like {{email}})
   */
  private static getActionValue(step: UIStep): string {
    const action = step.action as any;

    switch (action.type) {
      case 'type':
        // Show the variable name or value
        return this.truncateString(action.text || '', 25);
      case 'navigate':
        return this.truncateString(action.url || '', 25);
      case 'select':
        return this.truncateString(action.value || '', 25);
      case 'waitTime':
        return `${action.duration || 2000}ms`;
      default:
        return '-';
    }
  }


  /**
   * Truncate string with ellipsis
   */
  private static truncateString(str: string, maxLength: number): string {
    if (!str) return '-';
    // Sanitize for PDF (replace non-ASCII characters)
    const sanitized = this.sanitizeForPDF(str);
    if (sanitized.length <= maxLength) return sanitized;
    return sanitized.substring(0, maxLength - 3) + '...';
  }

  /**
   * Sanitize text for PDF - handle non-Latin characters
   * jsPDF default fonts don't support Arabic/Unicode, so we transliterate or show placeholder
   */
  private static sanitizeForPDF(text: string): string {
    if (!text) return '';

    // Check if text contains non-ASCII characters
    const hasNonAscii = /[^\x00-\x7F]/.test(text);

    if (hasNonAscii) {
      // Try to extract meaningful parts or use a placeholder
      // Keep ASCII parts and replace non-ASCII with readable alternatives
      return text
        .replace(/[\u0600-\u06FF]+/g, '[Arabic]')  // Arabic
        .replace(/[\u4E00-\u9FFF]+/g, '[Chinese]') // Chinese
        .replace(/[\u3040-\u309F\u30A0-\u30FF]+/g, '[Japanese]') // Japanese
        .replace(/[\uAC00-\uD7AF]+/g, '[Korean]') // Korean
        .replace(/[^\x00-\x7F]+/g, '[...]');      // Other non-ASCII
    }

    return text;
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

  /**
   * Get description of what action was performed
   */
  private static getActionDescription(step: UIStep, action: any, dataSet?: Record<string, string>): string {
    const selector = step.selectors[0]?.value || '';
    const shortSelector = this.truncateString(selector, 20);

    // Substitute variables with actual values
    const substituteVars = (text: string): string => {
      if (!dataSet) return text;
      return text.replace(/\{\{(\w+)\}\}/g, (_, varName) => dataSet[varName] || varName);
    };

    switch (action.type) {
      case 'click':
        return `Clicked on "${shortSelector}"`;
      case 'dblclick':
        return `Double-clicked "${shortSelector}"`;
      case 'type':
        const text = substituteVars(action.text || '');
        return `Typed "${this.truncateString(text, 20)}" into field`;
      case 'navigate':
        return `Navigated to ${this.truncateString(action.url || '', 25)}`;
      case 'select':
        const selectValue = substituteVars(action.value || '');
        return `Selected "${this.truncateString(selectValue, 15)}"`;
      case 'check':
        return `Checked checkbox`;
      case 'uncheck':
        return `Unchecked checkbox`;
      case 'waitTime':
        return `Waited ${action.duration || 2000}ms`;
      case 'waitForElement':
        return `Waited for element`;
      case 'scroll':
        return `Scrolled to (${action.x || 0}, ${action.y || 0})`;
      default:
        return `Performed ${action.type}`;
    }
  }

  /**
   * Get success description based on action type
   */
  private static getSuccessDescription(step: UIStep, action: any, dataSet?: Record<string, string>): string {
    const stepName = step.name.toLowerCase();

    // Substitute variables if present
    const substituteVars = (text: string): string => {
      if (!dataSet) return text;
      return text.replace(/\{\{(\w+)\}\}/g, (_, varName) => dataSet[varName] || varName);
    };

    switch (action.type) {
      case 'click':
        if (stepName.includes('login') || stepName.includes('sign in')) {
          return 'Login button clicked successfully';
        } else if (stepName.includes('submit')) {
          return 'Form submitted successfully';
        } else if (stepName.includes('save')) {
          return 'Save action completed';
        } else if (stepName.includes('delete') || stepName.includes('remove')) {
          return 'Delete action completed';
        } else if (stepName.includes('create') || stepName.includes('add')) {
          return 'Create action completed';
        } else if (stepName.includes('next') || stepName.includes('continue')) {
          return 'Navigation to next step completed';
        }
        return 'Element clicked successfully';

      case 'type':
        const text = substituteVars(action.text || '');
        if (stepName.includes('username') || stepName.includes('email')) {
          return `Username/email entered: ${this.truncateString(text, 20)}`;
        } else if (stepName.includes('password')) {
          return 'Password entered securely';
        } else if (stepName.includes('search')) {
          return `Search query entered: "${this.truncateString(text, 20)}"`;
        }
        return `Text entered: "${this.truncateString(text, 25)}"`;

      case 'navigate':
        return 'Page loaded successfully';

      case 'select':
        const value = substituteVars(action.value || '');
        return `Option selected: "${this.truncateString(value, 25)}"`;

      case 'check':
        return 'Checkbox checked';

      case 'uncheck':
        return 'Checkbox unchecked';

      case 'waitTime':
        return `Wait completed (${action.duration || 2000}ms)`;

      case 'waitForElement':
        return 'Element appeared on page';

      case 'scroll':
        return 'Page scrolled to position';

      default:
        return 'Step completed successfully';
    }
  }
}
