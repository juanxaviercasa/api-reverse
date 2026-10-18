export interface GitHubSettings { owner: string; repo: string; token: string; branch: string }
export interface ExtractionRun { id: number; html_url: string; status: string; conclusion: string | null }
export function trackingStartTime(): string { return new Date(Date.now() - 60000).toISOString(); }
export async function githubRequest<T>(settings: GitHubSettings, path: string, signal: AbortSignal, body?: unknown): Promise<T> {
  if (!/^[\w.-]+$/.test(settings.owner) || !/^[\w.-]+$/.test(settings.repo)) throw new Error('Usuario o repositorio inválido.');
  const response = await fetch(`https://api.github.com/repos/${settings.owner}/${settings.repo}${path}`, {
    method: body ? 'POST' : 'GET', signal: AbortSignal.any([signal, AbortSignal.timeout(30000)]),
    headers: { Accept: 'application/vnd.github+json', Authorization: `Bearer ${settings.token}`, 'Content-Type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  if (!response.ok) throw new Error(`GitHub respondió ${response.status}. Comprueba permisos de Actions y configuración del repositorio.`);
  return (response.status === 204 ? undefined : await response.json()) as T;
}
function delay(signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(timer); reject(new DOMException('Seguimiento detenido', 'AbortError')); };
    const timer = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, 5000);
    signal.addEventListener('abort', abort, { once: true });
    if (signal.aborted) abort();
  });
}
export async function trackExtraction(settings: GitHubSettings, correlation: string, startedAt: string, signal: AbortSignal, update: (run: ExtractionRun) => void): Promise<ExtractionRun> {
  const deadline = Date.now() + 20 * 60 * 1000;
  let run: ExtractionRun | undefined;
  while (Date.now() < deadline) {
    if (signal.aborted) throw new DOMException('Seguimiento detenido', 'AbortError');
    if (!run) {
      const data = await githubRequest<{ workflow_runs: (ExtractionRun & { display_title: string })[] }>(settings,
        `/actions/workflows/reverse-api-backend.yml/runs?event=workflow_dispatch&per_page=100&created=${encodeURIComponent(`>=${startedAt}`)}`, signal);
      run = data.workflow_runs.find((item) => item.display_title === `knowledge-${correlation}`);
    } else run = await githubRequest<ExtractionRun>(settings, `/actions/runs/${run.id}`, signal);
    if (run) { update(run); if (run.status === 'completed') return run; }
    await delay(signal);
  }
  throw new Error('Se agotó el seguimiento. Consulta la ejecución en GitHub antes de reintentar.');
}
