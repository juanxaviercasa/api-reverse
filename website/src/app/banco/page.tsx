import { ExamBankExplorer } from '@/components/exam-bank-explorer';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Banco Preuniversitario | Reverse API Knowledge',
  description: 'Explorador interactivo de 14,498 preguntas de exámenes de admisión de 20 universidades peruanas con KaTeX en vivo.',
};

export default function BancoPage() {
  return <ExamBankExplorer />;
}
