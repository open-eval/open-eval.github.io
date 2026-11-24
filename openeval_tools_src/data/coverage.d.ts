declare module "*/openeval_snapshots/coverage.jsonl" {
  const snapshot: {
    generated: string;
    totals: { benchmarks: number; models: number; items: number; responses: number };
    benchmarks: Record<string, {
      items: number;
      models: number;
      responses: number;
      rows: [model: string, itemsCovered: number, responses: number][];
    }>;
  };
  export default snapshot;
}
