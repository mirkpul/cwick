import { useState, useCallback, FormEvent, ChangeEvent } from 'react';
import toast from 'react-hot-toast';
import { showErrorToast } from '../components/ErrorToast';
import { getErrorMessage } from '../utils/apiErrors';

// eslint-disable-next-line @typescript-eslint/no-explicit-any
interface UseAuthFormOptions<T, R = any> {
  initialValues: T;
  toastId: string;
  validate?: (values: T) => string | null;
  onSubmit: (values: T) => Promise<{ success: boolean; error?: string } & R>;
  onSuccess?: (result: R) => void;
}

/**
 * Custom hook for authentication forms (login/register)
 * Handles form state, validation, submission, loading, and error states
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAuthForm = <T extends Record<string, string>, R = any>({
  initialValues,
  toastId,
  validate,
  onSubmit,
  onSuccess,
}: UseAuthFormOptions<T, R>) => {
  const [formData, setFormData] = useState<T>(initialValues);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleChange = useCallback((e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  }, []);

  const clearError = useCallback(() => {
    setError(null);
    toast.dismiss(toastId);
  }, [toastId]);

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      setError(null);
      toast.dismiss(toastId);

      // Run validation if provided
      if (validate) {
        const validationError = validate(formData);
        if (validationError) {
          setError(validationError);
          showErrorToast(validationError, toastId);
          return;
        }
      }

      setLoading(true);

      try {
        const result = await onSubmit(formData);

        if (result.success) {
          setError(null);
          onSuccess?.(result);
        } else {
          const errorMsg = result.error || 'Operation failed. Please try again.';
          setError(errorMsg);
          showErrorToast(errorMsg, toastId);
        }
      } catch (err) {
        const errorMsg = getErrorMessage(err);
        setError(errorMsg);
        showErrorToast(errorMsg, toastId);
      } finally {
        setLoading(false);
      }
    },
    [formData, toastId, validate, onSubmit, onSuccess]
  );

  return {
    formData,
    loading,
    error,
    handleChange,
    handleSubmit,
    clearError,
    setFormData,
  };
};
