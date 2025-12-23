import { useState, useEffect } from 'react';
import { EnvelopeIcon, ServerIcon } from '@heroicons/react/24/outline';
import { emailAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface EmailConnectionCardProps {
  onConnectionSuccess: () => void;
}

interface ImapData {
  emailAddress: string;
  host: string;
  port: string;
  password: string;
}

const EmailConnectionCard: React.FC<EmailConnectionCardProps> = ({ onConnectionSuccess }) => {
  const [connecting, setConnecting] = useState<boolean>(false);
  const [showImapForm, setShowImapForm] = useState<boolean>(false);
  const [imapData, setImapData] = useState<ImapData>({
    emailAddress: '',
    host: '',
    port: '993',
    password: ''
  });

  useEffect(() => {
    const handleOAuthCallback = (event: MessageEvent): void => {
      if (event.origin !== window.location.origin) {
        return;
      }

      if (event.data.type === 'EMAIL_OAUTH_SUCCESS') {
        setConnecting(false);
        toast.success('Email account connected successfully!');
        onConnectionSuccess();
      } else if (event.data.type === 'EMAIL_OAUTH_ERROR') {
        setConnecting(false);
        toast.error(event.data.error || 'OAuth connection failed');
      }
    };

    window.addEventListener('message', handleOAuthCallback);
    return () => window.removeEventListener('message', handleOAuthCallback);
  }, [onConnectionSuccess]);

  const handleOAuthConnect = async (provider: 'gmail' | 'outlook'): Promise<void> => {
    try {
      setConnecting(true);

      const response = provider === 'gmail'
        ? await emailAPI.getGmailAuthUrl()
        : await emailAPI.getOutlookAuthUrl();

      const authUrl = response.data.authUrl;

      const width = 600;
      const height = 700;
      const left = window.screenX + (window.outerWidth - width) / 2;
      const top = window.screenY + (window.outerHeight - height) / 2;

      const popup = window.open(
        authUrl,
        'oauth_popup',
        `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes`
      );

      if (!popup) {
        setConnecting(false);
        toast.error('Popup blocked. Please allow popups for this site, or use IMAP connection below.');
        return;
      }
    } catch (error: unknown) {
      setConnecting(false);
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to start OAuth flow';
      toast.error(errorMsg);
    }
  };

  const handleImapSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();

    if (!imapData.emailAddress || !imapData.host || !imapData.port || !imapData.password) {
      toast.error('Please fill in all fields');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(imapData.emailAddress)) {
      toast.error('Please enter a valid email address');
      return;
    }

    try {
      setConnecting(true);
      await emailAPI.storeImapCredentials({
        user: imapData.emailAddress,
        host: imapData.host,
        port: parseInt(imapData.port),
        password: imapData.password
      });

      toast.success('IMAP connection successful!');
      setShowImapForm(false);
      setImapData({ emailAddress: '', host: '', port: '993', password: '' });
      onConnectionSuccess();
    } catch (error: unknown) {
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'IMAP connection failed';
      toast.error(errorMsg);
    } finally {
      setConnecting(false);
    }
  };

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-gray-900 mb-2">
          Connect Your Email Account
        </h2>
        <p className="text-gray-600">
          Import emails from your inbox to enhance your knowledge base with context from your communications.
        </p>
      </div>

      {/* Privacy Notice */}
      <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
        <p className="text-sm text-blue-900">
          <strong>Privacy Notice:</strong> We will import emails from your inbox to enhance your knowledge base.
          Your email content is encrypted and only accessible to you.
          You can disconnect at any time to delete all imported emails.
        </p>
      </div>

      {!showImapForm ? (
        <>
          {/* OAuth Buttons */}
          <div className="space-y-3 mb-6">
            <button
              onClick={() => handleOAuthConnect('gmail')}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <EnvelopeIcon className="h-5 w-5 text-red-500" />
              <span className="font-medium">
                {connecting ? 'Connecting...' : 'Connect Gmail'}
              </span>
            </button>

            <button
              onClick={() => handleOAuthConnect('outlook')}
              disabled={connecting}
              className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <EnvelopeIcon className="h-5 w-5 text-blue-500" />
              <span className="font-medium">
                {connecting ? 'Connecting...' : 'Connect Outlook'}
              </span>
            </button>
          </div>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-gray-300"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-white text-gray-500">Or use IMAP</span>
            </div>
          </div>

          {/* IMAP Toggle Button */}
          <button
            onClick={() => setShowImapForm(true)}
            disabled={connecting}
            className="w-full flex items-center justify-center gap-3 px-6 py-3 bg-white border-2 border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 hover:border-gray-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <ServerIcon className="h-5 w-5 text-gray-600" />
            <span className="font-medium">Connect via IMAP</span>
          </button>
        </>
      ) : (
        <>
          {/* IMAP Form */}
          <form onSubmit={handleImapSubmit} className="space-y-4">
            <div>
              <label htmlFor="email" className="block text-sm font-medium text-gray-700 mb-1">
                Email Address
              </label>
              <input
                type="email"
                id="email"
                value={imapData.emailAddress}
                onChange={(e) => setImapData({ ...imapData, emailAddress: e.target.value })}
                placeholder="you@example.com"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="md:col-span-2">
                <label htmlFor="host" className="block text-sm font-medium text-gray-700 mb-1">
                  IMAP Server
                </label>
                <input
                  type="text"
                  id="host"
                  value={imapData.host}
                  onChange={(e) => setImapData({ ...imapData, host: e.target.value })}
                  placeholder="imap.gmail.com"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>

              <div>
                <label htmlFor="port" className="block text-sm font-medium text-gray-700 mb-1">
                  Port
                </label>
                <input
                  type="number"
                  id="port"
                  value={imapData.port}
                  onChange={(e) => setImapData({ ...imapData, port: e.target.value })}
                  placeholder="993"
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                  required
                />
              </div>
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-1">
                Password
              </label>
              <input
                type="password"
                id="password"
                value={imapData.password}
                onChange={(e) => setImapData({ ...imapData, password: e.target.value })}
                placeholder="Your email password"
                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                required
              />
            </div>

            {/* Help Text */}
            <div className="p-3 bg-gray-50 rounded-lg">
              <p className="text-xs text-gray-600">
                <strong>Common IMAP settings:</strong><br />
                Gmail: imap.gmail.com:993 (use app password)<br />
                Outlook/Hotmail: outlook.office365.com:993<br />
                Yahoo: imap.mail.yahoo.com:993
              </p>
            </div>

            {/* Form Buttons */}
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => {
                  setShowImapForm(false);
                  setImapData({ emailAddress: '', host: '', port: '993', password: '' });
                }}
                className="flex-1 px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50"
                disabled={connecting}
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={connecting}
                className="flex-1 px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {connecting ? 'Connecting...' : 'Connect'}
              </button>
            </div>
          </form>
        </>
      )}
    </div>
  );
};

export default EmailConnectionCard;
