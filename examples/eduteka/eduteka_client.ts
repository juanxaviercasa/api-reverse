/**
 * Cliente API TypeScript para Eduteka.pe
 * Diseñado para Node.js y Next.js
 */

export interface QuestionOption {
  opt: string;
  option: string;
  block?: boolean;
  rpta?: boolean;
}

export interface QuestionDetail {
  _id: string;
  area: string;
  topic?: string | null;
  slug: string;
  type: string;
  question: string;
  options: Record<string, string>;
  opts: QuestionOption[];
  has_rpta: boolean;
  resolution?: string;
}

export interface QuestionDetailResponse {
  status: boolean;
  question: QuestionDetail;
  rptaOld?: string | null;
}

export interface AnswerResponse {
  status: boolean;
  message: string;
  rpta?: string; // Clave correcta (A, B, C, D, E)
  correctAnswer?: boolean;
  resolution?: string; // Explicación / Resolución paso a paso en HTML
  optionsPorcent?: Record<string, { porcent: number; count: number }>;
}

export class EdutekaClient {
  private baseUrl: string;

  constructor(baseUrl: string = 'https://eduteka.pe') {
    this.baseUrl = baseUrl;
  }

  private get headers(): HeadersInit {
    return {
      Accept: 'application/json',
      'X-Requested-With': 'fetch',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    };
  }

  /**
   * Obtiene la lista de UUIDs de preguntas en una página específica de un área.
   */
  async getQuestionUUIDs(area: string = 'razonamiento-matematico', page: number = 1): Promise<string[]> {
    const url = `${this.baseUrl}/preguntas/area/${area}?page=${page}`;
    const res = await fetch(url, { headers: { 'User-Agent': this.headers['User-Agent'] as string } });
    if (!res.ok) return [];

    const html = await res.text();
    const regex = /showModalAnswerQuestion\s*\(\s*event\s*,\s*['"]([a-f0-9-]+)['"]\s*\)/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(html)) !== null) {
      matches.push(match[1]);
    }
    return matches;
  }

  /**
   * Consulta el endpoint interno /preguntas/detail/{uuid}
   */
  async getQuestionDetail(uuid: string): Promise<QuestionDetail | null> {
    const url = `${this.baseUrl}/preguntas/detail/${uuid}`;
    const res = await fetch(url, { headers: this.headers });
    if (!res.ok) return null;

    const data: QuestionDetailResponse = await res.json();
    if (!data.status || !data.question) return null;

    return data.question;
  }

  /**
   * Envía una respuesta a una pregunta y obtiene la clave correcta con su resolución.
   */
  async submitAnswer(uuid: string, optionKey: string): Promise<AnswerResponse> {
    const url = `${this.baseUrl}/preguntas/${uuid}/enviar-respuesta`;
    const formData = new URLSearchParams();
    formData.append('rpta', optionKey.toUpperCase());

    const res = await fetch(url, {
      method: 'POST',
      headers: {
        ...this.headers,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: formData.toString(),
    });

    if (!res.ok) {
      return { status: false, message: `HTTP Error ${res.status}` };
    }

    return await res.json();
  }

  /**
   * Descarga un lote de preguntas completas de forma asíncrona.
   */
  async fetchBatch(area: string = 'razonamiento-matematico', maxQuestions: number = 10): Promise<QuestionDetail[]> {
    const uuids = await this.getQuestionUUIDs(area, 1);
    const targetUuids = uuids.slice(0, maxQuestions);

    const questions: QuestionDetail[] = [];
    for (const id of targetUuids) {
      const q = await this.getQuestionDetail(id);
      if (q) questions.push(q);
    }
    return questions;
  }
}
