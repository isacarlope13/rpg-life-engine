"use client";

import React, { useState, useMemo } from "react";
import {
  Landmark,
  Wallet,
  ArrowRightLeft,
  BookOpen,
  PieChart,
  Swords,
  Shield,
  Coins,
  TrendingUp,
  TrendingDown,
  Plus,
  Search,
  Filter,
  CheckCircle2,
  AlertTriangle,
  Lock,
  Layers,
  Sparkles,
  Calendar,
  CreditCard,
  DollarSign,
  ArrowDownRight,
  ArrowUpRight,
  ShieldAlert,
} from "lucide-react";
import type { FinancialMovementRecord, DebtStrategy } from "@/types/rpg";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import {
  DEFAULT_BANK_ACCOUNTS,
  DEFAULT_DEBT_BOSSES,
  calculateFinancialSummary,
  executeAccountTransfer,
  getSmartBankInsights,
  calculateDebtStrategyMetrics,
  type BankAccountRecord,
  type DebtBossUI,
  type BankTransferPayload,
} from "@/lib/sanctuary/bank-engine";
import { INITIAL_FINANCIAL_MOVEMENTS } from "@/lib/initial-financial-movements";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";

interface BankBuildingProps {
  playerLevel: number;
  skillLevel?: number;
  totalGpEarned?: number;
  walletGp?: number;
  vaultGp?: number;
  vaultCapGp?: number;
  aegisShields?: number;
  onRefreshState?: () => Promise<void>;
  onSubmitDirectSkillSession?: (payload: Record<string, unknown>) => Promise<unknown>;
  onClose?: () => void;
}

export function BankBuilding({
  playerLevel,
  skillLevel = 1,
  totalGpEarned = 0,
  walletGp = 12500,
  vaultGp = 387500,
  vaultCapGp = 400000,
  aegisShields = 2,
  onRefreshState,
  onSubmitDirectSkillSession,
  onClose,
}: BankBuildingProps) {
  const [activeTab, setActiveTab] = useState("accounts");

  // Estado financiero: Movimientos y Cuentas
  const [movements, setMovements] = useState<FinancialMovementRecord[]>(INITIAL_FINANCIAL_MOVEMENTS);
  const [accounts, setAccounts] = useState<BankAccountRecord[]>(DEFAULT_BANK_ACCOUNTS);
  const [debtBosses, setDebtBosses] = useState<DebtBossUI[]>(DEFAULT_DEBT_BOSSES);
  const [debtStrategy, setDebtStrategy] = useState<DebtStrategy>("snowball");

  // Filtros de transacciones
  const [searchTxQuery, setSearchTxQuery] = useState("");
  const [selectedTxType, setSelectedTxType] = useState<"all" | "Ingreso" | "Gasto" | "Transferencia">("all");

  // Formulario de nueva transferencia
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferFrom, setTransferFrom] = useState(accounts[0]?.id || "");
  const [transferTo, setTransferTo] = useState(accounts[1]?.id || "");
  const [transferAmount, setTransferAmount] = useState<number>(50000);
  const [transferDescription, setTransferDescription] = useState("");

  // Formulario de nuevo movimiento
  const [isNewTxModalOpen, setIsNewTxModalOpen] = useState(false);
  const [newTxType, setNewTxType] = useState<"Ingreso" | "Gasto">("Gasto");
  const [newTxCategory, setNewTxCategory] = useState("Comida");
  const [newTxAmount, setNewTxAmount] = useState<number>(25000);
  const [newTxDesc, setNewTxDesc] = useState("");
  const [newTxAccount, setNewTxAccount] = useState(accounts[0]?.id || "");

  // Notificación en pantalla
  const [notification, setNotification] = useState<{
    type: "success" | "error" | "warning";
    message: string;
  } | null>(null);

  // Residente asociado: Silas
  const silasResident = useMemo(
    () => COZY_VILLAGE_RESIDENTS.find((r) => r.id === "silas"),
    []
  );

  // Métricas financieras calculadas con precisión
  const summary = useMemo(() => calculateFinancialSummary(movements), [movements]);
  const insights = useMemo(() => getSmartBankInsights(movements), [movements]);
  const debtMetrics = useMemo(
    () => calculateDebtStrategyMetrics(debtBosses, debtStrategy),
    [debtBosses, debtStrategy]
  );

  // Saldo consolidado total en COP
  const totalConsolidatedCop = useMemo(
    () => accounts.reduce((acc, a) => acc + Math.round(a.balanceCop), 0),
    [accounts]
  );

  // Filtrado de movimientos del libro mayor
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      const matchType =
        selectedTxType === "all" ||
        (selectedTxType === "Transferencia"
          ? m.categoria?.toLowerCase() === "transferencia" || (m.tipo as string) === "Transferencia"
          : m.tipo === selectedTxType && m.categoria?.toLowerCase() !== "transferencia");

      const q = searchTxQuery.toLowerCase().trim();
      const matchQuery =
        !q ||
        m.descripcion?.toLowerCase().includes(q) ||
        m.categoria?.toLowerCase().includes(q) ||
        m.metodo_pago?.toLowerCase().includes(q);

      return matchType && matchQuery;
    });
  }, [movements, selectedTxType, searchTxQuery]);

  // Manejador de Transferencia entre cuentas
  const handleExecuteTransfer = (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: BankTransferPayload = {
        fromAccountId: transferFrom,
        toAccountId: transferTo,
        amountCop: transferAmount,
        description: transferDescription.trim() || "Transferencia entre cuentas",
      };

      const result = executeAccountTransfer(accounts, payload);
      setAccounts(result.updatedAccounts);
      setMovements((prev) => [result.transferMovement, ...prev]);

      triggerHaptic("success");
      setNotification({
        type: "success",
        message: `Transferencia de $${transferAmount.toLocaleString("es-CO")} COP completada sin alterar tus ingresos ni gastos globales.`,
      });
      setIsTransferModalOpen(false);
      setTransferDescription("");
    } catch (err: unknown) {
      triggerHaptic("warning");
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Error al transferir fondos.",
      });
    }
  };

  // Manejador de Registro de Movimiento Manual
  const handleAddMovement = (e: React.FormEvent) => {
    e.preventDefault();
    if (newTxAmount <= 0) return;

    const chosenAcc = accounts.find((a) => a.id === newTxAccount) || accounts[0];
    const amountExact = Math.round(newTxAmount);

    const newMov: FinancialMovementRecord = {
      id: `mov_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      fecha: new Date().toISOString().replace("T", " ").slice(0, 16),
      tipo: newTxType,
      categoria: newTxCategory,
      monto: amountExact,
      descripcion: newTxDesc.trim() || `${newTxType} de ${newTxCategory}`,
      metodo_pago: chosenAcc.name,
      created_at: new Date().toISOString(),
    };

    // Actualizar saldo de la cuenta elegida
    setAccounts((prev) =>
      prev.map((acc) => {
        if (acc.id === chosenAcc.id) {
          const delta = newTxType === "Ingreso" ? amountExact : -amountExact;
          return { ...acc, balanceCop: acc.balanceCop + delta };
        }
        return acc;
      })
    );

    setMovements((prev) => [newMov, ...prev]);
    triggerHaptic("success");
    setNotification({
      type: "success",
      message: `Registro de ${newTxType.toLowerCase()} ($${amountExact.toLocaleString("es-CO")} COP) guardado con éxito.`,
    });
    setIsNewTxModalOpen(false);
    setNewTxDesc("");
  };

  // Ataque a un Jefe de Deuda (Abono a capital)
  const handleAttackDebtBoss = (bossId: string, paymentAmountCop: number) => {
    triggerHaptic("success");
    setDebtBosses((prev) =>
      prev.map((b) => {
        if (b.id === bossId) {
          const nextHp = Math.max(0, b.currentHpCop - paymentAmountCop);
          return {
            ...b,
            currentHpCop: nextHp,
            status: nextHp === 0 ? "defeated" : "active",
          };
        }
        return b;
      })
    );

    // Descontar de la cuenta principal de Bancolombia
    setAccounts((prev) =>
      prev.map((a) => {
        if (a.id === "acc_bancolombia") {
          return { ...a, balanceCop: Math.max(0, a.balanceCop - paymentAmountCop) };
        }
        return a;
      })
    );

    setNotification({
      type: "success",
      message: `¡Abono de $${paymentAmountCop.toLocaleString("es-CO")} COP registrado contra la deuda! Daño infligido al jefe.`,
    });
  };

  return (
    <BuildingInteriorShell
      buildingId="banco_oakhaven"
      buildingName="Banco de OakHaven & Real Tesorería"
      domain="work"
      districtName="Plaza Central & Tesorería"
      icon="🏦"
      tagline="Libro Mayor, Cuentas en COP, Bóveda del Reino & Deudas como Jefes de Mazmorra"
      playerLevel={playerLevel}
      skillLevel={skillLevel}
      totalGpEarned={totalGpEarned}
      resident={silasResident}
      sessionsCount={movements.length}
      specificMetrics={[
        {
          label: "Patrimonio Líquido",
          value: `$${totalConsolidatedCop.toLocaleString("es-CO")}`,
          icon: "💰",
        },
        {
          label: "Billetera RPG",
          value: `${walletGp.toLocaleString("es-CO")} GP`,
          icon: "🪙",
        },
        {
          label: "Bóveda RPG",
          value: `${vaultGp.toLocaleString("es-CO")} GP`,
          icon: "🏛️",
        },
        {
          label: "Deuda Activa",
          value: `$${debtMetrics.totalDebtCop.toLocaleString("es-CO")}`,
          icon: "⚔️",
        },
      ]}
      activeTab={activeTab}
      tabs={[
        {
          id: "accounts",
          label: "Cuentas & Tesoro",
          icon: <Landmark className="h-4 w-4" />,
          badge: accounts.length,
        },
        {
          id: "transactions",
          label: "Libro Contable",
          icon: <BookOpen className="h-4 w-4" />,
          badge: movements.length,
        },
        {
          id: "debts",
          label: "Sala de Deudas",
          icon: <Swords className="h-4 w-4" />,
          badge: debtMetrics.activeBossesCount,
        },
        {
          id: "rpg_vault",
          label: "Economía Dual & GP",
          icon: <Coins className="h-4 w-4" />,
        },
        {
          id: "advisor",
          label: "Silas & Alertas",
          icon: <ShieldAlert className="h-4 w-4" />,
          badge: insights.audit.anomalyAlerts.length || undefined,
        },
      ]}
      onTabChange={setActiveTab}
      onClose={onClose}
    >
      {/* NOTIFICACIÓN FLOTANTE */}
      {notification && (
        <div className="mb-4">
          <CozyNotification
            variant={notification.type}
            message={notification.message}
            onDismiss={() => setNotification(null)}
          />
        </div>
      )}

      {/* =========================================================================
          TAB 1: CUENTAS FINANCIERAS & TRANSFERENCIAS SIN DOBLE CONTEO
         ========================================================================= */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
          {/* Cabecera con Botones de Acción */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
                <span>🏦</span> Cuentas Financieras Soberanas
              </h3>
              <p className="text-xs text-[#795548]">
                Saldos reales en Pesos Colombianos (COP) administrados con total privacidad.
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <CozyButton
                variant="sunlight"
                size="sm"
                onClick={() => setIsTransferModalOpen(true)}
                icon={<ArrowRightLeft className="h-3.5 w-3.5" />}
              >
                Transferir entre Cuentas
              </CozyButton>

              <CozyButton
                variant="forest"
                size="sm"
                onClick={() => setIsNewTxModalOpen(true)}
                icon={<Plus className="h-3.5 w-3.5" />}
              >
                Registrar Movimiento
              </CozyButton>
            </div>
          </div>

          {/* Tarjetas de Cuentas */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {accounts.map((acc) => (
              <div
                key={acc.id}
                className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3 flex flex-col justify-between"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-11 w-11 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] text-2xl shadow-inner">
                    {acc.icon}
                  </span>
                  <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-2.5 py-0.5 text-[10px] font-black text-[#314C3C] uppercase">
                    {acc.type}
                  </span>
                </div>

                <div>
                  <h4 className="text-sm font-black text-[#3A2E2B]">{acc.name}</h4>
                  <span className="text-[11px] text-[#795548] block">
                    {acc.institution} {acc.accountNumberMask ? `(${acc.accountNumberMask})` : ""}
                  </span>
                </div>

                <div className="pt-2 border-t-2 border-[#3A2E2B]/10">
                  <span className="text-[10px] uppercase font-bold text-[#795548] block">
                    Saldo Disponible
                  </span>
                  <span className="font-mono text-xl font-black text-[#2A4331]">
                    ${Math.round(acc.balanceCop).toLocaleString("es-CO")} COP
                  </span>
                </div>
              </div>
            ))}
          </div>

          {/* Resumen Contable Consolidado */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#EAF3ED] p-5 shadow-[0_5px_0_#3A2E2B] grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
            <div className="p-2.5 rounded-2xl bg-[#FFFDF8] border-2 border-[#3A2E2B]/20">
              <span className="text-[10px] font-black uppercase text-[#314C3C] block">
                Total Ingresos
              </span>
              <span className="font-mono text-base font-black text-[#2E7D32]">
                +${summary.totalIncomeCop.toLocaleString("es-CO")}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#FFFDF8] border-2 border-[#3A2E2B]/20">
              <span className="text-[10px] font-black uppercase text-[#C62828] block">
                Total Gastos
              </span>
              <span className="font-mono text-base font-black text-[#C62828]">
                -${summary.totalExpenseCop.toLocaleString("es-CO")}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#FFFDF8] border-2 border-[#3A2E2B]/20">
              <span className="text-[10px] font-black uppercase text-[#3A2E2B] block">
                Superávit Neto
              </span>
              <span
                className={`font-mono text-base font-black ${
                  summary.netSavingsCop >= 0 ? "text-[#2E7D32]" : "text-[#C62828]"
                }`}
              >
                ${summary.netSavingsCop.toLocaleString("es-CO")}
              </span>
            </div>

            <div className="p-2.5 rounded-2xl bg-[#FFFDF8] border-2 border-[#3A2E2B]/20">
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Tasa de Ahorro
              </span>
              <span className="font-mono text-base font-black text-[#3A2E2B]">
                {summary.savingsRatePercent}%
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: LIBRO CONTABLE & REGISTRO DE MOVIMIENTOS
         ========================================================================= */}
      {activeTab === "transactions" && (
        <div className="space-y-5">
          {/* Barra de Filtros y Búsqueda */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(["all", "Ingreso", "Gasto", "Transferencia"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => {
                    setSelectedTxType(t);
                    triggerHaptic("light");
                  }}
                  className={`rounded-xl border-2 border-[#3A2E2B] px-3 py-1.5 text-xs font-black transition cursor-pointer ${
                    selectedTxType === t
                      ? "bg-[#314C3C] text-[#FFFDF8] shadow-[0_2px_0_#1A2B20]"
                      : "bg-[#FFFDF8] text-[#3A2E2B] hover:bg-[#F4EEDC]"
                  }`}
                >
                  {t === "all" ? "Todos" : t}
                </button>
              ))}
            </div>

            <div className="relative min-w-[240px]">
              <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-[#795548]" />
              <input
                type="text"
                value={searchTxQuery}
                onChange={(e) => setSearchTxQuery(e.target.value)}
                placeholder="Buscar por concepto o categoría..."
                className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#FFFDF8] pl-8 pr-3 py-1.5 text-xs text-[#3A2E2B] font-bold placeholder-[#9E9087] focus:outline-none focus:ring-2 focus:ring-[#314C3C]"
              />
            </div>
          </div>

          {/* Tabla de Movimientos */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 sm:p-5 shadow-[0_5px_0_#3A2E2B] overflow-x-auto">
            <table className="w-full text-left border-collapse min-w-[600px] text-xs">
              <thead>
                <tr className="border-b-2 border-[#3A2E2B]/20 text-[11px] font-black text-[#795548] uppercase tracking-wider">
                  <th className="py-2.5 px-3">Fecha</th>
                  <th className="py-2.5 px-3">Concepto & Detalle</th>
                  <th className="py-2.5 px-3">Categoría</th>
                  <th className="py-2.5 px-3">Cuenta / Método</th>
                  <th className="py-2.5 px-3 text-right">Importe (COP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#3A2E2B]/10">
                {filteredMovements.slice(0, 50).map((m) => {
                  const isTransfer =
                    (m.tipo as string) === "Transferencia" || m.categoria?.toLowerCase() === "transferencia";
                  const isIncome = m.tipo === "Ingreso";

                  return (
                    <tr key={m.id} className="hover:bg-[#F4EEDC]/40 transition">
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#795548]">
                        {m.fecha}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-[#3A2E2B]">
                        {m.descripcion}
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-lg bg-[#F7F4EB] border border-[#3A2E2B]/15 px-2 py-0.5 text-[10px] font-bold text-[#5D4037]">
                          {m.categoria}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#795548]">
                        {m.metodo_pago}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-black ${
                          isTransfer
                            ? "text-[#4361EE]"
                            : isIncome
                            ? "text-[#2E7D32]"
                            : "text-[#C62828]"
                        }`}
                      >
                        {isTransfer ? "⇄ " : isIncome ? "+$" : "-$"}
                        {Math.abs(m.monto).toLocaleString("es-CO")}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {filteredMovements.length > 50 && (
              <p className="text-center text-[11px] text-[#795548] pt-3 italic">
                Mostrando las primeras 50 de {filteredMovements.length} transacciones registradas.
              </p>
            )}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 3: SALA DE DEUDAS & JEFES DE MAZMORRA (DEBT BOSSES)
         ========================================================================= */}
      {activeTab === "debts" && (
        <div className="space-y-6">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
                <span>⚔️</span> Deudas Representadas como Jefes de Mazmorra
              </h3>
              <p className="text-xs text-[#795548]">
                Visualiza tus obligaciones financieras como enemigos a derrotar. Cada abono restaura tu paz mental.
              </p>
            </div>

            {/* Selector de Estrategia */}
            <div className="flex items-center gap-2 bg-[#F7F4EB] p-1.5 rounded-2xl border-2 border-[#3A2E2B]">
              <span className="text-[10px] font-black uppercase text-[#795548] px-2">
                Estrategia:
              </span>
              <button
                type="button"
                onClick={() => {
                  setDebtStrategy("snowball");
                  triggerHaptic("light");
                }}
                className={`rounded-xl px-2.5 py-1 text-xs font-black transition cursor-pointer ${
                  debtStrategy === "snowball"
                    ? "bg-[#314C3C] text-white"
                    : "text-[#3A2E2B] hover:bg-[#E8DFCF]"
                }`}
              >
                Bola de Nieve
              </button>
              <button
                type="button"
                onClick={() => {
                  setDebtStrategy("avalanche");
                  triggerHaptic("light");
                }}
                className={`rounded-xl px-2.5 py-1 text-xs font-black transition cursor-pointer ${
                  debtStrategy === "avalanche"
                    ? "bg-[#314C3C] text-white"
                    : "text-[#3A2E2B] hover:bg-[#E8DFCF]"
                }`}
              >
                Avalancha
              </button>
            </div>
          </div>

          {/* Tarjetas de Jefes de Deuda */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            {debtBosses.map((boss) => {
              const hpPercent = Math.round((boss.currentHpCop / boss.maxHpCop) * 100);
              const isDefeated = boss.currentHpCop === 0;

              return (
                <div
                  key={boss.id}
                  className={`rounded-3xl border-4 border-[#3A2E2B] p-5 shadow-[0_5px_0_#3A2E2B] space-y-4 ${
                    isDefeated ? "bg-[#EAF3ED]" : "bg-[#FFFDF8]"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#C62828] text-white text-2xl shadow-[0_2px_0_#3A2E2B]">
                        {isDefeated ? "🏆" : "👹"}
                      </span>
                      <div>
                        <h4 className="text-sm font-black text-[#3A2E2B]">{boss.name}</h4>
                        <span className="text-[10px] text-[#795548] block">
                          Tasa: {boss.interestRateEa}% EA • Corte: día {boss.cutoffDay}
                        </span>
                      </div>
                    </div>

                    <span
                      className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                        isDefeated
                          ? "bg-[#2E7D32] text-white"
                          : "bg-rose-100 text-rose-800 border border-rose-300"
                      }`}
                    >
                      {isDefeated ? "Derrotado" : `${hpPercent}% HP`}
                    </span>
                  </div>

                  {/* Barra de Salud (HP / Saldo Pendiente) */}
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs font-bold">
                      <span className="text-[#795548]">Saldo Pendiente (HP):</span>
                      <span className="font-mono font-black text-[#C62828]">
                        ${boss.currentHpCop.toLocaleString("es-CO")} / ${boss.maxHpCop.toLocaleString("es-CO")}
                      </span>
                    </div>

                    <div className="h-4 w-full rounded-full border-2 border-[#3A2E2B] bg-[#F7F4EB] overflow-hidden p-0.5">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-amber-500 to-rose-600 transition-all duration-500"
                        style={{ width: `${Math.min(100, Math.max(0, hpPercent))}%` }}
                      />
                    </div>
                  </div>

                  {/* Datos Clave & Botón de Abono */}
                  <div className="flex items-center justify-between border-t-2 border-[#3A2E2B]/10 pt-3">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-[#795548] block">
                        Cuota Mínima Sugerida
                      </span>
                      <span className="font-mono text-xs font-black text-[#3A2E2B]">
                        ${boss.minMonthlyPaymentCop.toLocaleString("es-CO")} COP / mes
                      </span>
                    </div>

                    {!isDefeated && (
                      <CozyButton
                        variant="clay"
                        size="sm"
                        onClick={() => handleAttackDebtBoss(boss.id, boss.minMonthlyPaymentCop)}
                        icon={<Swords className="h-3.5 w-3.5" />}
                      >
                        Abonar Cuota
                      </CozyButton>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: ECONOMÍA DUAL & BÓVEDA DEL JUEGO (GP)
         ========================================================================= */}
      {activeTab === "rpg_vault" && (
        <div className="space-y-6">
          {/* Muro de Seguridad: Separación Estricta de Monedas */}
          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFF9E6] p-5 shadow-[0_4px_0_#3A2E2B] flex items-start gap-3.5">
            <span className="text-2xl select-none">🛡️</span>
            <div>
              <h4 className="text-xs font-black uppercase text-[#B78103] tracking-wider">
                Muro de Soberanía Financiera: Economía Dual
              </h4>
              <p className="text-xs text-[#5D4037] leading-relaxed pt-0.5">
                Los <strong>Pesos Colombianos (COP)</strong> corresponden a tu dinero real en el mundo físico. Los <strong>Gold Pieces (GP)</strong> son puntos lúdicos forjados con hábitos, libros leídos y entrenamiento. <em>Nunca se mezclan ni convierten automáticamente.</em>
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
            {/* Tarjeta de Billetera Virtual */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#FDDA24] text-2xl shadow-inner">
                🪙
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">Billetera del Héroe</h4>
                <p className="text-[11px] text-[#795548]">
                  GP desbloqueados disponibles para canjear en la lista de deseos.
                </p>
              </div>
              <span className="font-mono text-2xl font-black text-[#B78103] block pt-1">
                {walletGp.toLocaleString("es-CO")} GP
              </span>
            </div>

            {/* Tarjeta de Bóveda del Reino */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-inner">
                🏛️
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">Bóveda de Reserva</h4>
                <p className="text-[11px] text-[#795548]">
                  Tope mensual de riqueza protegida. Se libera con consistencia.
                </p>
              </div>
              <span className="font-mono text-2xl font-black text-[#2A4331] block pt-1">
                {vaultGp.toLocaleString("es-CO")} / {vaultCapGp.toLocaleString("es-CO")} GP
              </span>
            </div>

            {/* Escudos de Protección Aegis */}
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#81D4FA] text-2xl shadow-inner">
                🛡️
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">Escudos Aegis</h4>
                <p className="text-[11px] text-[#795548]">
                  Protegen tu racha y bajan multas ante imprevistos cotidianos.
                </p>
              </div>
              <span className="font-mono text-2xl font-black text-[#0277BD] block pt-1">
                {aegisShields} Escudos Activos
              </span>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: SILAS & AUDITORÍA INTELIGENTE (SMART EXPENSE INSIGHTS)
         ========================================================================= */}
      {activeTab === "advisor" && (
        <div className="space-y-6">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_6px_0_#3A2E2B] space-y-4">
            <div className="flex items-center gap-3.5">
              <span className="flex h-14 w-14 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] text-3xl text-white shadow-inner">
                🦡
              </span>
              <div>
                <h3 className="text-base font-black text-[#3A2E2B]">
                  Consejo de Silas sobre tus Finanzas
                </h3>
                <p className="text-xs text-[#795548]">
                  Análisis inteligente de fugas hormiga y recomendaciones de ahorro con aprobación humana.
                </p>
              </div>
            </div>

            {/* Alertas de Fugas Hormiga */}
            {insights.audit.anomalyAlerts.length > 0 ? (
              <div className="space-y-2.5 pt-2">
                {insights.audit.anomalyAlerts.map((alert, idx) => (
                  <div
                    key={idx}
                    className="rounded-2xl border-2 border-amber-500/40 bg-amber-50 p-3.5 flex items-start gap-3"
                  >
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                    <div>
                      <span className="text-xs font-black text-amber-900 block">
                        Alerta de Presupuesto
                      </span>
                      <p className="text-xs text-amber-800 leading-relaxed pt-0.5">
                        {alert}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="p-4 rounded-2xl bg-[#EAF3ED] border-2 border-[#314C3C]/20 text-xs font-bold text-[#2A4331]">
                ✨ ¡Cero fugas críticas detectadas en el periodo analizado! Tus hábitos de gasto se encuentran balanceados.
              </div>
            )}

            {/* Pagos Recurrentes Identificados */}
            <div className="border-t-2 border-[#3A2E2B]/10 pt-4 space-y-2">
              <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-1.5">
                <Calendar className="h-4 w-4 text-[#314C3C]" /> Pagos Recurrentes Detectados
              </h4>
              <p className="text-xs text-[#795548]">
                Se han detectado {insights.recurringCount} cargos fijos que suman ${insights.recurringTotalCop.toLocaleString("es-CO")} COP.
              </p>
              <div className="flex flex-wrap gap-2 pt-1">
                {insights.topRecurringConcepts.map((c, i) => (
                  <span
                    key={i}
                    className="rounded-xl border border-[#3A2E2B]/20 bg-[#F7F4EB] px-3 py-1 text-xs font-bold text-[#3A2E2B]"
                  >
                    🔁 {c}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 1: FORMULARIO DE TRANSFERENCIA ENTRE CUENTAS
         ========================================================================= */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
              <span>⇄</span> Transferencia Neutra entre Cuentas
            </h3>
            <p className="text-xs text-[#795548]">
              Mueve fondos entre tus cuentas sin alterar los reportes de ingresos ni gastos.
            </p>

            <form onSubmit={handleExecuteTransfer} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">
                  Cuenta de Origen:
                </label>
                <select
                  value={transferFrom}
                  onChange={(e) => setTransferFrom(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-bold text-[#3A2E2B]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name} (${a.balanceCop.toLocaleString("es-CO")} COP)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">
                  Cuenta de Destino:
                </label>
                <select
                  value={transferTo}
                  onChange={(e) => setTransferTo(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-bold text-[#3A2E2B]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.icon} {a.name} (${a.balanceCop.toLocaleString("es-CO")} COP)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">
                  Importe a Transferir (COP):
                </label>
                <input
                  type="number"
                  step="1000"
                  min="1000"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(Math.max(1000, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-mono font-bold text-[#3A2E2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">
                  Motivo / Concepto:
                </label>
                <input
                  type="text"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  placeholder="Ej. Retiro de cajero para gastos de la semana..."
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-medium text-[#3A2E2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <CozyButton
                  variant="wood"
                  size="sm"
                  onClick={() => setIsTransferModalOpen(false)}
                >
                  Cancelar
                </CozyButton>

                <CozyButton variant="forest" size="sm" type="submit">
                  Confirmar Transferencia
                </CozyButton>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* =========================================================================
          MODAL 2: FORMULARIO DE NUEVO MOVIMIENTO MANUAL
         ========================================================================= */}
      {isNewTxModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-2xl space-y-4">
            <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
              <span>📝</span> Registrar Movimiento Financiero
            </h3>

            <form onSubmit={handleAddMovement} className="space-y-3.5">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTxType("Gasto")}
                  className={`py-2 rounded-xl border-2 border-[#3A2E2B] text-xs font-black transition ${
                    newTxType === "Gasto" ? "bg-[#C62828] text-white" : "bg-[#F7F4EB] text-[#3A2E2B]"
                  }`}
                >
                  Gasto (-)
                </button>
                <button
                  type="button"
                  onClick={() => setNewTxType("Ingreso")}
                  className={`py-2 rounded-xl border-2 border-[#3A2E2B] text-xs font-black transition ${
                    newTxType === "Ingreso" ? "bg-[#2E7D32] text-white" : "bg-[#F7F4EB] text-[#3A2E2B]"
                  }`}
                >
                  Ingreso (+)
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">
                  Monto en Pesos (COP):
                </label>
                <input
                  type="number"
                  step="500"
                  min="500"
                  value={newTxAmount}
                  onChange={(e) => setNewTxAmount(Math.max(500, Number(e.target.value) || 0))}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-mono font-bold text-[#3A2E2B]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Categoría:</label>
                <select
                  value={newTxCategory}
                  onChange={(e) => setNewTxCategory(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-bold text-[#3A2E2B]"
                >
                  {[
                    "Comida",
                    "Transporte",
                    "Sueldo",
                    "Universidad",
                    "Entretenimiento",
                    "Pago Celular",
                    "Pago internet",
                    "Gimnasio",
                    "Varios",
                  ].map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Cuenta:</label>
                <select
                  value={newTxAccount}
                  onChange={(e) => setNewTxAccount(e.target.value)}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-bold text-[#3A2E2B]"
                >
                  {accounts.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.name} (${a.balanceCop.toLocaleString("es-CO")} COP)
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Descripción:</label>
                <input
                  type="text"
                  value={newTxDesc}
                  onChange={(e) => setNewTxDesc(e.target.value)}
                  placeholder="Ej. Almuerzo con amigos, mercado..."
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-medium text-[#3A2E2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <CozyButton variant="wood" size="sm" onClick={() => setIsNewTxModalOpen(false)}>
                  Cancelar
                </CozyButton>

                <CozyButton variant="forest" size="sm" type="submit">
                  Guardar Movimiento
                </CozyButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </BuildingInteriorShell>
  );
}
