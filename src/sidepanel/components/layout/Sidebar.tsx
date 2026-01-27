import { FolderTree, Play, History, Settings, Zap } from 'lucide-react';
import type { View } from '../../App';
import { clsx } from 'clsx';

interface SidebarProps {
  currentView: View;
  onViewChange: (view: View) => void;
}

const navItems: { id: View; icon: typeof FolderTree; label: string }[] = [
  { id: 'suites', icon: FolderTree, label: 'Suites' },
  { id: 'tests', icon: Play, label: 'Tests' },
  { id: 'results', icon: History, label: 'Results' },
  { id: 'settings', icon: Settings, label: 'Settings' },
];

export function Sidebar({ currentView, onViewChange }: SidebarProps) {
  return (
    <aside className="w-16 bg-dark-950 border-r border-dark-800 flex flex-col items-center py-4">
      {/* Logo */}
      <div className="mb-8">
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center">
          <Zap className="w-6 h-6 text-white" />
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 flex flex-col gap-2">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onViewChange(item.id)}
              className={clsx(
                'w-10 h-10 rounded-lg flex items-center justify-center transition-colors',
                isActive
                  ? 'bg-accent text-white'
                  : 'text-dark-400 hover:text-dark-100 hover:bg-dark-800'
              )}
              title={item.label}
            >
              <Icon className="w-5 h-5" />
            </button>
          );
        })}
      </nav>

      {/* Version */}
      <div className="mt-auto pt-4 text-[10px] text-dark-600">v0.1</div>
    </aside>
  );
}
