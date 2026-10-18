'use client';

import { useEffect, useRef, useState } from 'react';
import { ArrowRight, Download, ExternalLink, LoaderCircle, Database, Copy } from 'lucide-react';
import { extractionPrompt, languages, profiles, validateTarget, type OutputLanguage, type ProfileId } from '@/lib/knowledge-profiles';
import { githubRequest, trackExtraction, trackingStartTime, type GitHubSettings } from '@/lib/github-extraction';
import { JsonSourceTool } from '@/components/json-source-tool';

const inputClass = 'w-full rounded-xl border border-fd-border bg-fd-background p-3 text-sm text-ink';
const panelClass = 'rounded-2xl border border-fd-border bg-fd-card p-5 space-y-4';

export function MathStudio() {
  const [profile, setProfile] = useState<ProfileId>('mathematics');
  const [url, setUrl] = useState('');
  const [goal, setGoal] = useState('Extraer un conjunto pequeño de problemas de álgebra con sus fórmulas, opciones y soluciones disponibles para reutilizarlos en mis aplicaciones.');
  const [language, setLanguage] = useState<OutputLanguage>('python');
  const [settings, setSettings] = useState<GitHubSettings>({ owner: 'juanxaviercasa', repo: 'api-reverse', branch: 'main', token: '' });
  const [status, setStatus] = useState<'idle' | 'running' | 'completed' | 'error'>('idle');
  const [message, setMessage] = useState('Configura una fuente y un objetivo. Cada extracción conserva su procedencia.');
  const [runUrl, setRunUrl] = useState('');
  const [artifacts, setArtifacts] = useState<{ id: number; name: string }[]>([]);
  const [runId, setRunId] = useState<number>();
  const [resultRepo, setResultRepo] = useState('');
  const controller = useRef<AbortController | null>(null);
  useEffect(() => {
    try { localStorage.removeItem('rae_gh_token'); } catch { /* Storage can be disabled. */ }
    return () => controller.current?.abort();
  }, []);
  const selected = profiles.find((item) => item.id === profile)!;
  const prompt = extractionPrompt(profile, goal);
  const dispatch = { ref: settings.branch, inputs: { url, prompt, language, profile, run_id: '<identificador generado al ejecutar>' } };

  async function start() {
    try {
      const target = validateTarget(url);
      if (!goal.trim() || goal.length > 6000) throw new Error('Describe un objetivo de entre 1 y 6000 caracteres.');
      if (!settings.token.trim() || !settings.branch.trim()) throw new Error('Completa el token temporal y la rama.');
      controller.current?.abort();
      const current = new AbortController();
      controller.current = current;
      setStatus('running'); setArtifacts([]); setRunUrl(''); setRunId(undefined);
      setResultRepo(`${settings.owner}/${settings.repo}`);
      setMessage('Enviando extracción a GitHub Actions…');
      const correlation = crypto.randomUUID();
      const startedAt = trackingStartTime();
      const requestSettings = { ...settings };
      await githubRequest(requestSettings, '/actions/workflows/reverse-api-backend.yml/dispatches', current.signal,
        { ref: settings.branch, inputs: { url: target, prompt, language, profile, run_id: correlation } });
      setMessage('Solicitud aceptada. Esperando al runner…');
      const run = await trackExtraction(requestSettings, correlation, startedAt, current.signal, (value) => {
        setRunUrl(value.html_url); setRunId(value.id);
        setMessage(value.status === 'queued' ? 'Extracción en cola…' : 'Capturando y preparando archivos. Puedes consultar los registros en GitHub.');
      });
      if (run.conclusion !== 'success') throw new Error(`La ejecución terminó con estado ${run.conclusion ?? 'desconocido'}. Revisa los registros en GitHub.`);
      const result = await githubRequest<{ artifacts: { id: number; name: string; expired: boolean }[] }>(requestSettings, `/actions/runs/${run.id}/artifacts`, current.signal);
      const files = result.artifacts.filter((item) => !item.expired && item.name.startsWith('knowledge-'));
      if (!files.length) throw new Error('La ejecución no tiene un paquete de resultados disponible.');
      setArtifacts(files); setStatus('completed');
      setMessage('Paquete disponible. Revisa su reporte de calidad: contiene JSON observados, sin respuestas inventadas.');
    } catch (error) {
      setStatus('error');
      setMessage(error instanceof Error && error.name === 'AbortError'
        ? 'Seguimiento detenido. El trabajo puede continuar en GitHub; consulta su estado antes de repetirlo.'
        : error instanceof Error ? error.message : 'No se pudo completar la extracción.');
    }
  }
  async function copyRequest() {
    try { await navigator.clipboard.writeText(JSON.stringify(dispatch, null, 2)); setMessage('Solicitud copiada como JSON.'); }
    catch { setMessage('No se pudo copiar. Selecciona el JSON de la solicitud.'); }
  }

  return <div className="mx-auto max-w-6xl px-4 py-12 space-y-8">
    <header className="space-y-4">
      <span className="text-xs font-semibold uppercase tracking-widest text-fd-primary">Knowledge Extraction Studio</span>
      <h1 className="font-display text-4xl font-bold text-ink">Conocimiento que conecta tus proyectos</h1>
      <p className="max-w-3xl text-ink-soft">Extrae datos de fuentes educativas y conviértelos en JSON reutilizables para tus sitios, evaluadores y experiencias de aprendizaje. El motor mantiene sus capacidades de descubrimiento y generación de clientes API.</p>
      <div className="flex flex-wrap items-center gap-2 text-xs text-ink-soft"><span>Fuente</span><ArrowRight size={14}/><span>Captura</span><ArrowRight size={14}/><span>JSON con procedencia</span><ArrowRight size={14}/><span>Tus aplicaciones e IA</span></div>
    </header>
    <section aria-label="Perfiles de extracción" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {profiles.map((item) => <button key={item.id} onClick={() => setProfile(item.id)} aria-pressed={profile === item.id}
        className={`rounded-2xl border p-4 text-left transition-colors ${profile === item.id ? 'border-fd-primary bg-fd-primary/10' : 'border-fd-border bg-fd-card hover:bg-fd-muted'}`}>
        <span className="block font-semibold text-ink">{item.title}</span><span className="mt-2 block text-xs text-ink-soft">{item.use}</span>
      </button>)}
    </section>
    <div className="grid gap-6 lg:grid-cols-2">
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-ink">1. Define la extracción</h2>
        <p className="text-xs text-ink-soft">Perfil: {selected.title}. La compatibilidad de cada fuente debe comprobarse.</p>
        <label className="block text-sm text-ink">URL de la fuente<input className={`${inputClass} mt-2`} type="url" placeholder="https://tu-fuente-educativa.org" value={url} onChange={(event) => setUrl(event.target.value)} /></label>
        <label className="block text-sm text-ink">Objetivo y alcance<textarea className={`${inputClass} mt-2`} rows={5} maxLength={6000} value={goal} onChange={(event) => setGoal(event.target.value)}/></label>
        <label className="block text-sm text-ink">Lenguaje del cliente reutilizable<select className={`${inputClass} mt-2`} value={language} onChange={(event) => setLanguage(event.target.value as OutputLanguage)}>{languages.map((value) => <option key={value}>{value}</option>)}</select></label>
        <p className="text-xs text-ink-soft">Las fórmulas y soluciones ausentes no se completan automáticamente. Puedes mapear los archivos después con tu IA preferida.</p>
      </section>
      <section className={panelClass}>
        <h2 className="text-lg font-semibold text-ink">2. Conecta tu ejecución</h2>
        <div className="grid gap-3 sm:grid-cols-2">{(['owner', 'repo', 'branch'] as const).map((key) => <label key={key} className="text-sm text-ink">{{ owner: 'Usuario de GitHub', repo: 'Repositorio', branch: 'Rama' }[key]}<input className={`${inputClass} mt-2`} value={settings[key]} onChange={(event) => setSettings({ ...settings, [key]: event.target.value })}/></label>)}</div>
        <label className="block text-sm text-ink">Token temporal de GitHub<input className={`${inputClass} mt-2`} type="password" autoComplete="off" value={settings.token} onChange={(event) => setSettings({ ...settings, token: event.target.value })}/></label>
        <p className="text-xs text-ink-soft">Se mantiene en memoria hasta cerrar o recargar. Necesita Actions: lectura y escritura en este repositorio. El runner requiere ANTHROPIC_API_KEY en sus secretos; consumo y disponibilidad dependen de tu cuenta.</p>
        <div className="flex flex-wrap gap-3"><button disabled={status === 'running'} onClick={start} className="rounded-xl bg-fd-primary px-5 py-3 text-sm font-semibold text-white disabled:opacity-50">{status === 'running' ? <LoaderCircle className="inline mr-2 animate-spin" size={16}/> : <Database className="inline mr-2" size={16}/>}Extraer y exportar</button>
          <button className="text-sm text-ink-soft" onClick={() => { controller.current?.abort(); setSettings({ ...settings, token: '' }); }}>Borrar token</button>
          {status === 'running' && <button className="text-sm text-ink-soft" onClick={() => controller.current?.abort()}>Detener seguimiento</button>}</div>
      </section>
    </div>
    <section className={panelClass} aria-label="Resultados">
      <h2 className="text-lg font-semibold text-ink">3. Recupera tus datos</h2>
      <p role="status" aria-live="polite" className={status === 'error' ? 'text-red-500 text-sm' : 'text-ink-soft text-sm'}>{message}</p>
      {runUrl && <a className="inline-flex items-center gap-2 text-fd-primary text-sm" href={runUrl} target="_blank" rel="noreferrer">Ver ejecución y registros <ExternalLink size={14}/></a>}
      {artifacts.map((item) => <a key={item.id} className="flex items-center gap-2 text-fd-primary" href={`https://github.com/${resultRepo}/actions/runs/${runId}/artifacts/${item.id}`} target="_blank" rel="noreferrer"><Download size={16}/>Descargar {item.name}</a>)}
      <p className="text-xs text-ink-soft">Paquete: respuestas saneadas, registros normalizados, manifiesto y reporte de calidad. Puede contener datos parciales: verifica la cobertura. Los clientes generados se conservan en ejecuciones locales; su publicación automática requiere una revisión independiente de secretos. La descarga requiere iniciar sesión en GitHub.</p>
    </section>
    <details className={panelClass}><summary className="cursor-pointer font-semibold text-ink">Solicitud reproducible</summary><p className="text-xs text-ink-soft">JSON para la API de despacho de GitHub. El motor CLI conserva sus modos manual, agent, engineer y collector.</p><pre className="overflow-auto whitespace-pre-wrap text-xs text-ink-soft">{JSON.stringify(dispatch, null, 2)}</pre><button onClick={copyRequest} className="text-sm text-fd-primary"><Copy size={14} className="inline mr-2"/>Copiar JSON</button></details>
    <details className={panelClass}><summary className="cursor-pointer font-semibold text-ink">Usar JSON que ya tienes</summary><p className="text-sm text-ink-soft">Normaliza capturas locales sin ejecutar un agente: <code>python -m reverse_api.knowledge normalize entrada.json --source-url https://fuente.org --output dataset</code>. La estructura original se conserva en cada registro; el mapeo semántico con IA es una etapa posterior.</p></details>
    <JsonSourceTool />
  </div>;
}
