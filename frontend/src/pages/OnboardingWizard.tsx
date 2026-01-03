import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeBaseAPI } from '../services/api';
import toast from 'react-hot-toast';

interface ApiError {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
}

export default function OnboardingWizard(): React.JSX.Element {
  const [checking, setChecking] = useState<boolean>(true);
  const [creating, setCreating] = useState<boolean>(false);
  const [kbName, setKbName] = useState<string>('My Knowledge Base');
  const [llmProvider, setLlmProvider] = useState<string>('openai');
  const [llmModel, setLlmModel] = useState<string>('gpt-4');
  const navigate = useNavigate();

  // Check if user already has a knowledge base
  useEffect(() => {
    const checkExistingKB = async (): Promise<void> => {
      try {
        const response = await knowledgeBaseAPI.getMyKB();
        if (response.data.knowledgeBase) {
          toast.success('You already have a knowledge base. Redirecting to dashboard...');
          navigate('/dashboard');
        }
      } catch (error) {
        const apiError = error as ApiError;
        // If 404, user doesn't have a KB yet, proceed with onboarding
        if (apiError.response?.status !== 404) {
          // Error checking for existing KB
        }
      } finally {
        setChecking(false);
      }
    };

    checkExistingKB();
  }, [navigate]);

  const handleCreateKB = async (e: React.FormEvent): Promise<void> => {
    e.preventDefault();

    if (!kbName.trim()) {
      toast.error('Please enter a name for your knowledge base');
      return;
    }

    setCreating(true);
    try {
      await knowledgeBaseAPI.create({
        name: kbName,
        description: 'My first AI-powered knowledge base',
        llm_provider: llmProvider,
        llm_model: llmModel,
        system_prompt: 'You are a helpful AI assistant. Answer questions based on the knowledge base provided.',
      });

      toast.success('Knowledge base created successfully!');
      navigate('/dashboard');
    } catch (error) {
      const apiError = error as ApiError;
      toast.error(apiError.response?.data?.error || 'Failed to create knowledge base');
    } finally {
      setCreating(false);
    }
  };

  const handleSkip = (): void => {
    navigate('/dashboard');
  };

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary-50 to-white flex items-center justify-center px-4 py-12">
      <div className="max-w-2xl w-full">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-bold text-gray-900 mb-4">
            Welcome! 🎉
          </h1>
          <p className="text-xl text-gray-600">
            Let&apos;s create your first AI-powered knowledge base
          </p>
        </div>

        <div className="bg-white rounded-lg shadow-lg p-8">
          <form onSubmit={handleCreateKB} className="space-y-6">
            <div>
              <label htmlFor="kb-name" className="block text-sm font-medium text-gray-700 mb-2">
                Knowledge Base Name <span className="text-red-500">*</span>
              </label>
              <input
                id="kb-name"
                type="text"
                required
                value={kbName}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setKbName(e.target.value)}
                placeholder="e.g., Customer Support KB, Product Documentation, FAQ"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
              />
              <p className="mt-2 text-sm text-gray-500">
                Choose a descriptive name for your knowledge base
              </p>
            </div>

            <div>
              <label htmlFor="ai-provider" className="block text-sm font-medium text-gray-700 mb-2">
                AI Provider
              </label>
              <select
                id="ai-provider"
                value={llmProvider}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => {
                  setLlmProvider(e.target.value);
                  // Set default model based on provider
                  if (e.target.value === 'openai') {
                    setLlmModel('gpt-4');
                  } else if (e.target.value === 'anthropic') {
                    setLlmModel('claude-3-5-sonnet-20241022');
                  } else if (e.target.value === 'gemini') {
                    setLlmModel('gemini-pro');
                  }
                }}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
              >
                <option value="openai">OpenAI (GPT-4)</option>
                <option value="anthropic">Anthropic (Claude)</option>
                <option value="gemini">Google (Gemini)</option>
              </select>
            </div>

            <div>
              <label htmlFor="ai-model" className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                id="ai-model"
                value={llmModel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setLlmModel(e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
              >
                {llmProvider === 'openai' && (
                  <>
                    <option value="gpt-4">GPT-4</option>
                    <option value="gpt-4-turbo">GPT-4 Turbo</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo</option>
                  </>
                )}
                {llmProvider === 'anthropic' && (
                  <>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku</option>
                  </>
                )}
                {llmProvider === 'gemini' && (
                  <>
                    <option value="gemini-pro">Gemini Pro</option>
                    <option value="gemini-pro-vision">Gemini Pro Vision</option>
                  </>
                )}
              </select>
            </div>

            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-sm font-medium text-blue-900 mb-2">What you can do next:</h3>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• Upload documents (PDF, DOCX, TXT)</li>
                <li>• Add FAQ entries manually</li>
                <li>• Connect your email (Gmail, Outlook)</li>
                <li>• Configure web scraping for your website</li>
                <li>• Chat with your AI-powered knowledge base</li>
              </ul>
            </div>

            <div className="flex gap-4 pt-4">
              <button
                type="submit"
                disabled={creating}
                className="flex-1 bg-primary-600 text-white px-6 py-3 rounded-lg hover:bg-primary-700 font-medium text-lg disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {creating ? 'Creating...' : 'Create Knowledge Base'}
              </button>
              <button
                type="button"
                onClick={handleSkip}
                className="px-6 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 font-medium text-lg transition-colors"
              >
                Skip for now
              </button>
            </div>
          </form>

          <p className="mt-6 text-center text-sm text-gray-500">
            Don&apos;t worry, you can always change these settings later from your dashboard
          </p>
        </div>
      </div>
    </div>
  );
}
