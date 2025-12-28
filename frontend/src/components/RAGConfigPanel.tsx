import { useState, useEffect } from 'react';
import {
  AdjustmentsHorizontalIcon,
  BeakerIcon,
  ChartBarIcon,
  ClockIcon,
  SparklesIcon,
  InformationCircleIcon,
  CheckCircleIcon,
  ExclamationTriangleIcon,
  Squares2X2Icon,
} from '@heroicons/react/24/outline';
import toast from 'react-hot-toast';
import { knowledgeBaseAPI } from '../services/api';
import { RAGConfig } from '../types/rag';

interface RAGConfigPanelProps {
  kbId: string;
  onConfigChange?: (config: RAGConfig) => void;
}

interface TooltipProps {
  text: string;
}

interface SliderControlProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min: number;
  max: number;
  step: number;
  tooltip?: string;
  unit?: string;
  showPercentage?: boolean;
}

interface ToggleControlProps {
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  tooltip?: string;
}

const RAGConfigPanel: React.FC<RAGConfigPanelProps> = ({ kbId, onConfigChange }) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [hasChanges, setHasChanges] = useState<boolean>(false);

  const [config, setConfig] = useState<RAGConfig>({
    knowledgeBaseThreshold: 0.70,
    emailThreshold: 0.65,
    hybridSearchEnabled: true,
    vectorWeight: 0.6,
    bm25Weight: 0.4,
    fusionMethod: 'weighted',
    rerankingEnabled: true,
    useDiversityFilter: true,
    diversityThreshold: 0.85,
    useMMR: false,
    mmrLambda: 0.7,
    semanticBoostEnabled: true,
    maxBoost: 0.05,
    minBoostThreshold: 0.30,
    dynamicBoostEnabled: false,
    temporalDecayEnabled: false,
    decayHalfLifeDays: 365,
    maxResults: 5,
    maxEmailRatio: 0.6,
    maxKBRatio: 0.8,
    ingestion: {
      tableMaxColumns: 10,
    },
  });

  useEffect(() => {
    const fetchConfig = async (): Promise<void> => {
      try {
        const response = await knowledgeBaseAPI.getRAGConfig(kbId);
        if (response.data.config) {
          setConfig(prev => ({ ...prev, ...response.data.config }));
        }
      } catch {
        // Use defaults if no saved config
      }
    };
    fetchConfig();
  }, [kbId]);

  const tableMaxColumns = config.ingestion?.tableMaxColumns ?? 10;

  const handleConfigChange = (key: keyof RAGConfig, value: number | string | boolean): void => {
    setConfig(prev => {
      const newConfig = { ...prev, [key]: value };

      if (key === 'vectorWeight') {
        newConfig.bm25Weight = Math.round((1 - (value as number)) * 100) / 100;
      } else if (key === 'bm25Weight') {
        newConfig.vectorWeight = Math.round((1 - (value as number)) * 100) / 100;
      }

      return newConfig;
    });
    setHasChanges(true);
  };

  const handleIngestionConfigChange = (value: number): void => {
    const sanitized = Math.max(1, Math.min(40, Math.round(value)));
    setConfig(prev => ({
      ...prev,
      ingestion: {
        ...(prev.ingestion || {}),
        tableMaxColumns: sanitized,
      },
    }));
    setHasChanges(true);
  };

  const saveConfig = async (): Promise<void> => {
    setIsSaving(true);
    try {
      await knowledgeBaseAPI.updateRAGConfig(kbId, config);
      toast.success('RAG configuration saved');
      setHasChanges(false);
      if (onConfigChange) {
        onConfigChange(config);
      }
    } catch {
      toast.error('Failed to save configuration');
    } finally {
      setIsSaving(false);
    }
  };

  const resetToDefaults = (): void => {
    setConfig({
      knowledgeBaseThreshold: 0.70,
      emailThreshold: 0.65,
      hybridSearchEnabled: true,
      vectorWeight: 0.6,
      bm25Weight: 0.4,
      fusionMethod: 'weighted',
      rerankingEnabled: true,
      useDiversityFilter: true,
      diversityThreshold: 0.85,
      useMMR: false,
      mmrLambda: 0.7,
      semanticBoostEnabled: true,
      maxBoost: 0.05,
      minBoostThreshold: 0.30,
      dynamicBoostEnabled: false,
      temporalDecayEnabled: false,
      decayHalfLifeDays: 365,
      maxResults: 5,
      maxEmailRatio: 0.6,
      maxKBRatio: 0.8,
      ingestion: {
        tableMaxColumns: 10,
      },
    });
    setHasChanges(true);
    toast('Reset to defaults', { icon: '↩️' });
  };

  const Tooltip: React.FC<TooltipProps> = ({ text }) => (
    <div className="group relative inline-block ml-1">
      <InformationCircleIcon className="h-4 w-4 text-gray-400 cursor-help" />
      <div className="hidden group-hover:block absolute z-10 w-64 p-2 bg-gray-900 text-white text-xs rounded-lg -top-2 left-6 shadow-lg">
        {text}
      </div>
    </div>
  );

  const SliderControl: React.FC<SliderControlProps> = ({
    label,
    value,
    onChange,
    min,
    max,
    step,
    tooltip,
    unit = '',
    showPercentage = false
  }) => (
    <div className="space-y-1">
      <div className="flex items-center justify-between">
        <div className="flex items-center">
          <span className="text-sm font-medium text-gray-700">{label}</span>
          {tooltip && <Tooltip text={tooltip} />}
        </div>
        <span className="text-sm font-semibold text-primary-600">
          {showPercentage ? `${Math.round(value * 100)}%` : value.toFixed(2)}{unit}
        </span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step}
        value={value}
        onChange={(e) => onChange(parseFloat(e.target.value))}
        className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
      />
      <div className="flex justify-between text-xs text-gray-400">
        <span>{showPercentage ? `${Math.round(min * 100)}%` : min}</span>
        <span>{showPercentage ? `${Math.round(max * 100)}%` : max}</span>
      </div>
    </div>
  );

  const ToggleControl: React.FC<ToggleControlProps> = ({ label, checked, onChange, tooltip }) => (
    <label className="flex items-center justify-between cursor-pointer">
      <div className="flex items-center">
        <span className="text-sm font-medium text-gray-700">{label}</span>
        {tooltip && <Tooltip text={tooltip} />}
      </div>
      <div className="relative">
        <input
          type="checkbox"
          className="sr-only"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className={`w-10 h-6 rounded-full shadow-inner transition-colors ${checked ? 'bg-primary-600' : 'bg-gray-300'}`}></div>
        <div className={`absolute left-1 top-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${checked ? 'translate-x-4' : ''}`}></div>
      </div>
    </label>
  );

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      {/* Header */}
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <AdjustmentsHorizontalIcon className="h-5 w-5 text-primary-600" />
          <span className="font-semibold text-gray-900">RAG Configuration</span>
          {hasChanges && (
            <span className="px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
              Unsaved changes
            </span>
          )}
        </div>
        <svg
          className={`h-5 w-5 text-gray-500 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Expandable Content */}
      {isExpanded && (
        <div className="p-4 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4 p-3 bg-gray-50 rounded-lg">
            <div className="text-center">
              <div className="text-2xl font-bold text-primary-600">
                {Math.round((config.knowledgeBaseThreshold ?? 0.70) * 100)}%
              </div>
              <div className="text-xs text-gray-500">KB Threshold</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">
                {Math.round((config.emailThreshold ?? 0.65) * 100)}%
              </div>
              <div className="text-xs text-gray-500">Email Threshold</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">
                {Math.round((config.vectorWeight ?? 0.6) * 100)}/{Math.round((config.bm25Weight ?? 0.4) * 100)}
              </div>
              <div className="text-xs text-gray-500">Vector/BM25</div>
            </div>
          </div>

          {/* Section: Thresholds */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <ChartBarIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Similarity Thresholds</h3>
            </div>

            <SliderControl
              label="Knowledge Base Threshold"
              value={config.knowledgeBaseThreshold ?? 0.70}
              onChange={(v) => handleConfigChange('knowledgeBaseThreshold', v)}
              min={0}
              max={1}
              step={0.05}
              showPercentage
              tooltip="Minimum similarity score for KB entries. Higher = more relevant but fewer results. 0% = no filtering."
            />

            <SliderControl
              label="Email Threshold"
              value={config.emailThreshold ?? 0.65}
              onChange={(v) => handleConfigChange('emailThreshold', v)}
              min={0}
              max={1}
              step={0.05}
              showPercentage
              tooltip="Minimum similarity score for emails. Lower than KB due to conversational nature. 0% = no filtering."
            />
          </div>

          {/* Section: Hybrid Search */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <BeakerIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Hybrid Search</h3>
            </div>

            <ToggleControl
              label="Enable Hybrid Search"
              checked={config.hybridSearchEnabled ?? true}
              onChange={(v) => handleConfigChange('hybridSearchEnabled', v)}
              tooltip="Combines vector similarity with BM25 keyword matching for better results."
            />

            {config.hybridSearchEnabled && (
              <>
                <SliderControl
                  label="Vector Weight"
                  value={config.vectorWeight ?? 0.6}
                  onChange={(v) => handleConfigChange('vectorWeight', v)}
                  min={0}
                  max={1}
                  step={0.1}
                  showPercentage
                  tooltip="Weight for semantic/vector similarity. Higher = more meaning-based."
                />

                <SliderControl
                  label="BM25 Weight"
                  value={config.bm25Weight ?? 0.4}
                  onChange={(v) => handleConfigChange('bm25Weight', v)}
                  min={0}
                  max={1}
                  step={0.1}
                  showPercentage
                  tooltip="Weight for keyword matching. Higher = more exact keyword matches."
                />

                <div className="space-y-1">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-700">Fusion Method</span>
                    <Tooltip text="How to combine vector and BM25 scores. Weighted preserves score quality." />
                  </div>
                  <select
                    value={config.fusionMethod}
                    onChange={(e) => handleConfigChange('fusionMethod', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 text-sm"
                  >
                    <option value="weighted">Weighted Average (Recommended)</option>
                    <option value="rrf">Reciprocal Rank Fusion</option>
                  </select>
                </div>
              </>
            )}
          </div>

          {/* Section: Reranking */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <SparklesIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Reranking & Diversity</h3>
            </div>

            <ToggleControl
              label="Enable Reranking"
              checked={config.rerankingEnabled ?? true}
              onChange={(v) => handleConfigChange('rerankingEnabled', v)}
              tooltip="Re-scores results based on query term matches and diversity."
            />

            {config.rerankingEnabled && (
              <>
                <ToggleControl
                  label="Diversity Filter"
                  checked={config.useDiversityFilter ?? true}
                  onChange={(v) => handleConfigChange('useDiversityFilter', v)}
                  tooltip="Removes results too similar to already selected ones."
                />

                {config.useDiversityFilter && (
                  <SliderControl
                    label="Diversity Threshold"
                    value={config.diversityThreshold ?? 0.85}
                    onChange={(v) => handleConfigChange('diversityThreshold', v)}
                    min={0}
                    max={1}
                    step={0.05}
                    showPercentage
                    tooltip="Skip results with similarity above this to already selected. Higher = less filtering."
                  />
                )}

                <ToggleControl
                  label="Use MMR (Maximal Marginal Relevance)"
                  checked={config.useMMR ?? false}
                  onChange={(v) => handleConfigChange('useMMR', v)}
                  tooltip="Advanced diversity algorithm. Balances relevance and novelty."
                />

                {config.useMMR && (
                  <SliderControl
                    label="MMR Lambda"
                    value={config.mmrLambda ?? 0.7}
                    onChange={(v) => handleConfigChange('mmrLambda', v)}
                    min={0}
                    max={1}
                    step={0.1}
                    showPercentage
                    tooltip="0 = max diversity, 1 = max relevance. 0.7 is balanced."
                  />
                )}
              </>
            )}
          </div>

          {/* Section: Semantic Boost */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <ChartBarIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Semantic Boost</h3>
            </div>

            <ToggleControl
              label="Enable Semantic Boost"
              checked={config.semanticBoostEnabled ?? true}
              onChange={(v) => handleConfigChange('semanticBoostEnabled', v)}
              tooltip="Boosts scores when query terms appear in content."
            />

            {config.semanticBoostEnabled && (
              <>
                <SliderControl
                  label="Max Boost"
                  value={config.maxBoost ?? 0.05}
                  onChange={(v) => handleConfigChange('maxBoost', v)}
                  min={0.01}
                  max={0.20}
                  step={0.01}
                  showPercentage
                  tooltip="Maximum score boost from query term matches."
                />

                <SliderControl
                  label="Min Score to Boost"
                  value={config.minBoostThreshold ?? 0.30}
                  onChange={(v) => handleConfigChange('minBoostThreshold', v)}
                  min={0}
                  max={1}
                  step={0.05}
                  showPercentage
                  tooltip="Don't boost scores below this threshold. 0% = boost all results."
                />

                <ToggleControl
                  label="Dynamic Boost (Experimental)"
                  checked={config.dynamicBoostEnabled ?? false}
                  onChange={(v) => handleConfigChange('dynamicBoostEnabled', v)}
                  tooltip="Adjusts boost based on match quality. Higher match ratio = higher boost."
                />
              </>
            )}
          </div>

          {/* Section: Temporal Decay */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <ClockIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Temporal Decay (Emails)</h3>
            </div>

            <ToggleControl
              label="Enable Temporal Decay"
              checked={config.temporalDecayEnabled ?? false}
              onChange={(v) => handleConfigChange('temporalDecayEnabled', v)}
              tooltip="Older emails get lower scores. Useful for time-sensitive info."
            />

            {config.temporalDecayEnabled && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <span className="text-sm font-medium text-gray-700">Half-Life (Days)</span>
                    <Tooltip text="Days until email score is halved. 365 = gentle decay." />
                  </div>
                  <span className="text-sm font-semibold text-primary-600">{config.decayHalfLifeDays}</span>
                </div>
                <input
                  type="range"
                  min={30}
                  max={730}
                  step={30}
                  value={config.decayHalfLifeDays ?? 365}
                  onChange={(e) => handleConfigChange('decayHalfLifeDays', parseInt(e.target.value))}
                  className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>30 days (aggressive)</span>
                  <span>730 days (gentle)</span>
                </div>
              </div>
            )}
          </div>

          {/* Section: Results */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <ChartBarIcon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Result Limits</h3>
            </div>

            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700">Max Results</span>
                  <Tooltip text="Maximum number of results to include in LLM context." />
                </div>
                <span className="text-sm font-semibold text-primary-600">{config.maxResults}</span>
              </div>
              <input
                type="range"
                min={1}
                max={10}
                step={1}
                value={config.maxResults ?? 5}
                onChange={(e) => handleConfigChange('maxResults', parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
            </div>

            <SliderControl
              label="Max Email Ratio"
              value={config.maxEmailRatio ?? 0.6}
              onChange={(v) => handleConfigChange('maxEmailRatio', v)}
              min={0.2}
              max={1.0}
              step={0.1}
              showPercentage
              tooltip="Maximum percentage of results that can be emails."
            />

            <SliderControl
              label="Max KB Ratio"
              value={config.maxKBRatio ?? 0.8}
              onChange={(v) => handleConfigChange('maxKBRatio', v)}
              min={0.2}
              max={1.0}
              step={0.1}
              showPercentage
              tooltip="Maximum percentage of results from knowledge base."
            />
          </div>

          {/* Section: Ingestion */}
          <div className="space-y-4">
            <div className="flex items-center space-x-2 pb-2 border-b border-gray-200">
              <Squares2X2Icon className="h-5 w-5 text-gray-600" />
              <h3 className="font-semibold text-gray-900">Ingestion Settings</h3>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <span className="text-sm font-medium text-gray-700">Max Table Columns</span>
                  <Tooltip text="Limit how many columns are captured per table chunk. Extra columns are summarized as omitted to keep prompts lean." />
                </div>
                <span className="text-sm font-semibold text-primary-600">{tableMaxColumns}</span>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={tableMaxColumns}
                onChange={(e) => handleIngestionConfigChange(parseInt(e.target.value))}
                className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-primary-600"
              />
              <div className="flex justify-between text-xs text-gray-400">
                <span>3 cols</span>
                <span>30 cols</span>
              </div>
              <div className="flex items-center space-x-2">
                <input
                  type="number"
                  min={1}
                  max={50}
                  value={tableMaxColumns}
                  onChange={(e) => handleIngestionConfigChange(parseInt(e.target.value) || 1)}
                  className="w-20 px-2 py-1 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                />
                <span className="text-xs text-gray-500">Columns captured per table snapshot</span>
              </div>
              <p className="text-xs text-gray-500">
                Large tables are stored as a single chunk. Columns above the cap are replaced with an ellipsis so the model understands data
                continues without bloating the token budget.
              </p>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center justify-between pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={resetToDefaults}
              className="px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            >
              Reset to Defaults
            </button>
            <div className="flex items-center space-x-3">
              {hasChanges && (
                <span className="flex items-center text-sm text-yellow-600">
                  <ExclamationTriangleIcon className="h-4 w-4 mr-1" />
                  Unsaved
                </span>
              )}
              <button
                type="button"
                onClick={saveConfig}
                disabled={isSaving || !hasChanges}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium flex items-center"
              >
                {isSaving ? (
                  <>
                    <svg className="animate-spin h-4 w-4 mr-2" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </svg>
                    Saving...
                  </>
                ) : (
                  <>
                    <CheckCircleIcon className="h-4 w-4 mr-2" />
                    Save Configuration
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Help Text */}
          <div className="p-3 bg-blue-50 rounded-lg">
            <p className="text-xs text-blue-700">
              <strong>Tip:</strong> Start with defaults. Adjust thresholds if you get too few/many results.
              Enable temporal decay for time-sensitive content. Use MMR for diverse answers.
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default RAGConfigPanel;
