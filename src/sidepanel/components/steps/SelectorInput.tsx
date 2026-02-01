import { useState, useMemo } from 'react';
import { Target, CheckCircle, AlertCircle, Loader2, ChevronDown, ChevronUp, Eye, AlertTriangle } from 'lucide-react';
import { useSelectorValidation } from '../../hooks/useSelectorValidation';
import type { SelectorStrategy } from '@/types/test';
import { clsx } from 'clsx';

interface SelectorInputProps {
  value: string;
  onChange: (value: string, allSelectors?: SelectorStrategy[]) => void;
  suggestions?: SelectorStrategy[];
  onSuggestionsRequest?: () => void;
}

/**
 * Check if a selector contains dynamic/unstable IDs that may change on page refresh
 * Returns warning message if dynamic, null if stable
 */
function checkDynamicSelector(selector: string): string | null {
  if (!selector) return null;

  // Extract ID from selector
  const idMatch = selector.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    const id = idMatch[1];

    // Dynamic ID patterns
    const dynamicPatterns = [
      // Frappe framework patterns (most common issue)
      { pattern: /^frappe[-_]ui[-_]\d+$/i, name: 'Frappe UI' },
      { pattern: /^frappe[-_]\d+$/i, name: 'Frappe' },
      { pattern: /^control-\d+-\d+$/i, name: 'Frappe control' },
      { pattern: /^awesomplete[-_]\d+$/i, name: 'Awesomplete' },

      // React patterns
      { pattern: /^:r[0-9]+:?$/, name: 'React useId' },
      { pattern: /^react-[a-z]+-\d+$/i, name: 'React' },

      // Other frameworks
      { pattern: /^ember\d+$/, name: 'Ember' },
      { pattern: /^ng-\d+$/, name: 'Angular' },
      { pattern: /^ng_\d+$/, name: 'Angular' },
      { pattern: /^mui-\d+$/, name: 'MUI' },
      { pattern: /^headlessui-[a-z]+-\d+$/i, name: 'Headless UI' },
      { pattern: /^radix-[a-z]+-\d+$/i, name: 'Radix UI' },
      { pattern: /^select2-[a-z]+-[a-z0-9]+$/i, name: 'Select2' },
      { pattern: /^react-select-\d+/i, name: 'React Select' },

      // Generic patterns
      { pattern: /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/i, name: 'UUID' },
      { pattern: /^[a-f0-9]{32}$/i, name: 'hash' },
      { pattern: /^\d+$/, name: 'numeric' },
      { pattern: /^uid[-_]\d+$/i, name: 'UID' },
      { pattern: /^id[-_]\d+$/i, name: 'ID' },
    ];

    for (const { pattern, name } of dynamicPatterns) {
      if (pattern.test(id)) {
        return `⚠️ Dynamic ${name} ID detected. This selector may break on page refresh. Consider using [name], [data-testid], or [aria-label] instead.`;
      }
    }
  }

  // Check for nth-child/nth-of-type which are position-dependent
  if (/nth-(child|of-type)\(\d+\)/.test(selector)) {
    return '⚠️ Position-based selector detected. This may break if page structure changes.';
  }

  // Check for very long/deep selectors
  if ((selector.match(/ > /g) || []).length > 4) {
    return '⚠️ Deep selector path detected. This may break if page structure changes.';
  }

  return null;
}

export function SelectorInput({ value, onChange, suggestions = [], onSuggestionsRequest }: SelectorInputProps) {
  const validation = useSelectorValidation(value);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isPicking, setIsPicking] = useState(false);

  // Check for dynamic selectors that may break on page refresh
  const dynamicWarning = useMemo(() => checkDynamicSelector(value), [value]);

  const handleHighlightElement = async () => {
    if (!value) return;

    try {
      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) return;

      await chrome.tabs.sendMessage(tab.id, { type: 'ping' }).catch(async () => {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content.js'],
        });
        await new Promise((r) => setTimeout(r, 200));
      });

      await chrome.tabs.sendMessage(tab.id, {
        type: 'element:highlight',
        selector: value,
      });
    } catch (error) {
      console.error('Failed to highlight element:', error);
    }
  };

  const handlePickElement = async () => {
    try {
      setIsPicking(true);

      const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tab?.id) {
        throw new Error('No active tab');
      }

      // Ensure content script is loaded
      await chrome.tabs.sendMessage(tab.id, { type: 'ping' }).catch(async () => {
        await chrome.scripting.executeScript({
          target: { tabId: tab.id! },
          files: ['content.js'],
        });
        await new Promise((r) => setTimeout(r, 200));
      });

      // Start element picker
      await chrome.tabs.sendMessage(tab.id, { type: 'picker:start' });

      // Listen for selected element
      const listener = (message: { type: string; selectors: SelectorStrategy[] }) => {
        if (message.type === 'picker:element-selected') {
          if (message.selectors && message.selectors.length > 0) {
            onChange(message.selectors[0].value, message.selectors);
            if (onSuggestionsRequest) {
              onSuggestionsRequest();
            }
          }
          chrome.runtime.onMessage.removeListener(listener);
          setIsPicking(false);
        }
      };

      chrome.runtime.onMessage.addListener(listener);

      // Timeout after 60 seconds
      setTimeout(() => {
        chrome.runtime.onMessage.removeListener(listener);
        setIsPicking(false);
      }, 60000);
    } catch (error) {
      console.error('Failed to pick element:', error);
      setIsPicking(false);
    }
  };

  const getStatusIcon = () => {
    switch (validation.status) {
      case 'validating':
        return <Loader2 className="w-4 h-4 animate-spin text-dark-500" />;
      case 'valid':
        return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'multiple':
        return <AlertCircle className="w-4 h-4 text-yellow-400" />;
      case 'invalid':
      case 'error':
        return <AlertCircle className="w-4 h-4 text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (validation.status) {
      case 'valid':
        return 'border-green-400 focus:ring-green-400';
      case 'multiple':
        return 'border-yellow-400 focus:ring-yellow-400';
      case 'invalid':
      case 'error':
        return 'border-red-400 focus:ring-red-400';
      default:
        return 'border-dark-700';
    }
  };

  return (
    <div className="space-y-2">
      <div className="relative">
        <div className="flex items-center gap-2">
          <div className="flex-1 relative">
            <input
              type="text"
              value={value}
              onChange={(e) => onChange(e.target.value)}
              placeholder="#id, .class, [attr], button[type='submit']"
              className={clsx(
                'input pr-10 font-mono text-sm transition-all',
                getStatusColor()
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1">
              {getStatusIcon()}
            </div>
          </div>

          {validation.isValid && (
            <button
              onClick={handleHighlightElement}
              className="btn btn-sm btn-ghost"
              title="Preview element on page"
            >
              <Eye className="w-4 h-4" />
            </button>
          )}

          <button
            onClick={handlePickElement}
            disabled={isPicking}
            className={clsx(
              'btn btn-sm',
              isPicking ? 'btn-ghost animate-pulse' : 'btn-primary'
            )}
            title="Pick element from page"
          >
            <Target className="w-4 h-4" />
            {isPicking ? 'Picking...' : 'Pick'}
          </button>

          {suggestions.length > 0 && (
            <button
              onClick={() => setShowSuggestions(!showSuggestions)}
              className="btn btn-sm btn-ghost"
              title="Show selector suggestions"
            >
              {showSuggestions ? (
                <ChevronUp className="w-4 h-4" />
              ) : (
                <ChevronDown className="w-4 h-4" />
              )}
            </button>
          )}
        </div>

        {/* Validation message */}
        {validation.message && (
          <p
            className={clsx(
              'text-xs mt-1',
              validation.status === 'valid'
                ? 'text-green-400'
                : validation.status === 'multiple'
                  ? 'text-yellow-400'
                  : 'text-red-400'
            )}
          >
            {validation.message}
          </p>
        )}

        {/* Dynamic selector warning */}
        {dynamicWarning && (
          <div className="flex items-start gap-2 mt-2 p-2 bg-amber-500/10 border border-amber-500/30 rounded-lg">
            <AlertTriangle className="w-4 h-4 text-amber-400 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-amber-300">{dynamicWarning}</p>
          </div>
        )}
      </div>

      {/* Suggestions dropdown */}
      {showSuggestions && suggestions.length > 0 && (
        <div className="bg-dark-850 border border-dark-700 rounded-lg p-2 space-y-1">
          <div className="text-xs text-dark-400 px-2 py-1">
            Suggestions (click to use):
          </div>
          {suggestions.slice(0, 5).map((suggestion, index) => {
            const isDynamic = checkDynamicSelector(suggestion.value);
            const stabilityLabel = suggestion.type === 'data-testid' || suggestion.type === 'data-cy'
              ? '✓ Stable'
              : suggestion.type === 'aria'
                ? '✓ Good'
                : suggestion.value.includes('[name=')
                  ? '~ OK'
                  : isDynamic
                    ? '⚠️ Unstable'
                    : '';

            return (
              <button
                key={index}
                onClick={() => {
                  onChange(suggestion.value);
                  setShowSuggestions(false);
                }}
                className={clsx(
                  "w-full text-left px-3 py-2 rounded hover:bg-dark-700 transition-colors",
                  isDynamic && "border border-amber-500/30 bg-amber-500/5"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <code className="text-xs text-dark-200 font-mono truncate flex-1">
                    {suggestion.value}
                  </code>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {stabilityLabel && (
                      <span
                        className={clsx(
                          'text-xs px-1.5 py-0.5 rounded whitespace-nowrap',
                          stabilityLabel.includes('Stable') || stabilityLabel.includes('Good')
                            ? 'bg-green-400/20 text-green-400'
                            : stabilityLabel.includes('OK')
                              ? 'bg-blue-400/20 text-blue-400'
                              : 'bg-amber-400/20 text-amber-400'
                        )}
                      >
                        {stabilityLabel}
                      </span>
                    )}
                    <span className="text-xs text-dark-500">
                      {suggestion.type}
                    </span>
                    <span
                      className={clsx(
                        'text-xs px-1.5 py-0.5 rounded',
                        suggestion.confidence > 0.8
                          ? 'bg-green-400/20 text-green-400'
                          : suggestion.confidence > 0.6
                            ? 'bg-yellow-400/20 text-yellow-400'
                            : 'bg-dark-700 text-dark-400'
                      )}
                    >
                      {Math.round(suggestion.confidence * 100)}%
                    </span>
                  </div>
                </div>
                {isDynamic && (
                  <p className="text-xs text-amber-400/80 mt-1">May change on refresh</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
