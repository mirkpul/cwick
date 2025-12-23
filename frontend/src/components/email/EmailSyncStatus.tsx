import { useState, useEffect } from 'react';
import { ArrowPathIcon, EnvelopeIcon, CheckCircleIcon, ExclamationCircleIcon } from '@heroicons/react/24/outline';
import { emailAPI } from '../../services/api';
import toast from 'react-hot-toast';
import { formatDistanceToNow } from 'date-fns';

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
  lastSyncStatus?: string;
}

interface EmailSyncStatusProps {
  syncStatus: SyncStatus;
  onSyncComplete?: () => void;
}

const EmailSyncStatus: React.FC<EmailSyncStatusProps> = ({ syncStatus: initialStatus, onSyncComplete }) => {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>(initialStatus);
  const [syncing, setSyncing] = useState<boolean>(false);

  useEffect(() => {
    const fetchSyncStatus = async (): Promise<void> => {
      try {
        const response = await emailAPI.getSyncStatus();
        const status = response.data;

        setSyncStatus(status);

        if (syncing && status.lastSyncStatus === 'success') {
          setSyncing(false);
          toast.success('Email sync completed successfully!');
          if (onSyncComplete) {
            onSyncComplete();
          }
        } else if (syncing && status.lastSyncStatus === 'failed') {
          setSyncing(false);
          toast.error(status.syncStats?.lastSyncError || 'Email sync failed');
        }
      } catch {
        // Silently fail - we'll retry on the next interval
      }
    };

    fetchSyncStatus();

    const interval = setInterval(fetchSyncStatus, syncing ? 2000 : 5000);

    return () => clearInterval(interval);
  }, [syncing, onSyncComplete]);

  const handleManualSync = async (): Promise<void> => {
    try {
      setSyncing(true);
      await emailAPI.triggerSync('incremental');
      toast.success('Email sync started in background');
    } catch (error: unknown) {
      setSyncing(false);
      const errorMsg = (error as { response?: { data?: { error?: string } } })?.response?.data?.error || 'Failed to start sync';
      toast.error(errorMsg);
    }
  };

  if (!syncStatus || !syncStatus.connected) {
    return null;
  }

  const { provider, emailAddress, syncStats } = syncStatus;
  const totalEmails = syncStats?.totalEmails || 0;
  const lastSyncAt = syncStats?.lastSyncAt;
  const lastSyncStatus = syncStats?.lastSyncStatus;

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <div className="flex items-center justify-between">
        {/* Left side: Provider, email, stats */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <EnvelopeIcon className="h-5 w-5 text-gray-600" />
            <div>
              <p className="text-sm font-medium text-gray-900">
                {provider === 'gmail' ? 'Gmail' : provider === 'outlook' ? 'Outlook' : 'IMAP'}
              </p>
              <p className="text-xs text-gray-500">{emailAddress}</p>
            </div>
          </div>

          <div className="border-l border-gray-300 pl-4">
            <p className="text-sm text-gray-600">
              <span className="font-medium text-gray-900">{totalEmails}</span> emails imported
            </p>
          </div>

          {lastSyncAt && (
            <div className="border-l border-gray-300 pl-4">
              <div className="flex items-center gap-1.5">
                {lastSyncStatus === 'success' && (
                  <CheckCircleIcon className="h-4 w-4 text-green-500" />
                )}
                {lastSyncStatus === 'failed' && (
                  <ExclamationCircleIcon className="h-4 w-4 text-red-500" />
                )}
                <p className="text-xs text-gray-500">
                  Last sync: {formatDistanceToNow(new Date(lastSyncAt), { addSuffix: true })}
                </p>
              </div>
            </div>
          )}
        </div>

        {/* Right side: Sync button */}
        <button
          onClick={handleManualSync}
          disabled={syncing}
          className="flex items-center gap-2 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          <ArrowPathIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
          <span className="text-sm font-medium">
            {syncing ? 'Syncing...' : 'Sync Now'}
          </span>
        </button>
      </div>

      {/* Sync in progress indicator */}
      {syncing && (
        <div className="mt-3 pt-3 border-t border-gray-200">
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <div className="animate-spin rounded-full h-4 w-4 border-2 border-primary-600 border-t-transparent"></div>
            <span>Syncing emails in background...</span>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmailSyncStatus;
