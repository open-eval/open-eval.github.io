import coverage from "../openeval_snapshots/coverage.jsonl";
import { createRoot } from "react-dom/client";
import { DataSummaryClient } from "./components/openeval-overview/data_summary_client";

const root = document.getElementById("schema-coverage");
if (root) createRoot(root).render(<DataSummaryClient />);

const totals = coverage.totals;
const counts = [
  ["hero-benchmark-count", totals.benchmarks],
  ["hero-item-count", totals.items],
  ["hero-response-count", totals.responses],
] as const;
const numberFormat = new Intl.NumberFormat("en-US");
for (const [id, count] of counts) {
  const element = document.getElementById(id);
  if (element) element.textContent = numberFormat.format(count);
}

const description = document.getElementById("repository-coverage");
if (description) {
  description.textContent = `A growing repository with ${numberFormat.format(totals.items)} items and ${numberFormat.format(totals.responses)} responses, covering diverse models, tasks, and constructs.`;
}
