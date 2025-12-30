import { useState } from 'react';
import { EnvelopeIcon, ShieldCheckIcon, TrashIcon } from '@heroicons/react/24/outline';
import { emailAPI } from '../../services/api';
import toast from 'react-hot-toast';

interface SyncStats {
  totalEmails?: number;
  lastSyncAt?: string;
  lastSyncStatus?: string;
  lastSyncError?: string;
}

interface SyncStatus {
  connected: boolean;
  provider?: string;
  emailAddress?: string;
  autoSync?: boolean;
  syncStats?: SyncStats;
}

interface EmailSettingsProps {
  syncStatus: SyncStatus;
  onDisconnect?: () => void;
}

const EmailSettings: React.FC<EmailSettingsProps> = ({ syncStatus, onDisconnect }) => {
  const [autoSyncEnabled, setAutoSyncEnabled] = useState<boolean>(syncStatus?.autoSync || false);
  const [disconnecting, setDisconnecting] = useState<boolean>(false);

  const handleToggleAutoSync = async (enabled: boolean): Promise<void> => {
    try {
      await emailAPI.toggleAutoSync(enabled);
      setAutoSyncEnabled(enabled);
      toast.success(`Auto-sync ${enabled ? 'enabled' : 'disabled'}`);
    } catch {
      toast.error('Failed to update auto-sync setting');
    }
  };

  const handleDisconnect = async (): Promise<void> => {
    if (!confirm(
      'Are you sure you want to disconnect your email account? This will delete all imported emails from your knowledge base. This action cannot be undone.'
    )) {
      return;
    }

    try {
      setDisconnecting(true);
      await emailAPI.disconnectEmail();
      toast.success('Email account disconnected successfully');
      if (onDisconnect) {
        onDisconnect();
      }
    } catch {
      toast.error('Failed to disconnect email account');
    } finally {
      setDisconnecting(false);
    }
  };

  if (!syncStatus || !syncStatus.connected) {
    return null;
  }

  const { provider, emailAddress } = syncStatus;

  return (
    <div className="bg-white rounded-lg shadow">
      {/* Header */}
      <div className="p-6 border-b border-gray-200">
        <h2 className="text-xl font-bold text-gray-900">Email Settings</h2>
      </div>

      <div className="p-6 space-y-6">
        {/* Connection Info */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Connected Account</h3>
          <div className="flex items-center gap-3 p-4 bg-gray-50 rounded-lg">
            <EnvelopeIcon className="h-6 w-6 text-primary-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'IMAP'}
              </p>
              <p className="text-sm text-gray-600">{emailAddress}</p>
            </div>
          </div>
        </div>

        {/* Auto-Sync Setting */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Automatic Sync</h3>
          <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
            <div className="flex-1">
              <p className="text-sm font-medium text-gray-900">Enable Auto-Sync</p>
              <p className="text-xs text-gray-600 mt-1">
                Automatically sync new emails every hour
              </p>
            </div>
            <button
              onClick={() => handleToggleAutoSync(!autoSyncEnabled)}
              className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2 ${
                autoSyncEnabled ? 'bg-primary-600' : 'bg-gray-200'
              }`}
              role="switch"
              aria-checked={autoSyncEnabled}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                  autoSyncEnabled ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </div>

        {/* Privacy Information */}
        <div>
          <h3 className="text-sm font-medium text-gray-900 mb-3">Privacy & Data</h3>
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg space-y-2">
            <div className="flex items-start gap-2">
              <ShieldCheckIcon className="h-5 w-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">Your data is secure</p>
                <ul className="text-xs text-blue-800 mt-2 space-y-1 list-disc list-inside">
                  <li>Emails are encrypted at rest in our database</li>
                  <li>Only you can access your imported emails</li>
                  <li>Email content is used exclusively for your knowledge base</li>
                  <li>We never share your email data with third parties</li>
                  <li>Disconnecting will permanently delete all imported emails</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Disconnect Button */}
        <div className="pt-4 border-t border-gray-200">
          <button
            onClick={handleDisconnect}
            disabled={disconnecting}
            className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <TrashIcon className="h-5 w-5" />
            <span className="font-medium">
              {disconnecting ? 'Disconnecting...' : 'Disconnect Email Account'}
            </span>
          </button>
          <p className="text-xs text-gray-500 text-center mt-2">
            This will delete all imported emails from your knowledge base
          </p>
        </div>
      </div>
    </div>
  );
};

export default EmailSettings;
