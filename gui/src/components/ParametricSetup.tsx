import { useState, useMemo } from 'react';
import ConfirmModal from './ConfirmModal';
import { Play, Square, LineChart, Trash2, Download } from 'lucide-react';
import Select from './Select';
import { useModelStore } from '../stores/modelStore';
import { useParametricStore, fmt } from '../stores/parametricStore';
import { exportParametricStudyToCsv } from '../utils/csv';
import type { VariableInfo } from '../api/types';

interface SweepInputProps {
  label: string;
  varName: string;
  setVarName: (n: string) => void;
  min: string;
  setMin: (v: string) => void;
  max: string;
  setMax: (v: string) => void;
  steps: string;
  setSteps: (v: string) => void;
  imposedVars: VariableInfo[];
  disabled: boolean;
}

function SweepInput({
  label,
  varName,
  setVarName,
  min,
  setMin,
  max,
  setMax,
  steps,
  setSteps,
  imposedVars,
  disabled,
}: SweepInputProps) {
  const handleVarChange = (name: string) => {
    setVarName(name);
    const info = imposedVars.find((v) => v.name === name);
    if (info?.imposedValue !== undefined) {
      const val = info.imposedValue;
      const delta = val !== 0 ? Math.abs(val) * 0.3 : 1;
      setMin((val - delta).toPrecision(4));
      setMax((val + delta).toPrecision(4));
    }
  };

  return (
    <div className="sweep-input-card">
      <div className="sweep-input-card-title">{label}</div>
      <div className="sweep-input-field">
        <label>Variable</label>
        <Select
          value={varName}
          options={imposedVars.map((v) => ({
            value: v.name,
            label: `${v.name}${v.imposedValue !== undefined ? ` (= ${fmt(v.imposedValue)})` : ''}`,
          }))}
          placeholder="- select variable -"
          onChange={handleVarChange}
          disabled={disabled}
        />
      </div>
      <div className="sweep-range-row">
        <div className="sweep-range-col">
          <label>Min</label>
          <input
            className="sweep-num"
            type="text"
            placeholder="min"
            value={min}
            onChange={(e) => setMin(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="sweep-range-col">
          <label>Max</label>
          <input
            className="sweep-num"
            type="text"
            placeholder="max"
            value={max}
            onChange={(e) => setMax(e.target.value)}
            disabled={disabled}
          />
        </div>
        <div className="sweep-range-col">
          <label>Steps</label>
          <input
            className="sweep-num"
            type="text"
            placeholder="10"
            value={steps}
            onChange={(e) => setSteps(e.target.value)}
            disabled={disabled}
          />
        </div>
      </div>
    </div>
  );
}

export default function ParametricSetup() {
  const parsedVariables = useModelStore((s) => s.parsedVariables);
  const parametricStudies = useModelStore((s) => s.parametricStudies);
  const removeParametricStudy = useModelStore((s) => s.removeParametricStudy);
  const solving = useModelStore((s) => s.solving);
  const [studyToDelete, setStudyToDelete] = useState<{ id: string; name: string } | null>(null);

  const confirmDeleteStudy = () => {
    if (!studyToDelete) return;
    removeParametricStudy(studyToDelete.id);
    setStudyToDelete(null);
  };

  const {
    var1Name, setVar1Name, var1Min, setVar1Min, var1Max, setVar1Max, var1Steps, setVar1Steps,
    var2Name, setVar2Name, var2Min, setVar2Min, var2Max, setVar2Max, var2Steps, setVar2Steps,
    timeout, setTimeoutVal, updateGuesses, setUpdateGuesses,
    running, progress, error,
    runStudy, stopStudy, loadStudy,
  } = useParametricStore();
  const activeStudyId = useModelStore((s) => s.activeStudyId);

  const imposedVars = useMemo(
    () => parsedVariables.filter((v) => v.isImposed),
    [parsedVariables]
  );

  return (
    <div className="parametric-setup-sidebar">
      <div className="explorer-header">
        <div className="explorer-title-group">
          <LineChart size={14} className="accent-icon" />
          <span className="explorer-title">PARAMETRIC SWEEP</span>
        </div>
      </div>

      <div className="parametric-setup-content">
        {imposedVars.length === 0 ? (
          <div className="parametric-notice">
            No imposed variables detected.
            <br />
            Write equations like <code>T_in = 300</code> in your model and parse to enable parametric sweeps.
          </div>
        ) : (
          <>
            <SweepInput
              label="Primary Sweep"
              varName={var1Name}
              setVarName={setVar1Name}
              min={var1Min}
              setMin={setVar1Min}
              max={var1Max}
              setMax={setVar1Max}
              steps={var1Steps}
              setSteps={setVar1Steps}
              imposedVars={imposedVars}
              disabled={running}
            />

            <SweepInput
              label="Secondary Sweep (Optional)"
              varName={var2Name}
              setVarName={setVar2Name}
              min={var2Min}
              setMin={setVar2Min}
              max={var2Max}
              setMax={setVar2Max}
              steps={var2Steps}
              setSteps={setVar2Steps}
              imposedVars={imposedVars}
              disabled={running}
            />

            <div className="parametric-options-card">
              <label className="parametric-option-label" title="Maximum time per solve point in seconds (0 = no limit)">
                <span>Timeout (s):</span>
                <input
                  className="sweep-num-sm"
                  type="text"
                  value={timeout}
                  onChange={(e) => setTimeoutVal(e.target.value)}
                  disabled={running}
                />
              </label>

              <label className="parametric-checkbox-label" title="Each solved point updates initial guesses for the next point, spiraling outward">
                <input
                  type="checkbox"
                  checked={updateGuesses}
                  onChange={(e) => setUpdateGuesses(e.target.checked)}
                  disabled={running}
                />
                <span>Update guesses dynamically</span>
              </label>
            </div>

            <div className="parametric-actions-bar">
              <button
                className="parametric-run-btn"
                disabled={running || solving || !var1Name}
                onClick={runStudy}
              >
                {running ? (
                  <>
                    <span className="spinner" style={{ width: 14, height: 14 }} />
                    Running…
                  </>
                ) : (
                  <>
                    <Play size={13} />
                    Run Study
                  </>
                )}
              </button>

              {running && (
                <button
                  className="parametric-stop-btn"
                  onClick={stopStudy}
                  title="Stop the parametric study"
                >
                  <Square size={12} /> Stop
                </button>
              )}
            </div>

            {running && progress && (
              <div className="parametric-progress-pill">{progress}</div>
            )}
          </>
        )}

        {error && <div className="parametric-error-box">{error}</div>}
        {parametricStudies.length > 0 && (
          <div className="parametric-saved-section">
            <div className="parametric-section-title">Saved Studies ({parametricStudies.length})</div>
            <div className="parametric-saved-list">
              {parametricStudies.map((s) => (
                <div
                  key={s.id}
                  className={`parametric-study-item ${activeStudyId === s.id ? 'active' : ''}`}
                  onClick={() => loadStudy(s)}
                >
                  <div className="study-info">
                    <span className="study-name">{s.name}</span>
                    <span className="study-meta">
                      {s.result.successCount}/{s.result.totalPoints} points converged
                    </span>
                  </div>
                  <div className="study-actions" style={{ display: 'flex', gap: 4 }}>
                    <button
                      className="icon-btn"
                      style={{ width: 22, height: 22 }}
                      onClick={(e) => {
                        e.stopPropagation();
                        exportParametricStudyToCsv(
                          s.sweepVariables,
                          s.result.results,
                          undefined,
                          undefined,
                          s.name
                        );
                      }}
                      title="Export study as CSV"
                    >
                      <Download size={13} />
                    </button>
                    <button
                      className="study-delete-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        setStudyToDelete({ id: s.id, name: s.name });
                      }}
                      title="Delete study"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
      {studyToDelete && (
        <ConfirmModal
          title="Delete Parametric Study"
          message={`Are you sure you want to delete parametric study "${studyToDelete.name}"? This action cannot be undone.`}
          confirmLabel="Delete Study"
          onConfirm={confirmDeleteStudy}
          onCancel={() => setStudyToDelete(null)}
        />
      )}
    </div>
  );
}
