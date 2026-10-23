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
      { title: "Sobre — Gatums Gourmet | Doces, tortas e brigadeiros em Santos" },
      {
        name: "description",
        content:
          "Há anos adoçando Santos com brigadeiros gourmet, tortas e doces artesanais feitos à mão. Conheça a Gatums Gourmet e peça o seu.",
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
          <h1 className="font-display text-4xl text-foreground">
            Doces que viram <span className="text-gradient-warm">boas lembranças</span>
          </h1>
          <p className="mt-6 text-lg leading-relaxed text-muted-foreground">
            A <strong className="text-foreground">Gatums Gourmet</strong> nasceu de um desejo
            simples: fazer o melhor brigadeiro que você já provou. Começamos numa cozinha pequena
            em Santos e, em três anos, já adoçamos a vida de mais de cem clientes que voltam sempre
            — porque doce bom a gente não esquece.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Trabalhamos com chocolate de verdade, pistache, chocolate branco e ingredientes
            escolhidos a dedo. Nada de atalhos nem conservadores: cada brigadeiro é enrolado à mão e
            cada uma das nossas sete receitas de torta é feita no dia, para chegar até você no ponto
            certo de sabor e maciez.
          </p>
          <p className="mt-4 leading-relaxed text-muted-foreground">
            Seja para uma festa, um presente que surpreende ou aquela vontade de se presentear,
            a gente prepara tudo com o mesmo carinho de quem faz para a própria família. É esse
            cuidado que transforma um doce num momento especial — e é por isso que tanta gente
            confia na Gatums para adoçar as datas que importam.
          </p>

          <div className="mt-12 grid gap-4 sm:grid-cols-2">
            <div className="rounded-2xl border border-border bg-card p-6">
              <h3 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-accent">
                <MapPin className="h-4 w-4" /> Onde estamos
              </h3>
              <p className="mt-3 text-foreground">Santos, SP</p>
              <p className="text-sm text-muted-foreground">
                Entrega e retirada sob agendamento. Encomende com antecedência.
              </p>
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
            <h3 className="font-display text-2xl text-foreground">Bateu a vontade de doce?</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              Chame a gente no WhatsApp, faça sua encomenda ou acompanhe as novidades.
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
              href={`https://www.instagram.com/${INSTAGRAM}`}
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
