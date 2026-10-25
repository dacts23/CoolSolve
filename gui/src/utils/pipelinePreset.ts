/**
 * pipelinePreset.ts - solver-pipeline presets and preset detection for coolsolve.conf.
 * Shared by the Config editor UI and unit tests.
 */
// ---------------------------------------------------------------------------
// Pipeline presets — each preset sets both solverPipeline and pipelineMode.
// ---------------------------------------------------------------------------
export const ALL_SOLVERS = 'Newton, TrustRegion, LevenbergMarquardt, BisectionND, Homotopy, Partitioned, Kinsol';

export interface PipelinePreset {
  id: string;
  label: string;
  pipeline: string;
  mode: string;
  description: string;
}

export const PIPELINE_PRESETS: PipelinePreset[] = [
  {
    id: 'sequential',
    label: 'All Solvers (Sequential)',
    pipeline: ALL_SOLVERS,
    mode: 'sequential',
    description:
      'Tries all solvers in order: Newton → TrustRegion → LM → BisectionND → Homotopy → Partitioned → Kinsol. '
      + 'Each solver warm-starts from the best result found so far. '
      + 'BisectionND is automatically skipped for blocks larger than bisectionNDMaxBlockSize. '
      + 'Robust and covers the widest range of problem types.',
  },
  {
    id: 'parallel',
    label: 'All Solvers (Parallel)',
    pipeline: ALL_SOLVERS,
    mode: 'parallel',
    description:
      'Launches all solvers concurrently in separate threads; the first solver to converge wins. '
      + 'Useful when the best solver is unknown and you have spare CPU cores. '
      + 'Uses more memory than sequential mode.',
  },
  {
    id: 'newton-only',
    label: 'Newton (Default)',
    pipeline: 'Newton',
    mode: 'sequential',
    description:
      'Newton solver with backtracking line search. '
      + 'Fastest per block — ideal when the Jacobian is well-conditioned and '
      + 'initial guesses are reasonably close to the solution. No fallback.',
  },
  {
    id: 'trustregion-only',
    label: 'TrustRegion',
    pipeline: 'TrustRegion',
    mode: 'sequential',
    description:
      'Trust-Region Dogleg solver. Blends steepest-descent and Newton steps, '
      + 'keeping updates inside a safe radius. Helps when trial points would drive '
      + 'thermodynamic calls into physically invalid regions. No fallback.',
  },
  {
    id: 'lm-only',
    label: 'LevenbergMarquardt',
    pipeline: 'LevenbergMarquardt',
    mode: 'sequential',
    description:
      'Levenberg-Marquardt solver. Uses adaptive damping: large λ → gradient descent '
      + '(safe, slow); small λ → Gauss-Newton (fast, quadratic near solution). '
      + 'Effective when the initial guess is far from the solution or the Jacobian is near-singular. No fallback.',
  },
  {
    id: 'bisectionnd-only',
    label: 'BisectionND',
    pipeline: 'BisectionND',
    mode: 'sequential',
    description:
      'Multi-dimensional Bisection (derivative-free). Converges even when J(x₀)=0. '
      + 'Automatically skipped for blocks larger than bisectionNDMaxBlockSize (default: 8). '
      + 'Cost is O(2ⁿ) function evaluations per iteration — use only for small blocks. No fallback.',
  },
  {
    id: 'homotopy-only',
    label: 'Homotopy',
    pipeline: 'Homotopy',
    mode: 'sequential',
    description:
      'Homotopy continuation. Deforms the problem from an easy auxiliary system to the real '
      + 'system via a parameter t ∈ [0,1]. Can reach solutions from starting points that are '
      + 'too far away for Newton-based methods. No fallback.',
  },
  {
    id: 'partitioned-only',
    label: 'Partitioned',
    pipeline: 'Partitioned',
    mode: 'sequential',
    description:
      'Partitioned Block Updates. Updates each variable using its matched equation diagonal: '
      + 'xᵢ ← xᵢ − w·Fᵢ/(∂Fᵢ/∂xᵢ). Acts like a DAE-style tear without restructuring the block. '
      + 'Last-resort stabilizer for stiff or highly nonlinear loops. No fallback.',
  },
  {
    id: 'kinsol-only',
    label: 'KINSOL',
    pipeline: 'Kinsol',
    mode: 'sequential',
    description:
      'SUNDIALS-KINSOL-style solver. Three globalisation modes (set via kinsolGlobalStrategy): '
      + 'inexact Newton + Dennis-Schnabel line search (default), Picard/Richardson fixed-point, '
      + 'or Anderson-accelerated fixed point. The derivative-free modes can solve blocks where '
      + 'the Jacobian is zero or singular. No fallback.',
  },
  // Sentinel: shown only when the conf contains values that match no preset above.
  {
    id: 'custom',
    label: 'Custom…',
    pipeline: '',
    mode: 'sequential',
    description:
      'The current coolsolve.conf contains a custom pipeline or mode that does not match '
      + 'any preset. Edit the values below, or select a preset to replace them.',
  },
];

/**
 * Infer which preset matches the current conf entries, or "custom" if none match.
 *
 * For the main pipeline (`pipelineKey='solverPipeline'`), the default — when
 * nothing is set — is `newton-only`.  For the Deep Search pipeline
 * (`deep=true`), the default is `sequential` (all solvers, sequential).
 */
export function detectPipelinePreset(
  confMap: Map<string, string>,
  pipelineKey = 'solverPipeline',
  modeKey = 'pipelineMode',
  deep = false,
): string {
  // Nothing set → default preset
  if (!confMap.has(pipelineKey) && !confMap.has(modeKey)) {
    return deep ? 'sequential' : 'newton-only';
  }
  const rawPipeline = (confMap.get(pipelineKey) ?? '').trim().toLowerCase();
  const mode = (confMap.get(modeKey) ?? 'sequential').trim().toLowerCase();
  // `LM` is accepted as an alias of `LevenbergMarquardt` in single-solver mode.
  const pipeline = rawPipeline === 'lm' ? 'levenbergmarquardt' : rawPipeline;

  // 1) Check single-solver presets (exact pipeline match + mode)
  for (const p of PIPELINE_PRESETS) {
    if (p.id === 'custom' || p.id === 'sequential' || p.id === 'parallel') continue;
    if (p.pipeline.toLowerCase() === pipeline && p.mode.toLowerCase() === mode) return p.id;
  }
  // 2) Sequential / parallel: match on the full solver set, not on mode
  // alone. A subset (e.g. "Newton, TrustRegion") is custom, not "All Solvers".
  const solvers = pipeline.split(',').map((s) => s.trim()).filter(Boolean);
  const known = new Set(
    ALL_SOLVERS.split(',').map((s) => s.trim().toLowerCase()).concat(['levenbergmarquardt', 'lm'])
  );
  const allSolvers = ALL_SOLVERS.split(',').map((s) => s.trim().toLowerCase()).sort();
  const given = solvers.map((s) => {
    const low = s.toLowerCase();
    return low === 'lm' ? 'levenbergmarquardt' : low;
  }).sort();
  const isFullSet = given.length === allSolvers.length && given.every((s, i) => s === allSolvers[i]);
  if (isFullSet && solvers.every((s) => known.has(s.toLowerCase()))) {
    if (mode === 'parallel') return 'parallel';
    if (mode === 'sequential') return 'sequential';
  }
  return 'custom';
}
