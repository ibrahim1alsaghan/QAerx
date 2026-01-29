import { useState } from 'react';
import { X, Copy, Download, Check, Code } from 'lucide-react';
import { CodeExportService } from '@/core/services/CodeExportService';
import type { Test } from '@/types/test';
import toast from 'react-hot-toast';
import { clsx } from 'clsx';

interface ExportModalProps {
  isOpen: boolean;
  onClose: () => void;
  test: Test;
  dataSets: Record<string, string>[];
}

type ExportFormat = 'playwright' | 'cypress' | 'selenium';

const formatInfo: Record<ExportFormat, { name: string; description: string; ext: string; icon: string }> = {
  playwright: {
    name: 'Playwright',
    description: 'Modern end-to-end testing framework by Microsoft',
    ext: '.spec.ts',
    icon: '🎭',
  },
  cypress: {
    name: 'Cypress',
    description: 'JavaScript-based testing framework',
    ext: '.cy.js',
    icon: '🌲',
  },
  selenium: {
    name: 'Selenium (Python)',
    description: 'Cross-browser automation with Python',
    ext: '.py',
    icon: '🐍',
  },
};

export function ExportModal({ isOpen, onClose, test, dataSets }: ExportModalProps) {
  const [selectedFormat, setSelectedFormat] = useState<ExportFormat>('playwright');
  const [includeComments, setIncludeComments] = useState(true);
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  const generateCode = () => {
    switch (selectedFormat) {
      case 'playwright':
        return CodeExportService.generatePlaywright(test, dataSets, { includeComments });
      case 'cypress':
        return CodeExportService.generateCypress(test, dataSets, { includeComments });
      case 'selenium':
        return CodeExportService.generateSelenium(test, dataSets, { includeComments });
      default:
        return '';
    }
  };

  const code = generateCode();

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      toast.success('Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleDownload = () => {
    const blob = new Blob([code], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${test.name.replace(/[^a-z0-9]/gi, '_')}${formatInfo[selectedFormat].ext}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success('File downloaded');
  };

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-dark-800 rounded-xl shadow-2xl w-full max-w-3xl mx-4 border border-dark-700 max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-dark-700">
          <div className="flex items-center gap-2">
            <Code className="w-5 h-5 text-accent" />
            <h3 className="text-lg font-semibold text-dark-100">Export Test Code</h3>
          </div>
          <button onClick={onClose} className="p-1 hover:bg-dark-700 rounded">
            <X className="w-5 h-5 text-dark-400" />
          </button>
        </div>

        {/* Format Selection */}
        <div className="px-4 py-3 border-b border-dark-700">
          <div className="flex gap-2">
            {(Object.keys(formatInfo) as ExportFormat[]).map((format) => (
              <button
                key={format}
                onClick={() => setSelectedFormat(format)}
                className={clsx(
                  'flex-1 px-4 py-3 rounded-lg border-2 transition-all',
                  selectedFormat === format
                    ? 'border-accent bg-accent/10 text-dark-100'
                    : 'border-dark-700 bg-dark-850 text-dark-400 hover:border-dark-600'
                )}
              >
                <div className="text-2xl mb-1">{formatInfo[format].icon}</div>
                <div className="font-medium text-sm">{formatInfo[format].name}</div>
                <div className="text-xs text-dark-500 mt-0.5">
                  {formatInfo[format].description}
                </div>
              </button>
            ))}
          </div>

          <div className="mt-3">
            <label className="flex items-center gap-2 text-sm text-dark-300 cursor-pointer">
              <input
                type="checkbox"
                checked={includeComments}
                onChange={(e) => setIncludeComments(e.target.checked)}
                className="w-4 h-4 rounded border-dark-600 bg-dark-800 text-accent focus:ring-accent/50"
              />
              Include comments and documentation
            </label>
          </div>
        </div>

        {/* Code Preview */}
        <div className="flex-1 overflow-hidden p-4">
          <div className="relative h-full">
            <div className="absolute top-2 right-2 flex gap-2 z-10">
              <button
                onClick={handleCopy}
                className="btn btn-sm btn-ghost text-dark-400 hover:text-dark-100"
              >
                {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4" />}
                {copied ? 'Copied!' : 'Copy'}
              </button>
              <button
                onClick={handleDownload}
                className="btn btn-sm btn-ghost text-dark-400 hover:text-dark-100"
              >
                <Download className="w-4 h-4" />
                Download
              </button>
            </div>
            <pre className="h-full overflow-auto bg-dark-900 rounded-lg p-4 pt-12 text-sm text-dark-200 font-mono">
              <code>{code}</code>
            </pre>
          </div>
        </div>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-dark-700 flex items-center justify-between">
          <div className="text-xs text-dark-500">
            {test.steps.length} steps • {dataSets.length} data sets
          </div>
          <div className="flex gap-2">
            <button onClick={onClose} className="btn btn-ghost">
              Cancel
            </button>
            <button onClick={handleDownload} className="btn btn-primary">
              <Download className="w-4 h-4" />
              Download {formatInfo[selectedFormat].name}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
