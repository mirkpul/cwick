/**
 * Centralized API error handling utility
 */

interface ApiErrorResponse {
  error?: string;
  errors?: Array<{ msg: string }>;
  message?: string;
}

/**
 * Extract error message from API response
 */
export const getErrorMessage = (error: unknown): string => {
  if (!error) {
    return 'An unexpected error occurred';
  }

  // Handle axios error
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as { response?: { data?: ApiErrorResponse } };
    const data = axiosError.response?.data;

    if (data) {
      // Check for single error message
      if (data.error) return data.error;
      if (data.message) return data.message;

      // Check for validation errors array
      if (data.errors && Array.isArray(data.errors) && data.errors.length > 0) {
        return data.errors.map((err) => err.msg).join(', ');
      }
    }
  }

  // Handle Error instance
  if (error instanceof Error) {
    return error.message;
  }

  // Handle string error
  if (typeof error === 'string') {
    return error;
  }

  return 'An unexpected error occurred';
};

/**
 * Check if error is an authentication error (401/403)
 */
export const isAuthError = (error: unknown): boolean => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as { response?: { status?: number } };
    return axiosError.response?.status === 401 || axiosError.response?.status === 403;
  }
  return false;
};

/**
 * Check if error is a validation error (400)
 */
export const isValidationError = (error: unknown): boolean => {
  if (typeof error === 'object' && error !== null && 'response' in error) {
    const axiosError = error as { response?: { status?: number } };
    return axiosError.response?.status === 400;
  }
  return false;
};
