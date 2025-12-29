import React, { useState, useEffect } from 'react';
import { knowledgeBaseAPI } from '../services/api';
import toast from 'react-hot-toast';
import ContextPreview from './ContextPreview';

interface Capabilities {
  q_and_a: boolean;
  scheduling: boolean;
  consultation: boolean;
  recommendations: boolean;
}

interface AvailabilitySchedule {
  general: string;
  hours: Record<string, unknown>;
}

interface PricingInfo {
  service: string;
  price: string;
}

interface PurposeConfig {
  requireClarifyingQuestions?: boolean;
  requiredInputs?: string[];
  clarifyingPrompt?: string;
}

interface DigitalTwin {
  id: string;
  name?: string;
  profession?: string;
  bio?: string;
  avatar_url?: string;
  llm_provider?: string;
  llm_model?: string;
  temperature?: number;
  max_tokens?: number;
  personality_traits?: string[] | Record<string, string>;
  communication_style?: string;
  capabilities?: Capabilities;
  services?: string[];
  pricing_info?: PricingInfo[];
  availability_schedule?: AvailabilitySchedule;
  handover_threshold?: number;
  auto_responses_enabled?: boolean;
  system_prompt?: string;
  semantic_search_max_results?: number;
  purpose?: string;
  purpose_config?: PurposeConfig | null;
}

interface KnowledgeBaseSettingsProps {
  twin: DigitalTwin;
  onUpdate?: () => void;
}

interface FormData {
  name: string;
  profession: string;
  bio: string;
  avatar_url: string;
  llm_provider: string;
  llm_model: string;
  temperature: number;
  max_tokens: number;
  personality_traits: string[];
  communication_style: string;
  capabilities: Capabilities;
  services: string[];
  pricing_info: PricingInfo[];
  availability_schedule: AvailabilitySchedule;
  handover_threshold: number;
  auto_responses_enabled: boolean;
  system_prompt: string;
  semantic_search_max_results: number;
  purpose: string;
  requireClarifyingQuestions: boolean;
  purposeRequiredInputs: string[];
  newPurposeInput: string;
  clarifyingPrompt: string;
}

export default function KnowledgeBaseSettings({ twin, onUpdate }: KnowledgeBaseSettingsProps): React.JSX.Element {
  const [formData, setFormData] = useState<FormData>({
    name: '',
    profession: '',
    bio: '',
    avatar_url: '',
    llm_provider: 'openai',
    llm_model: '',
    temperature: 0.7,
    max_tokens: 1000,
    personality_traits: [],
    communication_style: '',
    capabilities: {
      q_and_a: true,
      scheduling: false,
      consultation: false,
      recommendations: false,
    },
    services: [],
    pricing_info: [],
    availability_schedule: {
      general: '',
      hours: {},
    },
    handover_threshold: 0.5,
    auto_responses_enabled: true,
    system_prompt: '',
    semantic_search_max_results: 3,
    purpose: '',
    requireClarifyingQuestions: false,
    purposeRequiredInputs: [],
    newPurposeInput: '',
    clarifyingPrompt: '',
  });

  const [saving, setSaving] = useState<boolean>(false);
  const [newService, setNewService] = useState<string>('');
  const [newPricing, setNewPricing] = useState<PricingInfo>({ service: '', price: '' });
  const [newTrait, setNewTrait] = useState<string>('');

  useEffect(() => {
    if (twin) {
      setFormData({
        name: twin.name || '',
        profession: twin.profession || '',
        bio: twin.bio || '',
        avatar_url: twin.avatar_url || '',
        llm_provider: twin.llm_provider || 'openai',
        llm_model: twin.llm_model || '',
        temperature: twin.temperature || 0.7,
        max_tokens: twin.max_tokens || 1000,
        personality_traits: Array.isArray(twin.personality_traits)
          ? twin.personality_traits
          : (twin.personality_traits ? Object.values(twin.personality_traits) : []),
        communication_style: twin.communication_style || '',
        capabilities: twin.capabilities || {
          q_and_a: true,
          scheduling: false,
          consultation: false,
          recommendations: false,
        },
        services: Array.isArray(twin.services) ? twin.services : [],
        pricing_info: Array.isArray(twin.pricing_info) ? twin.pricing_info : [],
        availability_schedule: twin.availability_schedule || { general: '', hours: {} },
        handover_threshold: twin.handover_threshold || 0.5,
        auto_responses_enabled: twin.auto_responses_enabled !== false,
        system_prompt: twin.system_prompt || '',
        semantic_search_max_results: twin.semantic_search_max_results || 3,
        purpose: twin.purpose || '',
        requireClarifyingQuestions: twin.purpose_config?.requireClarifyingQuestions ?? false,
        purposeRequiredInputs: Array.isArray(twin.purpose_config?.requiredInputs) ? twin.purpose_config!.requiredInputs! : [],
        clarifyingPrompt: twin.purpose_config?.clarifyingPrompt || '',
        newPurposeInput: '',
      });
    }
  }, [twin]);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    setSaving(true);

    try {
      const updateData = {
        name: formData.name,
        profession: formData.profession,
        bio: formData.bio,
        avatar_url: formData.avatar_url,
        llm_provider: formData.llm_provider,
        llm_model: formData.llm_model,
        temperature: formData.temperature,
        max_tokens: formData.max_tokens,
        personality_traits: formData.personality_traits,
        communication_style: formData.communication_style,
        capabilities: formData.capabilities,
        services: formData.services,
        pricing_info: formData.pricing_info,
        availability_schedule: formData.availability_schedule,
        handover_threshold: formData.handover_threshold,
        auto_responses_enabled: formData.auto_responses_enabled,
        system_prompt: formData.system_prompt,
        semantic_search_max_results: formData.semantic_search_max_results,
        purpose: formData.purpose,
        purpose_config: {
          requireClarifyingQuestions: formData.requireClarifyingQuestions,
          requiredInputs: formData.purposeRequiredInputs,
          clarifyingPrompt: formData.clarifyingPrompt || undefined,
        },
      };

      await knowledgeBaseAPI.update(twin.id, updateData);
      toast.success('Settings updated successfully');
      if (onUpdate) onUpdate();
    } catch {
      toast.error('Failed to update settings');
    } finally {
      setSaving(false);
    }
  };

  const addService = (): void => {
    if (newService.trim()) {
      setFormData({
        ...formData,
        services: [...formData.services, newService.trim()],
      });
      setNewService('');
    }
  };

  const removeService = (index: number): void => {
    setFormData({
      ...formData,
      services: formData.services.filter((_, i) => i !== index),
    });
  };

  const addPricing = (): void => {
    if (newPricing.service && newPricing.price) {
      setFormData({
        ...formData,
        pricing_info: [...formData.pricing_info, { ...newPricing }],
      });
      setNewPricing({ service: '', price: '' });
    }
  };

  const removePricing = (index: number): void => {
    setFormData({
      ...formData,
      pricing_info: formData.pricing_info.filter((_, i) => i !== index),
    });
  };

  const addTrait = (): void => {
    if (newTrait.trim()) {
      setFormData({
        ...formData,
        personality_traits: [...formData.personality_traits, newTrait.trim()],
      });
      setNewTrait('');
    }
  };

  const removeTrait = (index: number): void => {
    setFormData({
      ...formData,
      personality_traits: formData.personality_traits.filter((_, i) => i !== index),
    });
  };

  const addPurposeInput = (): void => {
    const value = formData.newPurposeInput.trim();
    if (!value) return;
    if (formData.purposeRequiredInputs.includes(value)) {
      setFormData(prev => ({ ...prev, newPurposeInput: '' }));
      return;
    }
    setFormData(prev => ({
      ...prev,
      purposeRequiredInputs: [...prev.purposeRequiredInputs, value],
      newPurposeInput: '',
    }));
  };

  const removePurposeInput = (index: number): void => {
    setFormData(prev => ({
      ...prev,
      purposeRequiredInputs: prev.purposeRequiredInputs.filter((_, i) => i !== index),
    }));
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-8">
      {/* Basic Information */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Basic Information</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Name *</label>
            <input
              type="text"
              required
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Profession *</label>
            <input
              type="text"
              required
              value={formData.profession}
              onChange={(e) => setFormData({ ...formData, profession: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
            <textarea
              rows={3}
              value={formData.bio}
              onChange={(e) => setFormData({ ...formData, bio: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Tell us about yourself and your expertise..."
            />
          </div>

          <div className="md:col-span-2">
            <label className="block text-sm font-medium text-gray-700 mb-2">Avatar URL</label>
            <input
              type="url"
              value={formData.avatar_url}
              onChange={(e) => setFormData({ ...formData, avatar_url: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="https://..."
            />
          </div>
        </div>
      </section>

      {/* Purpose & Clarifications */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Purpose & Clarifications</h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Twin Purpose</label>
            <textarea
              rows={2}
              value={formData.purpose}
              onChange={(e) => setFormData({ ...formData, purpose: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Describe the main goal of this twin..."
            />
          </div>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.requireClarifyingQuestions}
              onChange={(e) => setFormData({ ...formData, requireClarifyingQuestions: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-3"
            />
            <span className="text-sm text-gray-700">
              Ask for missing information before providing an answer
            </span>
          </label>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Required Inputs</label>
            <div className="flex gap-2 mb-2">
              <input
                type="text"
                value={formData.newPurposeInput}
                onChange={(e) => setFormData({ ...formData, newPurposeInput: e.target.value })}
                onKeyDown={(e) => e.key === 'Enter' && (e.preventDefault(), addPurposeInput())}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
                placeholder="es. raggio della circonferenza"
              />
              <button
                type="button"
                onClick={addPurposeInput}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Add
              </button>
            </div>
            <div className="flex flex-wrap gap-2">
              {formData.purposeRequiredInputs.map((input, index) => (
                <span
                  key={input}
                  className="inline-flex items-center px-3 py-1 bg-primary-50 text-primary-700 rounded-full text-sm"
                >
                  {input}
                  <button
                    type="button"
                    onClick={() => removePurposeInput(index)}
                    className="ml-2 text-primary-600 hover:text-primary-800"
                  >
                    ×
                  </button>
                </span>
              ))}
              {formData.purposeRequiredInputs.length === 0 && (
                <p className="text-xs text-gray-500">Nessun input richiesto.</p>
              )}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Custom Clarifying Prompt</label>
            <textarea
              rows={3}
              value={formData.clarifyingPrompt}
              onChange={(e) => setFormData({ ...formData, clarifyingPrompt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="Optional instructions for how the twin should request missing data. Use {{missing_inputs}} as placeholder."
            />
          </div>
        </div>
      </section>

      {/* AI Configuration */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">AI Configuration</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">LLM Provider</label>
            <select
              value={formData.llm_provider}
              onChange={(e) => setFormData({ ...formData, llm_provider: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="openai">OpenAI</option>
              <option value="anthropic">Anthropic (Claude)</option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Model</label>
            <input
              type="text"
              value={formData.llm_model}
              onChange={(e) => setFormData({ ...formData, llm_model: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., gpt-5-mini, gpt-5.1, claude-3-5-sonnet-20241022"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Temperature ({formData.temperature})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.temperature}
              onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Lower = more focused, Higher = more creative</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Max Tokens</label>
            <input
              type="number"
              min="100"
              max="4000"
              value={formData.max_tokens}
              onChange={(e) => setFormData({ ...formData, max_tokens: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </div>
      </section>

      {/* Personality & Communication */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Personality & Communication Style</h3>

        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Communication Style</label>
          <textarea
            rows={2}
            value={formData.communication_style}
            onChange={(e) => setFormData({ ...formData, communication_style: e.target.value })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Professional, friendly, and approachable"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Personality Traits</label>
          <div className="flex gap-2 mb-2">
            <input
              type="text"
              value={newTrait}
              onChange={(e) => setNewTrait(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTrait())}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
              placeholder="e.g., Empathetic, Patient, Knowledgeable"
            />
            <button
              type="button"
              onClick={addTrait}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
            >
              Add
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {formData.personality_traits.map((trait, index) => (
              <span
                key={index}
                className="inline-flex items-center px-3 py-1 bg-primary-100 text-primary-700 rounded-full text-sm"
              >
                {trait}
                <button
                  type="button"
                  onClick={() => removeTrait(index)}
                  className="ml-2 text-primary-600 hover:text-primary-800"
                >
                  ×
                </button>
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* Capabilities */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Capabilities</h3>
        <div className="space-y-3">
          {Object.entries(formData.capabilities).map(([key, value]) => (
            <label key={key} className="flex items-center">
              <input
                type="checkbox"
                checked={value}
                onChange={(e) => setFormData({
                  ...formData,
                  capabilities: { ...formData.capabilities, [key]: e.target.checked }
                })}
                className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-3"
              />
              <span className="text-sm text-gray-700 capitalize">
                {key.replace(/_/g, ' ')}
              </span>
            </label>
          ))}
        </div>
      </section>

      {/* Services */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Services Offered</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newService}
            onChange={(e) => setNewService(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addService())}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Add a service..."
          />
          <button
            type="button"
            onClick={addService}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add
          </button>
        </div>
        <div className="space-y-2">
          {formData.services.map((service, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
              <span>{service}</span>
              <button
                type="button"
                onClick={() => removeService(index)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Pricing */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Pricing Information</h3>
        <div className="flex gap-2 mb-3">
          <input
            type="text"
            value={newPricing.service}
            onChange={(e) => setNewPricing({ ...newPricing, service: e.target.value })}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Service name..."
          />
          <input
            type="text"
            value={newPricing.price}
            onChange={(e) => setNewPricing({ ...newPricing, price: e.target.value })}
            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="Price..."
          />
          <button
            type="button"
            onClick={addPricing}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
          >
            Add
          </button>
        </div>
        <div className="space-y-2">
          {formData.pricing_info.map((pricing, index) => (
            <div key={index} className="flex items-center justify-between bg-gray-50 px-4 py-2 rounded">
              <span><strong>{pricing.service}:</strong> {pricing.price}</span>
              <button
                type="button"
                onClick={() => removePricing(index)}
                className="text-red-600 hover:text-red-700 text-sm"
              >
                Remove
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Availability */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Availability</h3>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">General Availability</label>
          <textarea
            rows={2}
            value={formData.availability_schedule.general}
            onChange={(e) => setFormData({
              ...formData,
              availability_schedule: { ...formData.availability_schedule, general: e.target.value }
            })}
            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            placeholder="e.g., Available Monday-Friday, 9 AM - 5 PM EST"
          />
        </div>
      </section>

      {/* Advanced Settings */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Advanced Settings</h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Handover Threshold ({formData.handover_threshold})
            </label>
            <input
              type="range"
              min="0"
              max="1"
              step="0.1"
              value={formData.handover_threshold}
              onChange={(e) => setFormData({ ...formData, handover_threshold: parseFloat(e.target.value) })}
              className="w-full"
            />
            <p className="text-xs text-gray-500 mt-1">Confidence level below which to request human assistance</p>
          </div>

          <label className="flex items-center">
            <input
              type="checkbox"
              checked={formData.auto_responses_enabled}
              onChange={(e) => setFormData({ ...formData, auto_responses_enabled: e.target.checked })}
              className="rounded border-gray-300 text-primary-600 focus:ring-primary-500 mr-3"
            />
            <span className="text-sm text-gray-700">Enable automatic responses</span>
          </label>

          <div>
            <div className="flex items-center justify-between mb-2">
              <label className="block text-sm font-medium text-gray-700">
                Custom System Prompt (Advanced)
              </label>
              <ContextPreview kbId={twin.id} />
            </div>
            <textarea
              rows={4}
              value={formData.system_prompt}
              onChange={(e) => setFormData({ ...formData, system_prompt: e.target.value })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 font-mono text-sm"
              placeholder="Additional instructions for the AI (optional)..."
            />
            <p className="text-xs text-gray-500 mt-1">
              These instructions will be appended to the auto-generated context. Click "Preview Full Context" to see what the AI will see.
            </p>
          </div>
        </div>
      </section>

      {/* Semantic Search Settings */}
      <section>
        <h3 className="text-lg font-semibold mb-4 text-gray-900">Semantic Search Settings</h3>
        <p className="text-sm text-gray-600 mb-4">
          Configure how the AI uses your knowledge base to answer questions. Hybrid search (vector + keyword matching) finds the most relevant content from your uploaded documents and emails based on both meaning and exact keywords.
        </p>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Maximum Results in Context
            </label>
            <select
              value={formData.semantic_search_max_results}
              onChange={(e) => setFormData({ ...formData, semantic_search_max_results: parseInt(e.target.value) })}
              className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500"
            >
              <option value="1">1 result</option>
              <option value="2">2 results</option>
              <option value="3">3 results (recommended)</option>
              <option value="5">5 results</option>
              <option value="7">7 results</option>
              <option value="10">10 results</option>
            </select>
            <p className="text-xs text-gray-500 mt-1">
              Number of most relevant knowledge base entries to include when generating responses.
              More results provide more context but use more tokens. 3-5 results is usually optimal.
            </p>
          </div>
        </div>
      </section>

      {/* Submit */}
      <div className="flex justify-end pt-4 border-t">
        <button
          type="submit"
          disabled={saving}
          className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
        >
          {saving ? 'Saving...' : 'Save Settings'}
        </button>
      </div>
    </form>
  );
}
