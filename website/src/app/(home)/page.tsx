import type { Metadata } from 'next';
import { MathStudio } from '@/components/math-studio';

export const metadata: Metadata = {
  title: 'API Reverse Studio · Math & Full Stack Engineering',
  description:
    'Convierte plataformas matemáticas (Symbolab, Khan Academy, GeoGebra, Wolfram, Brilliant) en APIs tipadas o consume APIs abiertas para educación y desarrollo web.',
};

export default function HomePage() {
  return (
    <main className="flex-1">
      <MathStudio />
    </main>
  );
}
