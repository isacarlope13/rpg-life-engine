"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  Sparkles,
  ArrowLeft,
  Copy,
  Check,
  Heart,
  BookOpen,
  Coffee,
  Play,
  Layers,
  Palette,
  Eye,
  Info,
} from "lucide-react";
import {
  COZY_COLORS,
  CozyButton,
  CozyCard,
  CozyCardHeader,
  CozyWindow,
  CozyModal,
  CozyTooltip,
  CozyProgress,
  CozyTabs,
  CozyNotification,
  CozyEmptyState,
  CozyLoadingState,
  CozySessionControls,
} from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

export default function CozyDesignSystemPage() {
  const [copiedHex, setCopiedHex] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState("tab1");
  const [progressVal, setProgressVal] = useState(68);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [notificationDismissed, setNotificationDismissed] = useState(false);

  const handleCopy = (hex: string) => {
    if (typeof navigator !== "undefined" && navigator.clipboard) {
      navigator.clipboard.writeText(hex);
      setCopiedHex(hex);
      triggerHaptic("success");
      setTimeout(() => setCopiedHex(null), 2000);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4EEDC] text-[#3A2E2B] font-sans antialiased selection:bg-[#E7D69C]/40 p-4 sm:p-8 pb-24">
      <div className="mx-auto max-w-6xl space-y-10">
        
        {/* CABECERA DE LA PÁGINA */}
        <header className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-[3px] border-[#3A2E2B] bg-[#314C3C] text-2xl text-[#FFFDF8] shadow-[0_3px_0_#3A2E2B]">
              🎨
            </span>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-black uppercase tracking-widest text-[#77936A]">
                  Guía de Estilo & Componentes
                </span>
                <span className="rounded-full bg-[#E7D69C] px-2 py-0.5 text-[9px] font-black text-[#3A2E2B] border border-[#3A2E2B]">
                  v3.5.0
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-black text-[#3A2E2B] tracking-tight">
                Cozy Pixel Design System
              </h1>
            </div>
          </div>

          <Link
            href="/cozy"
            className="inline-flex items-center gap-2 rounded-2xl border-2 border-[#3A2E2B] bg-[#E8DFCF] px-4 py-2 text-xs font-black text-[#3A2E2B] shadow-[0_2px_0_#3A2E2B] hover:bg-[#D8B48A] transition-transform active:translate-y-0.5"
          >
            <ArrowLeft className="h-4 w-4" /> Volver al Pueblo
          </Link>
        </header>

        {/* 1. PALETA DE COLORES OFICIAL */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <Palette className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              1. Paleta Oficial Cozy Pixel
            </h2>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-3.5">
            {Object.entries(COZY_COLORS).map(([name, hex]) => {
              const isLight = ["cream", "parchment", "sunlight", "meadow", "lake"].includes(name);

              return (
                <div
                  key={name}
                  onClick={() => handleCopy(hex)}
                  className="rounded-2xl border-3 border-[#3A2E2B] p-3 shadow-[0_3px_0_#3A2E2B] transition-transform hover:-translate-y-1 hover:shadow-[0_5px_0_#3A2E2B] cursor-pointer"
                  style={{ backgroundColor: hex }}
                >
                  <div
                    className={`flex items-center justify-between text-xs font-black capitalize ${
                      isLight ? "text-[#3A2E2B]" : "text-[#FFFDF8]"
                    }`}
                  >
                    <span>{name}</span>
                    {copiedHex === hex ? (
                      <Check className="h-3.5 w-3.5 text-emerald-700" />
                    ) : (
                      <Copy className="h-3 w-3 opacity-60" />
                    )}
                  </div>
                  <span
                    className={`mt-6 block font-mono text-[11px] font-bold tracking-wider ${
                      isLight ? "text-[#3A2E2B]/80" : "text-[#FFFDF8]/80"
                    }`}
                  >
                    {hex}
                  </span>
                </div>
              );
            })}
          </div>
        </section>

        {/* 2. BOTONES */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <Sparkles className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              2. Botones Pixel Tactiles (`CozyButton`)
            </h2>
          </div>

          <CozyCard variant="parchment" className="space-y-6">
            <div>
              <span className="block text-xs font-black uppercase text-[#77936A] mb-3">
                Variantes de Color
              </span>
              <div className="flex flex-wrap gap-3">
                <CozyButton variant="forest">Forest (Primario)</CozyButton>
                <CozyButton variant="wood">Wood (Madera)</CozyButton>
                <CozyButton variant="sunlight">Sunlight (Oro)</CozyButton>
                <CozyButton variant="sage">Sage (Salvia)</CozyButton>
                <CozyButton variant="clay">Clay (Alerta)</CozyButton>
                <CozyButton variant="ghost">Ghost</CozyButton>
              </div>
            </div>

            <div>
              <span className="block text-xs font-black uppercase text-[#77936A] mb-3">
                Tamaños y Estados
              </span>
              <div className="flex flex-wrap items-center gap-3">
                <CozyButton size="sm" variant="wood">Pequeño (sm)</CozyButton>
                <CozyButton size="md" variant="forest">Mediano (md)</CozyButton>
                <CozyButton size="lg" variant="sunlight">Grande (lg)</CozyButton>
                <CozyButton variant="forest" disabled>Deshabilitado</CozyButton>
                <CozyButton
                  variant="wood"
                  icon={<Coffee className="h-3.5 w-3.5 text-[#C88973]" />}
                >
                  Con Icono
                </CozyButton>
              </div>
            </div>
          </CozyCard>
        </section>

        {/* 3. TARJETAS BENTO Y VENTANAS RETRO */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <Layers className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              3. Tarjetas Bento (`CozyCard`) & Ventanas (`CozyWindow`)
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CozyCard variant="parchment" bolts={true}>
              <CozyCardHeader
                icon="🏰"
                title="Tarjeta Bento con Tornillos"
                subtitle="Estilo banco de trabajo con clavos decorativos"
                badge={<span className="rounded-full bg-[#E7D69C] px-2 py-0.5 text-[9px] font-black border border-[#3A2E2B]">Bento</span>}
              />
              <p className="text-xs text-[#5C4033] leading-relaxed">
                Esta tarjeta incluye los 4 tornillos decorativos (`bolts={true}`) que aportan la identidad visual cálida de taller artesanal en Oakhaven.
              </p>
            </CozyCard>

            <CozyWindow
              title="Ventana Retro Simulación"
              subtitle="Estilo Habbo / Club Penguin"
              icon="📜"
              headerVariant="wood"
              onClose={() => alert("Evento de cierre de ventana")}
            >
              <p className="text-xs text-[#5C4033] leading-relaxed">
                Marco con barra de título contrastada y botón de cierre táctil. Ideal para salas temáticas e interiores de edificios.
              </p>
            </CozyWindow>
          </div>
        </section>

        {/* 4. PROGRESO, PESTAÑAS Y TOOLTIPS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <BookOpen className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              4. Progreso, Pestañas & Tooltips
            </h2>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <CozyCard variant="parchment" className="space-y-4">
              <span className="text-xs font-black uppercase text-[#77936A] block">
                Barras de Progreso (`CozyProgress`)
              </span>
              <CozyProgress value={progressVal} label="Avance de Habilidad" variant="forest" />
              <CozyProgress value={progressVal} label="Bóveda de GP" variant="sunlight" size="sm" />
              <CozyProgress value={progressVal} label="Reserva de Racha" variant="clay" size="lg" />

              <div className="flex gap-2 pt-2">
                <CozyButton size="sm" variant="wood" onClick={() => setProgressVal((p) => Math.max(0, p - 10))}>
                  -10%
                </CozyButton>
                <CozyButton size="sm" variant="forest" onClick={() => setProgressVal((p) => Math.min(100, p + 10))}>
                  +10%
                </CozyButton>
              </div>
            </CozyCard>

            <CozyCard variant="parchment" className="space-y-5">
              <span className="text-xs font-black uppercase text-[#77936A] block">
                Pestañas (`CozyTabs`) & Tooltips (`CozyTooltip`)
              </span>

              <CozyTabs
                tabs={[
                  { id: "tab1", label: "General", badge: "3" },
                  { id: "tab2", label: "Artesanía", badge: "5" },
                  { id: "tab3", label: "Sabiduría" },
                ]}
                activeTab={activeTab}
                onChange={setActiveTab}
              />

              <div className="pt-2 flex items-center gap-4">
                <CozyTooltip content="¡Hola! Soy un tooltip apergaminado." position="top">
                  <span className="rounded-xl border-2 border-[#3A2E2B] bg-[#E8DFCF] px-3 py-1.5 text-xs font-black text-[#3A2E2B] cursor-help inline-flex items-center gap-1.5">
                    <Info className="h-3.5 w-3.5" /> Pasa el cursor aquí (Top)
                  </span>
                </CozyTooltip>

                <CozyTooltip content="Tooltip lateral derecho" position="right">
                  <span className="rounded-xl border-2 border-[#3A2E2B] bg-[#F4EEDC] px-3 py-1.5 text-xs font-black text-[#3A2E2B] cursor-help inline-flex items-center gap-1.5">
                    <Eye className="h-3.5 w-3.5" /> Derecha
                  </span>
                </CozyTooltip>
              </div>
            </CozyCard>
          </div>
        </section>

        {/* 5. NOTIFICACIONES, ESTADOS VACÍOS & DE CARGA */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <Heart className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              5. Notificaciones, Estados Vacíos & Carga
            </h2>
          </div>

          <div className="space-y-4">
            {!notificationDismissed && (
              <CozyNotification
                variant="success"
                title="¡Micro-Misión de Autocuidado Completada!"
                message="Has liberado 3.000 GP de la Bóveda hacia tu Billetera activa con Clara."
                action={{ label: "Ver en Billetera", onClick: () => alert("Redirigiendo a billetera") }}
                onDismiss={() => setNotificationDismissed(true)}
              />
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <CozyEmptyState
                icon="🧺"
                title="Canasto de Tejido Vacío"
                description="Aún no has iniciado un proyecto de dos agujas o crochet en el Atelier."
                action={{
                  label: "Comenzar Proyecto",
                  onClick: () => alert("Iniciar proyecto"),
                }}
              />

              <CozyLoadingState
                message="Sincronizando estado con el reino de Oakhaven..."
                variant="spinner"
              />
            </div>
          </div>
        </section>

        {/* 6. CONTROLES DE SESIÓN INTERACTIVOS */}
        <section className="space-y-4">
          <div className="flex items-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <Play className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              6. Controles de Sesión de Habilidad (`CozySessionControls`)
            </h2>
          </div>

          <div className="max-w-md mx-auto">
            <CozySessionControls
              initialMinutes={15}
              domainName="Lectura Serena"
              onSessionComplete={(mins, notes) => {
                alert(`¡Sesión forjada! ${mins} minutos completados. Notas: "${notes || "Sin notas"}"`);
              }}
            />
          </div>
        </section>

        {/* 7. MODAL INTERACTIVO */}
        <section className="space-y-4 text-center">
          <div className="flex items-center justify-center gap-2 border-b-2 border-[#3A2E2B]/15 pb-2">
            <Eye className="h-5 w-5 text-[#314C3C]" />
            <h2 className="text-lg font-black text-[#3A2E2B]">
              7. Modal Accesible (`CozyModal`)
            </h2>
          </div>

          <div className="pt-2">
            <CozyButton
              variant="forest"
              size="lg"
              onClick={() => setIsModalOpen(true)}
            >
              Abrir Modal de Demostración ➜
            </CozyButton>
          </div>

          <CozyModal
            isOpen={isModalOpen}
            onClose={() => setIsModalOpen(false)}
            title="Modal Accesible de Oakhaven"
            subtitle="Prueba de navegación con teclado (Esc)"
            icon="✨"
            headerVariant="forest"
          >
            <div className="space-y-4 text-left">
              <p className="text-xs text-[#5C4033] leading-relaxed">
                Este modal implementa `role="dialog"`, `aria-modal="true"`, foco controlado, bloqueo de desplazamiento y soporte para la tecla Escape.
              </p>

              <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F4EEDC] p-3 text-xs font-bold text-[#3A2E2B]">
                💡 Puedes cerrarlo pulsando la tecla <kbd className="rounded bg-white px-1.5 py-0.5 border border-[#3A2E2B]">Esc</kbd> o haciendo clic fuera.
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <CozyButton variant="wood" onClick={() => setIsModalOpen(false)}>
                  Entendido
                </CozyButton>
              </div>
            </div>
          </CozyModal>
        </section>

      </div>
    </div>
  );
}
