import type { Metadata } from 'next';
import { MathStudio } from '@/components/math-studio';

export const metadata: Metadata = {
  title: 'Knowledge Extraction Studio · Educación y desarrollo',
  description:
    'Extrae y organiza JSON de fuentes educativas y científicas para reutilizarlos en tus aplicaciones, contenidos y proyectos web.',
};

export default function HomePage() {
  return (
    <main className="flex-1">
      <MathStudio />
    </main>
  );
}
