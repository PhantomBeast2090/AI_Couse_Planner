import { AppProvider } from './store/AppContext';
import Dashboard from './components/Dashboard/Dashboard';
import Notification from './components/shared/Notification';

export default function App() {
  return (
    <AppProvider>
      <div className="relative min-h-screen" style={{ background: '#000810' }}>
        {/* TRON animated grid background */}
        <div className="tron-bg" />
        {/* Ambient scan line */}
        <div className="scan-line" />
        {/* Main app */}
        <Dashboard />
        {/* Global toast notifications */}
        <Notification />
      </div>
    </AppProvider>
  );
}
