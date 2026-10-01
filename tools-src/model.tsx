import { createRoot } from 'react-dom/client';
import { ModelScoresClient } from './components/model/model_performance_client';
const root = document.getElementById('model-tool');
if (root) createRoot(root).render(<ModelScoresClient />);

// Count each model once per benchmark, even when it has several metrics.
import { benchmarkSnapshots } from './data/snapshots';
const modelSets = Object.values(benchmarkSnapshots).map(snapshot =>
  new Set(snapshot.measurements.flatMap(measurement => measurement.models.map(model => model.name)))
);
const uniqueModels = new Set(modelSets.flatMap(models => [...models]));
const counts = modelSets.map(models => models.size).sort((a, b) => a - b);
const middle = Math.floor(counts.length / 2);
const median = counts.length ? (counts.length % 2 ? counts[middle] : (counts[middle - 1] + counts[middle]) / 2) : 0;
const totalNode = document.getElementById('summary-model-total');
const medianNode = document.getElementById('summary-model-median');
if (totalNode) totalNode.textContent = uniqueModels.size.toLocaleString('en-US');
if (medianNode) medianNode.textContent = median.toLocaleString('en-US');
