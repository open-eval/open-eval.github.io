// Browser client adapted from ref_website/lib/openeval/client.ts.
// Queries Open-Eval-Commons/OpenEval live — no 8 GB download.

import type { OEBenchmark, OEItem, OEMeasurement, OEModelScore } from "./types";

const BASE = "https://datasets-server.huggingface.co";
const DATASET = "Open-Eval-Commons/OpenEval";

// Public dataset queries only. Never put a Hugging Face token in browser code.
const requests = new Map<string, Promise<Record<string, unknown>>>();
let activeRequests = 0;
const waiting: (() => void)[] = [];
async function limitedFetch(url: string, fresh = false): Promise<{ response: Response; data?: Record<string, unknown> }> {
  if (activeRequests >= 3) await new Promise<void>(resolve => waiting.push(resolve));
  activeRequests++;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 45000);
  try {
    const response = await fetch(url, { signal: controller.signal, cache: fresh ? "no-store" : "default" });
    // Keep the timeout and concurrency slot until the response body finishes.
    return { response, data: response.ok ? await response.json() : undefined };
  }
  finally {
    clearTimeout(timeout);
    activeRequests--;
    waiting.shift()?.();
  }
}
async function dsFetch(path: string, params: Record<string, string | number>, fresh = false): Promise<Record<string, unknown>> {
  const url = new URL(BASE + path);
  url.searchParams.set('dataset', DATASET);
  for (const [key, value] of Object.entries(params)) url.searchParams.set(key, String(value));
  const key = url.toString();
  if (!fresh && requests.has(key)) return requests.get(key)!;
  const request = (async () => {
    const location = `${params.config}/${params.split}, offset ${params.offset ?? 0}`;
    for (let attempt = 0; attempt < 4; attempt++) {
      let result: Awaited<ReturnType<typeof limitedFetch>>;
      try {
        result = await limitedFetch(key, fresh);
      } catch (error) {
        if (attempt === 3) {
          throw new Error(`Hugging Face network request failed (${location}) after 4 attempts. Check your connection and retry. No partial statistics were used.`);
        }
        await new Promise(resolve => setTimeout(resolve, 1000 * 2 ** attempt));
        continue;
      }
      const { response, data } = result;
      if (response.ok) return data!;
      if ((response.status !== 429 && response.status < 500) || attempt === 3) {
        throw new Error(`Hugging Face query failed (HTTP ${response.status}; ${location}). Please retry.`);
      }
      const retryAfter = response.headers.get('Retry-After');
      const seconds = retryAfter ? Number(retryAfter) : NaN;
      const wait = Number.isFinite(seconds) ? seconds * 1000 : 1000 * 2 ** attempt;
      await new Promise(resolve => setTimeout(resolve, Math.min(30000, Math.max(1000, wait))));
    }
    throw new Error('Hugging Face is unavailable. Please retry.');
  })();
  if (fresh) return request;
  requests.set(key, request);
  request.catch(() => requests.delete(key));
  // Bound both lifetime and memory when a visitor performs many searches.
  if (requests.size > 100) requests.delete(requests.keys().next().value!);
  setTimeout(() => requests.delete(key), 300000);
  return request;
}

/** Read a value that may be nested (item_content.input) or flattened. */
function pick(row: Record<string, unknown>, dotted: string): unknown {
  if (dotted in row) return row[dotted];
  let cur: unknown = row;
  for (const part of dotted.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[part];
  }
  return cur;
}

function asArray(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => typeof x === "string" ? x : JSON.stringify(x));
  if (v == null || v === "") return [];
  return [String(v)];
}

type DsRow = { row: Record<string, unknown>; row_idx?: number };

export async function listBenchmarks(): Promise<OEBenchmark[]> {
  const rows: DsRow[] = [];
  let total = Infinity;
  while (rows.length < total) {
    const data = await dsFetch('/rows', { config: 'bench', split: 'train', offset: rows.length, length: 100 }, true);
    const page = (data.rows as DsRow[]) ?? [];
    rows.push(...page);
    total = typeof data.num_rows_total === 'number' ? data.num_rows_total : rows.length;
    if (!page.length && rows.length < total) throw new Error("Hugging Face returned an incomplete benchmark catalog. Please retry.");
  }
  return rows
    .map((r) => {
      const row = r.row;
      return {
        name: String(pick(row, "benchmark_name") ?? ""),
        version: String(pick(row, "benchmark_version") ?? ""),
        tags: asArray(pick(row, "benchmark_tags")),
        paperUrl: (pick(row, "paper_url") as string) || undefined,
        datasetUrl: (pick(row, "dataset_url") as string) || undefined,
      };
    })
    .filter((b) => b.name);
}

export async function searchItems(opts: {
  split: string;
  query?: string;
  offset?: number;
  length?: number;
}): Promise<{ items: OEItem[]; total: number }> {
  const { split, query, offset = 0, length = 20 } = opts;
  const useSearch = !!query && query.trim().length > 0;
  const params: Record<string, string | number> = {
    config: "item",
    split,
    offset,
    length,
  };
  if (useSearch) params.query = query!.trim();

  const data = await dsFetch(useSearch ? "/search" : "/rows", params);
  const rows = (data.rows as DsRow[]) ?? [];

  const items: OEItem[] = rows.map((r) => {
    const row = r.row;
    return {
      id: String(pick(row, "item_id") ?? r.row_idx ?? crypto.randomUUID()),
      benchmark: split,
      input: asArray(pick(row, "item_content.input")).join("\n\n"),
      references: asArray(pick(row, "item_content.references")),
      source: (pick(row, "item_metadata.source") as string) || undefined,
    };
  });

  const total =
    typeof data.num_rows_total === "number"
      ? (data.num_rows_total as number)
      : items.length;

  return { items, total };
}

export type MeasurementProgress = { config: string; loaded: number; total: number };

/** Live preview of the first 1,000 responses; full item IDs for coverage and joins. */
export async function getMeasurement(split: string, options: {
  signal?: AbortSignal;
  onProgress?: (progress: MeasurementProgress) => void;
} = {}): Promise<OEMeasurement[]> {
  async function scan(config: string, consume: (row: Record<string, unknown>) => void, limit = Infinity) {
    let offset = 0, total = Infinity;
    while (offset < Math.min(total, limit)) {
      options.signal?.throwIfAborted();
      const data = await dsFetch('/rows', { config, split, offset, length: Math.min(100, limit - offset) }, true);
      options.signal?.throwIfAborted();
      if (typeof data.num_rows_total !== 'number') throw new Error('HF did not return a complete row count.');
      if (Number.isFinite(total) && total !== data.num_rows_total) throw new Error('HF data changed while loading. Please retry.');
      total = data.num_rows_total;
      const rows = (data.rows as DsRow[]) ?? [];
      if (!rows.length && offset < total) throw new Error('Incomplete HF page. Please retry.');
      for (const entry of rows) consume(entry.row);
      offset += rows.length;
      options.onProgress?.({ config, loaded: offset, total: Math.min(total, limit) });
    }
    return total;
  }
  const items = new Map<string, boolean>();
  await scan('item', row => {
    if (typeof row.item_id !== 'string') throw new Error('An item has no item_id.');
    items.set(row.item_id, asArray(pick(row, 'item_content.references')).length > 0);
  });
  type ResponseScore = { id: string; scores: Map<string, number> };
  const pairs = new Map<string, Map<string, ResponseScore>>();
  const metrics = new Set<string>();
  const totalResponses = await scan('response', row => {
    const name = pick(row, 'model.name');
    const id = row.response_id;
    if (typeof name !== 'string' || !name || typeof id !== 'string') throw new Error('A response has no model name or response_id.');
    let item = typeof row.item_id === 'string' ? row.item_id : '';
    if (!item) {
      // Repository converters generate response_id as item_id + model + response index.
      let prefix = id;
      while (prefix.includes('_')) {
        prefix = prefix.slice(0, prefix.lastIndexOf('_'));
        if (items.has(prefix)) { item = prefix; break; }
      }
    }
    if (!items.has(item)) throw new Error(`Cannot link response ${id} to an item in this benchmark.`);
    const scores = pick(row, 'scores') as { metric?: { name?: string }[]; value?: unknown[] } | undefined;
    const parsed = new Map<string, number>();
    scores?.metric?.forEach((metric, index) => {
      if (!metric.name) return;
      metrics.add(metric.name);
      const value = scores.value?.[index];
      if (typeof value === 'number' && Number.isFinite(value)) parsed.set(metric.name, value);
    });
    let model = pairs.get(name);
    if (!model) { model = new Map(); pairs.set(name, model); }
    const prior = model.get(item);
    // Pick a response independently of scores; do not combine metrics from different responses.
    if (!prior || id < prior.id) model.set(item, { id, scores: parsed });
  }, 1000);
  const itemCount = items.size;
  const minimumItems = Math.max(1, Math.ceil(itemCount * 0.1));
  return [...(metrics.size ? metrics : ['Unspecified'])].sort().map(metric => {
    const models: OEModelScore[] = [];
    let scoredResponses = 0;
    let bounded = true, binary = true;
    for (const [name, model] of pairs) {
      const values = [...model.values()].flatMap(response => {
        const value = response.scores.get(metric);
        return value === undefined || (value === -1 && (metric === "safety_llama_score" || metric.endsWith("_correctness"))) ? [] : [value];
      });
      if (values.length < minimumItems) continue;
      models.push({ name, mean: values.reduce((a, b) => a + b, 0) / values.length, n: values.length });
      scoredResponses += values.length;
      bounded &&= values.every(value => value >= 0 && value <= 1);
      binary &&= values.every(value => value === 0 || value === 1);
    }
    models.sort((a, b) => b.mean - a.mean || a.name.localeCompare(b.name));
    const means = models.map(model => model.mean).sort((a, b) => a - b);
    const n = means.length;
    const avgScore = n ? means.reduce((a, b) => a + b, 0) / n : 0;
    const squared = means.reduce((sum, value) => sum + (value - avgScore) ** 2, 0);
    const middle = Math.floor(n / 2);
    return {
      split, totalResponses, loadedResponses: Math.min(totalResponses, 1000), itemCount, scoredResponses, minimumItems,
      refCoverage: itemCount ? [...items.values()].filter(Boolean).length / itemCount : null,
      metrics: [metric], avgScore,
      medianScore: n ? n % 2 ? means[middle] : (means[middle - 1] + means[middle]) / 2 : null,
      standardError: n > 1 ? Math.sqrt(squared / (n - 1) / n) : null,
      discrimination: n ? Math.sqrt(squared / n) : 0,
      best: models[0] ?? null, worst: models.length ? models[models.length - 1] : null, models, bounded, binary,
    };
  });
}
