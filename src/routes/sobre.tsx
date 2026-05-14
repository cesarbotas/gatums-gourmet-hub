import { createFileRoute } from "@tanstack/react-router";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Gatums Gourmet" },
      {
        name: "description",
        content: "Conheça a história e os valores por trás da Gatums Gourmet.",
      },
    ],
  }),
  component: SobrePage,
});

function SobrePage() {
  return (
    <div className="flex min-h-screen flex-col bg-background">
      <Navigation />
      <main className="flex-1">
        <section className="mx-auto max-w-3xl px-4 py-16 sm:px-6">
          <h1 className="font-display text-4xl text-foreground">Nossa história</h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            A <strong className="text-foreground">Gatums Gourmet</strong> nasceu em uma cozinha
            pequena, com a vontade de fazer comida de verdade. Sete anos depois, continuamos
            apaixonados por fermentações longas, geleias borbulhando no fogão e a cara de quem
            prova um doce nosso pela primeira vez.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Trabalhamos em pequenos lotes, com produtores locais sempre que possível, e cada
            receita passa por dezenas de testes antes de chegar ao catálogo.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
                Onde estamos
              </h3>
              <p className="mt-2 text-foreground">São Paulo, SP</p>
              <p className="text-sm text-muted-foreground">Atelier sob agendamento.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="text-sm font-semibold uppercase tracking-wide text-accent">
                Fale com a gente
              </h3>
              <p className="mt-2 text-foreground">contato@gatumsgourmet.com</p>
              <p className="text-sm text-muted-foreground">(11) 90000-0000</p>
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </div>
  );
}
