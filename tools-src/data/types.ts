// OpenEval (Open-Eval-Commons/OpenEval) — shared types + canonical splits.

export interface OEBenchmark {
  name: string;
  version: string;
  tags: string[];
  paperUrl?: string;
  datasetUrl?: string;
}

export interface OEItem {
  id: string;
  benchmark: string;
  input: string;
  references: string[];
  source?: string;
}

// One model's aggregated score on a benchmark (from its available items).
export interface OEModelScore {
  name: string;
  size?: string;
  mean: number; // 0..1
  n: number; // distinct scored items for this model
}

// Measurement-performance + validity signals for a benchmark, computed from a
// full scan of the OpenEval `response` split.
export interface OEMeasurement {
  labelFrequencies?: { label: string; count: number }[];
  split: string;
  loadedResponses: number; // first rows read for this preview
  totalResponses: number; // full size of the response split
  scoredResponses: number; // retained, distinct model–item scores for this metric
  minimumItems: number;
  itemCount: number; // size of the item split
  refCoverage: number | null; // fraction of benchmark items with gold references
  metrics: string[]; // distinct scoring metric names
  avgScore: number | null; // equally weighted mean of retained model means
  medianScore: number | null;
  standardError: number | null;
  discrimination: number | null; // std-dev of per-model means (higher = separates models)
  best: OEModelScore | null;
  worst: OEModelScore | null;
  models: OEModelScore[]; // per-model, sorted by mean desc
  bounded: boolean; // retained scores are all between 0 and 1
  binary: boolean; // true when every score is 0 or 1
}

// The 24 valid `item` splits in the dataset (one per benchmark), used as the
// selectable benchmarks for browsing/importing. Slugs are the real split names.
export const ITEM_SPLITS: { slug: string; label: string }[] = [
  { slug: "mmlu_pro", label: "MMLU-Pro" },
  { slug: "gpqa", label: "GPQA" },
  { slug: "omni_math", label: "Omni-MATH" },
  { slug: "ifeval", label: "IFEval" },
  { slug: "truthfulqa", label: "TruthfulQA" },
  { slug: "boolq", label: "BoolQ" },
  { slug: "bbq", label: "BBQ" },
  { slug: "bold", label: "BOLD" },
  { slug: "culturalbench", label: "CulturalBench" },
  { slug: "emobench", label: "EmoBench" },
  { slug: "hi_tom", label: "Hi-ToM" },
  { slug: "moralbench", label: "MoralBench" },
  { slug: "opentom", label: "OpenToM" },
  { slug: "wildbench", label: "WildBench" },
  { slug: "cnndm", label: "CNN/DailyMail" },
  { slug: "xsum", label: "XSum" },
  { slug: "imdb", label: "IMDB" },
  { slug: "disinformation", label: "Disinformation" },
  { slug: "salad_bench", label: "SALAD-Bench" },
  { slug: "harmbench", label: "HarmBench" },
  { slug: "xstest", label: "XSTest" },
  { slug: "simplesafetytests", label: "SimpleSafetyTests" },
  { slug: "do_not_answer", label: "Do-Not-Answer" },
  { slug: "anthropic_red_teaming", label: "Anthropic Red-Teaming" },
];

export const ITEM_SPLIT_SLUGS = new Set(ITEM_SPLITS.map((s) => s.slug));

export function splitLabel(slug: string): string {
  return ITEM_SPLITS.find((s) => s.slug === slug)?.label ?? slug;
}

/** bench-table names use hyphens (mmlu-pro); item splits use underscores (mmlu_pro). */
export function benchmarkSlug(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, "_");
}
