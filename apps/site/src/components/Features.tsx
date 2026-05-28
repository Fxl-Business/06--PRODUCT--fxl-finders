import { Activity, ShieldCheck, Zap } from 'lucide-react';

const features = [
  {
    icon: Activity,
    title: 'Dashboard ao vivo',
    description: 'Dados em tempo real via TanStack Query e a API Hono.',
  },
  {
    icon: ShieldCheck,
    title: 'Multi-tenant por padrão',
    description: 'Clerk Organizations + org_id em toda tabela. Pronto para escalar.',
  },
  {
    icon: Zap,
    title: 'Deploy descomplicado',
    description: 'Vercel para frontend, Coolify para backend. Um comando para subir.',
  },
];

export function Features() {
  return (
    <section id="features" className="border-b">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">
            Tudo o que você precisa para começar
          </h2>
          <p className="mt-4 text-muted-foreground">
            Cada projeto FXL começa com o mesmo contrato: monorepo, auth, banco,
            i18n e CI já configurados.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-8 md:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.title} className="rounded-lg border bg-card p-8">
              <feature.icon className="size-6 text-primary" />
              <h3 className="mt-6 text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-sm text-muted-foreground">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
