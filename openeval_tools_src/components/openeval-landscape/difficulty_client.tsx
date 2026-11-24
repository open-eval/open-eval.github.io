"use client";
import { useState } from "react";
import { landscapeSnapshots } from "../../data/landscape";

// Gaussian smoothing of the saved histogram for display; fitted statistics stay unchanged.
function distributionPath(bins: number[]) {
  const samples = Array.from({ length: 321 }, (_, i) => {
    const position = i / 320 * bins.length;
    return bins.reduce((sum, count, j) => sum + count * Math.exp(-0.5 * ((position - j - 0.5) / 0.85) ** 2), 0);
  });
  const peak = Math.max(1, ...samples);
  return `M 0 35 ${samples.map((value, i) => `L ${i * 2} ${35 - value / peak * 24}`).join(" ")} L 640 35`;
}

export function DifficultyView() {
  const [selected, setSelected] = useState<Record<string, string>>({});
  const rows = Object.entries(landscapeSnapshots).flatMap(([slug, snapshot]) => {
    const metrics = Object.keys(snapshot.metrics);
    const metric = metrics.includes(selected[slug]) ? selected[slug] : metrics[0];
    return metric ? [{ slug, metrics, metric, data: snapshot.metrics[metric] }] : [];
  }).sort((a,b) => a.slug.localeCompare(b.slug));
  const computedAt = rows.length ? Math.max(...rows.map(({slug}) => new Date(landscapeSnapshots[slug].computedAt).getTime())) : null;
  return <div>
    <div className="flex flex-col gap-4">
      {rows.map(({slug,metrics,metric,data}) => {
        const medianPosition = data.median == null ? null : (data.median - data.min) / (data.max - data.min);
        return <section key={slug} className="rounded-2xl border border-border bg-surface px-4 py-2">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-baseline gap-2"><a href={`openeval-benchmark.html#benchmark=${encodeURIComponent(slug)}`} className="text-sm font-semibold text-ink">{slug.replaceAll('_','-')}</a><span className="text-xs text-muted" aria-hidden="true">·</span><span className="text-xs text-muted">{data.items.toLocaleString()} items &amp; {data.models} models fitted</span></div>
            <label className="text-xs text-muted">Metric: {metrics.length > 1 ? <select aria-label={`${slug} difficulty metric`} value={metric} onChange={e => setSelected({...selected,[slug]:e.target.value})} className="max-w-full rounded border border-border bg-subtle p-1 text-ink">{metrics.map(m=><option key={m}>{m}</option>)}</select> : <span className="text-ink">{metric}</span>}</label>
          </div>
          <svg viewBox="0 0 640 36" className="mt-3 w-full" role="img" aria-label={`${slug}: distribution of Rasch item difficulty`}>
            <path d={`${distributionPath(data.bins)} Z`} fill="var(--accent)" fillOpacity="0.15" />
            <path d={distributionPath(data.bins)} fill="none" stroke="var(--accent)" strokeWidth="0.75" strokeLinejoin="round"><title>Smoothed histogram of fitted item difficulties</title></path>
            {medianPosition != null && <g>
              <line x1={medianPosition * 640} x2={medianPosition * 640} y1="7.5" y2="35" stroke="var(--accent)" strokeWidth="1.25" strokeDasharray="3 2" />
              <circle cx={medianPosition * 640} cy="7.5" r="2.5" fill="var(--accent)" />
            </g>}
            <line x1="0" x2="640" y1="35" y2="35" stroke="var(--accent)" strokeWidth="0.75"/>
          </svg>
          <div className="difficulty-axis-labels text-xs text-muted">
            <span>{data.min.toFixed(2)} · easier</span>
            {data.median != null && medianPosition != null && (
              <span className="difficulty-axis-median" style={{ left: `clamp(6rem, ${medianPosition * 100}%, 100% - 6rem)` }}>
                median · {data.median.toFixed(2)}
              </span>
            )}
            <span>harder · {data.max.toFixed(2)}</span>
          </div>
        </section>;
      })}
      {!rows.length && <p className="text-muted">No corrected item distributions are available yet.</p>}
    </div>
    <p className="mt-4 mb-5 text-[0.65rem] text-muted">
      {computedAt != null && <>*Snapshot on {new Date(computedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.{" "}</>}
      {rows.length} benchmarks with supported binary metrics; Rasch fits are separate for each benchmark and metric, so difficulty levels are not directly comparable across benchmarks.
    </p>
  </div>;
}
