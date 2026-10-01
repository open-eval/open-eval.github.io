export interface AbilityMetric {
  available: boolean;
  reason?: string;
  reverseCoded?: boolean;
  itemCount?: number;
  modelCount?: number;
  pairCount?: number;
  models?: { name: string; theta: number; sd: number; n: number }[];
}
export interface AbilitySnapshot {
  computedAt: string;
  metrics: Record<string, AbilityMetric>;
}
