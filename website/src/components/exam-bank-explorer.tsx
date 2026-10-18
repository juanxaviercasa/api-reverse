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
  Sparkles,
  Printer,
  Timer,
  Play,
  RotateCcw,
  Trophy,
  ImageIcon
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
  { id: 'all', name: 'Todos los Cursos (14,558)' },
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
  const [onlyImages, setOnlyImages] = useState(false);
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [allFiltered, setAllFiltered] = useState<Question[]>([]);
  const [total, setTotal] = useState(0);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);
  const [selectedAnswers, setSelectedAnswers] = useState<Record<string, string>>({});
  const [revealedSolutions, setRevealedSolutions] = useState<Record<string, boolean>>({});

  // Modo Simulacro con Temporizador
  const [isExamMode, setIsExamMode] = useState(false);
  const [examTimeSeconds, setExamTimeSeconds] = useState(1800); // 30 minutos
  const [timerActive, setTimerActive] = useState(false);
  const [examFinished, setExamFinished] = useState(false);

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

  // Re-renderizar KaTeX tras cargar preguntas o alternar vistas
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
  }, [questions, revealedSolutions, isExamMode, examFinished]);

  // Manejo del Temporizador de Simulacro
  useEffect(() => {
    let interval: any = null;
    if (timerActive && examTimeSeconds > 0) {
      interval = setInterval(() => {
        setExamTimeSeconds(s => s - 1);
      }, 1000);
    } else if (examTimeSeconds === 0 && timerActive) {
      setTimerActive(false);
      setExamFinished(true);
    }
    return () => clearInterval(interval);
  }, [timerActive, examTimeSeconds]);

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
        // Filtro solo con imágenes
        if (onlyImages) {
          raw = raw.filter(q => q.question_html && q.question_html.includes('<img'));
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
          setAllFiltered(raw);
          setTotal(raw.length);
          const pageSize = isExamMode ? 20 : 10;
          setTotalPages(Math.ceil(raw.length / pageSize) || 1);
          const offset = (page - 1) * pageSize;
          setQuestions(raw.slice(offset, offset + pageSize));
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
  }, [course, university, difficulty, search, page, onlyImages, isExamMode]);

  const handleSelectOption = (qId: string, opt: string) => {
    setSelectedAnswers(prev => ({ ...prev, [qId]: opt }));
  };

  const toggleSolution = (qId: string) => {
    setRevealedSolutions(prev => ({ ...prev, [qId]: !prev[qId] }));
  };

  const startExam = (minutes: number = 30) => {
    setIsExamMode(true);
    setExamTimeSeconds(minutes * 60);
    setTimerActive(true);
    setExamFinished(false);
    setSelectedAnswers({});
    setRevealedSolutions({});
    setPage(1);
  };

  const finishExam = () => {
    setTimerActive(false);
    setExamFinished(true);
  };

  const formatTime = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Calcular puntaje del simulacro
  const examStats = () => {
    let correct = 0;
    let wrong = 0;
    let blank = 0;

    questions.forEach(q => {
      const ans = selectedAnswers[q.id];
      if (!ans) {
        blank++;
      } else if (q.correct_key && ans === q.correct_key) {
        correct++;
      } else if (q.correct_key) {
        wrong++;
      }
    });

    // Puntuación tipo San Marcos / UNI: +20 correcta, -1.125 incorrecta
    const score = (correct * 20) - (wrong * 1.125);
    return { correct, wrong, blank, score: Math.max(0, score).toFixed(2) };
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 space-y-8" ref={containerRef}>
      {/* Estilos para impresión en PDF A4 */}
      <style jsx global>{`
        @media print {
          body { background: #fff !important; color: #000 !important; }
          .no-print { display: none !important; }
          .print-header { display: block !important; }
          article { break-inside: avoid !important; border: 1px solid #ccc !important; margin-bottom: 20px !important; }
        }
      `}</style>

      {/* Cabecera Principal */}
      <header className="space-y-3 no-print">
        <div className="flex items-center justify-between flex-wrap gap-2">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-fd-primary">
            <GraduationCap size={16} />
            <span>Banco Oficial de Exámenes Preuniversitarios (14.5K)</span>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => window.print()}
              className="inline-flex items-center gap-1.5 rounded-xl border border-fd-border bg-fd-card px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-fd-muted transition-colors shadow-sm"
              title="Imprimir o guardar en PDF"
            >
              <Printer size={15} />
              <span>Imprimir Ficha (PDF)</span>
            </button>

            {!isExamMode ? (
              <button
                onClick={() => startExam(30)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                <Play size={14} />
                <span>Iniciar Simulacro (30 min)</span>
              </button>
            ) : (
              <button
                onClick={() => setIsExamMode(false)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-fd-border bg-fd-card px-3.5 py-1.5 text-xs font-semibold text-ink hover:bg-fd-muted transition-colors"
              >
                <span>Volver a Modo Estudio</span>
              </button>
            )}
          </div>
        </div>

        <h1 className="font-display text-3xl sm:text-4xl font-bold text-ink">
          {isExamMode ? 'Simulacro de Examen de Admisión' : 'Explorador y Banco Preuniversitario'}
        </h1>
        <p className="max-w-3xl text-sm sm:text-base text-ink-soft">
          {isExamMode 
            ? 'Pon a prueba tus conocimientos en condiciones de examen real. Marca tus respuestas y al finalizar obtendrás tu puntaje neto con solucionario.'
            : 'Explora 14,558 preguntas reales de 20 universidades peruanas con 2,000+ diagramas y fórmulas KaTeX nítidas.'}
        </p>
      </header>

      {/* Barra Flotante de Temporizador en Modo Simulacro */}
      {isExamMode && (
        <section className="rounded-2xl border-2 border-emerald-500/40 bg-emerald-500/10 p-4 sticky top-16 z-40 backdrop-blur-md flex flex-wrap items-center justify-between gap-4 shadow-md no-print">
          <div className="flex items-center gap-3">
            <Timer className="text-emerald-600 animate-pulse" size={24} />
            <div>
              <span className="text-xs uppercase font-bold text-emerald-800 tracking-wider block">Tiempo Restante</span>
              <span className="font-mono text-2xl font-bold text-emerald-950">{formatTime(examTimeSeconds)}</span>
            </div>
          </div>

          <div className="text-xs text-ink-soft font-medium">
            Respondidas: <strong className="text-ink">{Object.keys(selectedAnswers).length}</strong> de <strong>{questions.length}</strong>
          </div>

          <div className="flex items-center gap-2">
            {!examFinished ? (
              <button
                onClick={finishExam}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-bold text-white hover:bg-emerald-700 transition-colors shadow-sm"
              >
                Finalizar y Calificar
              </button>
            ) : (
              <button
                onClick={() => startExam(30)}
                className="rounded-xl border border-fd-border bg-fd-card px-3.5 py-2 text-xs font-semibold text-ink hover:bg-fd-muted transition-colors inline-flex items-center gap-1"
              >
                <RotateCcw size={14} /> Reiniciar
              </button>
            )}
          </div>
        </section>
      )}

      {/* Tarjeta de Calificación al Terminar el Simulacro */}
      {isExamMode && examFinished && (
        <div className="rounded-2xl border-2 border-emerald-500 bg-fd-card p-6 shadow-lg space-y-4 no-print">
          <div className="flex items-center gap-2 text-emerald-600 font-bold text-lg">
            <Trophy size={24} />
            <h2>Resultados Oficiales del Simulacro</h2>
          </div>
          {(() => {
            const stats = examStats();
            return (
              <div className="grid gap-3 sm:grid-cols-4 text-center">
                <div className="rounded-xl bg-emerald-500/10 p-3 border border-emerald-500/20">
                  <span className="text-xs text-emerald-700 block font-semibold">Aciertos</span>
                  <span className="text-2xl font-bold text-emerald-600">{stats.correct}</span>
                </div>
                <div className="rounded-xl bg-rose-500/10 p-3 border border-rose-500/20">
                  <span className="text-xs text-rose-700 block font-semibold">Errores</span>
                  <span className="text-2xl font-bold text-rose-600">{stats.wrong}</span>
                </div>
                <div className="rounded-xl bg-fd-muted p-3 border border-fd-border">
                  <span className="text-xs text-ink-soft block font-semibold">En Blanco</span>
                  <span className="text-2xl font-bold text-ink">{stats.blank}</span>
                </div>
                <div className="rounded-xl bg-fd-primary/10 p-3 border border-fd-primary/20">
                  <span className="text-xs text-fd-primary block font-semibold">Puntaje Neto</span>
                  <span className="text-2xl font-bold text-fd-primary">{stats.score} pts</span>
                </div>
              </div>
            );
          })()}
          <p className="text-xs text-ink-soft">
            Revisa abajo cada pregunta: se han revelado las claves correctas y las resoluciones explicativas para tu retroalimentación.
          </p>
        </div>
      )}

      {/* Barra de Filtros (Oculta durante simulacro para no distraer) */}
      {!isExamMode && (
        <section className="rounded-2xl border border-fd-border bg-fd-card p-5 space-y-4 shadow-sm no-print">
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

          {/* Filtros secundarios y estado */}
          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border pt-4 text-xs text-ink-soft">
            <div className="flex items-center gap-4">
              <span>Mostrando <strong>{questions.length}</strong> de <strong>{total.toLocaleString()}</strong> preguntas encontradas</span>
              
              <label className="inline-flex items-center gap-1.5 cursor-pointer font-medium text-ink hover:text-fd-primary">
                <input
                  type="checkbox"
                  checked={onlyImages}
                  onChange={(e) => { setOnlyImages(e.target.checked); setPage(1); }}
                  className="rounded border-fd-border text-fd-primary"
                />
                <ImageIcon size={14} className="text-fd-primary" />
                <span>Solo con diagramas/figuras</span>
              </label>
            </div>

            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <Sparkles size={14} /> Fórmulas KaTeX / MathJax Activas
              </span>
            </div>
          </div>
        </section>
      )}

      {/* Encabezado visible al imprimir */}
      <div className="hidden print-header border-b-2 border-slate-900 pb-3 mb-6">
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
          Evaluación y Práctica Preuniversitaria
        </h1>
        <div className="grid grid-cols-3 text-xs text-slate-700 mt-2">
          <div>Alumno(a): ________________________________________</div>
          <div>Fecha: ____/____/________</div>
          <div>Materia: {course.toUpperCase()}</div>
        </div>
      </div>

      {/* Lista de Preguntas */}
      <div className="space-y-6">
        {loading ? (
          <div className="text-center py-16 text-ink-soft space-y-3 no-print">
            <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-fd-primary border-t-transparent"></div>
            <p>Cargando preguntas matemáticas...</p>
          </div>
        ) : questions.length === 0 ? (
          <div className="rounded-2xl border border-fd-border bg-fd-card p-12 text-center text-ink-soft space-y-2 no-print">
            <BookOpen className="mx-auto text-ink-soft" size={36} />
            <p className="text-base font-semibold text-ink">No se encontraron preguntas con estos filtros</p>
            <p className="text-sm">Prueba seleccionando otra materia o desactivando los filtros específicos.</p>
          </div>
        ) : (
          questions.map((q, idx) => {
            const chosen = selectedAnswers[q.id];
            const hasKey = Boolean(q.correct_key);
            const isRevealed = revealedSolutions[q.id] || examFinished;
            const isCorrect = hasKey && chosen === q.correct_key;
            const isWrong = hasKey && chosen && chosen !== q.correct_key;

            return (
              <article 
                key={q.id}
                className="rounded-2xl border border-fd-border bg-fd-card p-6 space-y-4 shadow-sm hover:border-fd-primary/40 transition-colors"
              >
                {/* Badges superiores */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-lg bg-fd-primary/10 px-2.5 py-1 text-xs font-bold text-fd-primary uppercase">
                      #{(page - 1) * (isExamMode ? 20 : 10) + idx + 1}
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

                {/* Enunciado con Fórmulas e Imágenes Locales */}
                <div 
                  className="text-base text-ink leading-relaxed font-sans overflow-x-auto py-2 [&_img]:max-h-64 [&_img]:mx-auto [&_img]:my-3 [&_img]:rounded-xl [&_img]:border [&_img]:border-fd-border [&_img]:bg-white [&_img]:p-2"
                  dangerouslySetInnerHTML={{ __html: q.question_html }}
                />

                {/* Opciones A - E */}
                <div className="grid gap-2 sm:grid-cols-2 pt-2">
                  {(['A', 'B', 'C', 'D', 'E'] as const).map((letra) => {
                    const optContent = q[`option_${letra.toLowerCase()}` as keyof Question] as string;
                    if (!optContent) return null;

                    const isSelected = chosen === letra;
                    const isOfficialCorrect = hasKey && q.correct_key === letra && (isRevealed || (chosen && !isExamMode));

                    let btnClass = 'border-fd-border bg-fd-background hover:bg-fd-muted text-ink';
                    if (isOfficialCorrect) {
                      btnClass = 'border-emerald-500 bg-emerald-500/10 text-emerald-700 font-semibold';
                    } else if (isSelected && isWrong && !isExamMode) {
                      btnClass = 'border-rose-500 bg-rose-500/10 text-rose-700';
                    } else if (isSelected) {
                      btnClass = 'border-fd-primary bg-fd-primary/10 text-fd-primary font-semibold';
                    }

                    return (
                      <button
                        key={letra}
                        disabled={examFinished}
                        onClick={() => handleSelectOption(q.id, letra)}
                        className={`flex items-start gap-3 rounded-xl border p-3 text-left transition-all ${btnClass} [&_img]:max-h-24 [&_img]:rounded-lg`}
                      >
                        <span className="font-bold shrink-0">{letra})</span>
                        <div 
                          className="grow text-sm overflow-x-auto"
                          dangerouslySetInnerHTML={{ __html: optContent }}
                        />
                        {isOfficialCorrect && <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />}
                        {isSelected && isWrong && !isExamMode && <XCircle className="text-rose-500 shrink-0" size={16} />}
                      </button>
                    );
                  })}
                </div>

                {/* Acciones de la Pregunta (solo en modo estudio o tras simulacro) */}
                <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border pt-4 no-print">
                  <div className="flex items-center gap-2">
                    {hasKey && !isExamMode && (
                      <button
                        onClick={() => toggleSolution(q.id)}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border px-3 py-1.5 text-xs font-semibold text-ink hover:bg-fd-muted transition-colors"
                      >
                        {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                        {isRevealed ? 'Ocultar Clave' : 'Revelar Clave Oficial'}
                      </button>
                    )}
                    {chosen && hasKey && !isExamMode && (
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
      {totalPages > 1 && !isExamMode && (
        <div className="flex items-center justify-between border-t border-fd-border pt-6 no-print">
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
