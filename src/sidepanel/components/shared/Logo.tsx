import { clsx } from 'clsx';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg';
  showText?: boolean;
}

export function Logo({ size = 'md', showText = true }: LogoProps) {
  const sizeClasses = {
    sm: 'w-6 h-6',
    md: 'w-8 h-8',
    lg: 'w-12 h-12',
  };

  const textSizes = {
    sm: 'text-sm',
    md: 'text-base',
    lg: 'text-xl',
  };

  return (
    <div className="flex items-center gap-2">
      <LogoIcon className={sizeClasses[size]} />
      {showText && (
        <span className={clsx('font-bold text-white', textSizes[size])}>
          QAerx
        </span>
      )}
    </div>
  );
}

// Simple icon version for small spaces - Navy blue circle with green checkmark
export function LogoIcon({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      className={clsx('w-8 h-8', className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Navy blue circle */}
      <circle cx="20" cy="20" r="18" fill="#2d3a6d" />
      {/* Green checkmark */}
      <path
        d="M12 20l6 6 10-12"
        stroke="#10b981"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}
