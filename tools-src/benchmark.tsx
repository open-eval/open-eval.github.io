import { createRoot } from 'react-dom/client';
import { BenchBrowserClient } from './components/benchmark/benchmark_browser_client';
const root = document.getElementById('benchmark-tool');
if (root) createRoot(root).render(<BenchBrowserClient />);
