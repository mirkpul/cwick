import { useState, useCallback } from 'react';
import { getErrorMessage } from '../utils/apiErrors';

interface AsyncOperationState {
  loading: boolean;
  error: string | null;
}

/**
 * Custom hook for handling async operations with loading and error states
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const useAsyncOperation = <T extends any[], R>(
  operation: (...args: T) => Promise<R>
) => {
  const [state, setState] = useState<AsyncOperationState>({
    loading: false,
    error: null,
  });

  const execute = useCallback(
    async (...args: T): Promise<{ success: boolean; data?: R; error?: string }> => {
      setState({ loading: true, error: null });

      try {
        const result = await operation(...args);
        setState({ loading: false, error: null });
        return { success: true, data: result };
      } catch (err) {
        const errorMessage = getErrorMessage(err);
        setState({ loading: false, error: errorMessage });
        return { success: false, error: errorMessage };
      }
    },
    [operation]
  );

  const clearError = useCallback(() => {
    setState((prev) => ({ ...prev, error: null }));
  }, []);

  return {
    loading: state.loading,
    error: state.error,
    execute,
    clearError,
  };
};
