import { useState } from 'react';
import { Plus, Trash2, Copy, Upload, Sparkles, ChevronLeft, ChevronRight } from 'lucide-react';

interface DataPanelProps {
  dataSets: Record<string, string>[];
  onDataSetsChange: (dataSets: Record<string, string>[]) => void;
  onGenerateWithAI?: () => void;
}

export function DataPanel({ dataSets, onDataSetsChange, onGenerateWithAI }: DataPanelProps) {
  const [currentSetIndex, setCurrentSetIndex] = useState(0);
  const [newKey, setNewKey] = useState('');

  // Ensure we have at least one data set
  const currentDataSets = dataSets.length > 0 ? dataSets : [{}];
  const currentSet = currentDataSets[currentSetIndex] || {};
  const keys = Array.from(
    new Set(currentDataSets.flatMap((ds) => Object.keys(ds)))
  );

  const updateCurrentSet = (updates: Record<string, string>) => {
    const newDataSets = [...currentDataSets];
    newDataSets[currentSetIndex] = { ...currentSet, ...updates };
    onDataSetsChange(newDataSets);
  };

  const addVariable = () => {
    if (!newKey.trim()) return;
    updateCurrentSet({ [newKey.trim()]: '' });
    setNewKey('');
  };

  const removeVariable = (key: string) => {
    const newDataSets = currentDataSets.map((ds) => {
      const newDs = { ...ds };
      delete newDs[key];
      return newDs;
    });
    onDataSetsChange(newDataSets);
  };

  const addDataSet = () => {
    const newSet: Record<string, string> = {};
    keys.forEach((key) => (newSet[key] = ''));
    onDataSetsChange([...currentDataSets, newSet]);
    setCurrentSetIndex(currentDataSets.length);
  };

  const duplicateDataSet = () => {
    const newSet = { ...currentSet };
    onDataSetsChange([...currentDataSets, newSet]);
    setCurrentSetIndex(currentDataSets.length);
  };

  const deleteDataSet = () => {
    if (currentDataSets.length <= 1) return;
    const newDataSets = currentDataSets.filter((_, i) => i !== currentSetIndex);
    onDataSetsChange(newDataSets);
    setCurrentSetIndex(Math.min(currentSetIndex, newDataSets.length - 1));
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      try {
        // Try JSON first
        const json = JSON.parse(text);
        if (Array.isArray(json)) {
          onDataSetsChange(json);
        } else {
          onDataSetsChange([json]);
        }
      } catch {
        // Try CSV
        const lines = text.trim().split('\n');
        if (lines.length < 2) return;

        const headers = lines[0].split(',').map((h) => h.trim());
        const newDataSets = lines.slice(1).map((line) => {
          const values = line.split(',').map((v) => v.trim());
          const obj: Record<string, string> = {};
          headers.forEach((header, i) => {
            obj[header] = values[i] || '';
          });
          return obj;
        });
        onDataSetsChange(newDataSets);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dark-300">Test Data</h3>
        <div className="flex items-center gap-2">
          <label className="btn btn-sm btn-ghost cursor-pointer">
            <Upload className="w-4 h-4" />
            Import
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
          {onGenerateWithAI && (
            <button onClick={onGenerateWithAI} className="btn btn-sm btn-ghost text-accent">
              <Sparkles className="w-4 h-4" />
              AI Generate
            </button>
          )}
        </div>
      </div>

      {/* Data Set Navigation */}
      <div className="flex items-center justify-between bg-dark-850 rounded-lg px-3 py-2">
        <button
          onClick={() => setCurrentSetIndex(Math.max(0, currentSetIndex - 1))}
          disabled={currentSetIndex === 0}
          className="btn btn-icon btn-sm btn-ghost disabled:opacity-30"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm text-dark-300">
          Data Set {currentSetIndex + 1} of {currentDataSets.length}
        </span>
        <button
          onClick={() => setCurrentSetIndex(Math.min(currentDataSets.length - 1, currentSetIndex + 1))}
          disabled={currentSetIndex === currentDataSets.length - 1}
          className="btn btn-icon btn-sm btn-ghost disabled:opacity-30"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Data Set Actions */}
      <div className="flex items-center gap-2">
        <button onClick={addDataSet} className="btn btn-sm btn-ghost flex-1">
          <Plus className="w-4 h-4" />
          New Set
        </button>
        <button onClick={duplicateDataSet} className="btn btn-sm btn-ghost flex-1">
          <Copy className="w-4 h-4" />
          Duplicate
        </button>
        <button
          onClick={deleteDataSet}
          disabled={currentDataSets.length <= 1}
          className="btn btn-sm btn-ghost text-red-400 disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>

      {/* Variables */}
      <div className="space-y-2">
        {keys.length === 0 ? (
          <div className="text-center py-6 text-dark-500 border border-dashed border-dark-700 rounded-lg">
            <p className="text-sm">No variables defined</p>
            <p className="text-xs mt-1">Add variables below to use in your test steps</p>
          </div>
        ) : (
          keys.map((key) => (
            <div key={key} className="flex items-center gap-2">
              <div className="w-1/3">
                <div className="px-3 py-2 bg-dark-850 rounded-lg text-sm text-dark-300 font-mono">
                  {`{{${key}}}`}
                </div>
              </div>
              <input
                type="text"
                value={currentSet[key] || ''}
                onChange={(e) => updateCurrentSet({ [key]: e.target.value })}
                placeholder={`Enter ${key}...`}
                className="input flex-1"
              />
              <button
                onClick={() => removeVariable(key)}
                className="btn btn-icon btn-sm btn-ghost text-dark-500 hover:text-red-400"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))
        )}
      </div>

      {/* Add Variable */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addVariable()}
          placeholder="Variable name (e.g., email, password)"
          className="input flex-1"
        />
        <button onClick={addVariable} className="btn btn-sm btn-primary">
          <Plus className="w-4 h-4" />
          Add
        </button>
      </div>

      {/* Usage Hint */}
      <div className="bg-dark-850 rounded-lg px-3 py-2 text-xs text-dark-500">
        <p>
          <strong>Tip:</strong> Use <code className="bg-dark-700 px-1 rounded">{`{{variableName}}`}</code> in
          your test steps to substitute these values.
        </p>
      </div>
    </div>
  );
}
