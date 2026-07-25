import { useApp } from '../../store/AppContext';

export default function Notification() {
  const { notification } = useApp();

  if (!notification) return null;

  const colors = {
    success: 'border-green-400/50 text-green-300 bg-green-900/20',
    error:   'border-red-400/50 text-red-300 bg-red-900/20',
    info:    'border-cyan-400/50 text-cyan-300 bg-cyan-900/10',
    warning: 'border-orange-400/50 text-orange-300 bg-orange-900/20',
  };

  const icons = { success: '✓', error: '✗', info: 'ℹ', warning: '⚠' };

  return (
    <div className="fixed bottom-6 right-6 z-50 pointer-events-none">
      <div
        className={`
          flex items-center gap-3 px-4 py-3 rounded-lg border
          backdrop-blur-md shadow-lg max-w-sm
          ${colors[notification.type] || colors.info}
          animate-[fadeIn_0.3s_ease]
        `}
        style={{
          fontFamily: 'Share Tech Mono',
          fontSize: '0.8rem',
          minWidth: '260px',
        }}
      >
        <span className="text-lg flex-shrink-0">{icons[notification.type] || 'ℹ'}</span>
        <span>{notification.message}</span>
      </div>
    </div>
  );
}
