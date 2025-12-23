import toast, { Toast } from 'react-hot-toast';
import { ExclamationCircleIcon } from '@heroicons/react/24/outline';

export const showErrorToast = (message: string, id = 'error-toast'): void => {
  toast.custom((t: Toast) => (
    <div className={`${t.visible ? 'animate-enter' : 'animate-leave'} max-w-md w-full bg-red-600 shadow-lg rounded-lg pointer-events-auto flex ring-1 ring-black ring-opacity-5`}>
      <div className="flex-1 w-0 p-4">
        <div className="flex items-start">
          <div className="flex-shrink-0 pt-0.5">
            <ExclamationCircleIcon className="h-6 w-6 text-white" />
          </div>
          <div className="ml-3 flex-1">
            <p className="text-sm font-semibold text-white">Error</p>
            <p className="mt-1 text-sm text-white">{message}</p>
          </div>
        </div>
      </div>
      <div className="flex border-l border-red-700">
        <button
          onClick={() => toast.dismiss(t.id)}
          className="w-full border border-transparent rounded-none rounded-r-lg p-4 flex items-center justify-center text-sm font-medium text-white hover:bg-red-700 focus:outline-none"
          aria-label="Close"
        >
          ✕
        </button>
      </div>
    </div>
  ), {
    duration: 300000,
    id: id,
  });
};
