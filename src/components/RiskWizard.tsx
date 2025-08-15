import React, { useMemo, useState } from "react";
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

// ---------- small helpers ---------- //
function toPct(x: number, digits = 2) {
  return `${(x * 100).toFixed(digits)}%`;
}

function quantile(arr: number[], q: number) {
  if (arr.length === 0) return NaN;
  const sorted = [...arr].sort((a, b) => a - b);
  const pos = (sorted.length - 1) * q;
  const base = Math.floor(pos);
  const rest = pos - base;
  if (sorted[base + 1] !== undefined) {
    return sorted[base] + rest * (sorted[base + 1] - sorted[base]);
  } else {
    return sorted[base];
  }
}

function mean(arr: number[]) {
  return arr.reduce((a, b) => a + b, 0) / arr.length;
}

function std(arr: number[]) {
  const m = mean(arr);
  const v = arr.reduce((s, x) => s + (x - m) ** 2, 0) / (arr.length - 1);
  return Math.sqrt(v);
}

function covariance(a: number[], b: number[]) {
  const mA = mean(a);
  const mB = mean(b);
  let s = 0;
  const n = Math.min(a.length, b.length);
  for (let i = 0; i < n; i++) s += (a[i] - mA) * (b[i] - mB);
  return s / (n - 1);
}

function corr(a: number[], b: number[]) {
  return covariance(a, b) / (std(a) * std(b));
}

function cumprod(arr: number[]) {
  const out: number[] = [];
  let acc = 1;
  for (const r of arr) {
    acc = acc * (1 + r);
    out.push(acc);
  }
  return out;
}

function maxDrawdown(returns: number[]) {
  const nav = cumprod(returns);
  let peak = -Infinity;
  let maxDD = 0;
  for (const v of nav) {
    if (v > peak) peak = v;
    const dd = (peak - v) / peak;
    if (dd > maxDD) maxDD = dd;
  }
  return { nav, maxDD };
}

function zFromConf(conf: number) {
  // one-tailed z for (1 - conf) tail, positive value e.g. 95% -> 1.645, 99% -> 2.326
  const map: Record<string, number> = { "0.90": 1.282, "0.95": 1.645, "0.99": 2.326 };
  const key = conf.toFixed(2);
  return map[key] ?? 1.645;
}

// sample data generator (geometric Brownian motion-ish)
function genReturns(nDays: number, muDaily: number, sigmaDaily: number, seed = 42) {
  // simple LCG for deterministic demo randomness
  let state = seed;
  const rand = () => ((state = (1664525 * state + 1013904223) % 4294967296) / 4294967296);
  const out: number[] = [];
  for (let i = 0; i < nDays; i++) {
    // Box-Muller transform
    const u1 = Math.max(rand(), 1e-9);
    const u2 = Math.max(rand(), 1e-9);
    const z = Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
    out.push(muDaily + sigmaDaily * z);
  }
  return out;
}

const DEFAULT_ASSETS = [
  { ticker: "MSFT", mu: 0.0006, sigma: 0.020, color: "#2563eb" }, // ~15% ann, ~32% ann vol
  { ticker: "AAPL", mu: 0.0005, sigma: 0.022, color: "#16a34a" },
  { ticker: "GLD", mu: 0.0002, sigma: 0.009, color: "#ca8a04" },
  { ticker: "AGG", mu: 0.00015, sigma: 0.005, color: "#6b7280" }, // bonds
];

const DEFAULT_BENCH = { ticker: "SPY", mu: 0.0005, sigma: 0.012, color: "#ef4444" };

// ---------- main component ---------- //
export default function RiskWizard() {
  const [step, setStep] = useState(1);
  const [days, setDays] = useState(252); // ~1Y trading days
  const [conf, setConf] = useState(0.95);
  const [useHistVaR, setUseHistVaR] = useState(true);
  const [weights, setWeights] = useState<number[]>([0.4, 0.4, 0.2, 0]);
  const [shock, setShock] = useState(-0.07); // 1-day stress shock

  const assets = useMemo(() => {
    return DEFAULT_ASSETS.map((a, i) => ({ ...a, returns: genReturns(days, a.mu, a.sigma, 100 + i) }));
  }, [days]);

  const bench = useMemo(() => ({ ...DEFAULT_BENCH, returns: genReturns(days, DEFAULT_BENCH.mu, DEFAULT_BENCH.sigma, 999) }), [days]);

  // normalize weights
  const w = useMemo(() => {
    const s = weights.reduce((a, b) => a + b, 0);
    return s === 0 ? weights : weights.map((x) => x / s);
  }, [weights]);

  // portfolio returns
  const pReturns = useMemo(() => {
    const n = assets[0].returns.length;
    const out: number[] = new Array(n).fill(0);
    for (let t = 0; t < n; t++) {
      let v = 0;
      for (let i = 0; i < assets.length; i++) v += w[i] * (assets[i] as any).returns[t];
      out[t] = v;
    }
    return out;
  }, [assets, w]);

  // stats
  const annFactor = 252; // daily to annual
  const pMean = useMemo(() => mean(pReturns), [pReturns]);
  const pStd = useMemo(() => std(pReturns), [pReturns]);
  const volAnn = useMemo(() => pStd * Math.sqrt(annFactor), [pStd]);

  // covariance & correlation matrix
  const covMatrix = useMemo(() => {
    const n = assets.length;
    const M: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i][j] = covariance((assets[i] as any).returns, (assets[j] as any).returns);
    }
    return M;
  }, [assets]);

  const corrMatrix = useMemo(() => {
    const n = assets.length;
    const M: number[][] = Array.from({ length: n }, () => Array(n).fill(0));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) M[i][j] = corr((assets[i] as any).returns, (assets[j] as any).returns);
    }
    return M;
  }, [assets]);

  // portfolio volatility via w^T Σ w (daily -> annualized)
  const volByMatrix = useMemo(() => {
    const n = assets.length;
    let v = 0;
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) v += w[i] * w[j] * covMatrix[i][j];
    }
    return Math.sqrt(v) * Math.sqrt(annFactor);
  }, [covMatrix, w]);

  // beta for each asset vs benchmark, and portfolio beta
  const assetBetas = useMemo(() => assets.map((a) => covariance((a as any).returns, bench.returns) / covariance(bench.returns, bench.returns)), [assets, bench]);
  const portBeta = useMemo(() => assetBetas.reduce((s, b, i) => s + w[i] * b, 0), [assetBetas, w]);

  // VaR (1-day)
  const varHist = useMemo(() => {
    const q = quantile(pReturns, 1 - conf); // e.g. 5th percentile
    return Math.max(0, -q); // express as positive loss fraction
  }, [pReturns, conf]);

  const varVC = useMemo(() => {
    const z = zFromConf(conf);
    // VaR = z*std - mu (1-day)
    return Math.max(0, z * pStd - pMean);
  }, [pStd, pMean, conf]);

  // Max Drawdown
  const { nav, maxDD } = useMemo(() => maxDrawdown(pReturns), [pReturns]);

  // Stress: simple one-day shock applied proportional to beta contribution
  const stressLoss = useMemo(() => {
    const shockRet = shock; // e.g., -7%
    // approximate portfolio response: beta * market shock for equity-like assets, bonds/gold dampened by corr
    const benchStd = std(bench.returns) || 1e-9;
    const benchShockZ = shockRet / benchStd; // how many std moves
    const response = assets.reduce((s, a, i) => {
      const corrToBench = corr((a as any).returns, bench.returns);
      const assetStd = std((a as any).returns) || 1e-9;
      const assetShock = benchShockZ * corrToBench * assetStd; // linear propagation
      return s + w[i] * assetShock;
    }, 0);
    return response;
  }, [assets, bench, shock, w]);

  // chart data
  const chartData = useMemo(() => {
    const data = nav.map((v, i) => ({ idx: i, Portfolio: v }));
    return data;
  }, [nav]);

  const next = () => setStep((s) => Math.min(4, s + 1));
  const back = () => setStep((s) => Math.max(1, s - 1));

  // color helper for correlation heat table
  function corrBg(c: number) {
    // blue for negative, red for positive
    const val = Math.round(((c + 1) / 2) * 255);
    const r = val;
    const b = 255 - val;
    return `rgba(${r}, 60, ${b}, 0.2)`;
  }

  return (
    <div className="w-full max-w-6xl mx-auto p-4 sm:p-6 safe-px safe-py">
      <div className="mb-6">
        <h1 className="text-xl sm:text-2xl font-semibold">Interactive Risk Analysis Wizard</h1>
        <p className="text-xs sm:text-sm text-gray-500 dark:text-muted-dark">Step-by-step, institutional-style portfolio risk demo — no external data required.</p>
      </div>

      {/* progress */}
      <div className="flex items-center gap-3 mb-6">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className={`flex-1 h-2 rounded-full ${i <= step ? "bg-blue-600" : "bg-gray-200 dark:bg-gray-800"}`} />
        ))}
      </div>

      {step === 1 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h2 className="font-medium mb-3">Step 1 · Dataset & Benchmark</h2>
            <label className="block text-sm mb-1">Trading days</label>
            <input
              aria-label="Trading days"
              type="range"
              min={126}
              max={756}
              step={21}
              value={days}
              onChange={(e) => setDays(parseInt(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{days} days (~{(days / 252).toFixed(1)} years)</div>
            <div className="mt-4 text-sm text-gray-600 dark:text-gray-300">
              Benchmark: <span className="font-semibold">{bench.ticker}</span> (sampled)
            </div>
            <div className="mt-4 text-xs text-gray-500 dark:text-muted-dark">
              This demo generates realistic sample returns in-browser to illustrate the workflow without external data.
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium mb-3">Assets (sample parameters)</h3>
            <div className="overflow-x-auto -mx-2 sm:mx-0">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-muted-dark">
                    <th className="py-1 px-2">Ticker</th>
                    <th className="px-2">μ (daily)</th>
                    <th className="px-2">σ (daily)</th>
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a) => (
                    <tr key={a.ticker}>
                      <td className="py-1 px-2 font-medium" style={{ color: (a as any).color }}>{a.ticker}</td>
                      <td className="px-2">{((a as any).mu * 100).toFixed(2)}%</td>
                      <td className="px-2">{((a as any).sigma * 100).toFixed(2)}%</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {step === 2 && (
        <div className="card">
          <h2 className="font-medium mb-3">Step 2 · Portfolio Weights</h2>
          <div className="grid gap-4">
            {assets.map((a, i) => (
              <div key={a.ticker} className="grid grid-cols-12 items-center gap-3">
                <div className="col-span-3 sm:col-span-2 text-sm font-medium truncate" style={{ color: (a as any).color }}>{a.ticker}</div>
                <input
                  className="col-span-7 sm:col-span-8"
                  type="range"
                  min={0}
                  max={1}
                  step={0.01}
                  value={weights[i]}
                  onChange={(e) => {
                    const v = parseFloat(e.target.value);
                    const nextW = [...weights];
                    nextW[i] = v;
                    setWeights(nextW);
                  }}
                />
                <div className="col-span-2 text-right text-sm">{toPct(w[i] ?? 0)}</div>
              </div>
            ))}
          </div>
          <div className="mt-3 text-xs text-gray-500 dark:text-muted-dark">Weights auto-normalize to 100%.</div>
        </div>
      )}

      {step === 3 && (
        <div className="grid gap-6 md:grid-cols-2">
          <div className="card">
            <h2 className="font-medium mb-3">Step 3 · VaR Settings</h2>
            <div className="text-sm mb-2">Confidence</div>
            <div className="flex items-center gap-2">
              {[0.90, 0.95, 0.99].map((c) => (
                <button
                  key={c}
                  onClick={() => setConf(c)}
                  className={`px-3 py-1 rounded-full border border-gray-200 dark:border-gray-700 ${conf === c ? "bg-blue-600 text-white" : "bg-white dark:bg-transparent"}`}
                >
                  {(c * 100).toFixed(0)}%
                </button>
              ))}
            </div>
            <div className="mt-4 text-sm mb-2">Method</div>
            <div className="flex items-center gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={true === true && conf && (true || false) && undefined === undefined && (true)} onChange={() => setUseHistVaR(true)} /> Historical Simulation
              </label>
              <label className="flex items-center gap-2 text-sm">
                <input type="radio" checked={!useHistVaR} onChange={() => setUseHistVaR(false)} /> Variance–Covariance
              </label>
            </div>
            <div className="mt-4 text-xs text-gray-500 dark:text-muted-dark">
              Historical VaR uses the empirical return distribution; Variance–Covariance assumes normality.
            </div>
          </div>

          <div className="card">
            <h2 className="font-medium mb-3">Stress Test</h2>
            <label className="block text-sm mb-1">One-day market shock (benchmark)</label>
            <input
              aria-label="One-day market shock"
              type="range"
              min={-0.15}
              max={0.05}
              step={0.005}
              value={shock}
              onChange={(e) => setShock(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-sm text-gray-600 dark:text-gray-300 mt-1">{toPct(shock)}</div>
            <div className="mt-4 text-xs text-gray-500 dark:text-muted-dark">
              Shock is propagated to assets using correlation and relative volatility.
            </div>
          </div>
        </div>
      )}

      {step === 4 && (
        <div className="grid gap-6">
          <div className="card">
            <h2 className="font-medium mb-3">Results · Key Risk Metrics (annualized where noted)</h2>
            <div className="grid md:grid-cols-4 gap-4 text-sm">
              <div className="rounded-xl border p-4 bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800">
                <div className="text-gray-500 dark:text-muted-dark">Volatility (σ, annualized)</div>
                <div className="text-2xl font-semibold">{toPct(volAnn)}</div>
                <div className="text-xs text-gray-500 dark:text-muted-dark mt-1">via wᵀΣw</div>
              </div>
              <div className="rounded-xl border p-4 bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800">
                <div className="text-gray-500 dark:text-muted-dark">Portfolio Beta (β vs SPY)</div>
                <div className="text-2xl font-semibold">{portBeta.toFixed(2)}</div>
                <div className="text-xs text-gray-500 dark:text-muted-dark mt-1">weighted average of asset betas</div>
              </div>
              <div className="rounded-xl border p-4 bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800">
                <div className="text-gray-500 dark:text-muted-dark">1-Day VaR {Math.round(conf * 100)}% ({useHistVaR ? "Hist" : "V-C"})</div>
                <div className="text-2xl font-semibold">{toPct(useHistVaR ? varHist : varVC)}</div>
                <div className="text-xs text-gray-500 dark:text-muted-dark mt-1">positive value = potential loss</div>
              </div>
              <div className="rounded-xl border p-4 bg-white dark:bg-white/5 border-gray-200 dark:border-gray-800">
                <div className="text-gray-500 dark:text-muted-dark">Max Drawdown (historical)</div>
                <div className="text-2xl font-semibold">{toPct(maxDD)}</div>
                <div className="text-xs text-gray-500 dark:text-muted-dark mt-1">from peak to trough</div>
              </div>
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium mb-3">Cumulative NAV</h3>
            <div className="h-64 sm:h-72">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="idx" tick={{ fontSize: 12 }} />
                  <YAxis tick={{ fontSize: 12 }} />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="Portfolio" dot={false} stroke="#2563eb" strokeWidth={2} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium mb-3">Correlation Heat Table</h3>
            <div className="overflow-x-auto">
              <table className="text-sm min-w-[480px]">
                <thead>
                  <tr>
                    <th className="p-2 text-left">Asset</th>
                    {assets.map((a) => (
                      <th key={a.ticker} className="p-2 text-center">{a.ticker}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {assets.map((a, i) => (
                    <tr key={a.ticker}>
                      <td className="p-2 font-medium" style={{ color: (a as any).color }}>{a.ticker}</td>
                      {assets.map((b, j) => (
                        <td key={b.ticker}
                          className="p-2 text-center rounded"
                          style={{ background: corrBg(corrMatrix[i][j]) }}
                        >
                          {corrMatrix[i][j].toFixed(2)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card">
            <h3 className="font-medium mb-2">Stress Test (1-day benchmark shock)</h3>
            <div className="text-sm">Shock: <span className="font-semibold">{toPct(shock)}</span> → Estimated portfolio impact: <span className="font-semibold">{toPct(stressLoss)}</span></div>
            <div className="text-xs text-gray-500 dark:text-muted-dark mt-1">Linear propagation using asset correlation & relative volatility. For education/demo only.</div>
          </div>
        </div>
      )}

      <div className="mt-6 flex items-center justify-between gap-2">
        <button onClick={back} disabled={step === 1} className={`px-4 py-2 rounded-xl border border-gray-200 dark:border-gray-700 ${step === 1 ? "opacity-40 cursor-not-allowed" : "hover:bg-gray-50 dark:hover:bg-white/10"}`}>Back</button>
        <div className="text-xs text-gray-500 dark:text-muted-dark hidden md:block">
          {step === 1 && "Choose sample dataset & benchmark"}
          {step === 2 && "Adjust weights; they auto-normalize to 100%"}
          {step === 3 && "Pick VaR method & set a stress scenario"}
          {step === 4 && "Review results, charts, and stress impact"}
        </div>
        <button onClick={next} disabled={step === 4} className={`px-4 py-2 rounded-xl border bg-blue-600 text-white border-blue-600 ${step === 4 ? "opacity-40 cursor-not-allowed" : "hover:bg-blue-700"}`}>{step === 3 ? "Compute" : step === 4 ? "Done" : "Next"}</button>
      </div>

      <div className="mt-6 text-xs text-gray-400 dark:text-gray-500">
        Educational demo only. Not investment advice.
      </div>
    </div>
  );
}
