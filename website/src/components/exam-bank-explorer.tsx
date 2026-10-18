'use client';

import { useState, useEffect, useRef } from 'react';
import { 
  BookOpen, 
  GraduationCap, 
  Search, 
  CheckCircle2, 
  XCircle, 
  Eye, 
  EyeOff, 
  ChevronLeft, 
  ChevronRight, 
  Layers,
  Sparkles,
  FileText
} from 'lucide-react';

interface Question {
  id: string;
  area_slug: string | null;
  university_slug: string | null;
  exam_slug: string | null;
  area_name: string;
  question_type: string;
  question_html: string;
  question_text: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  option_e: string;
  correct_key: string | null;
  resolution_html: string | null;
  resolution_text: string | null;
  web_url: string;
  difficulty_level?: string;
}

const TOP_COURSES = [
  { id: 'all', name: 'Todos los Cursos' },
  { id: 'razonamiento-matematico', name: 'Razonamiento Matemático (1,352)' },
  { id: 'algebra', name: 'Álgebra (492)' },
  { id: 'geometria', name: 'Geometría (521)' },
  { id: 'trigonometria', name: 'Trigonometría (443)' },
  { id: 'aritmetica', name: 'Aritmética (580)' },
  { id: 'fisica', name: 'Física (1,000)' },
  { id: 'quimica', name: 'Química (1,104)' },
  { id: 'razonamiento-verbal', name: 'Razonamiento Verbal (1,587)' },
  { id: 'biologia', name: 'Biología (1,061)' },
];

const TOP_UNIVERSITIES = [
  { id: 'all', name: 'Todas las Universidades' },
  { id: 'uni', name: 'UNI - Univ. Nac. de Ingeniería (1,612)' },
  { id: 'san-marcos', name: 'San Marcos - UNMSM (826)' },
  { id: 'unt', name: 'UNT - Univ. Nac. de Trujillo (1,000)' },
  { id: 'unsch', name: 'UNSCH - San Cristóbal de Huamanga (2,100)' },
  { id: 'unsm', name: 'UNSM - San Martín (3,127)' },
  { id: 'unica', name: 'UNICA - San Luis Gonzaga (1,193)' },
  { id: 'unsa', name: 'UNSA - San Agustín de Arequipa (300)' },
  { id: 'uncp', name: 'UNCP - Centro del Perú (250)' },
];

export function ExamBankExplorer() {
  const [course, setCourse] = useState('algebra');
  const [university, setUniversity] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});

  const containerRef = useRef<HTMLDivElement>(null);

  // Inyectar script de KaTeX para renderizado de fórmulas
  useEffect(() => {
    if (!document.getElementById('katex-css')) {
      const link = document.createElement('link');
      link.id = 'katex-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.css';
      document.head.appendChild(link);
    }

    if (!document.getElementById('katex-js')) {
      const script = document.createElement('script');
      script.id = 'katex-js';
      script.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/katex.min.js';
      document.head.appendChild(script);

      const autoRender = document.createElement('script');
      autoRender.id = 'katex-autorender';
      autoRender.src = 'https://cdn.jsdelivr.net/npm/katex@0.16.9/dist/contrib/auto-render.min.js';
      document.head.appendChild(autoRender);
    }
  }, []);

  // Re-renderizar KaTeX tras cargar preguntas
  useEffect(() => {
    if (typeof window !== 'undefined' && (window as any).renderMathInElement && containerRef.current) {
      setTimeout(() => {
        (window as any).renderMathInElement(containerRef.current, {
          delimiters: [
            { left: '$$', right: '$$', display: true },
            { left: '\\[', right: '\\]', display: true },
            { left: '$', right: '$', display: false },
            { left: '\\(', right: '\\)', display: false },
          ],
          throwOnError: false,
        });
      }, 100);
    }
  }, [questions, revealedSolutions]);

  // Cargar preguntas directamente desde los JSON estáticos de /dataset
  useEffect(() => {
    let isCancelled = false;
    async function loadData() {
      setLoading(true);
      try {
        let fetchUrl = '/dataset/areas/razonamiento-matematico.json';
        if (course && course !== 'all') {
          fetchUrl = `/dataset/areas/${course}.json`;
        } else if (university && university !== 'all') {
          fetchUrl = `/dataset/universidades/${university}.json`;
        }

        const res = await fetch(fetchUrl);
        if (!res.ok) throw new Error('Error al cargar archivo de preguntas');
        let raw: Question[] = await res.json();

        // Filtro cruzado universidad + área
        if (course && course !== 'all' && university && university !== 'all') {
          raw = raw.filter(q => q.university_slug === university);
        }
        // Filtro por dificultad
        if (difficulty && difficulty !== 'all') {
          raw = raw.filter(q => q.difficulty_level === difficulty);
        }
        // Filtro por búsqueda
        if (search) {
          const s = search.toLowerCase();
          raw = raw.filter(q => 
            (q.question_text && q.question_text.toLowerCase().includes(s)) ||
            (q.area_name && q.area_name.toLowerCase().includes(s))
          );
        }

        if (!isCancelled) {
          setTotal(raw.length);
          setTotalPages(Math.ceil(raw.length / 10) || 1);
          const offset = (page - 1) * 10;
          setQuestions(raw.slice(offset, offset + 10));
        }
      } catch (err) {
        if (!isCancelled) {
          setQuestions([]);
          setTotal(0);
        }
      } finally {
        if (!isCancelled) setLoading(false);
      }
    }
    loadData();
    return () => { isCancelled = true; };
  }, [course, university, difficulty, search, page]);

  const handleSelectOption = (qId: string, opt: string) => {
    setSelectedAnswers(prev => ({ ...prev, [qId]: opt }));
  };

  const toggleSolution = (qId: string) => {
    setRevealedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8" ref={containerRef}>
      {/* Cabecera */}
      <header className="space-y-3">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fd-primary">
          <GraduationCap size={16} />
          <span>Banco Oficial de Exámenes Preuniversitarios</span>
        </div>
        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">
          Explorador de Preguntas y Fórmulas
        </h1>
        <p className="max-w-3xl text-sm sm:text-base text-ink-soft">
          Explora 14,498 preguntas reales de 20 universidades peruanas (UNI, San Marcos, UNT, UNSA, etc.), 
          clasificadas por materia y dificultad con renderizado matemático KaTeX en tiempo real.
        </p>
      </header>

      {/* Barra de Filtros */}
      <section className="rounded-2xl border border-fd-border bg-fd-card p-5 space-y-4 shadow-sm">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {/* Selector de Curso */}
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Curso / Materia
            </label>
            <select
              value={course}
              onChange={(e) => { setCourse(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-fd-border bg-fd-background p-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary"
            >
              {TOP_COURSES.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>

          {/* Selector de Universidad */}
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Universidad
            </label>
            <select
              value={university}
              onChange={(e) => { setUniversity(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-fd-border bg-fd-background p-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary"
            >
              {TOP_UNIVERSITIES.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
            </select>
          </div>

          {/* Selector de Dificultad */}
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Nivel de Dificultad
            </label>
            <select
              value={difficulty}
              onChange={(e) => { setDifficulty(e.target.value); setPage(1); }}
              className="w-full rounded-xl border border-fd-border bg-fd-background p-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary"
            >
              <option value="all">Todas las Dificultades</option>
              <option value="Avanzado">Avanzado (UNI / CEPREUNI)</option>
              <option value="Intermedio">Intermedio (San Marcos / UNT)</option>
              <option value="Básico">Básico (Escolar / Selección)</option>
            </select>
          </div>

          {/* Búsqueda por texto */}
          <div>
            <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
              Buscar en Enunciado
            </label>
            <div className="relative">
              <input
                type="text"
                placeholder="ej: logaritmo, matriz, fuerza..."
                value={search}
                onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                className="w-full rounded-xl border border-fd-border bg-fd-background p-2.5 pl-9 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary"
              />
              <Search className="absolute left-3 top-3 text-ink-soft" size={16} />
            </div>
          </div>
        </div>

        {/* Resumen de resultados */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-fd-border pt-4 text-xs text-ink-soft">
          <div>
            Mostrando <strong>{questions.length}</strong> de <strong>{total.toLocaleString()}</strong> preguntas encontradas
          </div>
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
              <Sparkles size={14} /> KaTeX MathJax Activo
            </span>
          </div>
        </div>
      </section>

      {/* Lista de Preguntas */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-16 text-ink-soft space-y-3">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-fd-primary border-t-transparent"></div>
            <p>Cargando preguntas matemáticas...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-fd-border bg-fd-card p-12 text-center text-ink-soft space-y-2">
            <BookOpen className="mx-auto text-ink-soft" size={36} />
            <p className="text-base font-semibold text-ink">No se encontraron preguntas con estos filtros</p>
            <p className="text-sm">Prueba seleccionando otra materia o ampliando la universidad.</p>
          </div>
        ) : (
          questions.map((q, idx) => {
            const chosen = selectedAnswers[q.id];
            const hasKey = Boolean(q.correct_key);
            const isCorrect = hasKey && chosen === q.correct_key;
            const isWrong = hasKey && chosen && chosen !== q.correct_key;
            const isRevealed = revealedSolutions[q.id];

            return (
              <article 
                key={q.id}
                className="rounded-2xl border border-fd-border bg-fd-card p-6 space-y-4 shadow-sm hover:border-fd-primary/40 transition-colors"
              >
                {/* Badges superiores */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-fd-primary/10 px-2.5 py-1 text-xs font-bold text-fd-primary uppercase">
                      #{(page - 1) * 10 + idx + 1}
                    </span>
                    <span className="rounded-lg bg-fd-muted px-2.5 py-1 text-xs font-semibold text-ink uppercase">
                      {q.university_slug?.toUpperCase() || 'EXAMEN'}
                    </span>
                    <span className="rounded-lg bg-fd-muted px-2.5 py-1 text-xs text-ink-soft">
                      {q.area_name}
                    </span>
                    {q.difficulty_level && (
                      <span className={`rounded-lg px-2.5 py-1 text-xs font-medium ${
                        q.difficulty_level === 'Avanzado' ? 'bg-red-500/10 text-red-600' :
                        q.difficulty_level === 'Básico' ? 'bg-emerald-500/10 text-emerald-600' :
                        'bg-amber-500/10 text-amber-600'
                      }`}>
                        {q.difficulty_level}
                      </span>
                    )}
                  </div>
                  {q.exam_slug && (
                    <span className="text-xs text-ink-soft truncate max-w-xs">
                      {q.exam_slug.replace(/-/g, ' ')}
                    </span>
                  )}
                </div>

                {/* Enunciado de la pregunta con KaTeX */}
                <div 
                  className="text-base text-ink leading-relaxed font-sans overflow-x-auto py-2"
                  dangerouslySetInnerHTML={{ __html: q.question_html }}
                />

                {/* Opciones A - E */}
                <div className="grid gap-2 sm:grid-cols-2 pt-2">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((letra) => {
                    const optContent = q[`option_${letra.toLowerCase()}` as keyof Question] as string;
                    if (!optContent) return null;

                    const isSelected = chosen === letra;
                    const isOfficialCorrect = hasKey && q.correct_key === letra && (isRevealed || chosen);

                    let btnClass = 'border-fd-border bg-fd-background hover:bg-fd-muted text-ink';
                    if (isOfficialCorrect) {
                      btnClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 font-semibold';
                    } else if (isSelected && isWrong) {
                      btnClass = 'border-rose-500 bg-rose-500/10 text-rose-700';
                    } else if (isSelected) {
                      btnClass = 'border-fd-primary bg-fd-primary/10 text-fd-primary font-semibold';
                    }

                    return (
                      <button
                        key={letra}
                        onClick={() => handleSelectOption(q.id, letra)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${btnClass}`}
                      >
                        <span className="font-bold shrink-0">{letra})</span>
                        <div 
                          className="grow text-sm overflow-x-auto"
                          dangerouslySetInnerHTML={{ __html: optContent }}
                        />
                        {isOfficialCorrect && <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />}
                        {isSelected && isWrong && <XCircle className="text-rose-500 shrink-0" size={16} />}
                      </button>
                    );
                  })}
                </div>

                {/* Acciones de la Pregunta */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border pt-4">
                  <div className="flex items-center gap-2">
                    {hasKey && (
                      <button
                        onClick={() => toggleSolution(q.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-fd-muted transition-colors"
                      >
                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        {isRevealed ? 'Ocultar Clave' : 'Revelar Clave Oficial'}
                      </button>
                    )}
                    {chosen && hasKey && (
                      <span className={`text-xs font-semibold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {isCorrect ? '¡Correcto! Clave ' + q.correct_key : 'Incorrecto. La clave es ' + q.correct_key}
                      </span>
                    )}
                  </div>

                  <a
                    href={q.web_url || '#'}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-fd-primary hover:underline inline-flex items-center gap-1"
                  >
                    Ver en Eduteka original
                  </a>
                </div>

                {/* Solución explicativa paso a paso */}
                {isRevealed && q.resolution_html && (
                  <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2 mt-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                      Resolución Oficial Paso a Paso
                    </span>
                    <div 
                      className="text-sm text-ink leading-relaxed"
                      dangerouslySetInnerHTML={{ __html: q.resolution_html }}
                    />
                  </div>
                )}
              </article>
            );
          })
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-fd-border pt-6">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-xl border border-fd-border px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40 hover:bg-fd-muted transition-colors"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="text-xs text-ink-soft">
            Página <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-fd-border px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40 hover:bg-fd-muted transition-colors"
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
