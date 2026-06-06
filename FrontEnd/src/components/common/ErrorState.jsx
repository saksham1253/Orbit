import { AlertCircle, RefreshCw } from 'lucide-react';

/**
 * ErrorState — shown when a React Query fetch fails.
 *
 * @param {string}   message  Custom message (optional)
 * @param {Function} onRetry  Called when the user clicks "Retry"
 */
const ErrorState = ({ message = 'Failed to load data.', onRetry }) => (
  <div
    className="flex flex-col items-center justify-center py-16 rounded-2xl text-center"
    style={{
      background: 'rgba(255,75,75,0.03)',
      border: '1px dashed rgba(255,75,75,0.2)',
    }}
    role="alert"
  >
    <div
      className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-4"
      style={{
        background: 'rgba(255,75,75,0.1)',
        border: '1px solid rgba(255,75,75,0.25)',
      }}
    >
      <AlertCircle size={22} style={{ color: '#ff4b4b' }} />
    </div>

    <h3 className="text-base font-semibold text-white mb-1">Oops!</h3>
    <p className="text-white/40 text-sm mb-5 max-w-xs">{message}</p>

    {onRetry && (
      <button
        onClick={onRetry}
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all"
        style={{
          background: 'rgba(255,75,75,0.1)',
          border: '1px solid rgba(255,75,75,0.3)',
          color: '#ff4b4b',
        }}
      >
        <RefreshCw size={14} />
        Retry
      </button>
    )}
  </div>
);

export default ErrorState;
