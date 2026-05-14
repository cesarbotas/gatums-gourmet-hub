export function Footer() {
  return (
    <footer className="border-t border-border bg-secondary/40">
      <div className="mx-auto grid max-w-7xl gap-8 px-4 py-12 sm:px-6 md:grid-cols-3">
        <div>
          <h3 className="font-display text-xl font-semibold text-foreground">
            Gatums <span className="text-gradient-warm">Gourmet</span>
          </h3>
          <p className="mt-2 max-w-sm text-sm text-muted-foreground">
            Produtos artesanais feitos com tempo, técnica e ingredientes selecionados.
          </p>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Contato</h4>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>contato@gatumsgourmet.com</li>
            <li>(11) 90000-0000</li>
            <li>São Paulo, SP</li>
          </ul>
        </div>
        <div>
          <h4 className="text-sm font-semibold text-foreground">Horário</h4>
          <ul className="mt-3 space-y-1 text-sm text-muted-foreground">
            <li>Seg a Sex — 9h às 18h</li>
            <li>Sáb — 9h às 13h</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-4 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} Gatums Gourmet — feito com cuidado.
      </div>
    </footer>
  );
}
