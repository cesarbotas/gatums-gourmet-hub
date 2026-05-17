import { createFileRoute } from "@tanstack/react-router";
import { Instagram, MessageCircle, Mail, MapPin, Phone } from "lucide-react";
import { Navigation } from "@/components/Navigation";
import { Footer } from "@/components/Footer";
import { Button } from "@/components/ui/button";

const WHATSAPP_NUMBER = "5513991341233"; // formato internacional
const PHONE_DISPLAY = "(13) 9 9134-1233";
const EMAIL = "gatumsgourmet@gmail.com";
const INSTAGRAM = "gatumsgourmet";
const WHATSAPP_MSG = encodeURIComponent(
  "Olá! Gostaria de saber mais sobre os produtos da Gatums Gourmet.",
);

export const Route = createFileRoute("/sobre")({
  head: () => ({
    meta: [
      { title: "Sobre — Gatums Gourmet" },
      {
        name: "description",
        content: "Conheça a história e os valores por trás da Gatums Gourmet, em Santos/SP.",
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
            pequena, com a vontade de fazer comida de verdade. Continuamos apaixonados por
            fermentações longas, geleias borbulhando no fogão e a cara de quem prova um doce
            nosso pela primeira vez.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Trabalhamos em pequenos lotes, com produtores locais sempre que possível, e cada
            receita passa por dezenas de testes antes de chegar ao catálogo.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
                <MapPin className="h-4 w-4" /> Onde estamos
              </h3>
              <p className="mt-3 text-foreground">Santos, SP</p>
              <p className="text-sm text-muted-foreground">Retirada e entrega sob agendamento.</p>
            </div>
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
                <Mail className="h-4 w-4" /> Fale com a gente
              </h3>
              <a
                href={`mailto:${EMAIL}`}
                className="mt-3 block text-foreground hover:underline"
              >
                {EMAIL}
              </a>
              <p className="mt-1 inline-flex items-center gap-1.5 text-sm text-muted-foreground">
                <Phone className="h-3.5 w-3.5" /> {PHONE_DISPLAY}
              </p>
            </div>
          </div>

          <div className="mt-8 rounded-2xl border border-border bg-gradient-warm/10 p-6">
            <h3 className="font-display text-2xl text-foreground">Vamos conversar?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Tire dúvidas, faça encomendas ou siga as novidades nas redes.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <Button asChild className="bg-[#25D366] text-white hover:bg-[#1ebe57]">
                <a
                  href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <MessageCircle className="h-4 w-4" /> WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <a
                  href={`https://instagram.com/${INSTAGRAM}`}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  <Instagram className="h-4 w-4" /> @{INSTAGRAM}
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={`mailto:${EMAIL}`}>
                  <Mail className="h-4 w-4" /> Enviar e-mail
                </a>
              </Button>
            </div>
          </div>

          <div className="mt-8 overflow-hidden rounded-2xl border border-border bg-card">
            <div className="border-b border-border p-5">
              <h3 className="flex items-center gap-2 font-semibold text-foreground">
                <Instagram className="h-4 w-4 text-accent" /> Acompanhe no Instagram
              </h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Bastidores, lançamentos e receitas em primeira mão.
              </p>
            </div>
            <a
              href={`https://wwww.instagram.com/${INSTAGRAM}`}
              target="_blank"
              rel="noopener noreferrer"
              className="block p-5 text-sm font-medium text-accent hover:underline"
            >
              Abrir perfil @{INSTAGRAM} →
            </a>
          </div>
        </section>
      </main>

      {/* WhatsApp flutuante */}
      <a
        href={`https://wa.me/${WHATSAPP_NUMBER}?text=${WHATSAPP_MSG}`}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Conversar no WhatsApp"
        className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-full bg-[#25D366] text-white shadow-warm transition-transform hover:scale-105"
      >
        <MessageCircle className="h-6 w-6" />
      </a>

      <Footer />
    </div>
  );
}
