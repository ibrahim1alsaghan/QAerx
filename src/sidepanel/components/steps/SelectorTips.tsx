import { Lightbulb, X } from 'lucide-react';
import { useState } from 'react';

export function SelectorTips() {
  const [isVisible, setIsVisible] = useState(true);

  if (!isVisible) return null;

  return (
    <div className="bg-accent/10 border border-accent/30 rounded-lg p-4 mb-4">
      <div className="flex items-start justify-between gap-3">
        <Lightbulb className="w-5 h-5 text-accent flex-shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <h4 className="text-sm font-medium text-accent">Selector Tips</h4>
          <div className="text-xs text-dark-300 space-y-1">
            <p>
              <strong className="text-dark-200">1. Use the Pick button</strong> - Click on the page element directly
            </p>
            <p>
              <strong className="text-dark-200">2. By ID:</strong> <code className="bg-dark-800 px-1 rounded">#email</code> - Most reliable
            </p>
            <p>
              <strong className="text-dark-200">3. By name:</strong> <code className="bg-dark-800 px-1 rounded">input[name="email"]</code>
            </p>
            <p>
              <strong className="text-dark-200">4. By type:</strong> <code className="bg-dark-800 px-1 rounded">button[type="submit"]</code>
            </p>
            <p>
              <strong className="text-dark-200">5. By placeholder:</strong> <code className="bg-dark-800 px-1 rounded">input[placeholder="Email"]</code>
            </p>
          </div>
        </div>
        <button
          onClick={() => setIsVisible(false)}
          className="btn btn-icon btn-sm btn-ghost flex-shrink-0"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
