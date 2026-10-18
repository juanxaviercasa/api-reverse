'use client';

import { useState, useEffect, useRef } from 'react';
import { MathHtml } from '@/components/math-html';
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
  ImageIcon,
  KeyRound,
  FileQuestion
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

// Diccionario oficial con nombres formales y tildación correcta
const TOP_COURSES = [
  { id: 'all', name: 'Todos los Cursos (14,558)' },
  { id: 'razonamiento-matematico', name: 'Razonamiento Matemático (1,352)' },
  { id: 'algebra', name: 'Álgebra (492)' },
  { id: 'geometria', name: 'Geometría (521)' },
  { id: 'trigonometria', name: 'Trigonometría (443)' },
  { id: 'aritmetica', name: 'Aritmética (580)' },
  { id: 'fisica', name: 'Física (1,000)' },
  { id: 'quimica', name: 'Química (1,104)' },
  { id: 'biologia', name: 'Biología (1,061)' },
  { id: 'anatomia', name: 'Anatomía (64)' },
  { id: 'razonamiento-verbal', name: 'Razonamiento Verbal (1,587)' },
  { id: 'lenguaje', name: 'Lenguaje (586)' },
  { id: 'literatura', name: 'Literatura (405)' },
  { id: 'economia', name: 'Economía (454)' },
  { id: 'filosofia', name: 'Filosofía (260)' },
  { id: 'psicologia', name: 'Psicología (249)' },
  { id: 'historia-del-peru', name: 'Historia del Perú (203)' },
  { id: 'historia-universal', name: 'Historia Universal (192)' },
  { id: 'geografia', name: 'Geografía (284)' },
  { id: 'educacion-civica', name: 'Educación Cívica (163)' },
  { id: 'ingles', name: 'Inglés (192)' },
];

// Nombres oficiales completos de universidades peruanas con siglas en mayúscula
const TOP_UNIVERSITIES = [
  { id: 'all', name: 'Todas las Universidades (14,558 preguntas)' },
  { id: 'uni', name: 'Universidad Nacional de Ingeniería (UNI) — 1,612' },
  { id: 'san-marcos', name: 'Universidad Nacional Mayor de San Marcos (UNMSM) — 826' },
  { id: 'unsch', name: 'Universidad Nacional de San Cristóbal de Huamanga (UNSCH) — 2,100' },
  { id: 'unsm', name: 'Universidad Nacional de San Martín (UNSM) — 3,127' },
  { id: 'unt', name: 'Universidad Nacional de Trujillo (UNT) — 1,000' },
  { id: 'unica', name: 'Universidad Nacional San Luis Gonzaga (UNICA) — 1,193' },
  { id: 'unj', name: 'Universidad Nacional de Jaén (UNJ) — 610' },
  { id: 'unjbg', name: 'Universidad Nacional Jorge Basadre Grohmann (UNJBG) — 540' },
  { id: 'untrm', name: 'Universidad Nacional Toribio Rodríguez de Mendoza (UNTRM) — 700' },
  { id: 'unsa', name: 'Universidad Nacional de San Agustín de Arequipa (UNSA) — 300' },
  { id: 'uns', name: 'Universidad Nacional del Santa (UNS) — 300' },
  { id: 'uncp', name: 'Universidad Nacional del Centro del Perú (UNCP) — 250' },
  { id: 'unac', name: 'Universidad Nacional del Callao (UNAC) — 210' },
  { id: 'unap', name: 'Universidad Nacional de la Amazonía Peruana (UNAP) — 200' },
  { id: 'unc', name: 'Universidad Nacional de Cajamarca (UNC) — 180' },
  { id: 'unah', name: 'Universidad Nacional Autónoma de Huanta (UNAH) — 120' },
  { id: 'unamba', name: 'Universidad Nacional Micaela Bastidas de Apurímac (UNAMBA) — 60' },
  { id: 'untumbes', name: 'Universidad Nacional de Tumbes (UNTUMBES) — 100' },
  { id: 'unprg', name: 'Universidad Nacional Pedro Ruiz Gallo (UNPRG) — 100' },
  { id: 'pronabec', name: 'PRONABEC (Beca 18 / Talento Perú) — 60' },
];

// Helper para siglas oficiales en mayúscula
export function formatUniversityBadge(slug: string | null): string {
  if (!slug) return 'EXAMEN';
  const s = slug.toLowerCase();
  const map: Record<string, string> = {
    uni: 'UNI',
    'san-marcos': 'UNMSM',
    unac: 'UNAC',
    unsa: 'UNSA',
    unt: 'UNT',
    unsch: 'UNSCH',
    unsm: 'UNSM',
    unica: 'UNICA',
    uncp: 'UNCP',
    unjbg: 'UNJBG',
    unprg: 'UNPRG',
    unc: 'UNC',
    uns: 'UNS',
    unap: 'UNAP',
    unj: 'UNJ',
    untrm: 'UNTRM',
    unah: 'UNAH',
    unamba: 'UNAMBA',
    untumbes: 'UNTUMBES',
    pronabec: 'PRONABEC',
  };
  return map[s] || s.toUpperCase();
}

// Helper para formatear títulos de exámenes con números romanos y tildación correcta
export function formatExamTitle(slug: string | null): string {
  if (!slug) return '';

  const DICTIONARY: Record<string, string> = {
    uni: 'UNI',
    unmsm: 'UNMSM',
    unac: 'UNAC',
    unsa: 'UNSA',
    unsch: 'UNSCH',
    uncp: 'UNCP',
    unjbg: 'UNJBG',
    unprg: 'UNPRG',
    unap: 'UNAP',
    untrm: 'UNTRM',
    unamba: 'UNAMBA',
    unsm: 'UNSM',
    unah: 'UNAH',
    unt: 'UNT',
    unj: 'UNJ',
    uns: 'UNS',
    unica: 'UNICA',
    unc: 'UNC',
    untumbes: 'UNTUMBES',
    pronabec: 'PRONABEC',
    cepre: 'CEPRE',
    cepreuni: 'CEPRE-UNI',
    cpu: 'CPU',
    cepu: 'CEPU',
    pre: 'Pre',
    admision: 'Admisión',
    practica: 'Práctica',
    calificada: 'Calificada',
    ordinario: 'Ordinario',
    extraordinario: 'Extraordinario',
    seleccion: 'Selección',
    simulacro: 'Simulacro',
    concurso: 'Concurso',
    escolar: 'Escolar',
    primer: 'Primer',
    primera: 'Primera',
    segundo: 'Segundo',
    segunda: 'Segunda',
    tercer: 'Tercer',
    tercera: 'Tercera',
    cuarto: 'Cuarto',
    cuarta: 'Cuarta',
    quinto: 'Quinto',
    quinta: 'Quinta',
    sexto: 'Sexto',
    examen: 'Examen',
    examenes: 'Exámenes',
    ciclo: 'Ciclo',
    matematicas: 'Matemáticas',
    matematica: 'Matemática',
    algebra: 'Álgebra',
    geometria: 'Geometría',
    trigonometria: 'Trigonometría',
    aritmetica: 'Aritmética',
    fisica: 'Física',
    quimica: 'Química',
    biologia: 'Biología',
    anatomia: 'Anatomía',
    economia: 'Economía',
    filosofia: 'Filosofía',
    psicologia: 'Psicología',
    geografia: 'Geografía',
    ingles: 'Inglés',
    comunicacion: 'Comunicación',
    ciencias: 'Ciencias',
    salud: 'Salud',
    letras: 'Letras',
    humanidades: 'Humanidades',
    ingenieria: 'Ingeniería',
    de: 'de',
    del: 'del',
    la: 'la',
    las: 'las',
    los: 'los',
    y: 'y',
    e: 'e',
    i: 'I',
    ii: 'II',
    iii: 'III',
    iv: 'IV',
    v: 'V',
    vi: 'VI',
    vii: 'VII',
    viii: 'VIII',
  };

  const parts = slug.split('-');
  return parts.map((part, index) => {
    const lower = part.toLowerCase();
    
    // Si coincide exactamente con el diccionario
    if (DICTIONARY[lower]) return DICTIONARY[lower];

    // Semestres tipo 2024-1 o 2024-2 precedidos por un año
    const prev = index > 0 ? parts[index - 1] : '';
    if (/^\d{4}$/.test(prev)) {
      if (lower === '1') return 'I';
      if (lower === '2') return 'II';
      if (lower === '3') return 'III';
    }

    // Años de 4 dígitos
    if (/^\d{4}$/.test(part)) return part;

    // Números ordinales tipo 1ro, 2do, 3ro, 4to
    if (/^\d+(ro|do|er|to|ta|da|ra)$/i.test(part)) {
      return part.toLowerCase();
    }

    // Mayúscula inicial por defecto
    return part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
  }).join(' ');
}

// Helper para nombres de materias con tilde
export function formatCourseName(areaName: string | null): string {
  if (!areaName) return '';
  const map: Record<string, string> = {
    'algebra': 'Álgebra',
    'geometria': 'Geometría',
    'trigonometria': 'Trigonometría',
    'aritmetica': 'Aritmética',
    'fisica': 'Física',
    'quimica': 'Química',
    'biologia': 'Biología',
    'anatomia': 'Anatomía',
    'economia': 'Economía',
    'filosofia': 'Filosofía',
    'psicologia': 'Psicología',
    'geografia': 'Geografía',
    'ingles': 'Inglés',
    'educacion civica': 'Educación Cívica',
    'razonamiento matematico': 'Razonamiento Matemático',
    'razonamiento verbal': 'Razonamiento Verbal',
    'comunicacion': 'Comunicación',
    'redaccion': 'Redacción',
  };
  const key = areaName.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  return map[key] || areaName;
}

export function ExamBankExplorer() {
  const [course, setCourse] = useState('algebra');
  const [university, setUniversity] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [keyFilter, setKeyFilter] = useState<'all' | 'with-key' | 'practice'>('all');
  const [search, setSearch] = useState('');
  const [onlyImages, setOnlyImages] = useState(false);
  const [page, setPage] = useState(1);
  const [questions, setQuestions] = useState<Question[]>([]);
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
        // Filtro por disponibilidad de clave
        if (keyFilter === 'with-key') {
          raw = raw.filter(q => Boolean(q.correct_key));
        } else if (keyFilter === 'practice') {
          raw = raw.filter(q => !q.correct_key);
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
  }, [course, university, difficulty, keyFilter, search, page, onlyImages, isExamMode]);

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
    <div className="mx-auto max-w-[1560px] px-4 sm:px-6 lg:px-8 py-8 space-y-8" ref={containerRef}>
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
        <p className="max-w-4xl text-sm sm:text-base text-ink-soft">
          {isExamMode 
            ? 'Pon a prueba tus conocimientos en condiciones de examen real. Marca tus respuestas y al finalizar obtendrás tu puntaje neto con solucionario.'
            : 'Explora 14,558 preguntas reales de 20 universidades peruanas con 2,000+ diagramas y fórmulas matemáticas nítidas renderizadas con KaTeX.'}
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

      {/* Barra de Filtros en Modo Estudio */}
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

            {/* Selector de Universidad con nombres completos oficiales */}
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
                <option value="Avanzado">Avanzado (UNI / CEPRE-UNI)</option>
                <option value="Intermedio">Intermedio (San Marcos / UNT)</option>
                <option value="Básico">Básico (Escolar / Selección)</option>
              </select>
            </div>

            {/* Selector de Disponibilidad de Clave */}
            <div>
              <label className="block text-xs font-semibold text-ink uppercase tracking-wider mb-2">
                Disponibilidad de Clave
              </label>
              <select
                value={keyFilter}
                onChange={(e) => { setKeyFilter(e.target.value as any); setPage(1); }}
                className="w-full rounded-xl border border-fd-border bg-fd-background p-2.5 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary"
              >
                <option value="all">Todas las Preguntas (14.5K)</option>
                <option value="with-key">🔑 Solo con Clave Oficial</option>
                <option value="practice">📝 Preguntas Propuestas (Modo Práctica)</option>
              </select>
            </div>
          </div>

          {/* Búsqueda por texto y opciones secundarias */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 pt-2">
            <div className="sm:col-span-2">
              <div className="relative">
                <input
                  type="text"
                  placeholder="Buscar en enunciado o tema (ej: logaritmo, matriz, cinemática, enlaces, mitosis)..."
                  value={search}
                  onChange={(e) => { setSearch(e.target.value); setPage(1); }}
                  className="w-full rounded-xl border border-fd-border bg-fd-background p-2.5 pl-9 text-sm text-ink focus:outline-none focus:ring-2 focus:ring-fd-primary"
                />
                <Search className="absolute left-3 top-3 text-ink-soft" size={16} />
              </div>
            </div>

            <div className="flex items-center justify-between sm:justify-end gap-4 text-xs text-ink-soft">
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

              <span className="inline-flex items-center gap-1 text-emerald-600 font-medium">
                <Sparkles size={14} /> KaTeX Activo
              </span>
            </div>
          </div>

          <div className="border-t border-fd-border pt-3 text-xs text-ink-soft flex items-center justify-between">
            <span>
              Mostrando <strong>{questions.length}</strong> de <strong>{total.toLocaleString()}</strong> preguntas encontradas
            </span>
            {keyFilter !== 'all' && (
              <span className="text-fd-primary font-semibold">
                Filtro activo: {keyFilter === 'with-key' ? 'Solo con clave oficial' : 'Preguntas propuestas'}
              </span>
            )}
          </div>
        </section>
      )}

      {/* Encabezado visible al imprimir en PDF */}
      <div className="hidden print-header border-b-2 border-slate-900 pb-3 mb-6">
        <h1 className="text-xl font-bold uppercase tracking-wider text-slate-900">
          Evaluación y Práctica Preuniversitaria
        </h1>
        <div className="grid grid-cols-3 text-xs text-slate-700 mt-2">
          <div>Alumno(a): ________________________________________</div>
          <div>Fecha: ____/____/________</div>
          <div>Materia: {formatCourseName(course).toUpperCase()}</div>
        </div>
      </div>

      {/* Lista de Preguntas en Diseño de Dos Columnas */}
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
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-start">
            {questions.map((q, idx) => {
              const chosen = selectedAnswers[q.id];
              const hasKey = Boolean(q.correct_key);
              const isRevealed = revealedSolutions[q.id] || examFinished;
              const isCorrect = hasKey && chosen === q.correct_key;
              const isWrong = hasKey && chosen && chosen !== q.correct_key;

              return (
                <article 
                  key={q.id}
                  className="flex flex-col justify-between rounded-2xl border border-fd-border bg-fd-card p-6 space-y-5 shadow-sm hover:border-fd-primary/40 transition-colors h-full"
                >
                  <div className="space-y-4">
                    {/* Badges superiores formateados */}
                    <div className="flex flex-wrap items-center justify-between gap-2 border-b border-fd-border pb-3">
                      <div className="flex flex-wrap items-center gap-1.5">
                        <span className="rounded-lg bg-fd-primary/10 px-2.5 py-1 text-xs font-bold text-fd-primary">
                          #{(page - 1) * (isExamMode ? 20 : 10) + idx + 1}
                        </span>
                        <span className="rounded-lg bg-fd-muted px-2.5 py-1 text-xs font-bold text-ink">
                          {formatUniversityBadge(q.university_slug)}
                        </span>
                        <span className="rounded-lg bg-fd-muted px-2.5 py-1 text-xs font-medium text-ink-soft">
                          {formatCourseName(q.area_name)}
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
                        {hasKey ? (
                          <span className="rounded-lg bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 inline-flex items-center gap-1">
                            <KeyRound size={11} /> Clave Oficial
                          </span>
                        ) : (
                          <span className="rounded-lg bg-amber-500/10 px-2 py-0.5 text-[11px] font-semibold text-amber-700 inline-flex items-center gap-1">
                            <FileQuestion size={11} /> Propuesta
                          </span>
                        )}
                      </div>

                      {q.exam_slug && (
                        <span className="text-xs font-medium text-ink-soft text-right">
                          {formatExamTitle(q.exam_slug)}
                        </span>
                      )}
                    </div>

                    {/* Enunciado con Fórmulas e Imágenes Locales */}
                    <MathHtml 
                      html={q.question_html} 
                      className="text-base text-ink leading-relaxed font-sans overflow-x-auto py-1 [&_img]:max-h-64 [&_img]:mx-auto [&_img]:my-3 [&_img]:rounded-xl [&_img]:border [&_img]:border-fd-border [&_img]:bg-white [&_img]:p-2"
                    />

                    {/* Opciones A - E */}
                    <div className="grid gap-2.5 sm:grid-cols-2 pt-1">
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

                        // Opción E abarca 2 columnas para un diseño balanceado si es la última
                        const spanClass = letra === 'E' ? 'sm:col-span-2' : '';

                        return (
                          <button
                            key={letra}
                            disabled={examFinished}
                            onClick={() => handleSelectOption(q.id, letra)}
                            className={`flex items-center gap-3 rounded-xl border px-3.5 py-3 text-left transition-all ${btnClass} ${spanClass} [&_img]:max-h-24 [&_img]:rounded-lg overflow-hidden cursor-pointer`}
                          >
                            <span className="font-bold shrink-0 text-sm">{letra})</span>
                            <MathHtml 
                              html={optContent}
                              className="grow text-sm overflow-visible min-w-0" 
                              inlineDisplay={true}
                            />
                            {isOfficialCorrect && <CheckCircle2 className="text-emerald-500 shrink-0" size={16} />}
                            {isSelected && isWrong && !isExamMode && <XCircle className="text-rose-500 shrink-0" size={16} />}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* Pie de Acciones de la Pregunta */}
                  <div className="space-y-3 pt-2">
                    <div className="flex flex-wrap items-center justify-between gap-3 border-t border-fd-border pt-4 no-print">
                      <div className="flex items-center gap-2">
                        {hasKey && !isExamMode ? (
                          <>
                            <button
                              onClick={() => toggleSolution(q.id)}
                              className="inline-flex items-center gap-1.5 rounded-lg border border-fd-border bg-fd-background px-3 py-1.5 text-xs font-semibold text-ink hover:bg-fd-muted transition-colors shadow-xs"
                            >
                              {isRevealed ? <EyeOff size={14} /> : <Eye size={14} />}
                              {isRevealed ? 'Ocultar Clave' : 'Revelar Clave Oficial'}
                            </button>
                            {chosen && (
                              <span className={`text-xs font-bold ${isCorrect ? 'text-emerald-600' : 'text-rose-600'}`}>
                                {isCorrect ? '¡Correcto! Clave ' + q.correct_key : 'Incorrecto. Clave oficial: ' + q.correct_key}
                              </span>
                            )}
                          </>
                        ) : !hasKey && !isExamMode ? (
                          <div className="flex items-center gap-2 text-xs text-amber-700/90 font-medium">
                            <span className="inline-flex items-center gap-1">
                              <FileQuestion size={13} /> Pregunta propuesta (práctica libre)
                            </span>
                            {chosen && (
                              <span className="text-fd-primary font-bold">
                                • Marcaste {chosen}
                              </span>
                            )}
                          </div>
                        ) : null}
                      </div>

                      <a
                        href={q.web_url || '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="text-xs text-fd-primary hover:underline inline-flex items-center gap-1 shrink-0"
                      >
                        Ver en Eduteka original ↗
                      </a>
                    </div>

                    {/* Solución explicativa paso a paso */}
                    {isRevealed && q.resolution_html && (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-2 mt-2">
                        <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 block">
                          Resolución Oficial Paso a Paso
                        </span>
                        <MathHtml 
                          html={q.resolution_html}
                          className="text-sm text-ink leading-relaxed" 
                        />
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>

      {/* Paginación */}
      {totalPages > 1 && !isExamMode && (
        <div className="flex items-center justify-between border-t border-fd-border pt-6 no-print">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page === 1}
            className="inline-flex items-center gap-1 rounded-xl border border-fd-border px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40 hover:bg-fd-muted transition-colors cursor-pointer"
          >
            <ChevronLeft size={16} /> Anterior
          </button>
          <span className="text-xs text-ink-soft">
            Página <strong>{page}</strong> de <strong>{totalPages}</strong>
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page === totalPages}
            className="inline-flex items-center gap-1 rounded-xl border border-fd-border px-4 py-2 text-sm font-semibold text-ink disabled:opacity-40 hover:bg-fd-muted transition-colors cursor-pointer"
          >
            Siguiente <ChevronRight size={16} />
          </button>
        </div>
      )}
    </div>
  );
}
