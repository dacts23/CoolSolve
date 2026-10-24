import { Code2, LineChart, Table2, Sigma } from 'lucide-react';
import ThermoDiagramIcon from './ThermoDiagramIcon';
import { useUIStore, type ActivityMode } from '../stores/uiStore';

export default function ActivityBar() {
  const activityMode = useUIStore((s) => s.activityMode);
  const leftPanelOpen = useUIStore((s) => s.leftPanelOpen);
  const setActivityMode = useUIStore((s) => s.setActivityMode);
  const toggleLeftPanel = useUIStore((s) => s.toggleLeftPanel);

  const handleClick = (mode: ActivityMode) => {
    if (activityMode === mode) {
      toggleLeftPanel();
    } else {
      setActivityMode(mode);
    }
  };

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <button
          className={`activity-bar-btn ${activityMode === 'code' && leftPanelOpen ? 'active' : ''}`}
          onClick={() => handleClick('code')}
          title="Code & Workspace Explorer"
          aria-label="Code and Workspace Explorer"
        >
          <Code2 size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'parametric' && leftPanelOpen ? 'active' : ''}`}
          onClick={() => handleClick('parametric')}
          title="Parametric Sweep Study"
          aria-label="Parametric Sweep Study"
        >
          <LineChart size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'diagrams' && leftPanelOpen ? 'active' : ''}`}
          onClick={() => handleClick('diagrams')}
          title="Thermodynamic Property Diagrams (T-s, P-h, h-s)"
          aria-label="Thermodynamic Diagrams"
        >
          <ThermoDiagramIcon size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'tables' && leftPanelOpen ? 'active' : ''}`}
          onClick={() => handleClick('tables')}
          title="Lookup Tables (CSV Data & Interpolation)"
          aria-label="Lookup Tables"
        >
          <Table2 size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'integral' && leftPanelOpen ? 'active' : ''}`}
          onClick={() => handleClick('integral')}
          title="Integral Trajectory ($IntegralTable)"
          aria-label="Integral Trajectory"
        >
          <Sigma size={20} />
        </button>
      </div>
    </div>
  );
}
