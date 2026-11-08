"use client";

import React from "react";
import Link from "next/link";
import {
  ShieldCheck,
  Lock,
  Eye,
  FileText,
  Database,
  ArrowLeft,
  CheckCircle2,
  AlertTriangle,
  Download,
  Trash2,
  Smartphone,
  Server,
  UserCheck,
} from "lucide-react";

export default function PoliticaPrivacidadPage() {
  return (
    <div className="min-h-screen bg-[#070b14] text-slate-100 selection:bg-emerald-500/30 selection:text-emerald-200">
      {/* HEADER DE NAVEGACIÓN */}
      <header className="sticky top-0 z-50 border-b border-slate-800/80 bg-[#070b14]/90 backdrop-blur-md px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-5xl items-center justify-between">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3.5 py-1.5 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a la Portada
          </Link>
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40">
              <ShieldCheck className="h-4 w-4" />
            </span>
            <span className="text-xs font-bold text-slate-300">
              Habeas Data & Privacidad • v3.4
            </span>
          </div>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* ENCABEZADO */}
        <div className="text-center space-y-3 mb-10">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-1 text-xs font-semibold text-emerald-300">
            <Lock className="h-3.5 w-3.5" />
            <span>Compromiso de Confidencialidad & Seguridad de Datos</span>
          </div>
          <h1 className="text-3xl font-extrabold text-white sm:text-4xl tracking-tight">
            Política de Tratamiento y Protección de Datos Personales
          </h1>
          <p className="text-xs text-slate-400 max-w-2xl mx-auto leading-relaxed">
            Conforme a la Ley Estatutaria 1581 de 2012, el Decreto Reglamentario 1377 de 2013 de la República de Colombia (Régimen de Habeas Data) y los más altos estándares internacionales de privacidad y soberanía de datos.
          </p>
          <p className="text-[11px] font-mono text-emerald-400">
            Última actualización: Noviembre de 2026 • Versión 3.4
          </p>
        </div>

        {/* RESUMEN EJECUTIVO EN 3 TARJETAS */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-12">
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-950/15 p-4 space-y-2">
            <div className="flex items-center gap-2 text-emerald-400">
              <Lock className="h-5 w-5" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-emerald-300">
                100% Sin Venta de Datos
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Tus hábitos, finanzas, horas de estudio y métricas personales jamás son vendidos, transferidos ni comercializados a redes publicitarias ni a centrales de riesgo.
            </p>
          </div>

          <div className="rounded-2xl border border-indigo-500/30 bg-indigo-950/15 p-4 space-y-2">
            <div className="flex items-center gap-2 text-indigo-400">
              <Database className="h-5 w-5" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-indigo-300">
                Aislamiento RLS en Base de Datos
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Políticas de Row Level Security (RLS) en PostgreSQL/Supabase garantizan criptográficamente que solo tú puedes consultar y modificar tus propios registros.
            </p>
          </div>

          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-950/15 p-4 space-y-2">
            <div className="flex items-center gap-2 text-cyan-400">
              <Download className="h-5 w-5" />
              <h3 className="font-bold text-xs uppercase tracking-wider text-cyan-300">
                Portabilidad & Derecho al Olvido
              </h3>
            </div>
            <p className="text-xs text-slate-300 leading-relaxed">
              Puedes exportar el 100% de tus datos a CSV / JSON o Notion en cualquier momento, o solicitar la eliminación total e irrevocable de tu cuenta.
            </p>
          </div>
        </div>

        {/* ARTÍCULOS DETALLADOS DE LA POLÍTICA */}
        <div className="space-y-8 rounded-3xl border border-slate-800 bg-slate-900/40 p-6 sm:p-10 text-xs sm:text-sm text-slate-300 leading-relaxed shadow-xl">
          {/* SECCIÓN 1 */}
          <section className="space-y-2.5">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">01.</span>
              Identificación del Responsable del Tratamiento
            </h2>
            <p>
              El <strong>RPG Productivity & Personal Finance Life-Engine</strong> (en adelante, &quot;La Plataforma&quot;) es un sistema integral de sistematización de datos personales, productividad gamificada, gestión ágil de proyectos y analítica de hábitos, operado bajo principios de software seguro, soberanía del usuario y transparencia.
            </p>
            <p>
              Para cualquier solicitud, consulta, actualización, rectificación o revocatoria del consentimiento, el titular de los datos puede comunicarse al canal oficial de privacidad:{" "}
              <code className="rounded bg-slate-950 px-2 py-0.5 text-emerald-400 font-mono">
                privacidad@rpg-life-engine.local
              </code>{" "}
              o mediante el repositorio institucional del proyecto en GitHub.
            </p>
          </section>

          {/* SECCIÓN 2 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">02.</span>
              Marco Legal y Alcance
            </h2>
            <p>
              Esta política se rige en estricto cumplimiento del Artículo 15 de la Constitución Política de Colombia, la <strong>Ley Estatutaria 1581 de 2012</strong>, el <strong>Decreto Reglamentario 1377 de 2013</strong> y demás normas que las adicionen, complementen o reglamenten, así como por los principios universales de protección de datos (GDPR / Soberanía Digital).
            </p>
            <p>
              Aplica a todos los datos personales recolectados, almacenados, procesados y sincronizados a través de la aplicación web, el cliente móvil Progressive Web App (PWA) y los atajos de automatización de iOS Shortcuts.
            </p>
          </section>

          {/* SECCIÓN 3 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">03.</span>
              Categorías de Datos Tratados
            </h2>
            <p>
              La Plataforma recolecta únicamente los datos estrictamente necesarios para su funcionamiento operativo y gamificado, agrupados en las siguientes categorías:
            </p>
            <ul className="list-disc pl-5 space-y-1.5 text-slate-300">
              <li>
                <strong>Datos de Registro y Autenticación:</strong> Dirección de correo electrónico, contraseña procesada mediante funciones hash unidireccionales seguras (bcrypt / Supabase Auth), nombre público de usuario o alias de aventurero y clase de personaje seleccionada.
              </li>
              <li>
                <strong>Datos Cuantitativos de Productividad & Habilidades:</strong> Minutos invertidos en bloques de estudio o trabajo (Deep Work), páginas leídas y títulos de libros en biblioteca, tarjetas de repetición espaciada (SM-2), hileras de tejido artesanal y tiempos de resolución de cubos Rubik (Ao5, Ao12, mejores marcas individuales y tipos de cubos según regulaciones de la WCA).
              </li>
              <li>
                <strong>Datos de Proyectos Ágiles:</strong> Nombres de metas, metodologías de trabajo asignadas (Scrum, Kanban, Lean), etapas de tableros Trello, tarjetas de tareas y criterios de aceptación generados manualmente o mediante asistencia con Gemini IA.
              </li>
              <li>
                <strong>Datos de Ritmo Circadiano & Biológico:</strong> Horarios estimados de levantarse y acostarse, cálculo de ventanas de vigilia y sueño para la estructuración de cronogramas diarios de alto rendimiento.
              </li>
              <li>
                <strong>Datos de Finanzas Personales Cuantitativas:</strong> Presupuestos estimados de ingresos mensuales, gastos fijos y variables declarados, metas de ahorro en Bóveda, saldos en Billetera GP y montos aproximados de deudas pasivas (Debt Bosses) utilizados exclusivamente para simular estrategias de amortización (Bola de Nieve vs Avalancha).
              </li>
            </ul>

            <div className="rounded-xl border border-amber-500/30 bg-amber-950/20 p-4 space-y-1 mt-3">
              <h4 className="font-bold text-amber-300 text-xs flex items-center gap-1.5">
                <AlertTriangle className="h-4 w-4" /> Declaración Expresa sobre Datos Bancarios Sensibles
              </h4>
              <p className="text-xs text-amber-200/90 leading-relaxed">
                El RPG Life-Engine <strong>NO</strong> solicita, no recolecta, no procesa ni almacena números de cuentas bancarias completas, números de tarjetas de crédito o débito de 16 dígitos, códigos de seguridad CVV/CVC, tokens OTP ni credenciales de acceso a portales bancarios. Los nombres de entidades (ej. ADDI, Nequi, Bancolombia) actúan únicamente como etiquetas descriptivas de juego (*Debt Bosses*) introducidas por el propio aventurero para su auto-monitoreo.
              </p>
            </div>
          </section>

          {/* SECCIÓN 4 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">04.</span>
              Finalidades del Tratamiento
            </h2>
            <p>
              Los datos suministrados por el titular tienen como finalidades exclusivas:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              <li>Permitir el acceso seguro y autenticado a la cuenta del aventurero.</li>
              <li>Calcular en tiempo real el progreso de juego: nivel del jugador, puntos de experiencia (XP), forja de oro virtual (GP) y multiplicadores de racha de hábitos.</li>
              <li>Generar gráficos y visualizaciones analíticas personales (Heatmap anual de 365 días, curva de rendimiento WCA y cronograma biológico).</li>
              <li>Procesar peticiones de registro ultra-rápidas mediante atajos de iOS Shortcuts y el Modo Móvil de 5 segundos.</li>
              <li>Almacenar en cola local segura del dispositivo del usuario las acciones ejecutadas fuera de línea (Modo PWA Offline) para su posterior sincronización.</li>
              <li>Permitir la descarga completa de la información personal en archivos estándar abiertos (JSON, CSV, Notion).</li>
            </ol>
          </section>

          {/* SECCIÓN 5 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">05.</span>
              Principios Rectores Aplicados
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                <span className="font-bold text-emerald-300 text-xs block">Principio de Finalidad</span>
                <p className="text-xs text-slate-400">El tratamiento obedece a una finalidad legítima y comunicada expresamente al titular.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                <span className="font-bold text-emerald-300 text-xs block">Principio de Libertad</span>
                <p className="text-xs text-slate-400">El tratamiento solo se ejerce con el consentimiento previo, expreso e informado del usuario.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                <span className="font-bold text-emerald-300 text-xs block">Principio de Seguridad</span>
                <p className="text-xs text-slate-400">Medidas técnicas, humanas y administrativas necesarias para evitar adulteración o acceso no autorizado.</p>
              </div>
              <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-3 space-y-1">
                <span className="font-bold text-emerald-300 text-xs block">Principio de Confidencialidad</span>
                <p className="text-xs text-slate-400">Reserva absoluta de la información sin cesión ni explotación comercial por terceros.</p>
              </div>
            </div>
          </section>

          {/* SECCIÓN 6 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">06.</span>
              Seguridad Técnica & Arquitectura de Almacenamiento
            </h2>
            <p>
              La infraestructura del RPG Life-Engine incorpora estándares modernos de seguridad de la información:
            </p>
            <ul className="list-disc pl-5 space-y-1 text-slate-300">
              <li>
                <strong>Cifrado en Tránsito (TLS/HTTPS):</strong> Todas las peticiones entre el cliente (navegador o celular) y los servidores viajan a través de canales encriptados SSL/TLS con protocolos modernos.
              </li>
              <li>
                <strong>Row Level Security (RLS):</strong> Las tablas maestras en PostgreSQL aplican restricciones de seguridad a nivel de fila mediante Supabase RLS, impidiendo que cualquier usuario consulte o altere datos de otro jugador.
              </li>
              <li>
                <strong>Almacenamiento Local (PWA Client-Side):</strong> Los datos en cola offline residen exclusivamente en el almacenamiento local del dispositivo del usuario (localStorage / IndexedDB) y no se comparten con aplicaciones externas.
              </li>
              <li>
                <strong>Tokens de Acceso Seguros:</strong> Los atajos de iOS y la API utilizan claves privadas individuales (*Shortcut API Keys*) que pueden ser revocadas o regeneradas en cualquier momento por el usuario desde la interfaz.
              </li>
            </ul>
          </section>

          {/* SECCIÓN 7 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">07.</span>
              Derechos de los Titulares de los Datos (Habeas Data)
            </h2>
            <p>
              Como titular de sus datos personales, el usuario tiene derecho en cualquier momento a:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              <li>
                <strong>Conocer, actualizar y rectificar</strong> sus datos frente a la Plataforma.
              </li>
              <li>
                <strong>Solicitar prueba de la autorización</strong> otorgada para el tratamiento.
              </li>
              <li>
                <strong>Ser informado</strong> sobre el uso que se ha dado a sus datos.
              </li>
              <li>
                <strong>Presentar ante la Superintendencia de Industria y Comercio (SIC)</strong> quejas por infracciones a la Ley 1581 de 2012.
              </li>
              <li>
                <strong>Revocar la autorización y/o solicitar la supresión</strong> del dato cuando en el tratamiento no se respeten los principios, derechos y garantías constitucionales.
              </li>
              <li>
                <strong>Acceder gratuitamente</strong> a sus datos personales que hayan sido objeto de tratamiento (disponible mediante la función nativa de descarga de respaldo JSON maestro).
              </li>
            </ol>
          </section>

          {/* SECCIÓN 8 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">08.</span>
              Procedimiento para Ejercer los Derechos de Consulta o Reclamo
            </h2>
            <p>
              El titular o sus causahabientes podrán ejercer sus derechos enviando una solicitud formal al correo electrónico:{" "}
              <code className="rounded bg-slate-950 px-2 py-0.5 text-emerald-400 font-mono">
                privacidad@rpg-life-engine.local
              </code>.
            </p>
            <p>
              La solicitud debe contener: nombre completo del titular, correo registrado en La Plataforma, descripción clara de los hechos que dan lugar a la consulta o reclamo, y la petición concreta (rectificación, actualización, portabilidad o supresión definitiva). Las consultas serán atendidas en un término máximo de diez (10) días hábiles y los reclamos en un término de quince (15) días hábiles, conforme a la Ley 1581 de 2012.
            </p>
          </section>

          {/* SECCIÓN 9 */}
          <section className="space-y-2.5 border-t border-slate-800/80 pt-6">
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              <span className="text-emerald-400 font-mono">09.</span>
              Vigencia de las Bases de Datos y Modificaciones
            </h2>
            <p>
              Los datos personales se conservarán durante el tiempo necesario para cumplir las finalidades descritas o hasta que el titular revoque su autorización y solicite la supresión de los mismos.
            </p>
            <p>
              Cualquier cambio sustancial en esta Política de Tratamiento de Datos será publicado en esta misma página web con antelación a su entrada en vigencia.
            </p>
          </section>
        </div>

        {/* ACCIONES FINALES */}
        <div className="mt-8 flex flex-wrap items-center justify-between gap-4 border-t border-slate-800/80 pt-6">
          <Link
            href="/"
            className="inline-flex items-center gap-2 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-4 py-2.5 text-xs font-bold text-slate-200 transition cursor-pointer"
          >
            <ArrowLeft className="h-4 w-4" /> Volver a la Portada
          </Link>

          <Link
            href="/login"
            className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 px-5 py-2.5 text-xs font-bold text-white shadow-lg shadow-emerald-950/40 transition cursor-pointer"
          >
            <span>🔑</span> Ir a Iniciar Sesión / Registro
          </Link>
        </div>
      </main>
    </div>
  );
}
