export function Footer() {
  return (
    <footer className="border-t">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 px-6 py-12 sm:flex-row">
        <p className="text-sm text-muted-foreground">
          © {new Date().getFullYear()} Fxl Finders
        </p>
        <nav className="flex gap-6 text-sm text-muted-foreground">
          <a href="#features" className="hover:text-foreground">
            Recursos
          </a>
          <a
            href="https://fxlbusinessschool.com.br"
            className="hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            FXL
          </a>
        </nav>
      </div>
    </footer>
  );
}
