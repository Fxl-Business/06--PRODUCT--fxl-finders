const steps = [
  { n: '01', title: 'Clone o template', body: 'git clone fxl-template my-project' },
  {
    n: '02',
    title: 'Rode o init',
    body: 'bash scripts/init-from-template.sh <slug> "<Name>" <db>',
  },
  { n: '03', title: 'Configure .env', body: 'Adicione chaves Clerk, DATABASE_URL, etc.' },
  { n: '04', title: 'make dev', body: 'Suba api + web + site + mobile em paralelo.' },
];

export function HowItWorks() {
  return (
    <section className="border-b bg-muted/30">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="max-w-2xl">
          <h2 className="text-3xl font-semibold tracking-tight">Como funciona</h2>
          <p className="mt-4 text-muted-foreground">
            Quatro passos do zero ao app rodando localmente.
          </p>
        </div>
        <div className="mt-16 grid grid-cols-1 gap-12 md:grid-cols-4">
          {steps.map((step) => (
            <div key={step.n} className="relative">
              <span className="text-sm font-semibold text-primary">{step.n}</span>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 font-mono text-xs text-muted-foreground">{step.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
