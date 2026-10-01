"use client";

import { useMemo, useState } from "react";
import { abilitySnapshots } from "../../data/abilities";
import { benchmarkSnapshots } from "../../data/snapshots";
import { metricRange } from "../../data/metric-ranges";
import { IconLoader2 } from "@tabler/icons-react";

// Minimum shared models before a rank correlation between two benchmarks means
// anything. Below this the sample is too small to trust.
const MIN_SHARED = 5;

interface Bench {
  slug: string;
  label: string;
  bounded?: boolean;
}
interface ModelRow {
  name: string;
  scores: Record<string, number>;
}
interface Data {
  generatedAt: string;
  benchmarks: Bench[];
  models: ModelRow[];
}

interface Cell {
  shared: number;
  jaccard: number;
  rho: number | null; // Spearman over shared models; null if shared < MIN_SHARED
}

// Spearman rank correlation over paired values (ties get average ranks).
function spearman(xs: number[], ys: number[]): number | null {
  const n = xs.length;
  if (n < 3) return null;
  const rank = (v: number[]) => {
    const idx = v.map((val, i) => [val, i] as [number, number]);
    idx.sort((a, b) => a[0] - b[0]);
    const r = new Array<number>(n);
    let i = 0;
    while (i < n) {
      let j = i;
      while (j + 1 < n && idx[j + 1][0] === idx[i][0]) j++;
      const avg = (i + j) / 2 + 1; // 1-based average rank
      for (let k = i; k <= j; k++) r[idx[k][1]] = avg;
      i = j + 1;
    }
    return r;
  };
  const rx = rank(xs);
  const ry = rank(ys);
  const mean = (a: number[]) => a.reduce((s, v) => s + v, 0) / a.length;
  const mx = mean(rx);
  const my = mean(ry);
  let num = 0;
  let dx = 0;
  let dy = 0;
  for (let i = 0; i < n; i++) {
    num += (rx[i] - mx) * (ry[i] - my);
    dx += (rx[i] - mx) ** 2;
    dy += (ry[i] - my) ** 2;
  }
  if (dx === 0 || dy === 0) return null;
  return num / Math.sqrt(dx * dy);
}

type Mode = "overlap" | "agreement";

function metricChoices(slug: string, scoreView: "raw" | "ability") {
  return benchmarkSnapshots[slug].measurements.filter(m =>
    m.metrics[0] !== "do-not-answer_annotation" &&
    (scoreView === "raw" || abilitySnapshots[slug]?.metrics[m.metrics[0]]?.available)
  );
}

export function RedundancyView() {
  const [scoreView, setScoreView] = useState<"raw" | "ability">("raw");
  const [selected, setSelected] = useState<Record<string, string>>({});
  const data = useMemo<Data>(() => {
    const models = new Map<string, ModelRow>();
    const benchmarks: Bench[] = [];
    for (const slug of Object.keys(benchmarkSnapshots)) {
      const choices = metricChoices(slug, scoreView);
      const m = choices.find(m => m.metrics[0] === selected[slug]) ?? choices[0];
      if (!m) continue;
      const ability = abilitySnapshots[slug]?.metrics[m.metrics[0]];
      if (scoreView === "ability" && !ability?.available) continue;
      const range = metricRange(m.metrics[0], slug);
      benchmarks.push({ slug, label: slug.replaceAll("_", "-"), bounded: true });
      for (const model of (scoreView === "ability" ? ability!.models!.map(v => ({name: v.name, mean: v.theta})) : m.models)) {
        if (!models.has(model.name)) models.set(model.name, { name: model.name, scores: {} });
        models.get(model.name)!.scores[slug] = scoreView === "raw" && range.lower ? -model.mean : model.mean;
      }
    }
    return { generatedAt: Object.values(benchmarkSnapshots).map(s => s.computedAt).sort().at(-1)!, benchmarks, models: [...models.values()] };
  }, [selected, scoreView]);
  const [mode, setMode] = useState<Mode>("agreement");
  const [hover, setHover] = useState<[number, number] | null>(null);

  const model = useMemo(() => {
    if (!data) return null;
    const benches = data.benchmarks.filter((b) => b.bounded !== false);

    // slug -> Map(model -> score) and slug -> roster Set
    const scoresBySlug = new Map<string, Map<string, number>>();
    const roster = new Map<string, Set<string>>();
    for (const b of benches) {
      scoresBySlug.set(b.slug, new Map());
      roster.set(b.slug, new Set());
    }
    for (const m of data.models) {
      for (const [slug, v] of Object.entries(m.scores)) {
        if (!scoresBySlug.has(slug)) continue;
        scoresBySlug.get(slug)!.set(m.name, v);
        roster.get(slug)!.add(m.name);
      }
    }

    const n = benches.length;
    const cells: Cell[][] = Array.from({ length: n }, () =>
      Array.from({ length: n }, () => ({ shared: 0, jaccard: 0, rho: null }))
    );

    for (let i = 0; i < n; i++) {
      for (let j = i; j < n; j++) {
        const A = scoresBySlug.get(benches[i].slug)!;
        const B = scoresBySlug.get(benches[j].slug)!;
        const shared: string[] = [];
        for (const k of A.keys()) if (B.has(k)) shared.push(k);
        const union = new Set([...A.keys(), ...B.keys()]).size;
        const jaccard = union ? shared.length / union : 0;
        let rho: number | null = null;
        if (i !== j && shared.length >= MIN_SHARED && ![benches[i], benches[j]].some(b => { const ms = metricChoices(b.slug, scoreView); const metric = (ms.find(m => m.metrics[0] === selected[b.slug]) ?? ms[0])?.metrics[0]; return metricRange(metric ?? "", b.slug).directionUnknown; })) {
          rho = spearman(
            shared.map((k) => A.get(k)!),
            shared.map((k) => B.get(k)!)
          );
        }
        const cell: Cell = { shared: shared.length, jaccard, rho };
        cells[i][j] = cell;
        cells[j][i] = cell;
      }
    }

    // Seriate: greedy nearest-neighbour chain by shared-model count so
    // benchmarks with overlapping rosters (i.e. same era) sit adjacent.
    const remaining = new Set(benches.map((_, i) => i));
    // seed with the highest-overlap pair
    let best = [0, 1];
    let bestV = -1;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++)
        if (cells[i][j].shared > bestV) {
          bestV = cells[i][j].shared;
          best = [i, j];
        }
    const order = n >= 2 ? [best[0], best[1]] : n === 1 ? [0] : [];
    remaining.delete(best[0]);
    remaining.delete(best[1]);
    while (remaining.size) {
      const tail = order[order.length - 1];
      let pick = -1;
      let pv = -1;
      for (const c of remaining)
        if (cells[tail][c].shared > pv) {
          pv = cells[tail][c].shared;
          pick = c;
        }
      order.push(pick);
      remaining.delete(pick);
    }

    // pair stats
    let comparable = 0;
    const pairs: { a: string; b: string; rho: number; shared: number }[] = [];
    let disconnected = 0;
    let total = 0;
    for (let i = 0; i < n; i++)
      for (let j = i + 1; j < n; j++) {
        total++;
        if (cells[i][j].shared === 0) disconnected++;
        if (cells[i][j].rho != null) {
          comparable++;
          pairs.push({
            a: benches[i].label,
            b: benches[j].label,
            rho: cells[i][j].rho!,
            shared: cells[i][j].shared,
          });
        }
      }
    pairs.sort((a, b) => b.rho - a.rho);

    const maxShared = Math.max(
      1,
      ...cells.flatMap((row, i) => row.map((c, j) => (i === j ? 0 : c.shared)))
    );

    return { benches, cells, order, comparable, disconnected, total, pairs, maxShared };
  }, [data, selected]);

  if (!model) {
    return (
      <div className="flex items-center justify-center gap-2 py-16 text-muted">
        <IconLoader2 size={18} className="animate-spin" /> Computing relations…
      </div>
    );
  }

  const { benches, cells, order, comparable, disconnected, total, pairs, maxShared } =
    model;

  // Cell colour for the active mode.
  const cellStyle = (i: number, j: number): { background: string; label: string } => {
    if (i === j) return { background: "var(--color-subtle)", label: "" };
    const c = cells[i][j];
    if (mode === "overlap") {
      if (c.shared === 0) return { background: "transparent", label: "" };
      const t = c.shared / maxShared;
      return {
        background: `rgba(26, 60, 30, ${(0.04 + t * 0.96).toFixed(3)})`,
        label: String(c.shared),
      };
    }
    // agreement
    if (c.rho == null) return { background: "transparent", label: "" };
    const r = c.rho;
    // Diverging: terracotta for disagreement, green for agreement.
    const bg =
      r >= 0
        ? `rgba(26, 60, 30, ${(0.04 + r * 0.96).toFixed(3)})`
        : `rgba(145, 65, 45, ${(0.04 + Math.min(1, -r) * 0.96).toFixed(3)})`;
    return { background: bg, label: r.toFixed(2).replace(/^0/, "").replace(/^-0/, "-") };
  };

  return (
    <div>
      <div className="mb-4 flex flex-wrap items-center justify-center gap-x-8 gap-y-4">
        <div className="model-view-switch" role="group" aria-label="Comparison mode">
          {([
            ["agreement", "Rank agreement"],
            ["overlap", "Model overlap"],
          ] as [Mode, string][]).map(([id, lbl]) => (
            <button key={id} aria-pressed={mode === id} onClick={() => setMode(id)}>
              {lbl}
            </button>
          ))}
        </div>
        <div className="model-view-switch" role="group" aria-label="Correlation score view">
          <button aria-pressed={scoreView === "raw"} onClick={() => {setScoreView("raw");setHover(null);}}>Raw scores</button>
          <button aria-pressed={scoreView === "ability"} onClick={() => {setScoreView("ability");setHover(null);}}>Latent ability</button>
        </div>
      </div>

      <details className="mb-4 rounded-xl border border-border">
        <summary className="cursor-pointer px-3 text-[0.75rem] text-muted" style={{ lineHeight: "calc(1.75rem - 2px)" }}><span className="ml-1">Metrics used for plotting</span></summary>
        <div className="mt-3 grid gap-x-3 gap-y-1 px-3 pb-3 sm:grid-cols-2">
          {data.benchmarks.map(b => {
            const choices = metricChoices(b.slug, scoreView);
            const metric = (choices.find(m => m.metrics[0] === selected[b.slug]) ?? choices[0]).metrics[0];
            return <div key={b.slug} className="flex min-h-7 min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted sm:odd:pl-8"><span>{b.label}</span>
              {choices.length > 1 ? <select aria-label={`${b.label} metric`} className="max-w-full rounded border border-border bg-surface p-1 text-ink" value={metric} onChange={e => setSelected({...selected, [b.slug]: e.target.value})}>
                {choices.map(m => <option key={m.metrics[0]}>{m.metrics[0]}</option>)}
              </select> : <span className="text-ink" style={{ overflowWrap: "anywhere" }}>{metric}</span>}
            </div>;
          })}
        </div>
      </details>

      <div className="mb-3 w-full text-xs leading-relaxed text-muted">
        {mode === "overlap" ? (
          <ul className="list-disc pl-5">
            {scoreView === "ability" && <li>{data.benchmarks.length} benchmarks have supported binary metrics with available Rasch fits.</li>}
            <li>Each cell shows the number of models shared by a benchmark pair.</li>
            <li>Benchmarks are reordered so those sharing more models sit closer together.</li>
          </ul>
        ) : (
          <ul className="list-disc pl-5">
            {scoreView === "ability" && <li>{data.benchmarks.length} benchmarks have supported binary metrics with available Rasch fits.</li>}
            <li>Spearman rank correlations are computed over shared models. Lower-is-better metrics are reverse-coded.</li>
            <li>Only measurable correlations are shown. Blank cells indicate &lt;{MIN_SHARED} shared models, constant scores, or unresolved metric direction.</li>
            <li>Correlation reflects ranking agreement and should not be interpreted as evidence of benchmark equivalence.</li>
          </ul>
        )}
      </div>

      <div className="overflow-x-auto pb-2">
        <table style={{ borderCollapse: "collapse", width: "max-content" }}>
          <thead>
            <tr>
              <th className="sticky left-0 z-10 bg-bg" />
              {order.map((_, col) => (
                <th
                  key={col}
                  className="h-6 w-7 text-center align-bottom text-[11px] tabular-nums text-muted"
                >
                  {col + 1}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {order.map((ri, rowIdx) => (
              <tr key={ri}>
                <th
                  className="sticky left-0 z-10 whitespace-nowrap bg-bg pr-2 text-right text-[12px] font-medium text-ink"
                  style={{ maxWidth: 160 }}
                >
                  <span className="text-[11px] font-bold tabular-nums text-muted">{rowIdx + 1}.</span>{" "}
                  {benches[ri].label}
                </th>
                {order.map((ci, colIdx) => {
                  const { background, label } = cellStyle(ri, ci);
                  const c = cells[ri][ci];
                  const active =
                    hover && (hover[0] === ri || hover[1] === ci);
                  return (
                    <td
                      key={ci}
                      onMouseEnter={() => setHover([ri, ci])}
                      onMouseLeave={() => setHover(null)}
                      title={
                        ri === ci
                          ? benches[ri].label
                          : `${benches[ri].label} × ${benches[ci].label}\n${c.shared} shared model${c.shared !== 1 ? "s" : ""}${c.rho != null ? ` · ρ ${c.rho.toFixed(2)}` : ""}`
                      }
                      className={`text-center text-[10px] tabular-nums transition-opacity ${
                        hover && !active ? "opacity-40" : ""
                      }`}
                      style={{
                        padding: 0,
                        background,
                        color:
                          mode === "overlap"
                            ? c.shared / maxShared > 0.5
                              ? "white"
                              : "var(--color-soft)"
                            : c.rho != null && Math.abs(c.rho) > 0.55
                              ? "white"
                              : "var(--color-soft)",
                        border: "1px solid var(--color-border)",
                        position: "relative",
                        zIndex: active ? 1 : undefined,
                      }}
                    >
                      <div style={{ width: "1.75rem", height: "1.75rem", lineHeight: "1.75rem" }}>{label}</div>
                      {ri === ci && <svg aria-hidden="true" viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: "absolute", inset: -1, width: "calc(100% + 2px)", height: "calc(100% + 2px)", pointerEvents: "none" }}>
                        <line x1="0" y1="0" x2="100" y2="100" stroke="var(--color-border)" strokeWidth="1" vectorEffect="non-scaling-stroke" />
                      </svg>}
                      {hover && active && <span aria-hidden="true" style={{
                        position: "absolute",
                        inset: -1,
                        zIndex: 2,
                        pointerEvents: "none",
                        borderStyle: "solid",
                        borderColor: "var(--accent)",
                        borderTopWidth: hover[0] === ri || rowIdx === 0 ? 2 : 0,
                        borderBottomWidth: hover[0] === ri || rowIdx === order.length - 1 ? 2 : 0,
                        borderLeftWidth: hover[1] === ci || colIdx === 0 ? 2 : 0,
                        borderRightWidth: hover[1] === ci || colIdx === order.length - 1 ? 2 : 0,
                      }} />}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {mode === "agreement" && pairs.length > 0 && (
        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">
              Highest rank agreement
            </h3>
            <ul className="flex flex-col gap-1.5">
              {pairs.slice(0, 5).map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="truncate text-ink">
                    {p.a} <span className="text-muted">×</span> {p.b}
                  </span>
                  <span className="shrink-0 tabular-nums text-ink">
                    ρ = {p.rho.toFixed(2)}
                    <span className="ml-1 text-[10px] text-muted">on {p.shared} models</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div className="rounded-2xl border border-border bg-surface p-4 shadow-soft">
            <h3 className="mb-2 font-display text-sm font-semibold text-ink">
              Lowest rank agreement
            </h3>
            <ul className="flex flex-col gap-1.5">
              {pairs.slice(-5).reverse().map((p, i) => (
                <li
                  key={i}
                  className="flex items-center justify-between gap-2 text-[13px]"
                >
                  <span className="truncate text-ink">
                    {p.a} <span className="text-muted">×</span> {p.b}
                  </span>
                  <span className="shrink-0 tabular-nums text-soft">
                    ρ = {p.rho.toFixed(2)}
                    <span className="ml-1 text-[10px] text-muted">on {p.shared} models</span>
                  </span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}

      <p className="mt-4 text-[0.65rem] leading-relaxed text-muted">
        *Snapshot on {new Date(data.generatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" })}. Model identities are matched by their archived names.
      </p>
    </div>
  );
}
