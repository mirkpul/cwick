import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { benchmarkAPI, knowledgeBaseAPI } from '../../services/api';
import DatasetList, { Dataset } from '../../components/benchmark/DatasetList';
import QuestionsList, { Question } from '../../components/benchmark/QuestionsList';
import RAGConfigPanel from '../../components/RAGConfigPanel';
import RunComparisonTable from '../../components/benchmark/RunComparisonTable';
import RunDetailView from '../../components/benchmark/RunDetailView';
import { RunResult, BenchmarkRun } from '../../types/benchmark';

interface KnowledgeBase {
  id: string;
  name: string;
}

interface ApiError {
  response?: {
    status?: number;
  };
}

type TabType = 'datasets' | 'runs' | 'settings';
type ViewMode = 'list' | 'detail';

interface NewDataset {
  name: string;
  description: string;
  dataset_type: string;
}

interface NewRun {
  dataset_id: string;
  name: string;
  run_type: string;
}

interface GenerateOptions {
  count: number;
  types: string[];
}

interface NewQuestion {
  question: string;
  expected_answer: string;
  question_type: string;
  difficulty: string;
}

export default function BenchmarkDashboard(): React.JSX.Element {
  const navigate = useNavigate();
  const [kb, setKB] = useState<KnowledgeBase | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [activeTab, setActiveTab] = useState<TabType>('datasets');

  // Data
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [runs, setRuns] = useState<BenchmarkRun[]>([]);
  const [selectedDataset, setSelectedDataset] = useState<Dataset | null>(null);
  const [selectedRun, setSelectedRun] = useState<BenchmarkRun | null>(null);
  const [questions, setQuestions] = useState<Question[]>([]);

  const [runResults, setRunResults] = useState<RunResult[]>([]);
  const [viewMode, setViewMode] = useState<ViewMode>('list');

  // Modals
  const [showCreateDataset, setShowCreateDataset] = useState<boolean>(false);
  const [showCreateRun, setShowCreateRun] = useState<boolean>(false);
  const [showGenerateQuestions, setShowGenerateQuestions] = useState<boolean>(false);
  const [showAddQuestion, setShowAddQuestion] = useState<boolean>(false);

  // Forms
  const [newDataset, setNewDataset] = useState<NewDataset>({ name: '', description: '', dataset_type: 'golden' });
  const [newRun, setNewRun] = useState<NewRun>({ dataset_id: '', name: '', run_type: 'full' });
  const [generateOptions, setGenerateOptions] = useState<GenerateOptions>({ count: 20, types: ['simple', 'complex'] });
  const [newQuestion, setNewQuestion] = useState<NewQuestion>({ question: '', expected_answer: '', question_type: 'simple', difficulty: 'medium' });

  const loadData = useCallback(async (): Promise<void> => {
    try {
      const kbRes = await knowledgeBaseAPI.getMyKB();
      const kbData = kbRes.data.knowledgeBase;
      setKB(kbData);

      if (kbData) {
        const [datasetsRes, runsRes] = await Promise.all([
          benchmarkAPI.listDatasets(kbData.id),
          benchmarkAPI.listRuns(kbData.id)
        ]);
        setDatasets(datasetsRes.data);
        setRuns(runsRes.data);
      }
    } catch (err) {
      const apiError = err as ApiError;
      if (apiError.response?.status === 404) {
        navigate('/onboarding');
      } else {
        toast.error('Failed to load data');
      }
    }
    setLoading(false);
  }, [navigate]);

  // Load initial data
  useEffect(() => {
    loadData();
  }, [loadData]);

  // Dataset handlers
  const handleSelectDataset = async (dataset: Dataset): Promise<void> => {
    setSelectedDataset(dataset);
    setSelectedRun(null);
    try {
      const res = await benchmarkAPI.listQuestions(dataset.id);
      setQuestions(res.data);
    } catch {
      toast.error('Failed to load questions');
    }
  };

  const handleCreateDataset = async (): Promise<void> => {
    if (!newDataset.name.trim()) {
      toast.error('Dataset name is required');
      return;
    }
    try {
      await benchmarkAPI.createDataset({
        kb_id: kb!.id,
        ...newDataset
      });
      toast.success('Dataset created');
      setShowCreateDataset(false);
      setNewDataset({ name: '', description: '', dataset_type: 'golden' });
      loadData();
    } catch {
      toast.error('Failed to create dataset');
    }
  };

  const handleDeleteDataset = async (dataset: Dataset): Promise<void> => {
    try {
      await benchmarkAPI.deleteDataset(dataset.id);
      toast.success('Dataset deleted');
      if (selectedDataset?.id === dataset.id) {
        setSelectedDataset(null);
        setQuestions([]);
      }
      loadData();
    } catch {
      toast.error('Failed to delete dataset');
    }
  };

  const handleExportDataset = async (dataset: Dataset): Promise<void> => {
    try {
      const res = await benchmarkAPI.exportDataset(dataset.id);
      const blob = new Blob([JSON.stringify(res.data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${dataset.name.replace(/\s+/g, '_')}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success('Dataset exported');
    } catch {
      toast.error('Failed to export dataset');
    }
  };

  // Question handlers
  const handleAddQuestion = async (): Promise<void> => {
    if (!newQuestion.question.trim()) {
      toast.error('Question is required');
      return;
    }
    try {
      await benchmarkAPI.addQuestion(selectedDataset!.id, newQuestion);
      toast.success('Question added');
      setShowAddQuestion(false);
      setNewQuestion({ question: '', expected_answer: '', question_type: 'simple', difficulty: 'medium' });
      handleSelectDataset(selectedDataset!);
    } catch {
      toast.error('Failed to add question');
    }
  };

  const handleDeleteQuestion = async (question: Question): Promise<void> => {
    try {
      await benchmarkAPI.deleteQuestion(question.id);
      toast.success('Question deleted');
      handleSelectDataset(selectedDataset!);
    } catch {
      toast.error('Failed to delete question');
    }
  };

  const handleGenerateQuestions = async (): Promise<void> => {
    try {
      toast.loading('Generating questions...', { id: 'generate' });
      const res = await benchmarkAPI.generateQuestions(selectedDataset!.id, generateOptions);
      toast.success(`Generated ${res.data.generated} questions`, { id: 'generate' });
      setShowGenerateQuestions(false);
      handleSelectDataset(selectedDataset!);
    } catch {
      toast.error('Failed to generate questions', { id: 'generate' });
    }
  };

  // Run handlers
  const handleSelectRun = async (run: BenchmarkRun): Promise<void> => {
    setSelectedRun(run);
    setSelectedDataset(null);
    if (run.status === 'completed') {
      try {
        const res = await benchmarkAPI.getRunResults(run.id);
        setRunResults(res.data);
        setViewMode('detail');
      } catch {
        toast.error('Failed to load results');
      }
    }
  };

  const handleBackToRuns = (): void => {
    setSelectedRun(null);
    setRunResults([]);
    setViewMode('list');
  };

  const handleCompareRuns = async (runIds: string[]): Promise<void> => {
    // Basic implementation: just show toast for now, can be expanded to full comparison view
    // or trigger a 'compare' view mode
    toast.success(`Comparing ${runIds.length} runs (Feature coming soon)`);
  };

  const handleCreateRun = async (): Promise<void> => {
    if (!newRun.dataset_id) {
      toast.error('Please select a dataset');
      return;
    }
    try {
      const res = await benchmarkAPI.createRun({
        ...newRun,
      });
      toast.success('Run created');
      setShowCreateRun(false);
      setNewRun({ dataset_id: '', name: '', run_type: 'full' });
      loadData();

      // Optionally start immediately
      if (confirm('Start the benchmark run now?')) {
        await benchmarkAPI.startRun(res.data.id);
        toast.success('Benchmark started');
        loadData();
      }
    } catch {
      toast.error('Failed to create run');
    }
  };

  const handleDeleteRun = async (run: BenchmarkRun): Promise<void> => {
    try {
      await benchmarkAPI.deleteRun(run.id);
      toast.success('Run deleted');
      if (selectedRun?.id === run.id) {
        setSelectedRun(null);
        setRunResults([]);
      }
      loadData();
    } catch {
      toast.error('Failed to delete run');
    }
  };

  // Polling for running runs
  useEffect(() => {
    const runningRuns = runs.filter(r => r.status === 'running');
    if (runningRuns.length === 0) return;

    const interval = setInterval(() => {
      loadData();
    }, 5000);

    return () => clearInterval(interval);
  }, [runs, loadData]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: 'datasets', label: 'Datasets' },
    { id: 'runs', label: 'Runs' },
    { id: 'settings', label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-gray-900">RAG Benchmark</h1>
              <p className="text-sm text-gray-500 mt-1">Test and optimize your knowledge base</p>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => navigate('/dashboard')}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                Return to Home
              </button>
              <button
                onClick={() => setShowCreateDataset(true)}
                className="px-4 py-2 bg-white border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50"
              >
                New Dataset
              </button>
              <button
                onClick={() => setShowCreateRun(true)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700"
              >
                Run Benchmark
              </button>
            </div>
          </div>

          {/* Tabs */}
          <div className="mt-4 flex gap-4 border-b border-gray-200 -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`pb-3 px-1 text-sm font-medium border-b-2 transition-colors ${activeTab === tab.id
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">


        {activeTab === 'datasets' && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Dataset List */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">Datasets</h2>
                <button
                  onClick={() => setShowCreateDataset(true)}
                  className="text-sm text-blue-600 hover:text-blue-700"
                >
                  + New
                </button>
              </div>
              <DatasetList
                datasets={datasets}
                selectedId={selectedDataset?.id}
                onSelect={handleSelectDataset}
                onDelete={handleDeleteDataset}
                onExport={handleExportDataset}
              />
            </div>

            {/* Questions */}
            <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-gray-900">
                  Questions {selectedDataset && `(${questions.length})`}
                </h2>
                {selectedDataset && (
                  <div className="flex gap-2">
                    <button
                      onClick={() => setShowGenerateQuestions(true)}
                      className="text-sm text-purple-600 hover:text-purple-700"
                    >
                      Generate
                    </button>
                    <button
                      onClick={() => setShowAddQuestion(true)}
                      className="text-sm text-blue-600 hover:text-blue-700"
                    >
                      + Add
                    </button>
                  </div>
                )}
              </div>
              {selectedDataset ? (
                <QuestionsList
                  questions={questions}
                  onDelete={handleDeleteQuestion}
                />
              ) : (
                <p className="text-gray-500 text-center py-8">
                  Select a dataset to view questions
                </p>
              )}
            </div>
          </div>
        )}

        {activeTab === 'runs' && (
          <div className="space-y-6">
            {viewMode === 'list' ? (
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-lg font-semibold text-gray-900">Benchmark Runs</h2>
                  <button
                    onClick={() => setShowCreateRun(true)}
                    className="text-sm text-blue-600 hover:text-blue-700 font-medium"
                  >
                    + New Run
                  </button>
                </div>
                <RunComparisonTable
                  runs={runs}
                  onSelectRun={handleSelectRun}
                  onDeleteRun={handleDeleteRun}
                  onCompareRuns={handleCompareRuns}
                />
              </div>
            ) : (
              <RunDetailView
                run={selectedRun}
                results={runResults}
                onBack={handleBackToRuns}
              />
            )}
          </div>
        )}


        {
          activeTab === 'settings' && kb && (
            <div className="max-w-4xl mx-auto">
              <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-6">
                <h2 className="text-lg font-semibold text-gray-900 mb-4">Benchmark RAG Configuration</h2>
                <p className="text-gray-600 mb-6">
                  Configure how the RAG pipeline retrieves and processes information.
                  These settings will be snapshotted when you create a new benchmark run, allowing you to test different configurations.
                </p>
                <RAGConfigPanel kbId={kb.id} />
              </div>
            </div>
          )
        }
      </main >

      {/* Create Dataset Modal */}
      {
        showCreateDataset && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Create Dataset</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newDataset.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewDataset({ ...newDataset, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="My Test Dataset"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                  <textarea
                    value={newDataset.description}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewDataset({ ...newDataset, description: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="Optional description"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newDataset.dataset_type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewDataset({ ...newDataset, dataset_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="golden">Golden (manual)</option>
                    <option value="synthetic">Synthetic (auto-generated)</option>
                    <option value="hybrid">Hybrid (both)</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateDataset(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateDataset}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Create Run Modal */}
      {
        showCreateRun && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Create Benchmark Run</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Dataset</label>
                  <select
                    value={newRun.dataset_id}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewRun({ ...newRun, dataset_id: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="">Select dataset...</option>
                    {datasets.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name} ({d.total_questions || 0} questions)
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    type="text"
                    value={newRun.name}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setNewRun({ ...newRun, name: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    placeholder="Baseline v1"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                  <select
                    value={newRun.run_type}
                    onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewRun({ ...newRun, run_type: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                  >
                    <option value="full">Full (retrieval + generation)</option>
                    <option value="retrieval_only">Retrieval only</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowCreateRun(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleCreateRun}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Create
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Generate Questions Modal */}
      {
        showGenerateQuestions && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6">
              <h3 className="text-lg font-semibold mb-4">Generate Synthetic Questions</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Number of Questions
                  </label>
                  <input
                    type="number"
                    value={generateOptions.count}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setGenerateOptions({ ...generateOptions, count: parseInt(e.target.value) || 20 })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    min={1}
                    max={100}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Question Types
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {['simple', 'complex', 'multi_hop'].map((type) => (
                      <label key={type} className="flex items-center gap-2">
                        <input
                          type="checkbox"
                          checked={generateOptions.types.includes(type)}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            const types = e.target.checked
                              ? [...generateOptions.types, type]
                              : generateOptions.types.filter(t => t !== type);
                            setGenerateOptions({ ...generateOptions, types });
                          }}
                          className="rounded"
                        />
                        <span className="text-sm">{type}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowGenerateQuestions(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleGenerateQuestions}
                  className="px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
                >
                  Generate
                </button>
              </div>
            </div>
          </div>
        )
      }

      {/* Add Question Modal */}
      {
        showAddQuestion && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg shadow-xl w-full max-w-lg p-6">
              <h3 className="text-lg font-semibold mb-4">Add Question</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Question</label>
                  <textarea
                    value={newQuestion.question}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewQuestion({ ...newQuestion, question: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={2}
                    placeholder="What is...?"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Expected Answer (optional)
                  </label>
                  <textarea
                    value={newQuestion.expected_answer}
                    onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNewQuestion({ ...newQuestion, expected_answer: e.target.value })}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    rows={3}
                    placeholder="The expected answer..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Type</label>
                    <select
                      value={newQuestion.question_type}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewQuestion({ ...newQuestion, question_type: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="simple">Simple</option>
                      <option value="complex">Complex</option>
                      <option value="multi_hop">Multi-hop</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Difficulty</label>
                    <select
                      value={newQuestion.difficulty}
                      onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setNewQuestion({ ...newQuestion, difficulty: e.target.value })}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2"
                    >
                      <option value="easy">Easy</option>
                      <option value="medium">Medium</option>
                      <option value="hard">Hard</option>
                    </select>
                  </div>
                </div>
              </div>
              <div className="flex justify-end gap-3 mt-6">
                <button
                  onClick={() => setShowAddQuestion(false)}
                  className="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={handleAddQuestion}
                  className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
                >
                  Add
                </button>
              </div>
            </div>
          </div>
        )
      }
    </div >
  );
}
