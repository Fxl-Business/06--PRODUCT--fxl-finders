import Link from 'next/link';
import { ArrowRight } from 'lucide-react';
import { Button } from './Button';

export function Hero() {
  const webUrl = process.env.NEXT_PUBLIC_WEB_URL ?? 'http://localhost:5173';

  return (
    <section className="relative overflow-hidden border-b">
      <div className="mx-auto max-w-6xl px-6 py-24 sm:py-32">
        <div className="max-w-3xl">
          <span className="inline-flex items-center gap-2 rounded-full border bg-muted px-3 py-1 text-xs font-medium text-muted-foreground">
            <span className="size-1.5 rounded-full bg-primary" />
            Plataforma FXL
          </span>
          <h1 className="mt-6 text-4xl font-semibold tracking-tight sm:text-6xl">
            Fxl Finders
          </h1>
          <p className="mt-6 max-w-xl text-lg text-muted-foreground">
            Substitua este texto pela proposta de valor do projeto. A landing
            chega pré-montada com hero, features e timeline — basta editar.
          </p>
          <div className="mt-10 flex flex-wrap gap-4">
            <Button asChild size="lg">
              <Link href={webUrl}>
                Acessar dashboard <ArrowRight className="size-4" />
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline">
              <Link href="#features">Ver recursos</Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}
