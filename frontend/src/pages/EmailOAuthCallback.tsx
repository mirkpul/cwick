import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';

type Status = 'processing' | 'success' | 'error';

export default function EmailOAuthCallback(): React.JSX.Element {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [status, setStatus] = useState<Status>('processing');
  const [message, setMessage] = useState<string>('Processing your email connection...');

  useEffect(() => {
    const handleOAuthCallback = async (): Promise<void> => {
      // Check if this is a popup (opened from OAuth flow)
      const isPopup = window.opener && window.opener !== window;

      // Get URL parameters
      const error = searchParams.get('error');
      const code = searchParams.get('code');
      const provider = searchParams.get('provider'); // gmail or outlook

      // Handle error case
      if (error) {
        const errorDescription = searchParams.get('error_description') || 'OAuth authentication failed';
        setStatus('error');
        setMessage(errorDescription);

        if (isPopup) {
          // Send error to parent window
          window.opener.postMessage({
            type: 'EMAIL_OAUTH_ERROR',
            error: errorDescription
          }, window.location.origin);

          // Close popup after a short delay
          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          // Redirect to dashboard with error
          setTimeout(() => {
            navigate('/dashboard?email_error=' + encodeURIComponent(errorDescription));
          }, 2000);
        }
        return;
      }

      // Handle success case
      if (code && provider) {
        try {
          // The backend OAuth callback handler already exchanged the code for tokens
          // and stored them in the database. We just need to notify the parent window.
          setStatus('success');
          setMessage('Email account connected successfully!');

          if (isPopup) {
            // Send success to parent window
            window.opener.postMessage({
              type: 'EMAIL_OAUTH_SUCCESS',
              provider
            }, window.location.origin);

            // Close popup after a short delay
            setTimeout(() => {
              window.close();
            }, 1500);
          } else {
            // Redirect to dashboard with success
            setTimeout(() => {
              navigate('/dashboard?email_connected=true');
            }, 1500);
          }
        } catch (error) {
          // eslint-disable-next-line no-console
          console.error('OAuth callback processing error:', error);
          setStatus('error');
          setMessage('Failed to complete email connection');

          if (isPopup) {
            window.opener.postMessage({
              type: 'EMAIL_OAUTH_ERROR',
              error: 'Failed to complete email connection'
            }, window.location.origin);

            setTimeout(() => {
              window.close();
            }, 2000);
          } else {
            setTimeout(() => {
              navigate('/dashboard?email_error=' + encodeURIComponent('Failed to complete email connection'));
            }, 2000);
          }
        }
      } else {
        // Missing required parameters
        setStatus('error');
        setMessage('Invalid callback parameters');

        if (isPopup) {
          window.opener.postMessage({
            type: 'EMAIL_OAUTH_ERROR',
            error: 'Invalid callback parameters'
          }, window.location.origin);

          setTimeout(() => {
            window.close();
          }, 2000);
        } else {
          setTimeout(() => {
            navigate('/dashboard?email_error=' + encodeURIComponent('Invalid callback parameters'));
          }, 2000);
        }
      }
    };

    handleOAuthCallback();
  }, [searchParams, navigate]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-lg p-8 max-w-md w-full text-center">
        {status === 'processing' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-primary-600 mx-auto mb-4"></div>
            <h2 className="text-xl font-bold text-gray-900 mb-2">Processing...</h2>
            <p className="text-gray-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircleIcon className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Success!</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-4">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <ExclamationCircleIcon className="h-16 w-16 text-red-500 mx-auto mb-4" />
            <h2 className="text-xl font-bold text-gray-900 mb-2">Error</h2>
            <p className="text-gray-600">{message}</p>
            <p className="text-sm text-gray-500 mt-4">Redirecting...</p>
          </>
        )}
      </div>
    </div>
  );
}
