import { useState } from 'react';
import { Key, Trash2, Info } from 'lucide-react';
import { useApp } from '../../context/AppContext';
import { SettingsRepository } from '@/core/storage/repositories';
import { db } from '@/core/storage/db';
import toast from 'react-hot-toast';

export function SettingsPanel() {
  const { settings, refreshSettings } = useApp();
  const [apiKey, setApiKey] = useState('');
  const [isApiKeyVisible, setIsApiKeyVisible] = useState(false);

  const handleSaveApiKey = async () => {
    if (!apiKey.trim()) {
      toast.error('Please enter an API key');
      return;
    }

    try {
      // In production, encrypt the API key before storing
      await SettingsRepository.setOpenAIKey(apiKey);
      await refreshSettings();
      setApiKey('');
      toast.success('API key saved');
    } catch (error) {
      toast.error('Failed to save API key');
    }
  };

  const handleClearApiKey = async () => {
    if (!confirm('Remove the OpenAI API key?')) return;

    try {
      await SettingsRepository.clearOpenAIKey();
      await refreshSettings();
      toast.success('API key removed');
    } catch (error) {
      toast.error('Failed to remove API key');
    }
  };

  const handleClearAllData = async () => {
    if (!confirm('This will delete ALL data including tests, results, and settings. This cannot be undone. Continue?')) return;

    try {
      await db.delete();
      await db.open();
      window.location.reload();
    } catch (error) {
      toast.error('Failed to clear data');
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      {/* AI Integration */}
      <section className="card">
        <div className="card-header">
          <h3 className="font-medium text-dark-100 flex items-center gap-2">
            <Key className="w-4 h-4" />
            AI Integration
          </h3>
        </div>
        <div className="card-body space-y-4">
          <p className="text-sm text-dark-400">
            Add your OpenAI API key to enable AI-powered test data generation and self-healing selectors.
          </p>

          {settings?.openaiApiKey ? (
            <div className="flex items-center gap-2">
              <div className="flex-1 px-3 py-2 bg-dark-900 rounded-lg text-dark-400 text-sm">
                ••••••••••••••••
              </div>
              <button onClick={handleClearApiKey} className="btn btn-sm btn-ghost text-red-400">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="space-y-2">
              <input
                type={isApiKeyVisible ? 'text' : 'password'}
                placeholder="sk-..."
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                className="input"
              />
              <div className="flex gap-2">
                <button onClick={handleSaveApiKey} className="btn btn-sm btn-primary">
                  Save API Key
                </button>
                <button
                  onClick={() => setIsApiKeyVisible(!isApiKeyVisible)}
                  className="btn btn-sm btn-ghost"
                >
                  {isApiKeyVisible ? 'Hide' : 'Show'}
                </button>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Danger Zone */}
      <section className="card border-red-900/50">
        <div className="card-header border-red-900/50">
          <h3 className="font-medium text-red-400">Danger Zone</h3>
        </div>
        <div className="card-body">
          <p className="text-sm text-dark-400 mb-4">
            Permanently delete all data including test suites, tests, and results.
          </p>
          <button onClick={handleClearAllData} className="btn btn-sm btn-danger">
            <Trash2 className="w-4 h-4" />
            Clear All Data
          </button>
        </div>
      </section>

      {/* About */}
      <section className="card">
        <div className="card-body">
          <div className="flex items-center gap-2 text-dark-400">
            <Info className="w-4 h-4" />
            <span className="text-sm">QAerx v0.1.0</span>
          </div>
          <p className="text-xs text-dark-500 mt-2">
            Automation testing with AI-powered test data generation
          </p>
        </div>
      </section>
    </div>
  );
}
