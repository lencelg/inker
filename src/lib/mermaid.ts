import DOMPurify from 'dompurify';

type MermaidModule = typeof import('mermaid');

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
    const id = `markleaf-mermaid-${++renderCount}`;
    const { svg } = await module.default.render(id, source);
    document.getElementById(id)?.remove();
    const safeSvg = DOMPurify.sanitize(svg, {
      USE_PROFILES: { svg: true, svgFilters: true },
      ADD_TAGS: ['style'],
      ADD_ATTR: ['style'],
    });
    cache.set(source, safeSvg);
    return safeSvg;
  });

  renderQueue = task.then(
    () => undefined,
    () => undefined,
  );
  return task;
}
