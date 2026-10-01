/** Declared score ranges, not observed minima/maxima. Raw statistics stay unchanged. */
export function metricRange(metric: string, benchmark?: string) {
  // Likelihood alone does not indicate better performance or less bias on BOLD.
  if (benchmark === 'bold' && metric === 'logprob') {
    return { label: '(−∞, 0]', directionUnknown: true };
  }
  if (benchmark === 'health_orsc_bench' && metric === 'refusal-strings') {
    return { label: '[0, 1]', min: 0, max: 1, lower: true };
  }
  // Archived OR-Bench items do not identify benign versus toxic subsets.
  if (benchmark === 'or_bench' && metric === 'orbench-refusal') {
    return { label: '[0, 1]', min: 0, max: 1, directionUnknown: true };
  }
  if (metric === 'human_weighted_score') return { label: '[0, 5]', min: 0, max: 5 };
  if (metric === 'logprob') return { label: '(−∞, 0]' };
  if (metric === 'monte_carlo_entropy') return { label: '[0, +∞)' };
  if (metric.startsWith('BERTScore-')) return { label: '(−∞, 1]' };
  if (/bleurt/i.test(metric) && !metric.endsWith('_acc')) return { label: '(−∞, +∞)' };
  if (metric === 'do-not-answer_annotation') return { label: 'categorical' };
  if (metric === 'summac') return { label: '[−1, 1]', min: -1, max: 1 };
  if (metric === 'self_bleu') return { label: '[0, 100]', min: 0, max: 100, lower: true };
  if (/^(bleu|rouge[12L])_diff$/.test(metric)) return { label: '[−100, 100]', min: -100, max: 100 };
  if (/^(bleu|rouge[12L])_max$/.test(metric)) return { label: '[0, 100]', min: 0, max: 100 };
  if (/^(claude|gpt|llama)_score$/.test(metric)) return { label: '[1, 10]', min: 1, max: 10 };
  if (/exact_match$|correctness$|accuracy$|_acc$/.test(metric) ||
      ['refusal-strings', 'safety_gpt_score', 'safety_llama_score', 'haiku-llm-judge',
       'longformer-action-ro', 'orbench-refusal', 'attack_success', 'wildbench_score_rescaled',
       'ft-mistral-7b-sorrybench', 'rouge_1', 'rouge_2', 'rouge_l'].includes(metric)) {
    return { label: '[0, 1]', min: 0, max: 1,
      lower: ['attack_success', 'ft-mistral-7b-sorrybench'].includes(metric) };
  }
  return { label: 'not configured' };
}

/** Exploratory scale-relative cutoffs; these are not empirically validated validity tests. */
export const diagnosticThresholds = {
  discrimination: { moderate: 0.08, strong: 0.15 },
  difficulty: { hard: 0.35, easy: 0.70 },
  headroom: { limited: 0.85, saturated: 0.95 },
};
