import { Code2, LineChart, Table2, Sigma } from 'lucide-react';
import ThermoDiagramIcon from './ThermoDiagramIcon';
import { useUIStore } from '../stores/uiStore';

export default function ActivityBar() {
  const activityMode = useUIStore((s) => s.activityMode);
  const setActivityMode = useUIStore((s) => s.setActivityMode);

  return (
    <div className="activity-bar">
      <div className="activity-bar-top">
        <button
          className={`activity-bar-btn ${activityMode === 'code' ? 'active' : ''}`}
          onClick={() => setActivityMode('code')}
          title="Code Editor"
          aria-label="Code Editor"
        >
          <Code2 size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'parametric' ? 'active' : ''}`}
          onClick={() => setActivityMode('parametric')}
          title="Parametric Sweep Study"
          aria-label="Parametric Sweep Study"
        >
          <LineChart size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'diagrams' ? 'active' : ''}`}
          onClick={() => setActivityMode('diagrams')}
          title="Thermodynamic Property Diagrams (T-s, P-h, h-s)"
          aria-label="Thermodynamic Diagrams"
        >
          <ThermoDiagramIcon size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'tables' ? 'active' : ''}`}
          onClick={() => setActivityMode('tables')}
          title="Lookup Tables (CSV Data & Interpolation)"
          aria-label="Lookup Tables"
        >
          <Table2 size={20} />
        </button>
        <button
          className={`activity-bar-btn ${activityMode === 'integral' ? 'active' : ''}`}
          onClick={() => setActivityMode('integral')}
          title="Integral Trajectory ($IntegralTable)"
          aria-label="Integral Trajectory"
        >
          <Sigma size={20} />
        </button>
      </div>
    </div>
  );
}
