import { useState, useEffect } from 'react';
import { Sparkles, AlertCircle, Settings as SettingsIcon } from 'lucide-react';
import { clsx } from 'clsx';
import { SettingsRepository } from '@/core/storage/repositories';

type AIStatus = 'ready' | 'limited' | 'offline';

interface AIStatusIndicatorProps {
  onConfigureClick?: () => void;
  showLabel?: boolean;
}

export function AIStatusIndicator({ onConfigureClick, showLabel = true }: AIStatusIndicatorProps) {
  const [status, setStatus] = useState<AIStatus>('offline');
  const [showTooltip, setShowTooltip] = useState(false);

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const settings = await SettingsRepository.get();
        if (settings?.openaiApiKey && settings.openaiApiKey.trim().length > 0) {
          // API key is configured
          setStatus('ready');
        } else {
          // No API key
          setStatus('limited');
        }
      } catch (error) {
        console.error('[AIStatusIndicator] Error checking AI status:', error);
        setStatus('offline');
      }
    };

    checkStatus();

    // Check periodically
    const interval = setInterval(checkStatus, 30000);
    return () => clearInterval(interval);
  }, []);

  const getStatusConfig = () => {
    switch (status) {
      case 'ready':
        return {
          icon: <Sparkles className="w-3.5 h-3.5" />,
          color: 'text-green-400',
          bgColor: 'bg-green-500/20',
          borderColor: 'border-green-500/30',
          label: 'AI Ready',
          tooltip: 'AI validation is active. Test results will be analyzed by AI.',
        };
      case 'limited':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          color: 'text-yellow-400',
          bgColor: 'bg-yellow-500/20',
          borderColor: 'border-yellow-500/30',
          label: 'AI Limited',
          tooltip: 'OpenAI API key not configured. Using basic pattern matching for validation.',
        };
      case 'offline':
        return {
          icon: <AlertCircle className="w-3.5 h-3.5" />,
          color: 'text-red-400',
          bgColor: 'bg-red-500/20',
          borderColor: 'border-red-500/30',
          label: 'AI Offline',
          tooltip: 'AI service unavailable. Check your settings.',
        };
    }
  };

  const config = getStatusConfig();

  return (
    <div className="relative">
      <button
        onClick={onConfigureClick}
        onMouseEnter={() => setShowTooltip(true)}
        onMouseLeave={() => setShowTooltip(false)}
        className={clsx(
          'flex items-center gap-1.5 px-2 py-1 rounded-lg border transition-all',
          config.bgColor,
          config.borderColor,
          config.color,
          'hover:opacity-80 cursor-pointer'
        )}
      >
        {config.icon}
        {showLabel && (
          <span className="text-xs font-medium">{config.label}</span>
        )}
      </button>

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute top-full left-0 mt-2 z-50 w-64">
          <div className="bg-dark-800 border border-dark-600 rounded-lg shadow-xl p-3">
            <div className="flex items-start gap-2">
              <div className={clsx('mt-0.5', config.color)}>
                {config.icon}
              </div>
              <div className="flex-1">
                <p className="text-sm text-dark-200 font-medium">{config.label}</p>
                <p className="text-xs text-dark-400 mt-1">{config.tooltip}</p>
                {status === 'limited' && (
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      onConfigureClick?.();
                    }}
                    className="flex items-center gap-1 mt-2 text-xs text-accent hover:underline"
                  >
                    <SettingsIcon className="w-3 h-3" />
                    Configure API Key
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Compact version for inline use
 */
export function AIStatusDot({ className }: { className?: string }) {
  const [status, setStatus] = useState<AIStatus>('offline');

  useEffect(() => {
    const checkStatus = async () => {
      try {
        const settings = await SettingsRepository.get();
        if (settings?.openaiApiKey && settings.openaiApiKey.trim().length > 0) {
          setStatus('ready');
        } else {
          setStatus('limited');
        }
      } catch {
        setStatus('offline');
      }
    };
    checkStatus();
  }, []);

  const colors = {
    ready: 'bg-green-400',
    limited: 'bg-yellow-400',
    offline: 'bg-red-400',
  };

  return (
    <span
      className={clsx(
        'inline-block w-2 h-2 rounded-full',
        colors[status],
        status === 'ready' && 'animate-pulse',
        className
      )}
      title={
        status === 'ready' ? 'AI Ready' :
        status === 'limited' ? 'AI Limited - Configure API key' :
        'AI Offline'
      }
    />
  );
}
