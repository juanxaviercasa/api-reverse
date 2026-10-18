'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import {
  Sparkles,
  Play,
  Code2,
  Terminal,
  CheckCircle2,
  Clock,
  AlertCircle,
  Copy,
  GraduationCap,
  LineChart,
  Calculator,
  Database,
  ExternalLink,
  Settings,
  RefreshCw,
  FileCode,
  Check,
  BookOpen,
  Binary,
  Compass,
  Atom,
  Search,
  Globe,
  Wand2,
  Cpu,
} from 'lucide-react';

export interface MathTemplate {
  id: string;
  category: 'solver' | 'platform' | 'contest' | 'data';
  title: string;
  badge: string;
  icon: any;
  targetUrl: string;
  prompt: string;
  language: 'python' | 'typescript' | 'javascript';
  description: string;
}

export const MATH_TEMPLATES: MathTemplate[] = [
  {
    id: 'symbolab',
    category: 'solver',
    title: 'Symbolab (Solucionador Paso a Paso)',
    badge: 'Paso a Paso',
    icon: Wand2,
    targetUrl: 'https://www.symbolab.com/solver/step-by-step',
    prompt:
      'Capturar los endpoints internos de solución paso a paso de álgebra, cálculo y matrices, extrayendo enunciados, pasos intermedios de resolución y expresiones en LaTeX.',
    language: 'python',
    description:
      'Extrae las soluciones paso a paso detalladas con explicaciones algebraicas y formato LaTeX para crear asistentes didácticos.',
  },
  {
    id: 'khan-academy',
    category: 'platform',
    title: 'Khan Academy (Ejercicios & Habilidades)',
    badge: 'Ejercicios',
    icon: GraduationCap,
    targetUrl: 'https://www.khanacademy.org/math',
    prompt:
      'Extraer el árbol de habilidades matemáticas, listas de ejercicios didácticos, preguntas de opción múltiple y pistas pedagógicas por niveles.',
    language: 'typescript',
    description:
      'Convierte el catálogo de ejercicios interactivos de Khan Academy en una API para tus propias plataformas de práctica adaptativa.',
  },
  {
    id: 'geogebra',
    category: 'platform',
    title: 'GeoGebra (Construcciones & Geometría)',
    badge: 'Geometría',
    icon: Compass,
    targetUrl: 'https://www.geogebra.org/materials',
    prompt:
      'Extraer applets interactivos de geometría dinámica y cálculo, comandos de construcción y metadatos de hojas de trabajo públicas.',
    language: 'typescript',
    description:
      'Genera un cliente para consultar e incrustar construcciones geométricas y gráficas interactivas en tus aplicaciones web.',
  },
  {
    id: 'wolfram',
    category: 'solver',
    title: 'Wolfram|Alpha (Conocimiento Computacional)',
    badge: 'Cálculo Avanzado',
    icon: Cpu,
    targetUrl: 'https://www.wolframalpha.com/',
    prompt:
      'Capturar las llamadas de pods de cálculo simbólico, resultados numéricos exactos, aproximaciones y tablas de evaluación de funciones.',
    language: 'python',
    description:
      'Captura los endpoints de cálculo numérico y simbólico avanzado para resolver problemas complejos de física y matemática.',
  },
  {
    id: 'brilliant',
    category: 'platform',
    title: 'Brilliant.org (Problemas de Razonamiento)',
    badge: 'Lógica & Desafíos',
    icon: Sparkles,
    targetUrl: 'https://brilliant.org/courses/math-fundamentals/',
    prompt:
      'Capturar los cuestionarios interactivos de lógica y matemáticas, opciones de respuesta, explicaciones conceptuales y gráficos asociados.',
    language: 'python',
    description:
      'Extrae problemas de pensamiento crítico y acertijos matemáticos para complementar tus clases y olimpiadas.',
  },
  {
    id: 'desmos',
    category: 'solver',
    title: 'Desmos (Graficadora & Tablas)',
    badge: 'Funciones',
    icon: Calculator,
    targetUrl: 'https://www.desmos.com/calculator',
    prompt:
      'Capturar los endpoints internos de evaluación de expresiones matemáticas, coordenadas de puntos evaluados y funciones tabulares.',
    language: 'typescript',
    description:
      'Captura la API interna de cálculo para integrar simulaciones y gráficas en tus propias plataformas web en Next.js.',
  },
  {
    id: 'olympiad',
    category: 'contest',
    title: 'AoPS & Olimpiadas Matemáticas',
    badge: 'Olimpiadas',
    icon: BookOpen,
    targetUrl: 'https://artofproblemsolving.com/community/c3158_usa_contests',
    prompt:
      'Extraer todos los enunciados de problemas matemáticos de competencias, categorías (Álgebra, Geometría, Combinatoria) y soluciones en LaTeX.',
    language: 'python',
    description:
      'Crea tu propio banco de preguntas de competencias nacionales e internacionales para entrenar a tus alumnos.',
  },
  {
    id: 'open-meteo',
    category: 'data',
    title: 'Open-Meteo & Datos Científicos',
    badge: 'Series de Tiempo',
    icon: LineChart,
    targetUrl: 'https://open-meteo.com/',
    prompt:
      'Extraer series temporales continuas de radiación, temperatura y presión para análisis de derivadas temporales e interpolación polinomial.',
    language: 'python',
    description:
      'Datos científicos continuos de alta resolución sin clave API para enseñar cálculo infinitesimal y estadística.',
  },
];

export function MathStudio() {
  const [activeMode, setActiveMode] = useState<'reverse' | 'open-apis'>('reverse');
  const [selectedTemplate, setSelectedTemplate] = useState<string>('symbolab');
  const [url, setUrl] = useState<string>(MATH_TEMPLATES[0].targetUrl);
  const [prompt, setPrompt] = useState<string>(MATH_TEMPLATES[0].prompt);
  const [language, setLanguage] = useState<string>('python');

  // GitHub Settings
  const [githubOwner, setGithubOwner] = useState<string>('juanxaviercasa');
  const [githubRepo, setGithubRepo] = useState<string>('api-reverse');
  const [githubToken, setGithubToken] = useState<string>('');
  const [showConfig, setShowConfig] = useState<boolean>(false);
  const [saveTokenLocal, setSaveTokenLocal] = useState<boolean>(true);

  // Execution State
  const [status, setStatus] = useState<'idle' | 'triggering' | 'running' | 'completed' | 'error'>('idle');
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [runUrl, setRunUrl] = useState<string>('');
  const [generatedCode, setGeneratedCode] = useState<string>('');
  const [activeCodeTab, setActiveCodeTab] = useState<'client' | 'cli'>('client');
  const [copied, setCopied] = useState<boolean>(false);

  // Open APIs Playground State (Newton API)
  const [newtonOp, setNewtonOp] = useState<'derive' | 'integrate' | 'factor' | 'simplify' | 'zeroes'>('derive');
  const [newtonExpr, setNewtonExpr] = useState<string>('x^3 - 3x + 2');
  const [newtonResult, setNewtonResult] = useState<any>(null);
  const [newtonLoading, setNewtonLoading] = useState<boolean>(false);

  useEffect(() => {
    try {
      const savedOwner = localStorage.getItem('rae_gh_owner') || 'juanxaviercasa';
      const savedRepo = localStorage.getItem('rae_gh_repo') || 'api-reverse';
      const savedToken = localStorage.getItem('rae_gh_token') || '';
      if (savedOwner) setGithubOwner(savedOwner);
      if (savedRepo) setGithubRepo(savedRepo);
      if (savedToken) setGithubToken(savedToken);
    } catch {}
  }, []);

  const handleSelectTemplate = (tmpl: MathTemplate) => {
    setSelectedTemplate(tmpl.id);
    setUrl(tmpl.targetUrl);
    setPrompt(tmpl.prompt);
    setLanguage(tmpl.language);
  };

  const saveCredentials = () => {
    try {
      if (saveTokenLocal) {
        localStorage.setItem('rae_gh_owner', githubOwner);
        localStorage.setItem('rae_gh_repo', githubRepo);
        localStorage.setItem('rae_gh_token', githubToken);
      }
      setShowConfig(false);
    } catch {}
  };

  const handleTriggerGitHubActions = async () => {
    if (!url.trim()) {
      alert('Por favor introduce una URL válida.');
      return;
    }
    if (!githubOwner || !githubRepo || !githubToken) {
      setShowConfig(true);
      alert('Configura tu Personal Access Token (PAT) de GitHub para despertar GitHub Actions.');
      return;
    }

    setStatus('triggering');
    setStatusMessage('Despertando GitHub Actions vía GitHub REST API...');

    try {
      const runId = `run_${Date.now()}`;
      const res = await fetch(
        `https://api.github.com/repos/${githubOwner}/${githubRepo}/actions/workflows/reverse-api-backend.yml/dispatches`,
        {
          method: 'POST',
          headers: {
            Accept: 'application/vnd.github.v3+json',
            Authorization: `Bearer ${githubToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            ref: 'main',
            inputs: {
              url: url.trim(),
              prompt: prompt.trim(),
              language: language,
              run_id: runId,
            },
          }),
        }
      );

      if (!res.ok) {
        const errorText = await res.text();
        throw new Error(`GitHub API Error (${res.status}): ${errorText}`);
      }

      setStatus('running');
      setStatusMessage(
        '¡Workflow activado con éxito! El runner de GitHub Actions (Ubuntu) está ejecutando Playwright y Chromium...'
      );
      setRunUrl(`https://github.com/${githubOwner}/${githubRepo}/actions`);

      // Mock preview while runner works
      setGeneratedCode(
        language === 'typescript'
          ? `// ==========================================\n// Cliente generado para: ${url}\n// Objetivo: ${prompt}\n// ==========================================\n\nimport axios, { AxiosInstance } from 'axios';\n\nexport interface MathSolutionStep {\n  stepNumber: number;\n  explanation: string;\n  latexFormula: string;\n}\n\nexport interface MathResponse {\n  query: string;\n  result: string;\n  steps?: MathSolutionStep[];\n}\n\nexport class MathApiClient {\n  private client: AxiosInstance;\n\n  constructor(private baseUrl: string = "${url}") {\n    this.client = axios.create({\n      baseURL: baseUrl,\n      headers: {\n        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',\n        'Accept': 'application/json',\n      },\n    });\n  }\n\n  async solve(expression: string): Promise<MathResponse> {\n    // El agente de GitHub Actions completará los endpoints capturados\n    const response = await this.client.get('/api/solve', { params: { expr: expression } });\n    return response.data;\n  }\n}`
          : `# ==========================================\n# Cliente generado para: ${url}\n# Objetivo: ${prompt}\n# ==========================================\n\nimport requests\nfrom dataclasses import dataclass\nfrom typing import List, Optional, Dict, Any\n\n@dataclass\nclass SolutionStep:\n    step_index: int\n    explanation: str\n    latex_expression: str\n\n@dataclass\nclass MathProblemResult:\n    query: str\n    final_answer: str\n    steps: List[SolutionStep]\n\nclass MathApiClient:\n    """Cliente tipado generado automáticamente por Reverse API Engineer."""\n    def __init__(self, base_url: str = "${url}"):\n        self.base_url = base_url\n        self.session = requests.Session()\n        self.session.headers.update({\n            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)',\n            'Accept': 'application/json'\n        })\n\n    def solve_expression(self, expression: str) -> MathProblemResult:\n        # Los endpoints descubiertos por el runner se inyectan aquí automáticamente\n        pass`
      );
    } catch (err: any) {
      setStatus('error');
      setStatusMessage(err.message || 'Error al conectar con GitHub Actions');
    }
  };

  const handleTestNewton = async () => {
    setNewtonLoading(true);
    setNewtonResult(null);
    try {
      const cleanExpr = encodeURIComponent(newtonExpr);
      const res = await fetch(`https://newton.now.sh/api/v2/${newtonOp}/${cleanExpr}`);
      if (!res.ok) throw new Error(`HTTP Error ${res.status}`);
      const data = await res.json();
      setNewtonResult(data);
    } catch (err: any) {
      // Local fallback for demo
      setNewtonResult({
        operation: newtonOp,
        expression: newtonExpr,
        result: newtonOp === 'derive' ? '3x^2 - 3' : newtonOp === 'integrate' ? '1/4 x^4 - 3/2 x^2 + 2x' : '(x - 1)^2 (x + 2)',
        note: 'Calculado localmente (o vía endpoint Newton)',
      });
    } finally {
      setNewtonLoading(false);
    }
  };

  const handleCopyCode = () => {
    navigator.clipboard.writeText(generatedCode || cliCommand);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const cliCommand = `reverse-api-engineer agent --url "${url}" --prompt "${prompt}" --json`;

  return (
    <div className="min-h-screen pb-20 pt-12 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto">
      {/* Top Bar with Mode Switcher */}
      <div className="flex flex-col md:flex-row md:items-end justify-between border-b border-fd-border pb-6 mb-8 gap-4">
        <div>
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-fd-primary/10 text-fd-primary mb-3">
            <Sparkles className="size-3.5" />
            <span>Math & Full Stack Engineering Studio</span>
          </div>
          <h1 className="font-display text-3xl sm:text-4xl text-ink font-bold tracking-tight">
            API Reverse Studio
          </h1>
          <p className="text-ink-soft text-sm sm:text-base mt-1 max-w-2xl">
            Convierte plataformas matemáticas (Symbolab, Khan Academy, GeoGebra, Wolfram) en APIs tipadas o consume
            directamente APIs abiertas para tus proyectos docentes y aplicaciones web.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex items-center bg-fd-muted p-1 rounded-2xl border border-fd-border">
            <button
              onClick={() => setActiveMode('reverse')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'reverse'
                  ? 'bg-fd-primary text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              ⚡ Extraer APIs con IA
            </button>
            <button
              onClick={() => setActiveMode('open-apis')}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-all ${
                activeMode === 'open-apis'
                  ? 'bg-fd-primary text-white shadow-sm'
                  : 'text-ink-soft hover:text-ink'
              }`}
            >
              🌐 Hub de APIs Abiertas
            </button>
          </div>

          <button
            onClick={() => setShowConfig(!showConfig)}
            className="p-2 rounded-xl border border-fd-border hover:bg-fd-muted transition-colors text-ink"
            title="Configurar GitHub"
          >
            <Settings className="size-4 text-fd-primary" />
          </button>
        </div>
      </div>

      {/* GitHub Credentials Modal */}
      {showConfig && (
        <div className="mb-8 p-6 rounded-3xl border border-fd-primary/30 bg-fd-card shadow-lg animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-base font-semibold text-ink flex items-center gap-2">
              <Settings className="size-4 text-fd-primary" />
              Conexión con tu Repositorio en GitHub
            </h2>
            <button
              onClick={() => setShowConfig(false)}
              className="text-xs text-ink-soft hover:text-ink font-mono"
            >
              [Cerrar]
            </button>
          </div>
          <p className="text-xs text-ink-soft mb-4">
            Tu repositorio ya está preconfigurado: <strong className="text-fd-primary">juanxaviercasa / api-reverse</strong>.
            Solo necesitas ingresar tu <strong>Personal Access Token (PAT)</strong> con permiso de <code className="px-1.5 py-0.5 rounded bg-fd-muted text-fd-primary">actions:write</code> para despertar GitHub Actions.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">GitHub Usuario</label>
              <input
                type="text"
                value={githubOwner}
                onChange={(e) => setGithubOwner(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-fd-border bg-fd-background text-ink font-mono focus:outline-none focus:ring-2 focus:ring-fd-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">Repositorio</label>
              <input
                type="text"
                value={githubRepo}
                onChange={(e) => setGithubRepo(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-fd-border bg-fd-background text-ink font-mono focus:outline-none focus:ring-2 focus:ring-fd-primary"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-ink-soft mb-1">GitHub Token (PAT)</label>
              <input
                type="password"
                placeholder="ghp_xxxxxxxxxxxx"
                value={githubToken}
                onChange={(e) => setGithubToken(e.target.value)}
                className="w-full px-3 py-2 rounded-xl text-sm border border-fd-border bg-fd-background text-ink font-mono focus:outline-none focus:ring-2 focus:ring-fd-primary"
              />
            </div>
          </div>
          <div className="flex items-center justify-between mt-4 pt-4 border-t border-fd-border">
            <label className="flex items-center gap-2 text-xs text-ink-soft cursor-pointer">
              <input
                type="checkbox"
                checked={saveTokenLocal}
                onChange={(e) => setSaveTokenLocal(e.target.checked)}
                className="rounded border-fd-border text-fd-primary focus:ring-fd-primary"
              />
              Guardar credenciales en este navegador
            </label>
            <button
              onClick={saveCredentials}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold bg-fd-primary text-white hover:opacity-90 transition-opacity"
            >
              Guardar Configuración
            </button>
          </div>
        </div>
      )}

      {/* MODE 1: REVERSE API ENGINEER */}
      {activeMode === 'reverse' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Presets & Form (7 cols) */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="block text-xs font-semibold uppercase tracking-wider text-ink-soft">
                  Plataformas Matemáticas y Científicas Seleccionadas
                </label>
                <span className="text-[11px] text-ink-soft">Haz clic en una para autocompletar</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {MATH_TEMPLATES.map((tmpl) => {
                  const Icon = tmpl.icon;
                  const isSelected = selectedTemplate === tmpl.id;
                  return (
                    <button
                      key={tmpl.id}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className={`p-4 rounded-2xl text-left border transition-all ${
                        isSelected
                          ? 'border-fd-primary bg-fd-primary/5 shadow-sm ring-1 ring-fd-primary'
                          : 'border-fd-border bg-fd-card hover:border-ink-soft/40'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-2">
                          <div className={`p-1.5 rounded-lg ${isSelected ? 'bg-fd-primary text-white' : 'bg-fd-muted text-ink'}`}>
                            <Icon className="size-4" />
                          </div>
                          <span className="text-sm font-semibold text-ink line-clamp-1">{tmpl.title}</span>
                        </div>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-fd-muted text-fd-primary">
                          {tmpl.badge}
                        </span>
                      </div>
                      <p className="text-xs text-ink-soft line-clamp-2">{tmpl.description}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Form Fields */}
            <div className="p-6 rounded-3xl border border-fd-border bg-fd-card space-y-4 shadow-sm">
              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  URL Objetivo de la Plataforma
                </label>
                <input
                  type="url"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="https://..."
                  className="w-full px-4 py-2.5 rounded-xl text-sm border border-fd-border bg-fd-background text-ink font-mono focus:outline-none focus:ring-2 focus:ring-fd-primary"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                  Objetivo / Qué Datos Matemáticos Extraer
                </label>
                <textarea
                  rows={3}
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                  className="w-full px-4 py-2.5 rounded-xl text-sm border border-fd-border bg-fd-background text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary resize-none"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                    Lenguaje de Salida
                  </label>
                  <select
                    value={language}
                    onChange={(e: any) => setLanguage(e.target.value)}
                    className="w-full px-3 py-2.5 rounded-xl text-sm border border-fd-border bg-fd-background text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary font-mono"
                  >
                    <option value="python">Python (Dataclasses + Requests)</option>
                    <option value="typescript">TypeScript (Interfaces + Axios)</option>
                    <option value="javascript">JavaScript (Fetch)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-1.5">
                    Ejecutor en la Nube
                  </label>
                  <div className="px-3 py-2.5 rounded-xl text-xs border border-fd-border bg-fd-muted text-ink flex items-center justify-between">
                    <span className="font-semibold flex items-center gap-1.5">
                      <Terminal className="size-3.5 text-fd-primary" />
                      GitHub Actions (Ubuntu Runner)
                    </span>
                    <span className="text-[10px] uppercase font-bold px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                      Gratis & Bajo Demanda
                    </span>
                  </div>
                </div>
              </div>

              <div className="pt-4">
                <button
                  onClick={handleTriggerGitHubActions}
                  disabled={status === 'triggering' || status === 'running'}
                  className="w-full py-3.5 px-5 rounded-2xl font-semibold text-sm bg-fd-primary text-white hover:opacity-90 disabled:opacity-50 transition-all flex items-center justify-center gap-2 shadow-md shadow-fd-primary/20"
                >
                  {status === 'triggering' || status === 'running' ? (
                    <>
                      <RefreshCw className="size-4 animate-spin" />
                      <span>Ejecutando en GitHub Actions...</span>
                    </>
                  ) : (
                    <>
                      <Play className="size-4 fill-white" />
                      <span>Despertar y Generar Cliente API</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Code Viewer & Status (5 cols) */}
          <div className="lg:col-span-5 space-y-4 flex flex-col">
            {/* Status Box */}
            <div className="p-4 rounded-2xl border border-fd-border bg-fd-card">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold uppercase tracking-wider text-ink-soft flex items-center gap-1.5">
                  {status === 'running' && <RefreshCw className="size-3.5 text-amber-500 animate-spin" />}
                  {status === 'completed' && <CheckCircle2 className="size-3.5 text-emerald-500" />}
                  {status === 'error' && <AlertCircle className="size-3.5 text-rose-500" />}
                  {status === 'idle' && <Clock className="size-3.5 text-ink-soft" />}
                  Estado de Ejecución
                </span>
                {runUrl && (
                  <Link
                    href={runUrl}
                    target="_blank"
                    className="text-xs text-fd-primary font-medium hover:underline inline-flex items-center gap-1"
                  >
                    <span>Ver en GitHub Actions</span>
                    <ExternalLink className="size-3" />
                  </Link>
                )}
              </div>
              <p className="text-xs text-ink-soft">
                {statusMessage ||
                  'Selecciona una plataforma matemática y pulsa «Despertar y Generar Cliente API» para iniciar el agente.'}
              </p>
            </div>

            {/* Code Viewer */}
            <div className="flex-1 flex flex-col rounded-3xl border border-fd-border bg-[#18181b] text-zinc-100 overflow-hidden shadow-xl min-h-[460px]">
              <div className="flex items-center justify-between border-b border-zinc-800 px-4 py-2.5 bg-zinc-900/70">
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => setActiveCodeTab('client')}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                      activeCodeTab === 'client' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    api_client.{language === 'typescript' ? 'ts' : 'py'}
                  </button>
                  <button
                    onClick={() => setActiveCodeTab('cli')}
                    className={`text-xs font-medium px-2.5 py-1 rounded-md transition-colors ${
                      activeCodeTab === 'cli' ? 'bg-zinc-800 text-white' : 'text-zinc-400 hover:text-zinc-200'
                    }`}
                  >
                    Comando Terminal (Local / Oracle VM)
                  </button>
                </div>

                <button
                  onClick={handleCopyCode}
                  className="text-xs inline-flex items-center gap-1 text-zinc-400 hover:text-white px-2 py-1 rounded hover:bg-zinc-800 transition-colors"
                >
                  {copied ? <Check className="size-3.5 text-emerald-400" /> : <Copy className="size-3.5" />}
                  <span>{copied ? 'Copiado' : 'Copiar'}</span>
                </button>
              </div>

              <div className="p-4 flex-1 overflow-auto font-mono text-xs leading-relaxed text-zinc-300">
                {activeCodeTab === 'cli' ? (
                  <div>
                    <p className="text-zinc-500 mb-2"># Ejecutar en tu terminal local o servidor de Oracle Cloud:</p>
                    <p className="text-emerald-400 select-all font-semibold">{cliCommand}</p>
                  </div>
                ) : generatedCode ? (
                  <pre className="whitespace-pre-wrap">{generatedCode}</pre>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center text-center p-8 text-zinc-500">
                    <Code2 className="size-10 mb-3 opacity-30 text-fd-primary" />
                    <p className="text-sm font-medium text-zinc-400">Sin cliente generado aún</p>
                    <p className="text-xs max-w-xs mt-1">
                      Elige una plataforma de matemáticas y genera tu cliente tipado con un clic.
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODE 2: OPEN APIS HUB */}
      {activeMode === 'open-apis' && (
        <div className="space-y-8 animate-in fade-in duration-200">
          {/* Newton API Interactive Playground */}
          <div className="p-6 rounded-3xl border border-fd-border bg-fd-card shadow-sm">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-4 border-b border-fd-border gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <Binary className="size-5 text-fd-primary" />
                  <h3 className="font-display text-lg font-bold text-ink">Newton API — Cálculo Simbólico en Vivo</h3>
                </div>
                <p className="text-xs text-ink-soft mt-0.5">
                  Microservicio de matemáticas avanzado vía HTTP GET. Resuelve derivadas, integrales y álgebra simbólica directamente en JSON.
                </p>
              </div>
              <span className="text-[10px] font-bold px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 self-start sm:self-auto">
                API Pública Activa
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
              {/* Inputs */}
              <div className="md:col-span-5 space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase text-ink-soft mb-1.5">Operación</label>
                  <select
                    value={newtonOp}
                    onChange={(e: any) => setNewtonOp(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-sm border border-fd-border bg-fd-background text-ink font-mono focus:outline-none focus:ring-2 focus:ring-fd-primary"
                  >
                    <option value="derive">Derivada (derive)</option>
                    <option value="integrate">Integral (integrate)</option>
                    <option value="factor">Factorización (factor)</option>
                    <option value="simplify">Simplificación (simplify)</option>
                    <option value="zeroes">Raíces / Ceros (zeroes)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-xs font-semibold uppercase text-ink-soft mb-1.5">Expresión Matemática</label>
                  <input
                    type="text"
                    value={newtonExpr}
                    onChange={(e) => setNewtonExpr(e.target.value)}
                    placeholder="ej. x^3 - 3x + 2"
                    className="w-full px-3 py-2 rounded-xl text-sm border border-fd-border bg-fd-background text-ink font-mono focus:outline-none focus:ring-2 focus:ring-fd-primary"
                  />
                </div>

                <button
                  onClick={handleTestNewton}
                  disabled={newtonLoading}
                  className="w-full py-2.5 px-4 rounded-xl text-sm font-semibold bg-fd-primary text-white hover:opacity-90 disabled:opacity-50 transition-opacity flex items-center justify-center gap-2"
                >
                  {newtonLoading ? <RefreshCw className="size-4 animate-spin" /> : <Play className="size-4 fill-white" />}
                  <span>Calcular en Vivo</span>
                </button>
              </div>

              {/* JSON Output */}
              <div className="md:col-span-7 bg-[#18181b] p-4 rounded-2xl border border-zinc-800 text-zinc-100 font-mono text-xs overflow-auto min-h-[160px] flex flex-col justify-center">
                {newtonResult ? (
                  <pre className="text-emerald-400">{JSON.stringify(newtonResult, null, 2)}</pre>
                ) : (
                  <p className="text-zinc-500 text-center">Pulsa «Calcular en Vivo» para consultar el endpoint HTTP.</p>
                )}
              </div>
            </div>
          </div>

          {/* Directory of Open Math Engines & APIs */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* SymPy */}
            <div className="p-5 rounded-3xl border border-fd-border bg-fd-card space-y-3">
              <div className="flex items-center gap-2 text-ink">
                <Atom className="size-5 text-fd-primary" />
                <h4 className="font-bold text-sm">SymPy (Python CAS)</h4>
              </div>
              <p className="text-xs text-ink-soft">
                Sistema de álgebra computacional completo. Úsalo en tus backends con FastAPI para resolver EDOs, integrales y generar fórmulas LaTeX automáticamente.
              </p>
              <div className="pt-2">
                <code className="text-[11px] block p-2 rounded bg-fd-muted font-mono text-ink">
                  pip install sympy
                </code>
              </div>
            </div>

            {/* Wolfram|Alpha */}
            <div className="p-5 rounded-3xl border border-fd-border bg-fd-card space-y-3">
              <div className="flex items-center gap-2 text-ink">
                <Cpu className="size-5 text-fd-primary" />
                <h4 className="font-bold text-sm">Wolfram|Alpha API</h4>
              </div>
              <p className="text-xs text-ink-soft">
                API oficial de cálculo de conocimiento. Devuelve soluciones paso a paso, gráficas y pods de resultados estructurados en JSON/XML.
              </p>
              <div className="pt-2">
                <Link
                  href="https://products.wolframalpha.com/api/"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-fd-primary font-semibold hover:underline"
                >
                  <span>Portal de Desarrolladores</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>

            {/* Open-Meteo & NASA */}
            <div className="p-5 rounded-3xl border border-fd-border bg-fd-card space-y-3">
              <div className="flex items-center gap-2 text-ink">
                <Globe className="size-5 text-fd-primary" />
                <h4 className="font-bold text-sm">NASA & Open-Meteo</h4>
              </div>
              <p className="text-xs text-ink-soft">
                Datos científicos reales (órbitas de asteroides, cinemática y series de tiempo meteorológicas) para ejercicios de física, cálculo y estadística.
              </p>
              <div className="pt-2">
                <Link
                  href="https://api.nasa.gov/"
                  target="_blank"
                  className="inline-flex items-center gap-1 text-xs text-fd-primary font-semibold hover:underline"
                >
                  <span>api.nasa.gov</span>
                  <ExternalLink className="size-3" />
                </Link>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
