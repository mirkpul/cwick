import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

const OAuthCallback = () => {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { login } = useAuth();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const handleOAuthCallback = async () => {
      try {
        // Extract token from URL params
        const token = searchParams.get('token');
        const errorParam = searchParams.get('error');

        if (errorParam) {
          // eslint-disable-next-line no-console
          console.error('OAuth error:', errorParam);
          setError(getErrorMessage(errorParam));
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        if (!token) {
          setError('No authentication token received');
          setTimeout(() => navigate('/login'), 3000);
          return;
        }

        // Decode user info from token
        const payload = JSON.parse(atob(token.split('.')[1]));

        // Login with token and user info
        await login(token, payload);

        // Redirect to dashboard
        navigate('/dashboard');
      } catch (err) {
        // eslint-disable-next-line no-console
        console.error('OAuth callback error:', err);
        setError('Authentication failed. Please try again.');
        setTimeout(() => navigate('/login'), 3000);
      }
    };

    handleOAuthCallback();
  }, [searchParams, login, navigate]);

  const getErrorMessage = (errorCode: string): string => {
    switch (errorCode) {
      case 'oauth_failed':
        return 'OAuth authentication failed';
      case 'no_user':
        return 'Unable to retrieve user information';
      case 'server_error':
        return 'Server error during authentication';
      default:
        return 'Authentication error';
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50">
      <div className="max-w-md w-full space-y-8 p-8">
        {error ? (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-red-100">
              <svg
                className="h-6 w-6 text-red-600"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Authentication Failed
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">{error}</p>
            <p className="mt-2 text-center text-sm text-gray-500">
              Redirecting to login page...
            </p>
          </div>
        ) : (
          <div className="text-center">
            <div className="mx-auto flex items-center justify-center h-12 w-12">
              <svg
                className="animate-spin h-8 w-8 text-indigo-600"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
            </div>
            <h2 className="mt-6 text-center text-3xl font-extrabold text-gray-900">
              Authenticating...
            </h2>
            <p className="mt-2 text-center text-sm text-gray-600">
              Please wait while we complete your authentication
            </p>
          </div>
        )}
      </div>
    </div>
  );
};

export default OAuthCallback;
