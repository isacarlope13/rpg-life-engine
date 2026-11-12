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
  FileText,
  Copy,
  Check,
  HeartHandshake,
  ShoppingBag,
  Scale,
  Ban,
  Clock,
} from "lucide-react";
import type { FinancialMovementRecord, DebtStrategy } from "@/types/rpg";
import { LivingInteriorRoom, type InteriorStationDefinition } from "@/components/sanctuary/living-interior-room";
import { BuildingInteriorShell } from "@/components/sanctuary/building-interior-shell";
import { COZY_VILLAGE_RESIDENTS } from "@/lib/sanctuary/village-tiers";
import {
  calculateFinancialSummary,
  executeAccountTransfer,
  getSmartBankInsights,
  type BankAccountRecord,
  type BankTransferPayload,
  STORAGE_KEY_BANK_ACCOUNTS,
  CASE_STUDY_ACCOUNTS,
  loadPersistedAccounts,
  savePersistedAccounts,
} from "@/lib/sanctuary/bank-engine";
import { INITIAL_FINANCIAL_MOVEMENTS } from "@/lib/initial-financial-movements";
import { CozyButton, CozyNotification } from "@/components/cozy/ui";
import { triggerHaptic } from "@/lib/offline-sync";
import { safeLocalStorage } from "@/lib/storage-safe";

// OAKHAVEN 3.9 CORE IMPORTS
import {
  determineBiweeklyCycle,
  calculateBiweeklyCashflowPlan,
  type BiweeklyCashflowPlan,
  type CommittedObligationItem,
} from "@/lib/sanctuary/financial-core";
import {
  REAL_DEBTS_CASE_STUDY,
  simulateDebtPaymentImpact,
  auditSettlementOffer,
  type RealDebtObligation,
  type DebtPaymentSimulationResult,
} from "@/lib/sanctuary/debt-engine";
import { defaultFinancialWellbeingSkill } from "@/lib/sanctuary/financial-wellbeing-skill";
import {
  defaultWishlistDualEngine,
  type DualWishlistItem,
} from "@/lib/sanctuary/wishlist-dual-engine";

// Cuentas Reales y persistencia importadas de bank-engine.ts

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
  const [activeTab, setActiveTab] = useState("calendar");

  // Estado financiero: Movimientos y Cuentas Soberanas con Persistencia Real
  const [movements, setMovements] = useState<FinancialMovementRecord[]>(INITIAL_FINANCIAL_MOVEMENTS);
  const [accounts, setAccounts] = useState<BankAccountRecord[]>(() => loadPersistedAccounts());
  const [debts, setDebts] = useState<RealDebtObligation[]>(REAL_DEBTS_CASE_STUDY);

  // Modal para Ajustar / Modificar Saldo de Cuenta
  const [editingAccount, setEditingAccount] = useState<BankAccountRecord | null>(null);
  const [editAccountBalance, setEditAccountBalance] = useState<number>(0);

  // Wishlist Engine State
  const [wishlistItems, setWishlistItems] = useState<DualWishlistItem[]>(
    defaultWishlistDualEngine.getItems()
  );

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

  // Simulador de Abono a Deuda (3.9)
  const [simulationDebtId, setSimulationDebtId] = useState<string>("debt_nequi_propulsor");
  const [simulationAmount, setSimulationAmount] = useState<number>(56431);

  // Estado de Copia de Cartas Silas
  const [copiedLetterKey, setCopiedLetterKey] = useState<string | null>(null);

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

  // Fecha de Referencia real (11 de Noviembre de 2026)
  const asOfDateStr = "2026-11-11";

  // Saldo real consolidado (Nu + Nequi = 410.000 COP)
  const totalConsolidatedCop = useMemo(
    () => accounts.reduce((acc, a) => acc + Math.round(a.balanceCop), 0),
    [accounts]
  );

  // Obligaciones comprometidas de la quincena
  const committedObligations: CommittedObligationItem[] = useMemo(() => [
    {
      id: "nequi_cuota_22",
      name: "Cuota Nequi Préstamo (22/24)",
      amountCop: 56431,
      dueDate: "2026-11-15",
      isMandatory: true,
      priority: "high",
      status: "pending",
    },
    {
      id: "addi_cuota_atraso",
      name: "ADDI Pago Recomendado (Atraso + Cuota)",
      amountCop: 336085,
      dueDate: "2026-11-17",
      isMandatory: true,
      priority: "critical",
      status: "overdue",
    },
  ], []);

  // Planificador de Quincena Actual (Referencia: 11 Nov 2026)
  const biweeklyCycle = useMemo(() => determineBiweeklyCycle(asOfDateStr), [asOfDateStr]);

  // Plan de Flujo de Caja Quincenal Determinista
  const cashflowPlan: BiweeklyCashflowPlan = useMemo(() => {
    const nuAccount = accounts.find((a) => a.id === "acc_nu_39")?.balanceCop || 340000;
    const nequiAccount = accounts.find((a) => a.id === "acc_nequi_39")?.balanceCop || 70000;

    return calculateBiweeklyCashflowPlan({
      asOfDate: asOfDateStr,
      accounts: {
        nuAccountCop: nuAccount,
        nequiAccountCop: nequiAccount,
      },
      protectedEssentialReserveCop: 250000, // Reserva intocable de subsistencia hasta nov 20
      expectedNextIncome: {
        amountCop: 1000000,
        expectedDate: "2026-11-20",
        isConfirmed: false, // Regla de Oro: no disponible hoy
      },
      committedObligations,
    });
  }, [accounts, committedObligations]);

  // Diagnóstico Contextual de Silas
  const silasDiagnosis = useMemo(() => {
    return defaultFinancialWellbeingSkill.generateFinancialDiagnosis(cashflowPlan, debts);
  }, [cashflowPlan, debts]);

  // Presupuesto de Bienestar No Punitivo
  const wellnessBudget = useMemo(() => {
    return defaultFinancialWellbeingSkill.recommendWellnessBudget(cashflowPlan.freeMoneyCop);
  }, [cashflowPlan]);

  // Métricas financieras históricas del libro contable
  const summary = useMemo(() => calculateFinancialSummary(movements), [movements]);

  // Deuda total en COP
  const totalDebtBalanceCop = useMemo(
    () => debts.reduce((acc, d) => acc + d.totalBalanceCop, 0),
    [debts]
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
      savePersistedAccounts(result.updatedAccounts);
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

  // Manejador de Ajuste Directo de Saldo (Prueba de Usuario & Personalización Real)
  const handleSaveAccountBalance = (accountId: string, newBalanceCop: number) => {
    const exactBalance = Math.max(0, Math.round(newBalanceCop));
    setAccounts((prev) => {
      const updated = prev.map((a) => (a.id === accountId ? { ...a, balanceCop: exactBalance } : a));
      savePersistedAccounts(updated);
      return updated;
    });
    setEditingAccount(null);
    triggerHaptic("success");
    setNotification({
      type: "success",
      message: `💰 ¡Saldo de cuenta actualizado a $${exactBalance.toLocaleString("es-CO")} COP y recalculado en el plan!`,
    });
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

    setAccounts((prev) => {
      const updated = prev.map((acc) => {
        if (acc.id === chosenAcc.id) {
          const delta = newTxType === "Ingreso" ? amountExact : -amountExact;
          return { ...acc, balanceCop: Math.max(0, acc.balanceCop + delta) };
        }
        return acc;
      });
      savePersistedAccounts(updated);
      return updated;
    });

    setMovements((prev) => [newMov, ...prev]);
    triggerHaptic("success");
    setNotification({
      type: "success",
      message: `Registro de ${newTxType.toLowerCase()} ($${amountExact.toLocaleString("es-CO")} COP) guardado con éxito.`,
    });
    setIsNewTxModalOpen(false);
    setNewTxDesc("");
  };

  // Simulación de Abono contra Deuda Real (3.9)
  const currentSimulatedDebt = useMemo(
    () => debts.find((d) => d.id === simulationDebtId) || debts[0],
    [debts, simulationDebtId]
  );

  const simulationResult: DebtPaymentSimulationResult | null = useMemo(() => {
    if (!currentSimulatedDebt) return null;
    return simulateDebtPaymentImpact(
      currentSimulatedDebt.id,
      simulationAmount,
      cashflowPlan
    );
  }, [currentSimulatedDebt, simulationAmount, cashflowPlan]);

  // Auditoría de la Oferta de Contento BPS / Bancolombia
  const contentOfferAudit = useMemo(() => {
    const bancolombiaDebt = debts.find((d) => d.id === "debt_bancolombia_contento");
    if (!bancolombiaDebt || !bancolombiaDebt.settlementOffer) return null;
    return auditSettlementOffer(
      bancolombiaDebt.settlementOffer,
      asOfDateStr,
      cashflowPlan.maxMarginBeforeDebtsCop
    );
  }, [debts, cashflowPlan]);

  // Copiar Carta al Portapapeles
  const handleCopyLetter = (key: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedLetterKey(key);
    triggerHaptic("success");
    setNotification({
      type: "success",
      message: "¡Carta formal copiada al portapapeles con éxito!",
    });
    setTimeout(() => setCopiedLetterKey(null), 3000);
  };

  // Demostración de Barrera HITL Nivel 3 (Intento de Pago Autónomo Bloqueado)
  const handleTriggerAutonomousPaymentAttempt = () => {
    triggerHaptic("warning");
    try {
      defaultFinancialWellbeingSkill.executeAutonomousPayment();
    } catch (err: unknown) {
      setNotification({
        type: "error",
        message: err instanceof Error ? err.message : "Acción bloqueada por seguridad HITL Nivel 3.",
      });
    }
  };

  // Canje en Lista de Deseos (Wishlist Dual con Doble Candado)
  const handleRedeemWishlistItem = (item: DualWishlistItem) => {
    const hasOverdue = debts.some((d) => d.status === "vencida");
    const result = defaultWishlistDualEngine.executeDualRedemption(item, {
      itemId: item.id,
      userWalletGp: walletGp,
      availableReservedCashCop: cashflowPlan.freeMoneyCop,
      currentStreakDays: 3,
      hasOverdueDebts: hasOverdue,
    });

    if (result.success) {
      triggerHaptic("success");
      setNotification({
        type: "success",
        message: `¡Canje exitoso de '${item.name}'! Se reservaron $${result.deductedCashCop.toLocaleString("es-CO")} COP y ${result.deductedGp} GP.`,
      });
      setWishlistItems(defaultWishlistDualEngine.getItems());
    } else {
      triggerHaptic("warning");
      setNotification({
        type: "error",
        message: result.rejectionReason || "Canje denegado por candado no superado.",
      });
    }
  };

  const stations: InteriorStationDefinition[] = [
    {
      id: "accounts",
      name: "Ventanilla de Tesorería & Cuentas",
      shortName: "Cuentas COP",
      icon: "🏦",
      badge: `$${totalConsolidatedCop.toLocaleString("es-CO")}`,
      hotkey: "1",
      description: "Saldos bancarios reales (Nu, Nequi), libro mayor y transferencias soberanas.",
    },
    {
      id: "calendar",
      name: "Libro Quincenal & Flujo de Caja",
      shortName: "Quincenas 3.9",
      icon: "📅",
      badge: cashflowPlan.freeMoneyCop === 0 ? "Alerta" : undefined,
      badgeVariant: "warning",
      hotkey: "2",
      description: "Cálculo determinista: ingresos fijos, obligaciones comprometidas y margen libre.",
    },
    {
      id: "debts",
      name: "Muro de Batalla contra Deudas (Bosses)",
      shortName: "Debt Bosses",
      icon: "⚔️",
      badge: debts.filter((d) => d.status === "vencida").length || undefined,
      badgeVariant: "warning",
      hotkey: "3",
      description: "Simulación matemática avalancha vs bola de nieve, abonos a capital y acuerdos.",
    },
    {
      id: "wishlist",
      name: "Bóveda Real & Wishlist Dual",
      shortName: "Bóveda & Wishlist",
      icon: "🎁",
      hotkey: "4",
      description: "Wishlist con doble candado (días de enfriamiento + saldo real libre) y reservas GP.",
    },
    {
      id: "advisor",
      name: "Despacho de Silas Vance",
      shortName: "Consejo Silas",
      icon: "🦉",
      hotkey: "5",
      description: "Guardián Financiero HITL Nivel 3: diagnósticos objetivos y cero transferencias autónomas.",
    },
  ];

  return (
    <LivingInteriorRoom
      buildingId="banco_oakhaven"
      buildingName="Banco de OakHaven & Real Tesorería"
      domain="work"
      districtName="Plaza Central & Tesorería"
      icon="🏦"
      tagline="Financial & Life Intelligence 3.9 — Planificador de Quincenas, Deudas Reales y Bienestar"
      resident={silasResident}
      stations={stations}
      activeStationId={activeTab === "transactions" ? "accounts" : activeTab === "analytics" ? "calendar" : activeTab}
      onSelectStation={(id) => setActiveTab(id)}
      onClose={onClose}
      metrics={[
        {
          label: "Liquidez Declarada",
          value: `$${totalConsolidatedCop.toLocaleString("es-CO")}`,
          icon: "💰",
        },
        {
          label: "Reserva Esencial (Nov 20)",
          value: "$250.000",
          icon: "🛡️",
        },
        {
          label: "Margen Libre",
          value: `$${cashflowPlan.freeMoneyCop.toLocaleString("es-CO")}`,
          icon: "✨",
        },
        {
          label: "Deuda Total",
          value: `$${totalDebtBalanceCop.toLocaleString("es-CO")}`,
          icon: "⚔️",
        },
      ]}
      roomTheme={{
        wallColor: "#3D2B1F",
        floorPattern: "stone",
        ambientWarmth: "candlelight",
      }}
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
          TAB 1: PLANIFICADOR DE QUINCENAS DETERMINISTA (3.9)
         ========================================================================= */}
      {activeTab === "calendar" && (
        <div className="space-y-6">
          {/* Cabecera del Ciclo Quincenal */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2">
                <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[#314C3C] text-white text-xs font-black">
                  Q
                </span>
                <h3 className="text-base font-black text-[#3A2E2B]">
                  {biweeklyCycle.label}
                </h3>
              </div>
              <p className="text-xs text-[#795548] pt-1">
                Horizonte activo: {biweeklyCycle.startDate} al {biweeklyCycle.endDate} • Próximo pago salarial: {biweeklyCycle.nextPaydayDate}
              </p>
            </div>

            <div className="rounded-2xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-1.5 text-right">
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                Regla de Dinero Libre
              </span>
              <span className="font-mono text-sm font-black text-[#2E7D32]">
                DINERO_LIBRE = MAX(0, Saldo - Esenciales - Deudas)
              </span>
            </div>
          </div>

          {/* Tarjetas Principales del Plan de Caja */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_4px_0_#3A2E2B]">
              <span className="text-[10px] font-black uppercase text-[#795548] block">
                1. Saldo Real Conciliado
              </span>
              <span className="font-mono text-xl font-black text-[#3A2E2B] block pt-1">
                ${cashflowPlan.reconciledLiquidCashCop.toLocaleString("es-CO")} COP
              </span>
              <span className="text-[10px] text-[#795548] block pt-1">
                Nu ($340k) + Nequi ($70k)
              </span>
            </div>

            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_4px_0_#3A2E2B]">
              <span className="text-[10px] font-black uppercase text-[#C62828] block">
                2. Reserva Esencial (Comida/Bus)
              </span>
              <span className="font-mono text-xl font-black text-[#C62828] block pt-1">
                ${cashflowPlan.protectedReserveCop.toLocaleString("es-CO")} COP
              </span>
              <span className="text-[10px] text-[#795548] block pt-1">
                Intocable hasta el 20 nov
              </span>
            </div>

            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-4 shadow-[0_4px_0_#3A2E2B]">
              <span className="text-[10px] font-black uppercase text-[#E65100] block">
                3. Obligaciones en Ventana
              </span>
              <span className="font-mono text-xl font-black text-[#E65100] block pt-1">
                ${cashflowPlan.totalCommittedObligationsCop.toLocaleString("es-CO")} COP
              </span>
              <span className="text-[10px] text-[#795548] block pt-1">
                Nequi ($56k) + ADDI ($336k)
              </span>
            </div>

            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#EAF3ED] p-4 shadow-[0_4px_0_#3A2E2B]">
              <span className="text-[10px] font-black uppercase text-[#2E7D32] block">
                4. Dinero Libre Disponible
              </span>
              <span className="font-mono text-xl font-black text-[#2E7D32] block pt-1">
                ${cashflowPlan.freeMoneyCop.toLocaleString("es-CO")} COP
              </span>
              <span className="text-[10px] text-[#2A4331] font-bold block pt-1">
                {cashflowPlan.freeMoneyCop === 0 ? "⚠️ Déficit si se paga ADDI" : "Margen positivo"}
              </span>
            </div>
          </div>

          {/* Advertencia Crítica de Ingresos Futuros */}
          <div className="rounded-3xl border-3 border-[#3A2E2B] bg-[#FFF9E6] p-4 shadow-[0_4px_0_#3A2E2B] flex items-start gap-3">
            <ShieldAlert className="h-5 w-5 text-amber-700 shrink-0 mt-0.5" />
            <div className="text-xs">
              <span className="font-black text-amber-900 uppercase tracking-wide block">
                Principio Contable de Prudencia: Ingreso Esperado del 20 de Noviembre
              </span>
              <p className="text-amber-800 pt-0.5 leading-relaxed">
                El sueldo quincenal estimado de <strong>$1.000.000 COP</strong> esperado el 20 de noviembre{" "}
                <strong>NO está disponible hoy</strong>. Contabilizarlo anticipadamente generaría un sobregiro
                inmediato y consumiría tu comida y transporte esencial.
              </p>
            </div>
          </div>

          {/* Calendario de Vencimientos de la Quincena */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#314C3C]" /> Vencimientos Críticos en la Ventana (Nov 11 - Nov 20)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div className="p-3.5 rounded-2xl border-2 border-rose-300 bg-rose-50/70 space-y-1">
                <span className="text-[10px] font-black text-rose-800 uppercase block">13 Noviembre</span>
                <span className="text-xs font-black text-rose-900 block">Contento / Bancolombia</span>
                <span className="text-[11px] text-rose-700 block font-mono">$2.348.000 COP</span>
                <span className="text-[10px] font-bold text-rose-800 block">
                  ❌ NO ACEPTAR (Cesión no verificada)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border-2 border-emerald-300 bg-emerald-50/70 space-y-1">
                <span className="text-[10px] font-black text-emerald-800 uppercase block">15 Noviembre</span>
                <span className="text-xs font-black text-emerald-900 block">Nequi Préstamo (Cuota 22/24)</span>
                <span className="text-[11px] text-emerald-700 block font-mono font-bold">$56.431 COP</span>
                <span className="text-[10px] font-bold text-emerald-800 block">
                  ✅ PAGAR (Cabe en margen de $160k)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border-2 border-amber-300 bg-amber-50/70 space-y-1">
                <span className="text-[10px] font-black text-amber-800 uppercase block">17 Noviembre</span>
                <span className="text-xs font-black text-amber-900 block">ADDI (Recomendado)</span>
                <span className="text-[11px] text-amber-700 block font-mono">$336.085 COP</span>
                <span className="text-[10px] font-bold text-amber-800 block">
                  ⚠️ APLAZAR CON CARTA (Pagar el 20)
                </span>
              </div>

              <div className="p-3.5 rounded-2xl border-2 border-blue-300 bg-blue-50/70 space-y-1">
                <span className="text-[10px] font-black text-blue-800 uppercase block">20 Noviembre</span>
                <span className="text-xs font-black text-blue-900 block">Día de Sueldo Quincenal</span>
                <span className="text-[11px] text-blue-700 block font-mono font-bold">+$1.000.000 COP</span>
                <span className="text-[10px] font-bold text-blue-800 block">
                  🎉 Desbloqueo de liquidez
                </span>
              </div>
            </div>
          </div>

          {/* Proyección de Escenarios (Conservador, Base, Favorable) */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-4">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-[#314C3C]" /> Proyecciones de Cierre de Quincena (20 de Noviembre)
            </h4>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#3A2E2B]">Escenario Conservador</span>
                  <span className="text-[10px] bg-amber-200 text-amber-900 px-2 py-0.5 rounded-md font-bold">
                    Seguro
                  </span>
                </div>
                <p className="text-[11px] text-[#795548]">
                  {cashflowPlan.scenarios.conservative.notes.join(" • ")}
                </p>
                <div className="border-t border-[#3A2E2B]/10 pt-2 flex justify-between font-mono text-xs">
                  <span className="text-[#795548]">Dinero Libre Restante:</span>
                  <span className="font-black text-[#3A2E2B]">
                    ${cashflowPlan.scenarios.conservative.freeMoneyRemainingCop.toLocaleString("es-CO")} COP
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border-2 border-[#314C3C] bg-[#EAF3ED] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#314C3C]">Escenario Base</span>
                  <span className="text-[10px] bg-[#314C3C] text-white px-2 py-0.5 rounded-md font-bold">
                    Recomendado
                  </span>
                </div>
                <p className="text-[11px] text-[#2A4331]">
                  {cashflowPlan.scenarios.base.notes.join(" • ")}
                </p>
                <div className="border-t border-[#3A2E2B]/10 pt-2 flex justify-between font-mono text-xs">
                  <span className="text-[#2A4331]">Dinero Libre Restante:</span>
                  <span className="font-black text-[#2E7D32]">
                    ${cashflowPlan.scenarios.base.freeMoneyRemainingCop.toLocaleString("es-CO")} COP
                  </span>
                </div>
              </div>

              <div className="p-4 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-black text-[#3A2E2B]">Escenario Favorable</span>
                  <span className="text-[10px] bg-blue-200 text-blue-900 px-2 py-0.5 rounded-md font-bold">
                    Óptimo
                  </span>
                </div>
                <p className="text-[11px] text-[#795548]">
                  {cashflowPlan.scenarios.favorable.notes.join(" • ")}
                </p>
                <div className="border-t border-[#3A2E2B]/10 pt-2 flex justify-between font-mono text-xs">
                  <span className="text-[#795548]">Dinero Libre Restante:</span>
                  <span className="font-black text-[#3A2E2B]">
                    ${cashflowPlan.scenarios.favorable.freeMoneyRemainingCop.toLocaleString("es-CO")} COP
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 2: DEUDAS REALES & SIMULADOR DETERMINISTA (3.9)
         ========================================================================= */}
      {activeTab === "debts" && (
        <div className="space-y-6">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
                <span>⚔️</span> Deudas Reales del Caso de Estudio
              </h3>
              <p className="text-xs text-[#795548]">
                Auditoría jurídica y matemática de Nequi, ADDI y Bancolombia / Contento BPS.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs font-bold text-[#795548]">Deuda Total Consolidada:</span>
              <span className="font-mono text-sm font-black text-[#C62828] bg-rose-50 px-2.5 py-1 rounded-xl border border-rose-300">
                ${totalDebtBalanceCop.toLocaleString("es-CO")} COP
              </span>
            </div>
          </div>

          {/* Tarjetas de las 3 Deudas Reales */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {debts.map((debt) => {
              const isOverdue = debt.status === "vencida";
              const isNegotiation = debt.status === "en_negociacion";

              return (
                <div
                  key={debt.id}
                  className={`rounded-3xl border-4 border-[#3A2E2B] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3.5 flex flex-col justify-between ${
                    isOverdue ? "bg-rose-50/50" : isNegotiation ? "bg-amber-50/50" : "bg-[#FFFDF8]"
                  }`}
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-2xl">
                        {debt.creditor.includes("ADDI") ? "🛍️" : debt.creditor.includes("Nequi") ? "📱" : "🏦"}
                      </span>
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[10px] font-black uppercase ${
                          isOverdue
                            ? "bg-rose-100 text-rose-800 border border-rose-300"
                            : isNegotiation
                            ? "bg-amber-100 text-amber-800 border border-amber-300"
                            : "bg-emerald-100 text-emerald-800 border border-emerald-300"
                        }`}
                      >
                        {debt.status}
                      </span>
                    </div>

                    <h4 className="text-sm font-black text-[#3A2E2B]">{debt.creditor}</h4>
                    <p className="text-[11px] text-[#795548] leading-tight">
                      {debt.advisories[0] || "Obligación crediticia activa."}
                    </p>
                  </div>

                  <div className="space-y-1.5 pt-2 border-t-2 border-[#3A2E2B]/10">
                    <div className="flex justify-between text-xs font-mono">
                      <span className="text-[#795548]">Saldo Total:</span>
                      <span className="font-black text-[#3A2E2B]">
                        ${debt.totalBalanceCop.toLocaleString("es-CO")} COP
                      </span>
                    </div>

                    {debt.overdueBalanceCop > 0 && (
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-rose-700 font-bold">Monto Vencido:</span>
                        <span className="font-black text-rose-700">
                          ${debt.overdueBalanceCop.toLocaleString("es-CO")} COP
                        </span>
                      </div>
                    )}

                    {debt.currentInstallmentCop > 0 && (
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#795548]">Cuota Periódica:</span>
                        <span className="font-bold text-[#3A2E2B]">
                          ${debt.currentInstallmentCop.toLocaleString("es-CO")} COP
                        </span>
                      </div>
                    )}

                    {debt.dueDate && (
                      <div className="flex justify-between text-xs font-mono">
                        <span className="text-[#795548]">Próximo Vencimiento:</span>
                        <span className="font-bold text-[#3A2E2B]">{debt.dueDate}</span>
                      </div>
                    )}
                  </div>

                  <div className="pt-2">
                    <CozyButton
                      variant={simulationDebtId === debt.id ? "forest" : "wood"}
                      size="sm"
                      className="w-full"
                      onClick={() => {
                        setSimulationDebtId(debt.id);
                        setSimulationAmount(
                          debt.currentInstallmentCop || debt.overdueBalanceCop || 50000
                        );
                      }}
                    >
                      {simulationDebtId === debt.id ? "Seleccionada en Simulador" : "Simular Abono"}
                    </CozyButton>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Auditoría Legal de la Oferta de Contento BPS */}
          {contentOfferAudit && (
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFF9E6] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="text-sm font-black text-amber-950 flex items-center gap-2">
                  <Scale className="h-4 w-4 text-amber-800" /> Auditoría Jurídica: Oferta de Contento BPS ($2.348.000 COP)
                </h4>
                <span className="text-[10px] bg-rose-600 text-white font-black px-2.5 py-0.5 rounded-full uppercase">
                  {contentOfferAudit.isValidAndExecutableToday ? "Válida" : "No Apta para Pago Inmediato"}
                </span>
              </div>

              <div className="space-y-2 p-3 rounded-2xl bg-white/80 border border-amber-300 text-xs">
                <span className="font-bold text-amber-900 block">Dictamen del Experto Jurídico:</span>
                <p className="text-amber-950 font-medium leading-relaxed">
                  {contentOfferAudit.recommendation}
                </p>

                {contentOfferAudit.requiredPreconditions.length > 0 && (
                  <div className="pt-2 border-t border-amber-200">
                    <span className="font-bold text-amber-900 block pb-1">Condiciones Previas Obligatorias:</span>
                    <ul className="list-disc pl-4 space-y-1 text-amber-900 text-[11px]">
                      {contentOfferAudit.requiredPreconditions.map((cond: string, idx: number) => (
                        <li key={idx}>{cond}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Simulador Interactivo de Abono a Deuda */}
          {simulationResult && currentSimulatedDebt && (
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-4">
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                <div>
                  <h4 className="text-sm font-black text-[#3A2E2B] flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-[#314C3C]" /> Simulador de Impacto de Pago: {currentSimulatedDebt.creditor}
                  </h4>
                  <p className="text-xs text-[#795548]">
                    Evalúa si un abono afecta tu comida esencial o si normaliza verdaderamente la obligación.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  <label className="text-xs font-bold text-[#3A2E2B]">Monto a Simular:</label>
                  <input
                    type="number"
                    step="5000"
                    min="10000"
                    max={currentSimulatedDebt.totalBalanceCop}
                    value={simulationAmount}
                    onChange={(e) => setSimulationAmount(Math.max(0, Number(e.target.value) || 0))}
                    className="w-36 rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-3 py-1.5 font-mono text-xs font-bold text-[#3A2E2B]"
                  />
                </div>
              </div>

              {/* Resultados de la Simulación */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                <div
                  className={`p-3.5 rounded-2xl border-2 ${
                    simulationResult.encroachesEssentialReserve
                      ? "border-rose-300 bg-rose-50 text-rose-900"
                      : "border-emerald-300 bg-emerald-50 text-emerald-900"
                  }`}
                >
                  <span className="font-bold block uppercase text-[10px]">Reserva Esencial ($250k):</span>
                  <span className="text-sm font-black font-mono block pt-1">
                    {simulationResult.encroachesEssentialReserve ? "🚨 DEVORADA" : "🛡️ PROTEGIDA"}
                  </span>
                  <p className="text-[11px] pt-1">
                    {simulationResult.encroachesEssentialReserve
                      ? "Este abono te dejaría sin comida o pasajes antes del 20 de nov."
                      : "Tus gastos mínimos de subsistencia se mantienen a salvo."}
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] text-[#3A2E2B]">
                  <span className="font-bold block uppercase text-[10px] text-[#795548]">
                    Normalización Jurídica:
                  </span>
                  <span className="text-sm font-black font-mono block pt-1">
                    {simulationResult.isFullyNormalized ? "✅ AL DÍA" : "⚠️ SIGUE EN MORA / PARCIAL"}
                  </span>
                  <p className="text-[11px] text-[#795548] pt-1">
                    Saldo remanente: ${simulationResult.remainingDebtBalanceCop.toLocaleString("es-CO")} COP.
                  </p>
                </div>

                <div className="p-3.5 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] text-[#3A2E2B]">
                  <span className="font-bold block uppercase text-[10px] text-[#795548]">
                    Liquidez Inmediata Post-Pago:
                  </span>
                  <span className="text-sm font-black font-mono block pt-1">
                    ${simulationResult.liquidCashRemainingCop.toLocaleString("es-CO")} COP
                  </span>
                  <p className="text-[11px] text-[#795548] pt-1">
                    Permitido por liquidez: {simulationResult.isAllowedByLiquidity ? "Sí" : "No"}.
                  </p>
                </div>
              </div>

              {simulationResult.safetyAdvisories.length > 0 && (
                <div className="p-3 rounded-2xl bg-[#EAF3ED] border border-[#314C3C]/30 text-xs text-[#2A4331] font-medium leading-relaxed">
                  💡 <strong>Dictamen del Motor:</strong> {simulationResult.safetyAdvisories.join(" ")}
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* =========================================================================
          TAB 3: SILAS & GUARDIÁN FINANCIERO (CARTAS FORMALES & HITL 3)
         ========================================================================= */}
      {activeTab === "advisor" && (
        <div className="space-y-6">
          {/* Tarjeta de Diagnóstico y Semáforo */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-6 shadow-[0_5px_0_#3A2E2B] space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#314C3C] text-2xl text-white shadow-inner">
                  🦡
                </span>
                <div>
                  <h3 className="text-base font-black text-[#3A2E2B]">
                    Guardián Silas — Diagnóstico de Liquidez y Bienestar
                  </h3>
                  <p className="text-xs text-[#795548]">
                    {silasDiagnosis.headline}
                  </p>
                </div>
              </div>

              <span className="rounded-full px-3 py-1 text-xs font-black uppercase bg-amber-100 text-amber-800 border border-amber-300">
                Semáforo: Precaución Activa
              </span>
            </div>

            <div className="space-y-1 bg-[#F7F4EB] p-4 rounded-2xl border-2 border-[#3A2E2B]/10 text-xs text-[#3A2E2B]">
              {silasDiagnosis.keyInsights.map((insight: string, idx: number) => (
                <p key={idx} className="leading-relaxed">
                  • {insight}
                </p>
              ))}
            </div>

            {/* Acciones Prioritarias Explicables */}
            <div className="space-y-2 pt-2">
              <span className="text-xs font-black uppercase text-[#3A2E2B] block">
                Plan de Acción Inmediato:
              </span>
              <div className="space-y-2">
                {silasDiagnosis.immediateActionPlan.map((action, idx: number) => (
                  <div
                    key={idx}
                    className="p-3 rounded-2xl border-2 border-[#3A2E2B]/15 bg-[#FFFDF8] flex items-start gap-3"
                  >
                    <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[#314C3C] text-[10px] font-black text-white">
                      {action.step}
                    </span>
                    <div>
                      <span className="text-xs font-black text-[#3A2E2B] block">{action.title}</span>
                      <p className="text-[11px] text-[#5D4037] leading-relaxed">{action.description}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Presupuesto de Bienestar No Punitivo (Regla 9) */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-4">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-2">
              <HeartHandshake className="h-4 w-4 text-[#314C3C]" /> Presupuesto de Bienestar Humano (No Punitivo)
            </h4>
            <p className="text-xs text-[#795548]">
              {wellnessBudget.guidanceMessage}
            </p>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {wellnessBudget.categories.map((cat, idx: number) => (
                <div
                  key={idx}
                  className="p-3 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] space-y-1 text-center"
                >
                  <span className="text-xl">🌿</span>
                  <span className="text-[11px] font-black text-[#3A2E2B] block">{cat.label}</span>
                  <span className="font-mono text-xs font-black text-[#2E7D32] block">
                    ${cat.allocatedCop.toLocaleString("es-CO")}
                  </span>
                  <span className="text-[9px] uppercase font-bold text-[#795548] block">
                    {cat.purpose}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Generador de Cartas de Negociación Formal */}
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-4">
            <h4 className="text-xs font-black uppercase text-[#3A2E2B] flex items-center gap-2">
              <FileText className="h-4 w-4 text-[#314C3C]" /> Minutas & Cartas Formales de Negociación (Ley 1266 / SIC)
            </h4>
            <p className="text-xs text-[#795548]">
              Modelos redactados por Silas con fundamento normativo listos para enviar a acreedores.
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Carta Contento BPS */}
              {(() => {
                const draft = defaultFinancialWellbeingSkill.draftNegotiationDocument({
                  creditorType: "contento_bancolombia",
                  debtTotalCop: 3000000,
                  proposedPaymentCop: 2348000,
                });
                return (
                  <div className="p-4 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#3A2E2B]">A: Contento BPS / Bancolombia</span>
                        <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-2 py-0.5 rounded-md">
                          Verificación de Cesión
                        </span>
                      </div>
                      <p className="text-[11px] text-[#795548] pt-1">
                        Exige prueba de representación y expedición directa de Paz y Salvo por Bancolombia.
                      </p>
                    </div>

                    <div className="max-h-40 overflow-y-auto bg-white p-2.5 rounded-xl border border-[#3A2E2B]/10 font-mono text-[10px] text-[#3A2E2B] whitespace-pre-wrap">
                      {draft.formalBodyMarkdown}
                    </div>

                    <CozyButton
                      variant="sunlight"
                      size="sm"
                      onClick={() => handleCopyLetter("contento", draft.formalBodyMarkdown)}
                      icon={copiedLetterKey === "contento" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    >
                      {copiedLetterKey === "contento" ? "¡Copiada!" : "Copiar Carta Formal"}
                    </CozyButton>
                  </div>
                );
              })()}

              {/* Carta ADDI */}
              {(() => {
                const draft = defaultFinancialWellbeingSkill.draftNegotiationDocument({
                  creditorType: "addi",
                  debtTotalCop: 1041301,
                  proposedPaymentCop: 336085,
                  proposedDate: "2026-11-20",
                });
                return (
                  <div className="p-4 rounded-2xl border-2 border-[#3A2E2B]/20 bg-[#F7F4EB] space-y-3 flex flex-col justify-between">
                    <div>
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-black text-[#3A2E2B]">A: ADDI Colombia</span>
                        <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded-md">
                          Acuerdo Post-Quincena
                        </span>
                      </div>
                      <p className="text-[11px] text-[#795548] pt-1">
                        Notifica fecha cierta de pago para el 20 de noviembre tras el cobro del sueldo.
                      </p>
                    </div>

                    <div className="max-h-40 overflow-y-auto bg-white p-2.5 rounded-xl border border-[#3A2E2B]/10 font-mono text-[10px] text-[#3A2E2B] whitespace-pre-wrap">
                      {draft.formalBodyMarkdown}
                    </div>

                    <CozyButton
                      variant="sunlight"
                      size="sm"
                      onClick={() => handleCopyLetter("addi", draft.formalBodyMarkdown)}
                      icon={copiedLetterKey === "addi" ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    >
                      {copiedLetterKey === "addi" ? "¡Copiada!" : "Copiar Carta Formal"}
                    </CozyButton>
                  </div>
                );
              })()}
            </div>
          </div>

          {/* Barrera HITL Nivel 3 (Demostración de Seguridad) */}
          <div className="rounded-3xl border-3 border-rose-400 bg-rose-50/70 p-5 shadow-[0_4px_0_#C62828] space-y-3">
            <div className="flex items-start gap-3">
              <Ban className="h-5 w-5 text-rose-700 shrink-0 mt-0.5" />
              <div>
                <h4 className="text-xs font-black uppercase text-rose-950 tracking-wider">
                  Barrera de Seguridad Human-In-The-Loop (HITL Nivel 3)
                </h4>
                <p className="text-xs text-rose-800 leading-relaxed pt-0.5">
                  La IA tiene <strong>prohibido estrictamente</strong> realizar débitos bancarios, aceptar ofertas o pagar deudas de manera autónoma. Puedes probar la barrera a continuación:
                </p>
              </div>
            </div>

            <div className="pt-1 flex items-center justify-end">
              <CozyButton
                variant="clay"
                size="sm"
                onClick={handleTriggerAutonomousPaymentAttempt}
                icon={<Ban className="h-3.5 w-3.5" />}
              >
                Probar Intento de Pago Autónomo por IA (Bloqueado)
              </CozyButton>
            </div>
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 4: WISHLIST DUAL CON DOBLE CANDADO (3.9)
         ========================================================================= */}
      {activeTab === "wishlist" && (
        <div className="space-y-6">
          <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div>
              <h3 className="text-base font-black text-[#3A2E2B] flex items-center gap-2">
                <span>🎁</span> Wishlist Dual con Regla del Doble Candado
              </h3>
              <p className="text-xs text-[#795548]">
                CANJE_MAXIMO = MIN(Valor_GP_Canjeables, Presupuesto_Real_Reservado).
              </p>
            </div>

            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-[#F7F4EB] border border-[#3A2E2B]/20 text-center">
                <span className="text-[10px] uppercase font-bold text-[#795548] block">Billetera GP</span>
                <span className="font-mono text-xs font-black text-[#B78103]">{walletGp.toLocaleString("es-CO")} GP</span>
              </div>
              <div className="p-2 rounded-xl bg-[#F7F4EB] border border-[#3A2E2B]/20 text-center">
                <span className="text-[10px] uppercase font-bold text-[#795548] block">Dinero Libre</span>
                <span className="font-mono text-xs font-black text-[#2E7D32]">
                  ${cashflowPlan.freeMoneyCop.toLocaleString("es-CO")} COP
                </span>
              </div>
            </div>
          </div>

          {/* Advertencia si hay deudas en mora */}
          {debts.some((d) => d.status === "vencida") && (
            <div className="rounded-2xl border-2 border-amber-400 bg-amber-50 p-4 flex items-center gap-3 text-xs text-amber-900">
              <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
              <div>
                <strong>Aviso de Prudencia:</strong> Cuentas con obligaciones en mora (ADDI). El sistema te permite registrar canjes si tienes reserva real disponible, pero Silas recomienda priorizar la normalización financiera antes de compras recreativas.
              </div>
            </div>
          )}

          {/* Catálogo de la Wishlist */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {wishlistItems.map((item) => {
              const hasGp = walletGp >= item.costGp;
              const hasBudget = cashflowPlan.freeMoneyCop >= item.priceCop;
              const isEligible = hasGp && hasBudget && !item.isRedeemed;

              return (
                <div
                  key={item.id}
                  className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3.5 flex flex-col justify-between"
                >
                  <div className="space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="rounded-full bg-[#314C3C]/10 border border-[#314C3C]/30 px-2.5 py-0.5 text-[10px] font-black text-[#314C3C] uppercase">
                        Prioridad {item.priority}
                      </span>
                      {item.isRedeemed && (
                        <span className="text-[10px] font-black text-emerald-800 bg-emerald-100 px-2 py-0.5 rounded-full">
                          CANJEADO
                        </span>
                      )}
                    </div>

                    <h4 className="text-sm font-black text-[#3A2E2B]">{item.name}</h4>
                  </div>

                  {/* Doble Candado */}
                  <div className="space-y-1.5 pt-2 border-t-2 border-[#3A2E2B]/10">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#795548] flex items-center gap-1">
                        🪙 Candado GP:
                      </span>
                      <span className={`font-mono font-bold ${hasGp ? "text-emerald-700" : "text-rose-700"}`}>
                        {item.costGp.toLocaleString("es-CO")} GP {hasGp ? "✓" : "✗"}
                      </span>
                    </div>

                    <div className="flex justify-between text-xs">
                      <span className="text-[#795548] flex items-center gap-1">
                        💵 Candado COP:
                      </span>
                      <span className={`font-mono font-bold ${hasBudget ? "text-emerald-700" : "text-rose-700"}`}>
                        ${item.priceCop.toLocaleString("es-CO")} COP {hasBudget ? "✓" : "✗"}
                      </span>
                    </div>
                  </div>

                  <div className="pt-2">
                    <CozyButton
                      variant={isEligible ? "forest" : "wood"}
                      size="sm"
                      className="w-full"
                      disabled={!isEligible}
                      onClick={() => handleRedeemWishlistItem(item)}
                      icon={isEligible ? <Sparkles className="h-3.5 w-3.5" /> : <Lock className="h-3.5 w-3.5" />}
                    >
                      {item.isRedeemed
                        ? "Ya Canjeado"
                        : isEligible
                        ? "Canjear Recompensa"
                        : "Bloqueado por Candado"}
                    </CozyButton>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 5: CUENTAS FINANCIERAS & SOBERANÍA
         ========================================================================= */}
      {activeTab === "accounts" && (
        <div className="space-y-6">
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

                <div className="pt-2 border-t-2 border-[#3A2E2B]/10 flex items-center justify-between">
                  <div>
                    <span className="text-[10px] uppercase font-bold text-[#795548] block">
                      Saldo Disponible
                    </span>
                    <span className="font-mono text-xl font-black text-[#2A4331]">
                      ${Math.round(acc.balanceCop).toLocaleString("es-CO")} COP
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount(acc);
                      setEditAccountBalance(acc.balanceCop);
                      triggerHaptic("light");
                    }}
                    className="rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] px-2.5 py-1 text-xs font-black text-[#3A2E2B] hover:bg-[#E8DFCF] shadow-[0_2px_0_#3A2E2B] transition cursor-pointer"
                    title={`Modificar saldo de ${acc.name}`}
                  >
                    ✏️ Ajustar Saldo
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 6: LIBRO CONTABLE & REGISTRO DE MOVIMIENTOS
         ========================================================================= */}
      {activeTab === "transactions" && (
        <div className="space-y-5">
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
                      <td className="py-2.5 px-3 font-mono text-[11px] text-[#795548]">{m.fecha}</td>
                      <td className="py-2.5 px-3 font-bold text-[#3A2E2B]">{m.descripcion}</td>
                      <td className="py-2.5 px-3">
                        <span className="rounded-lg bg-[#F7F4EB] border border-[#3A2E2B]/15 px-2 py-0.5 text-[10px] font-bold text-[#5D4037]">
                          {m.categoria}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-[11px] text-[#795548]">{m.metodo_pago}</td>
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
          </div>
        </div>
      )}

      {/* =========================================================================
          TAB 7: ECONOMÍA DUAL & BÓVEDA DEL JUEGO (GP)
         ========================================================================= */}
      {activeTab === "rpg_vault" && (
        <div className="space-y-6">
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
            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#FDDA24] text-2xl shadow-inner">
                🪙
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">Billetera del Héroe</h4>
                <p className="text-[11px] text-[#795548]">GP desbloqueados para la lista de deseos.</p>
              </div>
              <span className="font-mono text-2xl font-black text-[#B78103] block pt-1">
                {walletGp.toLocaleString("es-CO")} GP
              </span>
            </div>

            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#E7D69C] text-2xl shadow-inner">
                🏛️
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">Bóveda de Reserva</h4>
                <p className="text-[11px] text-[#795548]">Tope mensual de riqueza protegida.</p>
              </div>
              <span className="font-mono text-2xl font-black text-[#2A4331] block pt-1">
                {vaultGp.toLocaleString("es-CO")} / {vaultCapGp.toLocaleString("es-CO")} GP
              </span>
            </div>

            <div className="rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 shadow-[0_5px_0_#3A2E2B] space-y-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-2xl border-2 border-[#3A2E2B] bg-[#81D4FA] text-2xl shadow-inner">
                🛡️
              </span>
              <div>
                <h4 className="text-sm font-black text-[#3A2E2B]">Escudos Aegis</h4>
                <p className="text-[11px] text-[#795548]">Protegen tu racha ante imprevistos.</p>
              </div>
              <span className="font-mono text-2xl font-black text-[#0277BD] block pt-1">
                {aegisShields} Escudos Activos
              </span>
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
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Cuenta de Origen:</label>
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
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Cuenta de Destino:</label>
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
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Importe a Transferir (COP):</label>
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
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Motivo / Concepto:</label>
                <input
                  type="text"
                  value={transferDescription}
                  onChange={(e) => setTransferDescription(e.target.value)}
                  placeholder="Ej. Traslado para separar reserva de comida..."
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-2.5 text-xs font-medium text-[#3A2E2B]"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <CozyButton variant="wood" size="sm" onClick={() => setIsTransferModalOpen(false)}>
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
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">Monto en Pesos (COP):</label>
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
                  placeholder="Ej. Almuerzo, mercado básico..."
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

      {/* =========================================================================
          MODAL 3: AJUSTAR SALDO DE CUENTA (PERSISTENCIA & PRUEBA DE USUARIO)
         ========================================================================= */}
      {editingAccount && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="w-full max-w-md rounded-3xl border-4 border-[#3A2E2B] bg-[#FFFDF8] p-5 sm:p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b-2 border-[#3A2E2B]/10 pb-3">
              <div className="flex items-center gap-2">
                <span className="text-2xl">{editingAccount.icon}</span>
                <div>
                  <h3 className="text-sm font-black text-[#3A2E2B]">
                    Ajustar Saldo Real: {editingAccount.name}
                  </h3>
                  <span className="text-[11px] text-[#795548]">
                    {editingAccount.institution} • {editingAccount.accountNumberMask}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setEditingAccount(null)}
                className="rounded-lg p-1 text-[#795548] hover:bg-[#F4EEDC]"
              >
                ✕
              </button>
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSaveAccountBalance(editingAccount.id, editAccountBalance);
              }}
              className="space-y-4"
            >
              <div>
                <label className="block text-xs font-bold text-[#3A2E2B] mb-1">
                  Nuevo Saldo Disponible (COP):
                </label>
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={editAccountBalance}
                  onChange={(e) => setEditAccountBalance(Number(e.target.value))}
                  className="w-full rounded-xl border-2 border-[#3A2E2B] bg-[#F7F4EB] p-3 text-base font-mono font-black text-[#2A4331]"
                  required
                />
                <span className="text-[11px] font-bold text-[#4E6E58] mt-1 block">
                  ${Math.round(editAccountBalance || 0).toLocaleString("es-CO")} COP
                </span>
              </div>

              <p className="text-[11px] text-[#795548] bg-[#F7F4EB] p-2.5 rounded-xl border border-[#3A2E2B]/15 leading-relaxed">
                ℹ️ Al modificar este saldo, el plan de flujo de caja quincenal, el margen libre y los diagnósticos de Silas Vance se recalcularán automáticamente de forma determinista y persistirán en almacenamiento seguro.
              </p>

              <div className="flex items-center justify-end gap-2 pt-2">
                <CozyButton variant="wood" size="sm" onClick={() => setEditingAccount(null)}>
                  Cancelar
                </CozyButton>
                <CozyButton variant="forest" size="sm" type="submit">
                  Guardar Saldo
                </CozyButton>
              </div>
            </form>
          </div>
        </div>
      )}
    </LivingInteriorRoom>
  );
}
