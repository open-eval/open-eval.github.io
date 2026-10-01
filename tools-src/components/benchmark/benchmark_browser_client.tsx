import { metricRange, diagnosticThresholds as thresholds } from "../../data/metric-ranges";
"use client";
import { benchmarkSnapshots } from "../../data/snapshots";
import { getMeasurement, type MeasurementProgress } from "../../data/client";
import { openEvalFetch } from "../../data/transport";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  IconSearch,
  IconLoader2,
  IconArrowLeft,
  IconExternalLink,
  IconChevronDown,
  IconGauge,
  IconShieldCheck,
} from "@tabler/icons-react";
import type { OEBenchmark, OEItem, OEMeasurement } from "../../data/types";
import { benchmarkSlug } from "../../data/types";

const pct = (x: number) => `${Math.round(x * 100)}%`;

function TagChip({
  label,
  active,
  onClick,
}: {
  label: string;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
        active
          ? "border-ink bg-ink text-white"
          : "border-border text-muted hover:text-ink"
      }`}
    >
      {label}
    </button>
  );
}

export function BenchBrowserClient() {
  const [benchmarks, setBenchmarks] = useState<OEBenchmark[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [showOtherTags, setShowOtherTags] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);
  const [selection, setSelection] = useState(() => window.location.hash.slice(1));
  const selectionParams = new URLSearchParams(selection);
  const selectedName = selectionParams.get("benchmark") ?? "";
  const selectedVersion = selectionParams.get("version") ?? "";
  const matchingBenchmarks = benchmarks.filter(b => benchmarkSlug(b.name) === benchmarkSlug(selectedName));
  const selected = matchingBenchmarks.find(b => b.version === selectedVersion)
    ?? (!selectedVersion ? matchingBenchmarks[0] : undefined);
  const selectBenchmark = (benchmark: OEBenchmark | null) => {
    const hash = benchmark ? new URLSearchParams({ benchmark: benchmark.name, version: benchmark.version }).toString() : "";
    const url = new URL(window.location.href);
    url.hash = hash;
    window.history.pushState(null, "", url);
    setSelection(hash);
  };
  useEffect(() => {
    const sync = () => setSelection(window.location.hash.slice(1));
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const loadBenchmarks = useCallback(async () => {
      setLoading(true);
      setError(null);
      setBenchmarks([]);
      setActiveTag(null);
      try {
        const res = await openEvalFetch("/api/openeval/benchmarks");
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Failed to load benchmarks");
        setBenchmarks([...data.benchmarks].sort((a: OEBenchmark, b: OEBenchmark) =>
          a.name.localeCompare(b.name, "en", { sensitivity: "base", numeric: true })
        ));
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to load benchmarks");
      } finally {
        setLoading(false);
      }
  }, []);

  useEffect(() => { void loadBenchmarks(); }, [loadBenchmarks]);

  const { commonTags, otherTags } = useMemo(() => {
    const usage = new Map<string, Set<string>>();
    benchmarks.forEach(b => new Set(b.tags).forEach(tag => {
      if (!usage.has(tag)) usage.set(tag, new Set());
      usage.get(tag)!.add(b.name);
    }));
    const tags = [...usage.keys()].sort();
    return {
      commonTags: tags.filter(tag => usage.get(tag)!.size > 1),
      otherTags: tags.filter(tag => usage.get(tag)!.size === 1),
    };
  }, [benchmarks]);

  const filtered = useMemo(
    () =>
      benchmarks.filter((b) => {
        const label = b.name.toLowerCase();
        const matchQ =
          !query.trim() ||
          label.includes(query.toLowerCase()) ||
          b.name.toLowerCase().includes(query.toLowerCase());
        const matchTag = !activeTag || b.tags.includes(activeTag);
        return matchQ && matchTag;
      }),
    [benchmarks, query, activeTag]
  );

  if (selected) {
    return (
      <BenchmarkDetail benchmark={selected} key={selection} onBack={() => selectBenchmark(null)} />
    );
  }

  return (
    <div>
      <div className="flex items-center gap-2 rounded-input border border-border bg-surface px-3">
        <IconSearch size={16} className="text-muted" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search benchmarks by name…"
          className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
        />
      </div>

      {commonTags.length + otherTags.length > 0 && (
        <div aria-label="Benchmark tags" className="mt-3 flex flex-wrap gap-1.5">
          <TagChip
            label="All"
            active={!activeTag}
            onClick={() => setActiveTag(null)}
          />
          {commonTags.map((t) => (
            <TagChip
              key={t}
              label={t}
              active={activeTag === t}
              onClick={() => setActiveTag(activeTag === t ? null : t)}
            />
          ))}
          <div id="other-benchmark-tags" hidden={!showOtherTags} className={showOtherTags ? "contents" : "hidden"}>
            {otherTags.map(t => <TagChip key={t} label={t} active={activeTag === t} onClick={() => setActiveTag(activeTag === t ? null : t)} />)}
          </div>
          {otherTags.length > 0 && (
            <button
              type="button"
              aria-expanded={showOtherTags}
              aria-controls="other-benchmark-tags"
              className="inline-flex items-center gap-1 px-2 py-1 text-xs text-muted hover:text-ink"
              onClick={() => {
                if (showOtherTags && activeTag && otherTags.includes(activeTag)) setActiveTag(null);
                setShowOtherTags(value => !value);
              }}
            >
              <IconChevronDown size={16} aria-hidden="true" className={showOtherTags ? "rotate-180" : ""} />
              {showOtherTags ? "Frequent tags" : "All tags"}
            </button>
          )}
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted">
          <IconLoader2 size={18} className="animate-spin" /> Loading benchmarks…
        </div>
      )}

      {error && !loading && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error}
        </p>
      )}

      {!loading && !error && (
        <>
          <p className="mt-4 text-sm text-muted">
            {filtered.length} benchmark{filtered.length !== 1 ? "s" : ""}
            {activeTag ? ` tagged “${activeTag}”` : ""}
          </p>

          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            {filtered.map((b) => (
              <article
                key={b.name}
                className="flex flex-col rounded-2xl border border-border bg-surface p-4 text-left shadow-soft transition-shadow hover:shadow-lift"
              >
                <div className="flex items-start justify-between gap-2">
                  <button onClick={() => selectBenchmark(b)} className="font-display text-[0.95rem] font-semibold text-ink text-left">
                    {b.name}{b.version && <span className="text-muted"> ({b.version})</span>}
                  </button>
                </div>

                <div className="mt-2 flex flex-wrap gap-3">
                  {b.tags.map((t) => (
                    <span
                      key={t}
                      className="benchmark-tag benchmark-card-tag bg-subtle px-2 py-0.5 text-[12px] text-soft"
                    >
                      {t}
                    </span>
                  ))}
                </div>

                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs">
                  {b.paperUrl && (
                    <a
                      href={b.paperUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      onClick={(e) => e.stopPropagation()}
                      className="flex items-center gap-1 text-muted hover:text-ink"
                    >
                      Paper <IconExternalLink size={12} />
                    </a>
                  )}
                  {b.datasetUrl && (
                    <a
                      href={b.datasetUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1 text-muted hover:text-ink"
                    >
                      Dataset <IconExternalLink size={12} />
                    </a>
                  )}
                  <button onClick={() => selectBenchmark(b)} aria-label={`Explore ${b.name} items`} className="ml-auto font-medium text-ink">
                    Explore items →
                  </button>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

function StatTile({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted">
        {label}
      </p>
      <p className="mt-0.5 font-display text-lg font-semibold text-ink">
        {value}
      </p>
      {sub && <p className="text-[11px] text-muted">{sub}</p>}
    </div>
  );
}

type Tone = "good" | "mid" | "warn";
const toneClass: Record<Tone, string> = {
  good: "bg-[#3f8f7a]/12 text-[#2f6e5d]",
  mid: "bg-[#b8860b]/12 text-[#8a6a1c]",
  warn: "bg-[#c0563f]/12 text-[#a23b2b]",
};

function SignalTile({
  label,
  value,
  note,
  tone,
}: {
  label: string;
  value: string;
  note?: string;
  tone: Tone;
}) {
  return (
    <div className="rounded-xl border border-border bg-bg px-3 py-2.5">
      <p className="text-[15px] font-medium text-ink">
        {label}{" "}
        <span className={`ml-1 inline-block rounded-full px-2 py-0.5 text-[12px] font-semibold ${toneClass[tone]}`}>
          {value.toUpperCase()}
        </span>
      </p>
      {note && <p className="mt-1 text-[14px] leading-snug text-muted">{note}</p>}
    </div>
  );
}

function MeasurementPanel({ m, benchmark, computedAt, measurements, metricIndex, onMetricChange }: {
  m: OEMeasurement;
  benchmark: OEBenchmark;
  computedAt?: string;
  measurements: OEMeasurement[];
  metricIndex: number;
  onMetricChange: (index: number) => void;
}) {
  const rangeLabel = metricRange(m.metrics[0] || "").label;
  const statistic = (value: number | null) => value == null ? "—" : value.toFixed(3);
  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <IconGauge size={18} className="text-muted" />
        <h3 className="font-display text-lg font-semibold text-ink">Evaluation Snapshot{computedAt && (
          <span className="ml-3 font-sans text-[14px] font-normal text-muted">
            on <time dateTime={computedAt}>{new Date(computedAt).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric", timeZone: "UTC" })}</time>
          </span>
        )}</h3>
      </div>
      <p className="mt-2 text-[12px] text-muted">
        *Models with valid scores on &lt;10% of the items and duplicate trials are removed; item coverage may still vary across models.      </p>
      <div className="mt-4 flex flex-wrap items-center gap-3 text-[15px]">
        <span className="font-medium text-ink">Benchmark tags:</span>
        {benchmark.tags.length ? benchmark.tags.map(tag => (
          <span key={tag} className="benchmark-tag benchmark-card-tag bg-subtle px-2 py-0.5 text-[12px] text-soft">{tag}</span>
        )) : <span className="text-muted">No tags</span>}
      </div>
      <p className="mt-1 text-[15px] text-muted">
        <span className="font-medium text-ink">Archived data:</span>{" "}
        {m.itemCount.toLocaleString()} items, {m.models.length.toLocaleString()} models, and {m.loadedResponses.toLocaleString()} {computedAt ? "responses" : "response rows loaded"}
      </p>
      <p className="mt-1 text-[15px] text-muted">
        <span className="font-medium text-ink">{m.metrics[0] === "do-not-answer_annotation" ? "Metric:" : "Score statistics:"}</span>{" "}
        {m.metrics[0] !== "do-not-answer_annotation" && "metric = "}{measurements.length > 1 ? (
          <span className="benchmark-metric-picker">
            <span className="benchmark-metric-width" aria-hidden="true">{m.metrics.join(", ")}</span>
          <select
            aria-label="Measurement metric"
            value={metricIndex}
            onChange={event => onMetricChange(Number(event.target.value))}
          >
            {measurements.map((entry, index) => <option key={entry.metrics.join(", ")} value={index}>{entry.metrics.join(", ")}</option>)}
          </select>
          </span>
        ) : m.metrics.join(", ") || "—"}{" "}<span className="text-muted">{rangeLabel === "categorical" || rangeLabel === "not configured" ? `(${rangeLabel})` : <><span style={{ fontWeight: 520 }}>∈</span>{" "}{rangeLabel}</>}</span>{m.metrics[0] !== "do-not-answer_annotation" && <>, avg. = {statistic(m.models.length ? m.avgScore : null)}, med. = {statistic(m.medianScore)}, SE = {statistic(m.standardError)}</>}
      </p>


    </section>
  );
}

function ValidityPanel({ m, benchmark }: { m: OEMeasurement; benchmark: string }) {
  if (!m.models.length) return <p className="mt-3 text-sm text-muted">No models meet the 10% valid-score coverage threshold for this metric.</p>;
  const range = metricRange(m.metrics[0] || "", benchmark);
  const finite = range.min !== undefined && range.max !== undefined;
  const invalidUnitScores = range.min === 0 && range.max === 1 && !m.bounded;
  const invalidMeans = finite && m.models.some(model => model.mean < range.min! || model.mean > range.max!);
  if (!finite || range.directionUnknown || invalidUnitScores || invalidMeans) {
    return <section className="rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-display text-lg font-semibold text-ink">Validity Diagnostics</h3>
      <p className="mt-2 text-sm text-muted">This metric does not establish benchmark validity.</p>
    </section>;
  }
  const width = range.max! - range.min!;
  const normalize = (value: number) => range.lower ? (range.max! - value) / width : (value - range.min!) / width;
  const rawBest = (range.lower ? m.worst?.mean : m.best?.mean) ?? 0;
  const best = normalize(rawBest);
  const disc = (m.discrimination ?? 0) / width;
  const average = normalize(m.avgScore ?? 0);

  const discrimination: { value: string; note: string; tone: Tone } =
    disc >= thresholds.discrimination.strong
      ? { value: "Strong", note: "Clearly separates models", tone: "good" }
      : disc >= thresholds.discrimination.moderate
      ? { value: "Moderate", note: "Some model separation", tone: "mid" }
      : { value: "Weak", note: "Models score similarly", tone: "warn" };

  const headroom: { value: string; note: string; tone: Tone } =
    best >= thresholds.headroom.saturated
      ? {
          value: "Saturated",
          note: `Top model scored ${rawBest.toFixed(3)}`,
          tone: "warn",
        }
      : best >= thresholds.headroom.limited
      ? { value: "Limited", note: `Top model scored ${rawBest.toFixed(3)}`, tone: "mid" }
      : { value: "Ample", note: `Top model scored ${rawBest.toFixed(3)}`, tone: "good" };

  const difficulty: { value: string; note: string; tone: Tone } =
    average < thresholds.difficulty.hard
      ? { value: "Hard", note: `Models scored ${(m.avgScore ?? 0).toFixed(3)} on average`, tone: "good" }
      : average <= thresholds.difficulty.easy
      ? { value: "Moderate", note: `Models scored ${(m.avgScore ?? 0).toFixed(3)} on average`, tone: "mid" }
      : { value: "Easy", note: `Models scored ${(m.avgScore ?? 0).toFixed(3)} on average`, tone: "warn" };

  const refs =
    m.refCoverage == null
      ? { value: "—", note: "unknown", tone: "mid" as Tone }
      : m.refCoverage >= 0.99
      ? { value: "Yes", note: "Items have reference responses", tone: "good" as Tone }
      : m.refCoverage <= 0.01
      ? {
          value: "None",
          note: "Judged, not matched",
          tone: "mid" as Tone,
        }
      : {
          value: pct(m.refCoverage),
          note: "of items have references",
          tone: "mid" as Tone,
        };

  return (
    <section className="rounded-2xl border border-border bg-surface p-5 shadow-soft">
      <div className="flex items-center gap-2">
        <IconShieldCheck size={18} className="text-muted" />
        <h3 className="font-display text-lg font-semibold text-ink">Validity Diagnostics</h3>
      </div>
      <p className="mt-1 text-[12px] text-muted">
        *Exploratory thresholds applied after normalization to 0–1{range.lower ? " and reverse-coding" : ""}; 
        these are not validated cutoffs.
      </p>

      <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SignalTile
          label="Discrimination"
          value={discrimination.value}
          note={discrimination.note}
          tone={discrimination.tone}
        />
        <SignalTile
          label="Difficulty"
          value={difficulty.value}
          note={difficulty.note}
          tone={difficulty.tone}
        />
        <SignalTile
          label="Headroom"
          value={headroom.value}
          note={headroom.note}
          tone={headroom.tone}
        />
        <SignalTile
          label="References"
          value={refs.value}
          note={refs.note}
          tone={refs.tone}
        />
      </div>

    </section>
  );
}

function BenchmarkDetail({
  benchmark,
  onBack,
}: {
  benchmark: OEBenchmark;
  onBack: () => void;
}) {
  const slug = benchmarkSlug(benchmark.name);
  useEffect(() => {
    window.scrollTo({ top: 0, left: 0, behavior: "instant" });
  }, [benchmark.name, benchmark.version]);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState<OEItem[]>([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [submittedQuery, setSubmittedQuery] = useState('');
  const requestId = useRef(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState<Record<string, boolean>>({});

  const [measurements, setMeasurement] = useState<OEMeasurement[] | null>(null);
  const [computedAt, setComputedAt] = useState<string | undefined>();
  const [metricIndex, setMetricIndex] = useState(0);
  const measurement = measurements?.[metricIndex];
  const [progress, setProgress] = useState<MeasurementProgress | null>(null);
  const [retryStats, setRetryStats] = useState(0);
  const [mLoading, setMLoading] = useState(true);
  const [mError, setMError] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;
    const controller = new AbortController();
    setMetricIndex(0);
    setProgress(null);
    setComputedAt(undefined);
    setMLoading(true);
    setMError(null);
    setMeasurement(null);
    (async () => {
      try {
        if (benchmarkSnapshots[slug]) {
          const snapshot = benchmarkSnapshots[slug];
          if (snapshot.benchmark !== slug || !snapshot.computedAt || !Array.isArray(snapshot.measurements)) {
            throw new Error("Saved benchmark statistics are invalid.");
          }
          if (!alive) return;
          setComputedAt(snapshot.computedAt);
          setMeasurement(snapshot.measurements);
        } else {
          const data = await getMeasurement(slug, {
            signal: controller.signal,
            onProgress: value => { if (alive) setProgress(value); },
          });
          if (!alive) return;
          setMeasurement(data);
        }
      } catch (e) {
        if (alive) setMError(e instanceof Error ? e.message : "Failed to load stats");
      } finally {
        if (alive) setMLoading(false);
      }
    })();
    return () => {
      alive = false;
      controller.abort();
    };
  }, [slug, retryStats]);

  const load = useCallback(async (nextOffset = 0, searchQuery = query) => {
    const id = ++requestId.current;
    setLoading(true);
    setError(null);
    try {
      const p = new URLSearchParams({ split: slug, length: "20", offset: String(nextOffset) });
      if (searchQuery.trim()) p.set("q", searchQuery.trim());
      const res = await openEvalFetch(`/api/openeval/items?${p.toString()}`);
      const data = await res.json();
      if (id !== requestId.current) return;
      if (!res.ok) throw new Error(data.error || "Failed to load items");
      setOffset(nextOffset);
      setSubmittedQuery(searchQuery);
      setOpen({});
      setItems(data.items);
      setTotal(data.total);
    } catch (e) {
      if (id !== requestId.current) return;
      setError(e instanceof Error ? e.message : "Failed to load items");
      setItems([]);
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }, [slug, query]);

  useEffect(() => {
    load();
    return () => { requestId.current++; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return (
    <div>
      <button
        onClick={onBack}
        className="flex items-center gap-1.5 text-sm text-muted transition-colors hover:text-ink"
      >
        <IconArrowLeft size={16} /> All benchmarks
      </button>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-semibold text-ink">
            {benchmark.name}{benchmark.version && <span className="text-muted"> ({benchmark.version})</span>}
          </h2>
        </div>
        <div className="flex items-center gap-3 text-xs">
          {benchmark.paperUrl && (
            <a
              href={benchmark.paperUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted hover:text-ink"
            >
              Paper <IconExternalLink size={12} />
            </a>
          )}
          {benchmark.datasetUrl && (
            <a
              href={benchmark.datasetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-1 text-muted hover:text-ink"
            >
              Dataset <IconExternalLink size={12} />
            </a>
          )}
        </div>
      </div>

      {mLoading && (
        <div className="mt-5 flex items-center justify-center gap-2 rounded-2xl border border-border bg-surface py-12 text-sm text-muted shadow-soft">
          <IconLoader2 size={16} className="animate-spin" /> Pulling &amp; analyzing OpenEval data...
        </div>
      )}
      {mError && !mLoading && (
        <p className="mt-5 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {mError} <button className="underline" onClick={() => setRetryStats(value => value + 1)}>Retry</button>
        </p>
      )}
      {measurements?.length === 0 && !mLoading && !mError && (
        <p className="mt-5 text-sm text-muted">No applicable score metrics are available for this benchmark.</p>
      )}
      {measurement && !mLoading && (
        <div className="mt-5 flex flex-col gap-4">
          <MeasurementPanel m={measurement} benchmark={benchmark} computedAt={computedAt} measurements={measurements ?? []} metricIndex={metricIndex} onMetricChange={setMetricIndex} />
          <ValidityPanel m={measurement} benchmark={slug} />
        </div>
      )}

      <h3 className="mt-8 font-display text-lg font-semibold text-ink">
        Item content
      </h3>
      <div className="mt-3 flex gap-2">
        <div className="flex flex-1 items-center gap-2 rounded-input border border-border bg-surface px-3">
          <IconSearch size={16} className="text-muted" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") load();
            }}
            placeholder={`Search ${benchmark.name} items…`}
            className="w-full bg-transparent py-2.5 text-sm text-ink outline-none placeholder:text-muted"
          />
        </div>
        <button
          onClick={() => load()}
          className="rounded-full bg-ink px-5 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90"
        >
          Search
        </button>
      </div>

      <p className="mt-4 text-sm text-muted">
        {loading
          ? "Loading…"
          : `Showing ${items.length ? offset + 1 : 0}–${offset + items.length} of ${total.toLocaleString()} items`}
      </p>

      {error && (
        <p className="mt-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-600">
          {error} <button onClick={() => load(offset, submittedQuery)} className="underline">Retry</button>
        </p>
      )}

      {loading && (
        <div className="flex items-center justify-center gap-2 py-16 text-muted">
          <IconLoader2 size={18} className="animate-spin" /> Querying OpenEval…
        </div>
      )}

      {!loading && !error && (
        <div className="mt-4 flex flex-col gap-2">
          {items.map((it) => {
            const isOpen = !!open[it.id];
            const content = it.input || "(no input text)";
            const preview = !isOpen && content.length > 240
              ? content.slice(0, 240).trimEnd() + "…"
              : content;
            return (
              <div
                key={it.id}
                className="relative rounded-2xl border border-border bg-surface p-3 pr-10 shadow-soft"
              >
                <div className="text-left">
                  <span className="text-[15px] leading-relaxed text-ink">
                    {preview}{" "}
                    <span className="ml-3 inline-block text-[15px] text-muted">({it.references.length} reference{it.references.length === 1 ? "" : "s"})</span>
                  </span>
                </div>
                <button
                  className="absolute bottom-2 right-2 flex items-center justify-center p-1 text-muted"
                  aria-label={`${isOpen ? "Collapse" : "Expand"} item: ${content.slice(0, 80)}`}
                  aria-expanded={isOpen}
                  onClick={() => setOpen((o) => ({ ...o, [it.id]: !o[it.id] }))}
                >
                  <IconChevronDown size={18} className={`transition-transform ${isOpen ? "rotate-180" : ""}`} />
                </button>

                {isOpen && it.references.length > 0 && (
                  <div className="mt-3 border-t border-border pt-3">
                    <p className="mb-1.5 text-xs font-semibold text-muted">
                      References
                    </p>
                    <ul className="m-0 ml-6 flex list-disc flex-col gap-2 p-0 text-[#527a5a]">
                      {it.references.map((r, i) => (
                        <li
                          key={i}
                          className="pl-1 text-[15px] leading-relaxed text-[#527a5a]"
                        >
                          {r}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {!loading && !error && total > 0 && (
        <nav aria-label="Item pages" className="benchmark-pagination mt-4 flex items-center justify-center gap-3 text-sm">
          <button aria-label="Previous" className="px-2 py-2" disabled={offset === 0} onClick={() => load(Math.max(0, offset - 20), submittedQuery)}>&lt;</button>
          <span aria-live="polite">{Math.floor(offset / 20) + 1}/{Math.ceil(total / 20)} pages</span>
          <button aria-label="Next" className="px-2 py-2" disabled={offset + items.length >= total} onClick={() => load(offset + 20, submittedQuery)}>&gt;</button>
        </nav>
      )}
    </div>
  );
}
