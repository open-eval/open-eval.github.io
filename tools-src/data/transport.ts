import { listBenchmarks, searchItems, getMeasurement } from './client';

// Replaces the three Next.js API routes without changing the component contracts.
export async function openEvalFetch(input: string, init?: RequestInit): Promise<Response> {
  const url = new URL(input, window.location.href);
  if (!url.pathname.startsWith('/api/openeval/')) return fetch(input, init);
  try {
    let payload: unknown;
    if (url.pathname.endsWith('/benchmarks')) payload = { benchmarks: await listBenchmarks() };
    else if (url.pathname.endsWith('/items')) {
      payload = await searchItems({
        split: url.searchParams.get('split') || '',
        query: url.searchParams.get('q') || '',
        offset: Math.max(0, Number(url.searchParams.get('offset')) || 0),
        length: Math.min(100, Math.max(1, Number(url.searchParams.get('length')) || 20))
      });
    } else if (url.pathname.endsWith('/measurement')) {
      payload = await getMeasurement(url.searchParams.get('split') || '');
    } else throw new Error('Unknown data query');
    return new Response(JSON.stringify(payload), { status: 200, headers: {'Content-Type': 'application/json'} });
  } catch (error) {
    return new Response(JSON.stringify({error: error instanceof Error ? error.message : 'Unable to load data.'}), {status: 502});
  }
}
