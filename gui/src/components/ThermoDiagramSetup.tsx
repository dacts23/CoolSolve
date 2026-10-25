import { useEffect, useMemo } from 'react';
import { Play, Loader2 } from 'lucide-react';
import ThermoDiagramIcon from './ThermoDiagramIcon';
import Select, { type SelectOption } from './Select';
import { extractArrayColumns } from '../utils/arrayData';
import { useDiagramStore, type DiagramType, DIAGRAM_TYPE_OPTIONS } from '../stores/diagramStore';
import { useModelStore } from '../stores/modelStore';
import { api } from '../api/client';

export default function ThermoDiagramSetup() {
  const lastResult = useModelStore((s) => s.lastResult);

  const {
    fluids,
    modelFluids,
    selectedFluid,
    diagramType,
    satData,
    loading,
    error,
    computeTime,
    showStates,
    showArrayOverlay,
    arrayXVar,
    arrayYVar,
    closeCycle,
    setSelectedFluid,
    setDiagramType,
    setShowStates,
    setShowArrayOverlay,
    setArrayXVar,
    setArrayYVar,
    setCloseCycle,
    setInferredVars,
    generate,
    initFluids,
  } = useDiagramStore();

  useEffect(() => {
    initFluids();
  }, [initFluids]);
  useEffect(() => {
    if (lastResult?.success) {
      api.getInferredVariables().then((res) => {
        setInferredVars(res.variables);
      }).catch(() => {});
    }
  }, [lastResult, setInferredVars]);
  const arrayColumns = useMemo(
    () => extractArrayColumns(lastResult?.variables),
    [lastResult]
  );

  const arrayColOptions = useMemo(() => {
    return [...arrayColumns.keys()].sort().map((base) => ({
      value: base,
      label: `${base} (${arrayColumns.get(base)!.length} pts)`,
    }));
  }, [arrayColumns]);

  const sortedFluids = useMemo(() => {
    const withDome = fluids.filter((f) => f.hasDome);
    const model = withDome.filter((f) => modelFluids.includes(f.name));
    const other = withDome.filter((f) => !modelFluids.includes(f.name));
    return [...model, ...other];
  }, [fluids, modelFluids]);

  const fluidOptions: SelectOption[] = useMemo(() => {
    const list: SelectOption[] = [];
    if (modelFluids.length > 0) {
      list.push({
        group: 'Model fluids',
        options: sortedFluids.filter((f) => modelFluids.includes(f.name)).map((f) => f.name),
      });
    }
    list.push({
      group: 'All fluids',
      options: sortedFluids.filter((f) => !modelFluids.includes(f.name)).map((f) => f.name),
    });
    return list;
  }, [modelFluids, sortedFluids]);

  return (
    <div className="parametric-setup-sidebar">
      <div className="explorer-header">
        <div className="explorer-title-group">
          <ThermoDiagramIcon size={14} className="accent-icon" />
          <span className="explorer-title">PROPERTY DIAGRAMS</span>
        </div>
      </div>

      <div className="parametric-setup-content">
        <div className="parametric-section">
          <div className="parametric-section-title">WORKING FLUID</div>
          <Select
            value={selectedFluid}
            options={fluidOptions}
            onChange={setSelectedFluid}
            placeholder="Select fluid..."
            style={{ width: '100%' }}
          />
        </div>
        <div className="parametric-section">
          <div className="parametric-section-title">PARAMETER PAIR</div>
          <Select
            value={diagramType}
            options={DIAGRAM_TYPE_OPTIONS}
            onChange={(val) => setDiagramType(val as DiagramType)}
            placeholder="Select parameter pair..."
            style={{ width: '100%' }}
          />
        </div>
        <div className="parametric-actions-bar">
          <button
            className="parametric-run-btn"
            onClick={generate}
            disabled={loading || !selectedFluid}
          >
            {loading ? <Loader2 size={13} className="spin" /> : <Play size={13} />}
            <span>{loading ? 'Computing dome…' : 'Generate Diagram'}</span>
          </button>
          {computeTime !== null && (
            <span
              style={{
                fontSize: 11,
                color: 'var(--text-muted)',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                padding: '3px 7px',
                borderRadius: 4,
                background: 'var(--bg-tertiary)',
                fontFamily: 'var(--mono-font)',
              }}
              title="Dome computation time"
            >
              {computeTime.toFixed(0)} ms
            </span>
          )}
        </div>
        {satData && lastResult?.success && (
          <div className="parametric-section" style={{ borderTop: '1px solid var(--border-color)', paddingTop: 10 }}>
            <div className="parametric-section-title">STATE OVERLAYS</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 12 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showStates}
                  onChange={(e) => setShowStates(e.target.checked)}
                />
                <span>Solved State Points</span>
              </label>

              <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={showArrayOverlay}
                  onChange={(e) => setShowArrayOverlay(e.target.checked)}
                />
                <span>Array Cycle Overlay</span>
              </label>

              {showArrayOverlay && arrayColumns.size > 0 && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingLeft: 18, marginTop: 4 }}>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>X variable:</span>
                    <Select
                      value={arrayXVar}
                      options={arrayColOptions}
                      placeholder="X column..."
                      onChange={setArrayXVar}
                      style={{ width: '100%', marginTop: 2 }}
                    />
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>Y variable:</span>
                    <Select
                      value={arrayYVar}
                      options={arrayColOptions}
                      placeholder="Y column..."
                      onChange={setArrayYVar}
                      style={{ width: '100%', marginTop: 2 }}
                    />
                  </div>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer', marginTop: 2 }}>
                    <input
                      type="checkbox"
                      checked={closeCycle}
                      onChange={(e) => setCloseCycle(e.target.checked)}
                    />
                    <span>Close cycle loop</span>
                  </label>
                </div>
              )}
            </div>
          </div>
        )}
        {error && (
          <div className="parametric-error-box">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}
