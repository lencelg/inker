type MermaidModule = typeof import('mermaid');
const MAX_CACHE_ENTRIES = 40;
let loader: Promise<MermaidModule> | null = null;
let renderQueue: Promise<unknown> = Promise.resolve();
let renderCount = 0;
const cache = new Map<string, string>();

async function loadMermaid(): Promise<MermaidModule> {
  loader ??= import('mermaid').then((module) => {
    module.default.initialize({
      startOnLoad: false,
      securityLevel: 'strict',
      theme: 'default',
      fontFamily: 'Inter, PingFang SC, sans-serif',
      flowchart: { htmlLabels: false },
    });
    return module;
  });
  return loader;
}

export function renderMermaid(source: string): Promise<string> {
  const cached = cache.get(source);
  if (cached) return Promise.resolve(cached);

  const task = renderQueue.then(async () => {
    const module = await loadMermaid();
    const id = `inker-mermaid-${++renderCount}`;
    const { svg } = await module.default.render(id, source);
    document.getElementById(id)?.remove();
    // securityLevel strict already sanitizes labels; an extra SVG pass strips them.
    cache.set(source, svg);
    while (cache.size > MAX_CACHE_ENTRIES) {
      const oldest = cache.keys().next().value;
      if (oldest === undefined) break;
      cache.delete(oldest);
    }
    return svg;
  });

  renderQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
