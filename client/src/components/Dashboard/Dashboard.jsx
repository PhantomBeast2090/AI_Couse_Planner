import { useEffect } from 'react';
import { useApp } from '../../store/AppContext';
import Sidebar from './Sidebar';
import Header from './Header';
import DashboardHome from '../DashboardHome/DashboardHome';
import CourseManager from '../CourseInput/CourseManager';
import GraphView from '../GraphView/GraphView';
import AlgorithmViz from '../AlgorithmViz/AlgorithmViz';
import SemesterTimeline from '../SemesterTimeline/SemesterTimeline';
import ComparisonMode from '../ComparisonMode/ComparisonMode';
import WhatIfSimulator from '../WhatIfSimulator/WhatIfSimulator';
import AgentPlanner from '../AgentPlanner/AgentPlanner';

const TABS = {
  dashboard: DashboardHome,
  courses: CourseManager,
  graph: GraphView,
  algorithm: AlgorithmViz,
  timeline: SemesterTimeline,
  compare: ComparisonMode,
  whatif: WhatIfSimulator,
  agent: AgentPlanner,
};

export default function Dashboard() {
  const { activeTab, loadSample, coursesLoaded, refreshGraph } = useApp();

  useEffect(() => {
    // Auto-load sample dataset on first launch
    if (!coursesLoaded) {
      loadSample().then(() => refreshGraph());
    }
  }, [coursesLoaded, loadSample, refreshGraph]);

  const ActiveComponent = TABS[activeTab] || DashboardHome;

  return (
    <div className="relative z-10 flex h-screen overflow-hidden">
      <Sidebar />
      <div className="flex flex-col flex-1 overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">
          <ActiveComponent />
        </main>
      </div>
    </div>
  );
}
