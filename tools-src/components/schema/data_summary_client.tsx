"use client";

import data from "../../../precomputed/coverage.json";

const format = (value: number) => value.toLocaleString("en-US");

type BenchmarkCoverage = { items: number; models: number; responses: number; rows: (string | number)[][] };

function coverageRange(benchmark: BenchmarkCoverage) {
  if (!benchmark.items || !benchmark.rows.length) return "—";
  const values = benchmark.rows.map(row => 100 * Number(row[1]) / benchmark.items).sort((a, b) => a - b);
  const middle = Math.floor(values.length / 2);
  const median = values.length % 2 ? values[middle] : (values[middle - 1] + values[middle]) / 2;
  return `${values[0].toFixed(1)}%–${values[values.length - 1].toFixed(1)}% (med. ${median.toFixed(1)}%)`;
}

export function DataSummaryClient() {
  const benchmarks = Object.entries(data.benchmarks).sort(([a], [b]) => a.localeCompare(b));
  const date = new Date(data.generated).toLocaleDateString("en-US", {
    month: "short", day: "numeric", year: "numeric", timeZone: "UTC",
  }).replace(/^(\w+) /, "$1. ");
  return <section className="schema-coverage" aria-labelledby="coverage-title">
    <h2 id="coverage-title" className="section-title">Data summary</h2>
    <p className="section-sub">OpenEval currently includes <strong>{format(data.totals.benchmarks)}</strong> benchmarks, <strong>{format(data.totals.models)}</strong> models, <strong>{format(data.totals.items)}</strong> items, and <strong>{format(data.totals.responses)}</strong> model responses.</p>
    <div className="coverage-summary-card">
      <div className="coverage-table-scroll">
        <table className="coverage-snapshot-table">
          <thead><tr>{["Benchmark", "Items", "Models", "Responses", "Item coverage"].map(label => <th key={label} scope="col">{label}</th>)}</tr></thead>
          <tbody>{benchmarks.map(([name, benchmark]) => <tr key={name}>
            <th scope="row"><a href={`benchmark.html#benchmark=${encodeURIComponent(name.replaceAll("_", "-"))}&version=`}>{name.replaceAll("_", "-")}</a></th>
            <td>{format(benchmark.items)}</td><td>{format(benchmark.models)}</td><td>{format(benchmark.responses)}</td><td>{coverageRange(benchmark)}</td>
          </tr>)}</tbody>
        </table>
      </div>
      <p className="coverage-snapshot-note coverage-summary-footnote">*Snapshot as of {date}. Model aliases are merged; item coverage counts distinct items across aliases.</p>
    </div>
  </section>;
}
