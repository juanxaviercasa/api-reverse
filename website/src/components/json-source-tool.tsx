'use client';

import { useState } from 'react';
import { validateTarget } from '@/lib/knowledge-profiles';

export function JsonSourceTool() {
  const [url, setUrl] = useState('');
  const [operation, setOperation] = useState('derive');
  const [expression, setExpression] = useState('x^3 - 3x + 2');
  const [result, setResult] = useState<string>();
  const [message, setMessage] = useState('Consulta una API pública o prepara una consulta simbólica a Newton.');
  const [busy, setBusy] = useState(false);
  async function fetchJson() {
    setBusy(true); setResult(undefined);
    try {
      const target = validateTarget(url);
      const response = await fetch(target, { credentials: 'omit', signal: AbortSignal.timeout(20000), headers: { Accept: 'application/json' } });
      if (!response.ok) throw new Error(`La fuente respondió HTTP ${response.status}.`);
      const text = await response.text();
      if (text.length > 5_000_000) throw new Error('La respuesta supera el límite de vista previa de 5 MB. Usa el cliente local.');
      const value: unknown = JSON.parse(text);
      setResult(JSON.stringify(value, null, 2));
      setMessage('JSON recibido de la fuente. Puedes descargarlo para tu proyecto o IA.');
    } catch (error) {
      setMessage(`${error instanceof Error ? error.message : 'Error de consulta'} Si la fuente bloquea CORS, utiliza el motor de captura. No se generó una respuesta de respaldo.`);
    } finally { setBusy(false); }
  }
  function download() {
    if (!result) return;
    const objectUrl = URL.createObjectURL(new Blob([result], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = objectUrl; link.download = 'source-response.json'; link.click();
    setTimeout(() => URL.revokeObjectURL(objectUrl), 1000);
  }
  return <details className="rounded-2xl border border-fd-border bg-fd-card p-5 space-y-4">
    <summary className="cursor-pointer font-semibold text-ink">Consultar APIs abiertas sin agente</summary>
    <p className="text-sm text-ink-soft">Si ya tienes el endpoint JSON, consúltalo directamente. Esta vista no envía credenciales ni utiliza modelos de IA.</p>
    <label className="block text-sm text-ink">Endpoint JSON<input className="mt-2 w-full rounded-xl border border-fd-border bg-fd-background p-3 text-sm" type="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://fuente.org/api/recursos" /></label>
    <details className="space-y-3"><summary className="cursor-pointer text-sm text-ink">Consulta simbólica: Newton</summary>
      <label className="block text-sm text-ink">Operación<select className="ml-2 rounded border border-fd-border bg-fd-background p-2" value={operation} onChange={(event) => setOperation(event.target.value)}>{['derive', 'integrate', 'factor', 'simplify', 'zeroes'].map((value) => <option key={value}>{value}</option>)}</select></label>
      <label className="block text-sm text-ink">Expresión<input className="ml-2 rounded border border-fd-border bg-fd-background p-2" value={expression} onChange={(event) => setExpression(event.target.value)}/></label>
      <button className="text-sm text-fd-primary" onClick={() => setUrl(`https://newton.now.sh/api/v2/${operation}/${encodeURIComponent(expression)}`)}>Preparar endpoint</button>
    </details>
    <div className="flex gap-4"><button disabled={busy} className="rounded-xl bg-fd-primary px-4 py-2 text-sm text-white disabled:opacity-50" onClick={fetchJson}>{busy ? 'Consultando…' : 'Consultar JSON'}</button>{result && <button className="text-sm text-fd-primary" onClick={download}>Descargar JSON original</button>}</div>
    <p role="status" className="text-xs text-ink-soft">{message}</p>
    {result && <pre className="max-h-80 overflow-auto rounded-xl bg-fd-muted p-4 text-xs text-ink">{result}</pre>}
  </details>;
}
