"use client";

import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { IconSearch, IconChevronLeft, IconChevronRight } from "@tabler/icons-react";
import { benchmarkSnapshots } from "../../data/snapshots";
import { abilitySnapshots } from "../../data/abilities";
import { metricRange } from "../../data/metric-ranges";

const benchmarks = Object.entries(benchmarkSnapshots).sort(([a], [b]) => a.localeCompare(b));
const numeric = (m: { metrics: string[] }) => m.metrics[0] !== "do-not-answer_annotation";
const PAGE_SIZE = 20;
const score = (value: number | null) => value == null ? "—" : value.toFixed(3);

function ModelName({ name }: { name: string }) {
  const [position, setPosition] = useState<{ left: number; top: number } | null>(null);
  const show = (element: HTMLElement) => {
    if (element.scrollWidth <= element.clientWidth) {
      setPosition(null);
      return;
    }
    const rect = element.getBoundingClientRect();
    setPosition({ left: Math.max(8, Math.min(rect.left, window.innerWidth - 368)), top: rect.bottom + 4 });
  };
  useEffect(() => {
    const hide = () => setPosition(null);
    window.addEventListener("scroll", hide, true);
    window.addEventListener("resize", hide);
    return () => { window.removeEventListener("scroll", hide, true); window.removeEventListener("resize", hide); };
  }, []);
  return <>
    <span className="model-name-label" tabIndex={0} onMouseEnter={event => show(event.currentTarget)} onMouseLeave={() => setPosition(null)} onFocus={event => show(event.currentTarget)} onBlur={() => setPosition(null)} onKeyDown={event => { if (event.key === "Escape") setPosition(null); }}>{name}</span>
    {position && createPortal(<div role="tooltip" className="model-name-tooltip" style={position}>{name}</div>, document.body)}
  </>;
}

export function ModelScoresClient() {
  const [benchmark, setBenchmark] = useState(() => {
    const saved = new URLSearchParams(window.location.hash.slice(1)).get("benchmark");
    return benchmarks.find(([slug, data]) => slug === saved && data.measurements.some(numeric))?.[0]
      ?? benchmarks.find(([, data]) => data.measurements.some(numeric))?.[0] ?? "";
  });
  const [metric, setMetric] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("metric") ?? "");
  const [view, setView] = useState(() => new URLSearchParams(window.location.hash.slice(1)).get("view") === "ability" ? "ability" : "raw");
  const [query, setQuery] = useState("");
  const [page, setPage] = useState(0);
  const snapshot = benchmarkSnapshots[benchmark];
  const measurements = snapshot?.measurements.filter(numeric) ?? [];
  const measurement = measurements.find(m => m.metrics[0] === metric) ?? measurements[0];
  const range = metricRange(measurement?.metrics[0] ?? "", benchmark);
  const abilitySnapshot = abilitySnapshots[benchmark];
  const ability = abilitySnapshot?.metrics[measurement?.metrics[0] ?? ""];
  const showAbility = view === "ability" && !!ability?.available;
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.slice(1));
    params.set("benchmark", benchmark);
    params.set("view", showAbility ? "ability" : "raw");
    if (measurement) params.set("metric", measurement.metrics[0]);
    window.history.replaceState(null, "", `#${params.toString()}`);
  }, [benchmark, measurement, showAbility]);
  const rows = useMemo(() => {
    const source = showAbility
      ? (ability?.models ?? []).map(model => ({ name: model.name, mean: model.theta, n: model.n, sd: model.sd }))
      : (measurement?.models ?? []).map(model => ({ ...model, sd: null as number | null }));
    const sorted = source.sort((a, b) =>
      (!showAbility && range.directionUnknown ? a.name.localeCompare(b.name) :
        (!showAbility && range.lower ? a.mean - b.mean : b.mean - a.mean)) || a.name.localeCompare(b.name));
    return sorted.map((model, index) => ({ ...model,
      rank: !showAbility && range.directionUnknown ? null : sorted.findIndex(other => other.mean === model.mean) + 1,
    })).filter(model => model.name.toLowerCase().includes(query.trim().toLowerCase()));
  }, [measurement, range.lower, range.directionUnknown, query, showAbility, ability]);

  if (!snapshot || !measurement) return <p className="text-muted">No numerical model scores are available.</p>;
  const pageCount = Math.max(1, Math.ceil(rows.length / PAGE_SIZE));
  const currentPage = Math.min(page, pageCount - 1);
  const offset = currentPage * PAGE_SIZE;
  const visibleRows = rows.slice(offset, offset + PAGE_SIZE);
  const itemCount = showAbility ? ability!.itemCount! : measurement.itemCount;
  const modelCount = showAbility ? ability!.modelCount! : measurement.models.length;
  const pairCount = showAbility ? ability!.pairCount! : measurement.scoredResponses;
  const overallMean = showAbility ? ability!.models!.reduce((sum, model) => sum + model.theta, 0) / modelCount : measurement.avgScore;
  const possiblePairs = itemCount * modelCount;
  const pairCoverage = possiblePairs > 0
    ? `${(100 * pairCount / possiblePairs).toFixed(1)}%`
    : "—";
  const means = measurement.models.map(model => model.mean);
  const lower = showAbility ? Math.min(...ability!.models!.map(m => m.theta - m.sd)) : range.min ?? Math.min(0, ...means);
  const upper = showAbility ? Math.max(...ability!.models!.map(m => m.theta + m.sd)) : range.max ?? Math.max(0, ...means);
  const width = upper - lower || 1;
  const x = (value: number) => Math.max(0, Math.min(100, 100 * (value - lower) / width));
  const baseline = x(0);

  return <div>
    <div className="flex flex-wrap items-center gap-3">
      <label className="text-sm text-muted">Benchmark
        <select aria-label="Benchmark" value={benchmark} onChange={event => { setBenchmark(event.target.value); setMetric(""); setPage(0); }} className="model-select model-benchmark-select ml-2 rounded-full border border-border bg-subtle px-3 py-1 text-ink">
          {benchmarks.filter(([, data]) => data.measurements.some(numeric)).map(([slug]) => <option key={slug} value={slug}>{slug.replaceAll("_", "-")}</option>)}
        </select>
      </label>
      <div className="model-view-switch" role="group" aria-label="Score view">
        <button type="button" aria-pressed={!showAbility} onClick={() => { setView("raw"); setPage(0); }}>Raw score</button>
        <button type="button" aria-pressed={showAbility} disabled={!ability?.available} title={ability?.available ? "Item-difficulty-adjusted ability with posterior uncertainty" : ability?.reason ?? "No ability estimate is available for this metric."} onClick={() => { setView("ability"); setPage(0); }}>Latent ability</button>
      </div>
      <div className="flex flex-1 items-center gap-2 rounded-full border border-border px-3">
        <IconSearch size={16} className="text-muted" />
        <input aria-label="Filter models" value={query} onChange={event => { setQuery(event.target.value); setPage(0); }} placeholder="Filter models by name…" className="w-full bg-transparent py-2 text-sm outline-none" />
      </div>
    </div>
    <div className="model-results">
    <div className="model-summary">
      <div className={`model-summary-metric${measurement.metrics[0].length > 18 ? " model-summary-metric-long" : ""}`}>
        <div className="model-summary-value">
          {measurements.length > 1 ? (
            <span className="model-metric-picker">
            <span className="model-metric-width" aria-hidden="true">{measurement.metrics[0]}</span>
            <select aria-label="Metric" value={measurement.metrics[0]} onChange={event => { setMetric(event.target.value); setPage(0); }} className="model-select rounded-full border border-border bg-subtle px-3 py-1 text-ink">
              {measurements.map(m => <option key={m.metrics[0]} value={m.metrics[0]}>{m.metrics[0]}</option>)}
            </select>
            </span>
          ) : <span className="text-ink">{measurement.metrics[0]}</span>}
        </div>
        <div className="model-summary-label">Metric</div>
      </div>
      {[[showAbility ? "Fitted items" : "Archived items", itemCount.toLocaleString()], [showAbility ? "Fitted models" : "Eligible models", modelCount.toLocaleString()], [showAbility ? "Overall mean ability" : "Overall mean score", `${score(overallMean)}${showAbility ? " ↑" : range.directionUnknown ? "" : range.lower ? " ↓" : " ↑"}`], ["Model-item coverage", pairCoverage]].map(([label, value]) => <div key={label} className="model-summary-stat"><div className="model-summary-value text-ink">{value}</div><div className="model-summary-label">{label}</div></div>)}
    </div>
    <p className="mt-3 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-muted" style={{ paddingInline: "var(--results-text-inset)" }} aria-live="polite">
      <span>Showing {rows.length ? offset + 1 : 0}–{Math.min(offset + PAGE_SIZE, rows.length)} of {rows.length.toLocaleString()} models</span>
      {!showAbility && range.directionUnknown && <span className="text-xs">(Direction unresolved; listed alphabetically.)</span>}
    </p>
    <div className="mt-2 overflow-x-auto">
      <table className="w-full text-left text-sm" style={{ minWidth: 600, tableLayout: "fixed" }}>
        <colgroup>
          <col style={{ width: "calc(3.5rem + var(--results-text-inset))" }} />
          <col style={{ width: "34%" }} />
          <col />
          <col style={{ width: "calc(12rem + var(--results-text-inset))" }} />
        </colgroup>
        <thead><tr className="border-b border-border text-muted"><th className="py-2 pr-3">Rank</th><th className="py-2 pr-3">Model</th><th className="py-2 pr-3">{showAbility ? <>Rasch ability <span className="font-normal">↑ ± SD</span></> : <>Mean score <span className="font-normal"><span style={{ fontWeight: 520 }}>∈</span> {range.label} {range.directionUnknown ? "" : range.lower ? "↓" : "↑"}</span></>}</th><th className="py-2">Item coverage</th></tr></thead>
        <tbody>{visibleRows.map(model => <tr key={model.name} className="border-b border-border">
          <td className="py-3 pr-3 text-muted">{model.rank ?? "—"}</td>
          <td className="py-3 pr-4 text-ink"><ModelName name={model.name} /></td>
          <td className="py-3 pr-4">{showAbility ? <div className="model-ability-score"><div className="model-ability-track" aria-hidden="true"><span className="model-ability-interval" style={{ left: `${x(model.mean - model.sd!)}%`, width: `${x(model.mean + model.sd!) - x(model.mean - model.sd!)}%` }} /><span className="model-ability-dot" style={{ left: `${x(model.mean)}%` }} /></div><span className="tabular-nums whitespace-nowrap">{score(model.mean)} <span className="model-secondary-value">± {score(model.sd)}</span></span></div> : <div className="flex items-center gap-3"><div className="relative h-2 flex-1 bg-subtle" style={{ minWidth: 100 }} aria-hidden="true"><div className="absolute inset-y-0 bg-accent" style={{ backgroundColor: model.mean < 0 ? "#b47762" : undefined, left: `${Math.min(baseline, x(model.mean))}%`, width: `${Math.abs(x(model.mean) - baseline)}%` }} /></div><span className="tabular-nums">{score(model.mean)}</span></div>}</td>
          <td className="py-3 tabular-nums whitespace-nowrap">
            {(100 * model.n / itemCount).toFixed(1)}%{" "}
            <span className="model-secondary-value">({model.n.toLocaleString()}/{itemCount.toLocaleString()})</span>
          </td>
        </tr>)}</tbody>
      </table>
      {!rows.length && <p className="py-6 text-muted">No models match your search.</p>}
    </div>
    {pageCount > 1 && <nav aria-label="Model pages" className="benchmark-pagination mt-4 flex items-center justify-center gap-3 text-sm">
      <button type="button" aria-label="Previous page" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}><IconChevronLeft size={20} /></button>
      <span>{currentPage + 1}/{pageCount} pages</span>
      <button type="button" aria-label="Next page" disabled={currentPage === pageCount - 1} onClick={() => setPage(currentPage + 1)}><IconChevronRight size={20} /></button>
    </nav>}
    </div>
    <p className="mt-5 text-[0.65rem] leading-relaxed text-muted">
      *Snapshot on {new Date(showAbility ? abilitySnapshot.computedAt : snapshot.computedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}.{" "}
      {showAbility
        ? "Rasch ability estimates are shown with ±1 approximate posterior SD. Compare abilities only within the same benchmark and metric; sparse records are excluded, and the largest connected response set is fitted."
        : "One response per model–item pair; only models with valid scores on ≧10% of benchmark items are included."}
    </p>
  </div>;
}
