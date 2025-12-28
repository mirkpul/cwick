import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { knowledgeBaseAPI } from '../services/api';
import toast from 'react-hot-toast';

interface PersonalityTraits {
  empathetic: boolean;
  professional: boolean;
  motivational: boolean;
  patient: boolean;
}

interface Capabilities {
  q_and_a: boolean;
  scheduling: boolean;
  consultation: boolean;
  lead_qualification: boolean;
}

interface FormData {
  name: string;
  profession: string;
  bio: string;
  llmProvider: string;
  llmModel: string;
  communicationStyle: string;
  personalityTraits: PersonalityTraits;
  capabilities: Capabilities;
}

interface ApiError {
  response?: {
    status?: number;
    data?: {
      error?: string;
    };
  };
}

export default function OnboardingWizard(): React.JSX.Element {
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(false);
  const [checking, setChecking] = useState<boolean>(true);
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
          // eslint-disable-next-line no-console
          console.error('Error checking for existing KB:', error);
        }
      } finally {
        setChecking(false);
      }
    };

    checkExistingKB();
  }, [navigate]);

  const [formData, setFormData] = useState<FormData>({
    // Step 1: Basic Info
    name: '',
    profession: '',
    bio: '',

    // Step 2: AI Configuration
    llmProvider: 'openai',
    llmModel: 'gpt-5-mini',
    communicationStyle: '',

    // Step 3: Personality
    personalityTraits: {
      empathetic: false,
      professional: true,
      motivational: false,
      patient: true,
    },

    // Step 4: Capabilities
    capabilities: {
      q_and_a: true,
      scheduling: true,
      consultation: true,
      lead_qualification: true,
    },
  });

  const handleChange = <K extends keyof FormData>(field: K, value: FormData[K]): void => {
    setFormData({
      ...formData,
      [field]: value,
    });
  };

  const validateStep = (): boolean => {
    if (currentStep === 1) {
      if (!formData.name.trim()) {
        toast.error('Digital Twin Name is required');
        return false;
      }
      if (!formData.profession.trim()) {
        toast.error('Profession is required');
        return false;
      }
    }
    return true;
  };

  const nextStep = (): void => {
    if (!validateStep()) {
      return;
    }
    if (currentStep < 4) {
      setCurrentStep(currentStep + 1);
    }
  };

  const prevStep = (): void => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleSubmit = async (): Promise<void> => {
    if (!validateStep()) {
      return;
    }

    setLoading(true);

    try {
      // Create knowledge base
      const systemPrompt = `You are ${formData.name}, ${formData.profession}. ${formData.bio}

Communication Style: ${formData.communicationStyle}

Provide helpful and accurate responses based on the knowledge base.`;

      const kbData = {
        name: formData.name,
        profession: formData.profession,
        bio: formData.bio,
        llmProvider: formData.llmProvider,
        llmModel: formData.llmModel,
        systemPrompt,
        personalityTraits: formData.personalityTraits,
        communicationStyle: formData.communicationStyle,
        capabilities: formData.capabilities,
      };

      await knowledgeBaseAPI.create(kbData);

      toast.success('Knowledge base created successfully!');
      navigate('/dashboard');
    } catch (error) {
      const apiError = error as ApiError;
      // If knowledge base already exists, redirect to dashboard
      if (apiError.response?.status === 409) {
        toast.success('You already have a knowledge base. Redirecting to dashboard...');
        setTimeout(() => navigate('/dashboard'), 1500);
      } else {
        toast.error(apiError.response?.data?.error || 'Failed to create knowledge base');
      }
    }

    setLoading(false);
  };

  const renderStep = (): React.JSX.Element | null => {
    switch (currentStep) {
      case 1:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Basic Information</h2>
            <p className="text-gray-600">Let&apos;s start with the basics about you and your practice.</p>

            <div>
              <label htmlFor="twin-name" className="block text-sm font-medium text-gray-700 mb-2">
                Digital Twin Name
              </label>
              <input
                id="twin-name"
                type="text"
                required
                value={formData.name}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('name', e.target.value)}
                placeholder="e.g., Coach John AI"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="profession" className="block text-sm font-medium text-gray-700 mb-2">
                Profession
              </label>
              <input
                id="profession"
                type="text"
                required
                value={formData.profession}
                onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleChange('profession', e.target.value)}
                placeholder="e.g., Life & Business Coach"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>

            <div>
              <label htmlFor="bio" className="block text-sm font-medium text-gray-700 mb-2">
                Bio / About You
              </label>
              <textarea
                id="bio"
                required
                rows={4}
                value={formData.bio}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('bio', e.target.value)}
                placeholder="Tell us about your experience, expertise, and what makes you unique..."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 2:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">AI Configuration</h2>
            <p className="text-gray-600">Choose the AI provider and customize the communication style.</p>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                AI Provider
              </label>
              <select
                value={formData.llmProvider}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('llmProvider', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                <option value="openai">OpenAI (GPT-5)</option>
                <option value="anthropic">Anthropic (Claude)</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Model
              </label>
              <select
                value={formData.llmModel}
                onChange={(e: React.ChangeEvent<HTMLSelectElement>) => handleChange('llmModel', e.target.value)}
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              >
                {formData.llmProvider === 'openai' ? (
                  <>
                    <option value="gpt-5-mini">GPT-5 Mini (default)</option>
                    <option value="gpt-5">GPT-5</option>
                    <option value="gpt-5.1">GPT-5.1</option>
                    <option value="gpt-5.1-mini">GPT-5.1 Mini</option>
                    <option value="gpt-4.1">GPT-4.1</option>
                    <option value="gpt-4o">GPT-4o</option>
                    <option value="gpt-4o-mini">GPT-4o Mini</option>
                    <option value="gpt-4">GPT-4 (legacy)</option>
                    <option value="gpt-3.5-turbo">GPT-3.5 Turbo (legacy)</option>
                  </>
                ) : (
                  <>
                    <option value="claude-3-sonnet-20240229">Claude 3 Sonnet (default)</option>
                    <option value="claude-3-5-sonnet-20241022">Claude 3.5 Sonnet</option>
                    <option value="claude-3-5-haiku-20241022">Claude 3.5 Haiku</option>
                    <option value="claude-3-opus-20240229">Claude 3 Opus</option>
                    <option value="claude-3-haiku-20240307">Claude 3 Haiku (legacy)</option>
                  </>
                )}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Communication Style
              </label>
              <textarea
                required
                rows={3}
                value={formData.communicationStyle}
                onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => handleChange('communicationStyle', e.target.value)}
                placeholder="e.g., Warm, encouraging, and professional. Use active listening and ask clarifying questions."
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
          </div>
        );

      case 3:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Personality Traits</h2>
            <p className="text-gray-600">Select the personality traits for your digital twin.</p>

            <div className="grid grid-cols-2 gap-4">
              {(Object.keys(formData.personalityTraits) as Array<keyof PersonalityTraits>).map((trait) => (
                <label key={trait} className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.personalityTraits[trait]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange('personalityTraits', {
                        ...formData.personalityTraits,
                        [trait]: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-primary-600"
                  />
                  <span className="capitalize font-medium">{trait.replace('_', ' ')}</span>
                </label>
              ))}
            </div>
          </div>
        );

      case 4:
        return (
          <div className="space-y-6">
            <h2 className="text-2xl font-bold">Capabilities</h2>
            <p className="text-gray-600">What should your digital twin be able to do?</p>

            <div className="space-y-3">
              {(Object.keys(formData.capabilities) as Array<keyof Capabilities>).map((capability) => (
                <label key={capability} className="flex items-center space-x-3 p-4 border rounded-lg cursor-pointer hover:bg-gray-50">
                  <input
                    type="checkbox"
                    checked={formData.capabilities[capability]}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                      handleChange('capabilities', {
                        ...formData.capabilities,
                        [capability]: e.target.checked,
                      })
                    }
                    className="w-5 h-5 text-primary-600"
                  />
                  <div>
                    <span className="capitalize font-medium block">
                      {capability.replace(/_/g, ' ')}
                    </span>
                    <span className="text-sm text-gray-600">
                      {capability === 'q_and_a' && 'Answer questions based on your knowledge base'}
                      {capability === 'scheduling' && 'Help visitors schedule appointments'}
                      {capability === 'consultation' && 'Provide consultations and advice'}
                      {capability === 'lead_qualification' && 'Qualify leads before handover'}
                    </span>
                  </div>
                </label>
              ))}
            </div>
          </div>
        );

      default:
        return null;
    }
  };

  // Show loading while checking for existing KB
  if (checking) {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="inline-block animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
          <p className="mt-4 text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50 py-12 px-4">
      <div className="max-w-3xl mx-auto">
        <div className="bg-white rounded-lg shadow-lg p-8">
          {/* Progress bar */}
          <div className="mb-8">
            <div className="flex justify-between mb-2">
              {[1, 2, 3, 4].map((step) => (
                <div
                  key={step}
                  className={`w-10 h-10 rounded-full flex items-center justify-center font-bold ${
                    step <= currentStep
                      ? 'bg-primary-600 text-white'
                      : 'bg-gray-200 text-gray-600'
                  }`}
                >
                  {step}
                </div>
              ))}
            </div>
            <div className="h-2 bg-gray-200 rounded-full">
              <div
                className="h-2 bg-primary-600 rounded-full transition-all duration-300"
                style={{ width: `${(currentStep / 4) * 100}%` }}
              />
            </div>
          </div>

          {/* Step content */}
          {renderStep()}

          {/* Navigation buttons */}
          <div className="flex justify-between mt-8">
            <button
              onClick={prevStep}
              disabled={currentStep === 1}
              className="px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Previous
            </button>

            {currentStep < 4 ? (
              <button
                onClick={nextStep}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700"
              >
                Next
              </button>
            ) : (
              <button
                onClick={handleSubmit}
                disabled={loading}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50"
              >
                {loading ? 'Creating...' : 'Complete Setup'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
