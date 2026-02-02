import { useState } from 'react';
import { Plus, Trash2, Upload, Sparkles, Beaker, Target, AlertTriangle, Maximize2, GripVertical } from 'lucide-react';
import type { ScenarioType } from '@/types/test';
import { clsx } from 'clsx';

// Re-export for backwards compatibility
export type { ScenarioType };

interface DataPanelProps {
  dataSets: Record<string, string>[];
  onDataSetsChange: (dataSets: Record<string, string>[]) => void;
  onGenerateWithAI?: () => void;
  onGenerateScenarioData?: () => void;
  dataSetScenarios?: ScenarioType[];
}

export function DataPanel({ dataSets, onDataSetsChange, onGenerateWithAI, onGenerateScenarioData, dataSetScenarios }: DataPanelProps) {
  const [newKey, setNewKey] = useState('');
  const [editingCell, setEditingCell] = useState<{ row: number; col: string } | null>(null);

  // Scenario label and styling helpers
  const getScenarioLabel = (scenario: ScenarioType): string => {
    const labels: Record<ScenarioType, string> = {
      'best-case': 'Best',
      'worst-case': 'Worst',
      'edge-case': 'Edge',
      'boundary': 'Bound',
      'normal': 'Normal',
    };
    return labels[scenario] || scenario;
  };

  const getScenarioIcon = (scenario: ScenarioType) => {
    switch (scenario) {
      case 'best-case':
        return <Target className="w-3 h-3" />;
      case 'worst-case':
        return <AlertTriangle className="w-3 h-3" />;
      case 'edge-case':
        return <Beaker className="w-3 h-3" />;
      case 'boundary':
        return <Maximize2 className="w-3 h-3" />;
      default:
        return null;
    }
  };

  const getScenarioColor = (scenario: ScenarioType): string => {
    switch (scenario) {
      case 'best-case':
        return 'bg-green-500/20 text-green-400';
      case 'worst-case':
        return 'bg-red-500/20 text-red-400';
      case 'edge-case':
        return 'bg-yellow-500/20 text-yellow-400';
      case 'boundary':
        return 'bg-blue-500/20 text-blue-400';
      default:
        return 'bg-dark-700 text-dark-400';
    }
  };

  // Ensure we have at least one data set
  const currentDataSets = dataSets.length > 0 ? dataSets : [{}];
  const keys = Array.from(
    new Set(currentDataSets.flatMap((ds) => Object.keys(ds)))
  );

  const updateCell = (rowIndex: number, key: string, value: string) => {
    const newDataSets = [...currentDataSets];
    newDataSets[rowIndex] = { ...newDataSets[rowIndex], [key]: value };
    onDataSetsChange(newDataSets);
  };

  const addVariable = () => {
    if (!newKey.trim()) return;
    const newDataSets = currentDataSets.map((ds) => ({
      ...ds,
      [newKey.trim()]: '',
    }));
    onDataSetsChange(newDataSets);
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

  const addRow = () => {
    const newSet: Record<string, string> = {};
    keys.forEach((key) => (newSet[key] = ''));
    onDataSetsChange([...currentDataSets, newSet]);
  };

  const deleteRow = (rowIndex: number) => {
    if (currentDataSets.length <= 1) return;
    const newDataSets = currentDataSets.filter((_, i) => i !== rowIndex);
    onDataSetsChange(newDataSets);
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
      {/* Header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-dark-200">Test Data</h3>
        <div className="flex items-center gap-1">
          <label className="btn btn-sm btn-ghost cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            <span className="text-xs">Import</span>
            <input
              type="file"
              accept=".json,.csv"
              onChange={handleFileUpload}
              className="hidden"
            />
          </label>
        </div>
      </div>

      {/* Table View */}
      {keys.length > 0 ? (
        <div className="border border-dark-700 rounded-lg overflow-hidden">
          {/* Table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              {/* Header Row */}
              <thead>
                <tr className="bg-dark-850">
                  <th className="w-8 px-2 py-2 text-left text-dark-500 font-medium border-b border-dark-700">
                    #
                  </th>
                  {dataSetScenarios && dataSetScenarios.length > 0 && (
                    <th className="px-3 py-2 text-left text-dark-500 font-medium border-b border-dark-700">
                      Type
                    </th>
                  )}
                  {keys.map((key) => (
                    <th
                      key={key}
                      className="px-3 py-2 text-left border-b border-dark-700 min-w-[120px]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <code className="text-xs text-accent font-mono">{`{{${key}}}`}</code>
                        <button
                          onClick={() => removeVariable(key)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-dark-500 hover:text-red-400 transition-opacity"
                          title={`Remove ${key}`}
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </th>
                  ))}
                  <th className="w-10 px-2 py-2 border-b border-dark-700"></th>
                </tr>
              </thead>

              {/* Data Rows */}
              <tbody>
                {currentDataSets.map((dataSet, rowIndex) => {
                  const scenario = dataSetScenarios?.[rowIndex];
                  return (
                    <tr
                      key={rowIndex}
                      className="group hover:bg-dark-850/50 transition-colors"
                    >
                      {/* Row Number */}
                      <td className="px-2 py-1.5 text-dark-600 text-xs border-b border-dark-800">
                        <div className="flex items-center gap-1">
                          <GripVertical className="w-3 h-3 opacity-0 group-hover:opacity-50 cursor-grab" />
                          {rowIndex + 1}
                        </div>
                      </td>

                      {/* Scenario Badge */}
                      {dataSetScenarios && dataSetScenarios.length > 0 && (
                        <td className="px-3 py-1.5 border-b border-dark-800">
                          {scenario && (
                            <span
                              className={clsx(
                                'inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-medium rounded',
                                getScenarioColor(scenario)
                              )}
                            >
                              {getScenarioIcon(scenario)}
                              {getScenarioLabel(scenario)}
                            </span>
                          )}
                        </td>
                      )}

                      {/* Data Cells */}
                      {keys.map((key) => {
                        const isEditing =
                          editingCell?.row === rowIndex && editingCell?.col === key;
                        return (
                          <td
                            key={key}
                            className="px-1 py-1 border-b border-dark-800"
                          >
                            {isEditing ? (
                              <input
                                type="text"
                                value={dataSet[key] || ''}
                                onChange={(e) =>
                                  updateCell(rowIndex, key, e.target.value)
                                }
                                onBlur={() => setEditingCell(null)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter' || e.key === 'Escape') {
                                    setEditingCell(null);
                                  }
                                  if (e.key === 'Tab') {
                                    const keyIndex = keys.indexOf(key);
                                    if (e.shiftKey && keyIndex > 0) {
                                      e.preventDefault();
                                      setEditingCell({ row: rowIndex, col: keys[keyIndex - 1] });
                                    } else if (!e.shiftKey && keyIndex < keys.length - 1) {
                                      e.preventDefault();
                                      setEditingCell({ row: rowIndex, col: keys[keyIndex + 1] });
                                    }
                                  }
                                }}
                                autoFocus
                                className="w-full px-2 py-1 bg-dark-900 border border-accent rounded text-sm focus:outline-none focus:ring-1 focus:ring-accent"
                              />
                            ) : (
                              <div
                                onClick={() => setEditingCell({ row: rowIndex, col: key })}
                                className="px-2 py-1 min-h-[28px] cursor-text rounded hover:bg-dark-800 transition-colors text-dark-200"
                              >
                                {dataSet[key] || (
                                  <span className="text-dark-600 italic">empty</span>
                                )}
                              </div>
                            )}
                          </td>
                        );
                      })}

                      {/* Row Actions */}
                      <td className="px-2 py-1.5 border-b border-dark-800">
                        <button
                          onClick={() => deleteRow(rowIndex)}
                          disabled={currentDataSets.length <= 1}
                          className="opacity-0 group-hover:opacity-100 p-1 text-dark-500 hover:text-red-400 disabled:opacity-30 transition-opacity"
                          title="Delete row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Table Footer - Add Row */}
          <div className="px-3 py-2 bg-dark-850/50 border-t border-dark-700">
            <button
              onClick={addRow}
              className="flex items-center gap-1.5 text-xs text-dark-400 hover:text-dark-200 transition-colors"
            >
              <Plus className="w-3.5 h-3.5" />
              Add row
            </button>
          </div>
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-8 border border-dashed border-dark-700 rounded-lg">
          <div className="text-dark-500 mb-3">
            <Beaker className="w-8 h-8 mx-auto opacity-50" />
          </div>
          <p className="text-sm text-dark-400">No variables defined</p>
          <p className="text-xs text-dark-600 mt-1">
            Add variables below to use in your test steps
          </p>
        </div>
      )}

      {/* Add Variable */}
      <div className="flex items-center gap-2">
        <input
          type="text"
          value={newKey}
          onChange={(e) => setNewKey(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addVariable()}
          placeholder="Variable name (e.g., email, password)"
          className="input flex-1 text-sm"
        />
        <button onClick={addVariable} className="btn btn-sm btn-ghost">
          <Plus className="w-4 h-4" />
          Add Column
        </button>
      </div>

      {/* AI Actions */}
      {(onGenerateWithAI || onGenerateScenarioData) && (
        <div className="flex items-center gap-2 pt-2 border-t border-dark-800">
          {onGenerateWithAI && (
            <button
              onClick={onGenerateWithAI}
              className="btn btn-sm btn-ghost text-accent flex-1"
              title="Generate basic test data"
            >
              <Sparkles className="w-4 h-4" />
              Generate with AI
            </button>
          )}
          {onGenerateScenarioData && (
            <button
              onClick={onGenerateScenarioData}
              className="btn btn-sm btn-ghost text-purple-400 flex-1"
              title="Generate scenario-based test data"
            >
              <Beaker className="w-4 h-4" />
              Generate Scenarios
            </button>
          )}
        </div>
      )}

      {/* Usage Hint */}
      <div className="bg-dark-850/50 rounded-lg px-3 py-2 text-xs text-dark-500">
        <strong>Tip:</strong> Use{' '}
        <code className="bg-dark-700 px-1 rounded text-accent">{`{{variableName}}`}</code>{' '}
        in your test steps. Click any cell to edit.
      </div>
    </div>
  );
}
