import { useMemo, useCallback } from 'react';
import { Sigma, RotateCcw } from 'lucide-react';
import { useModelStore } from '../stores/modelStore';
import Select from './Select';
import { SetupShell } from './SetupShell';
import { parseKeyValueText, updateKeyValueLines } from '../utils/conf';
import { resolveIntegralTable } from '../utils/integralTable.ts';
import type { IntegralTableData } from '../api/types';

const INTEGRAL_KEYS = [
  'integralMethod',
  'integralFixedStep',
  'integralMaxSteps',
  'integralRelTol',
  'integralAbsTol',
  'integralMinStep',
  'integralMaxStep',
  'integralRichardson',
  'integralOutputInterval',
];

export default function IntegralSetup() {
  const integralTable = useModelStore((s) => s.integralTable);
  const integralCSV = useModelStore((s) => s.integralCSV);
  const conf = useModelStore((s) => s.conf);
  const setConf = useModelStore((s) => s.setConf);
  const scheduleConfPut = useModelStore((s) => s.scheduleConfPut);

  const confMap = useMemo(() => parseKeyValueText(conf), [conf]);
  const method = confMap.get('integralMethod') || 'RK4';
  const isRK45 = method === 'RK45';

  const setKey = useCallback(
    (key: string, val: string) => {
      setConf(updateKeyValueLines(conf, { [key]: val.trim() || undefined }));
      scheduleConfPut();
    },
    [conf, setConf, scheduleConfPut]
  );

  const resetIntegralConf = useCallback(() => {
    const resets: Record<string, undefined> = {};
    for (const k of INTEGRAL_KEYS) resets[k] = undefined;
    setConf(updateKeyValueLines(conf, resets));
    scheduleConfPut();
  }, [conf, setConf, scheduleConfPut]);

  const table = useMemo<IntegralTableData | null>(
    () => resolveIntegralTable(integralTable, integralCSV),
    [integralTable, integralCSV]
  );

  const rowStyle: React.CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
    fontSize: 12,
  };

  const inputStyle: React.CSSProperties = {
    width: 84,
    padding: '3px 6px',
    fontSize: 12,
    background: 'var(--bg-primary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border-color)',
    borderRadius: 4,
    textAlign: 'right',
  };

  return (
    <SetupShell icon={<Sigma size={14} className="accent-icon" />} title="INTEGRAL TRAJECTORY">
        <div className="parametric-section">
          <div className="parametric-section-title" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span>INTEGRATOR SETTINGS</span>
            <button
              className="icon-btn small"
              onClick={resetIntegralConf}
              title="Reset integrator settings to default"
            >
              <RotateCcw size={11} />
            </button>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
            <div style={rowStyle}>
              <span style={{ color: 'var(--text-secondary)' }}>Method</span>
              <Select
                align="right"
                value={confMap.get('integralMethod') ?? ''}
                onChange={(v) => setKey('integralMethod', v)}
                options={[
                  { value: '', label: 'RK4 (default)' },
                  { value: 'RK45', label: 'RK45 (adaptive)' },
                  { value: 'EulerExplicit', label: 'EulerExplicit' },
                  { value: 'EulerImplicit', label: 'EulerImplicit' },
                ]}
              />
            </div>

            <div style={rowStyle}>
              <span style={{ color: 'var(--text-secondary)' }} title="Number of steps (or RK45 step budget)">Max steps</span>
              <input
                type="text"
                style={inputStyle}
                placeholder="1000"
                value={confMap.get('integralMaxSteps') ?? ''}
                onChange={(e) => setKey('integralMaxSteps', e.target.value)}
              />
            </div>

            <div style={rowStyle}>
              <span style={{ color: 'var(--text-secondary)' }} title="Fixed step size when INTEGRAL() omits 5th argument (0 = auto)">Fixed step</span>
              <input
                type="text"
                style={inputStyle}
                placeholder="0 (auto)"
                value={confMap.get('integralFixedStep') ?? ''}
                onChange={(e) => setKey('integralFixedStep', e.target.value)}
              />
            </div>

            {isRK45 ? (
              <>
                <div style={rowStyle}>
                  <span style={{ color: 'var(--text-secondary)' }}>Rel. tolerance</span>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="1e-6"
                    value={confMap.get('integralRelTol') ?? ''}
                    onChange={(e) => setKey('integralRelTol', e.target.value)}
                  />
                </div>
                <div style={rowStyle}>
                  <span style={{ color: 'var(--text-secondary)' }}>Abs. tolerance</span>
                  <input
                    type="text"
                    style={inputStyle}
                    placeholder="1e-9"
                    value={confMap.get('integralAbsTol') ?? ''}
                    onChange={(e) => setKey('integralAbsTol', e.target.value)}
                  />
                </div>
                <div style={rowStyle}>
                  <span style={{ color: 'var(--text-secondary)' }}>Min / Max step</span>
                  <div style={{ display: 'flex', gap: 4 }}>
                    <input
                      type="text"
                      style={{ ...inputStyle, width: 40 }}
                      placeholder="min"
                      title="Minimum step size (0 = auto)"
                      value={confMap.get('integralMinStep') ?? ''}
                      onChange={(e) => setKey('integralMinStep', e.target.value)}
                    />
                    <input
                      type="text"
                      style={{ ...inputStyle, width: 40 }}
                      placeholder="max"
                      title="Maximum step size (0 = auto)"
                      value={confMap.get('integralMaxStep') ?? ''}
                      onChange={(e) => setKey('integralMaxStep', e.target.value)}
                    />
                  </div>
                </div>
              </>
            ) : (
              <div style={rowStyle}>
                <span style={{ color: 'var(--text-secondary)' }} title="Richardson extrapolation (fixed-step error reduction)">Richardson</span>
                <input
                  type="checkbox"
                  checked={confMap.get('integralRichardson') === 'true'}
                  onChange={(e) => setKey('integralRichardson', e.target.checked ? 'true' : '')}
                />
              </div>
            )}

            <div style={rowStyle}>
              <span style={{ color: 'var(--text-secondary)' }} title="Default $IntegralTable row interval (0 = every step)">Output interval</span>
              <input
                type="text"
                style={inputStyle}
                placeholder="0 (all)"
                value={confMap.get('integralOutputInterval') ?? ''}
                onChange={(e) => setKey('integralOutputInterval', e.target.value)}
              />
            </div>
          </div>
        </div>

        <div className="parametric-section">
          <div className="parametric-section-title">TRAJECTORY STATUS</div>
          {table ? (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Variable:</span>
                <code>{table.integrationVar}</code>
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                <span style={{ color: 'var(--text-muted)' }}>Points:</span>
                <span>{table.numRows} rows</span>
              </div>
              {table.totalSteps !== undefined && (
                <div style={{ fontSize: 12, color: 'var(--text-primary)', display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: 'var(--text-muted)' }}>Steps:</span>
                  <span>{table.totalSteps} steps</span>
                </div>
              )}
              {table.rejectedSteps !== undefined && table.rejectedSteps > 0 && (
                <div style={{ fontSize: 12, color: '#f87171', display: 'flex', justifyContent: 'space-between' }}>
                  <span>Rejected:</span>
                  <span>{table.rejectedSteps}</span>
                </div>
              )}
            </div>
          ) : (
            <div className="parametric-notice">
              No integral trajectory computed yet. Run a model with dynamic integration equations to populate this view.
            </div>
          )}
        </div>

        {table && (
          <div className="parametric-section">
            <div className="parametric-section-title">
              RECORDED VARIABLES ({table.columns.length})
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {table.columns.map((col) => (
                <span
                  key={col}
                  style={{
                    fontSize: 11,
                    padding: '2px 6px',
                    borderRadius: 3,
                    background: col === table.integrationVar ? 'var(--accent, #3b82f6)' : 'var(--bg-elevated, #1e1e2e)',
                    color: col === table.integrationVar ? '#fff' : 'var(--text-primary)',
                    border: '1px solid var(--border, #2a2a3a)',
                  }}
                >
                  {col}
                </span>
              ))}
            </div>
          </div>
        )}
    </SetupShell>
  );
}
