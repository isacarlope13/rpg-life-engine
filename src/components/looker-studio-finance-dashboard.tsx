"use client";

import React, { useMemo, useState } from "react";
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  DollarSign,
  Filter,
  Calendar,
  Search,
  PieChart,
  BarChart3,
  ArrowUpDown,
  Plus,
  Download,
  Upload,
  ExternalLink,
  Layers,
  ShoppingBag,
  Swords,
  Check,
  X,
  ChevronLeft,
  ChevronRight,
  CreditCard,
  Coins,
  Sparkles,
  RefreshCw,
  FileSpreadsheet,
} from "lucide-react";
import type { FinancialMovementRecord } from "@/types/rpg";
import { INITIAL_FINANCIAL_MOVEMENTS } from "@/lib/initial-financial-movements";

interface LookerStudioFinanceDashboardProps {
  initialMovements?: FinancialMovementRecord[];
  onMovementAdded?: (movement: FinancialMovementRecord) => void;
  currency?: string;
  monthlyFreeCashflow?: number;
  // Slots para Wishlist y Debt Bosses si se desea verlos integrados
  wishlistSlot?: React.ReactNode;
  debtBossesSlot?: React.ReactNode;
}

export function LookerStudioFinanceDashboard({
  initialMovements = INITIAL_FINANCIAL_MOVEMENTS,
  onMovementAdded,
  currency = "COP",
  monthlyFreeCashflow = 0,
  wishlistSlot,
  debtBossesSlot,
}: LookerStudioFinanceDashboardProps) {
  // Estado local de movimientos
  const [movements, setMovements] = useState<FinancialMovementRecord[]>(() => {
    return initialMovements && initialMovements.length > 0
      ? initialMovements
      : INITIAL_FINANCIAL_MOVEMENTS;
  });

  // Pestaña activa dentro del módulo de finanzas
  const [activeSubTab, setActiveSubTab] = useState<
    "analytics" | "movements" | "looker_embed" | "wishlist" | "debts"
  >("analytics");

  // Filtros interactivos globales estilo Looker Studio
  const [selectedMonth, setSelectedMonth] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<"all" | "Ingreso" | "Gasto">("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedMethod, setSelectedMethod] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState<string>("");

  // Paginación y ordenación de la tabla
  const [sortField, setSortField] = useState<"fecha" | "monto" | "categoria">("fecha");
  const [sortAsc, setSortAsc] = useState<boolean>(false);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const itemsPerPage = 15;

  // Estado del modal de nuevo movimiento
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [newTipo, setNewTipo] = useState<"Ingreso" | "Gasto">("Gasto");
  const [newFecha, setNewFecha] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().substring(0, 10);
  });
  const [newCategoria, setNewCategoria] = useState<string>("Comida");
  const [newMonto, setNewMonto] = useState<string>("");
  const [newDescripcion, setNewDescripcion] = useState<string>("");
  const [newMetodo, setNewMetodo] = useState<string>("Transferencia");
  const [newDetalle, setNewDetalle] = useState<string>("");
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string>("");

  // Lista de meses disponibles derivados de los datos
  const availableMonths = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => {
      if (m.fecha) {
        const ym = m.fecha.substring(0, 7);
        if (ym.length === 7) set.add(ym);
      }
    });
    return Array.from(set).sort().reverse();
  }, [movements]);

  // Lista de categorías únicas derivadas de los datos
  const availableCategories = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => {
      if (m.categoria) set.add(m.categoria);
    });
    return Array.from(set).sort();
  }, [movements]);

  // Lista de métodos de pago derivados de los datos
  const availableMethods = useMemo(() => {
    const set = new Set<string>();
    movements.forEach((m) => {
      if (m.metodo_pago) set.add(m.metodo_pago);
    });
    return Array.from(set).sort();
  }, [movements]);

  // Filtrado reactivo en tiempo real
  const filteredMovements = useMemo(() => {
    return movements.filter((m) => {
      // Filtro de mes
      if (selectedMonth !== "all" && !m.fecha.startsWith(selectedMonth)) {
        return false;
      }
      // Filtro de tipo
      if (selectedType !== "all" && m.tipo !== selectedType) {
        return false;
      }
      // Filtro de categoría
      if (selectedCategory !== "all" && m.categoria !== selectedCategory) {
        return false;
      }
      // Filtro de método de pago
      if (selectedMethod !== "all" && m.metodo_pago !== selectedMethod) {
        return false;
      }
      // Buscador
      if (searchQuery.trim().length > 0) {
        const q = searchQuery.toLowerCase();
        const inDesc = (m.descripcion || "").toLowerCase().includes(q);
        const inCat = (m.categoria || "").toLowerCase().includes(q);
        const inDet = (m.detalle || "").toLowerCase().includes(q);
        const inMet = (m.metodo_pago || "").toLowerCase().includes(q);
        if (!inDesc && !inCat && !inDet && !inMet) return false;
      }
      return true;
    });
  }, [movements, selectedMonth, selectedType, selectedCategory, selectedMethod, searchQuery]);

  // Métricas agregadas (Scorecards de Looker Studio)
  const metrics = useMemo(() => {
    let totalIngresos = 0;
    let totalGastos = 0;
    const catMap: Record<string, number> = {};
    const methodMap: Record<string, { total: number; count: number }> = {};
    const monthlyMap: Record<string, { ingresos: number; gastos: number }> = {};

    filteredMovements.forEach((m) => {
      const ym = m.fecha.substring(0, 7) || "Sin fecha";
      if (!monthlyMap[ym]) monthlyMap[ym] = { ingresos: 0, gastos: 0 };

      if (m.tipo === "Ingreso") {
        totalIngresos += m.monto;
        monthlyMap[ym].ingresos += m.monto;
      } else {
        totalGastos += m.monto;
        monthlyMap[ym].gastos += m.monto;
        catMap[m.categoria] = (catMap[m.categoria] || 0) + m.monto;
      }

      const met = m.metodo_pago || "Otro";
      if (!methodMap[met]) methodMap[met] = { total: 0, count: 0 };
      methodMap[met].total += m.monto;
      methodMap[met].count += 1;
    });

    const balanceNeto = totalIngresos - totalGastos;
    const savingsRate =
      totalIngresos > 0 ? Math.round((balanceNeto / totalIngresos) * 100) : 0;

    // Top categorías de gastos
    const sortedCategories = Object.entries(catMap)
      .map(([cat, total]) => ({
        categoria: cat,
        total,
        percentage: totalGastos > 0 ? Math.round((total / totalGastos) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total);

    // Días únicos con gastos en el filtro
    const activeExpenseDays = new Set(
      filteredMovements.filter((m) => m.tipo === "Gasto").map((m) => m.fecha.substring(0, 10))
    ).size;
    const dailyAvgExpense =
      activeExpenseDays > 0 ? Math.round(totalGastos / activeExpenseDays) : 0;

    return {
      totalIngresos,
      totalGastos,
      balanceNeto,
      savingsRate,
      sortedCategories,
      methodMap,
      monthlyMap,
      dailyAvgExpense,
      totalCount: filteredMovements.length,
    };
  }, [filteredMovements]);

  // Ordenación de la lista para la tabla
  const sortedMovements = useMemo(() => {
    return [...filteredMovements].sort((a, b) => {
      if (sortField === "fecha") {
        return sortAsc
          ? a.fecha.localeCompare(b.fecha)
          : b.fecha.localeCompare(a.fecha);
      }
      if (sortField === "monto") {
        return sortAsc ? a.monto - b.monto : b.monto - a.monto;
      }
      if (sortField === "categoria") {
        return sortAsc
          ? a.categoria.localeCompare(b.categoria)
          : b.categoria.localeCompare(a.categoria);
      }
      return 0;
    });
  }, [filteredMovements, sortField, sortAsc]);

  // Paginación
  const totalPages = Math.max(1, Math.ceil(sortedMovements.length / itemsPerPage));
  const paginatedMovements = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return sortedMovements.slice(start, start + itemsPerPage);
  }, [sortedMovements, currentPage]);

  const handleSort = (field: "fecha" | "monto" | "categoria") => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(false);
    }
  };

  const handleResetFilters = () => {
    setSelectedMonth("all");
    setSelectedType("all");
    setSelectedCategory("all");
    setSelectedMethod("all");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const handleCreateMovement = (e: React.FormEvent) => {
    e.preventDefault();
    const parsedMonto = parseFloat(newMonto.replace(/[\$\,\.]/g, ""));
    if (isNaN(parsedMonto) || parsedMonto <= 0) {
      alert("Por favor ingresa un monto numérico válido mayor a 0.");
      return;
    }

    const created: FinancialMovementRecord = {
      id: `mov-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      fecha: newFecha || new Date().toISOString().substring(0, 10),
      tipo: newTipo,
      categoria: newCategoria.trim() || "Varios",
      monto: parsedMonto,
      descripcion: newDescripcion.trim() || (newTipo === "Ingreso" ? "Ingreso registrado" : "Gasto registrado"),
      metodo_pago: newMetodo,
      detalle: newDetalle.trim(),
    };

    setMovements((prev) => [created, ...prev]);
    if (onMovementAdded) {
      onMovementAdded(created);
    }

    setSaveSuccessMsg(`¡${newTipo} de $${parsedMonto.toLocaleString("es-CO")} guardado con éxito!`);
    setTimeout(() => setSaveSuccessMsg(""), 3500);

    // Reset modal
    setNewMonto("");
    setNewDescripcion("");
    setNewDetalle("");
    setIsModalOpen(false);
  };

  const handleExportCSV = () => {
    const headers = ["Fecha", "Tipo", "Categoría", "Monto", "Descripción", "Método de Pago", "Detalle", "ID Registro"];
    const rows = filteredMovements.map((m) => [
      `"${m.fecha}"`,
      `"${m.tipo}"`,
      `"${m.categoria}"`,
      `"${m.monto}"`,
      `"${(m.descripcion || "").replace(/"/g, '""')}"`,
      `"${m.metodo_pago}"`,
      `"${(m.detalle || "").replace(/"/g, '""')}"`,
      `"${m.id}"`,
    ]);
    const csvContent = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Finanzas_LookerStudio_${selectedMonth}_export.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;

      const lines = text.split("\n").filter((l) => l.trim().length > 0);
      if (lines.length < 2) return;

      const parseLine = (line: string) => {
        const parts: string[] = [];
        let cur = "";
        let inQuotes = false;
        for (let i = 0; i < line.length; i++) {
          const c = line[i];
          if (c === '"') {
            inQuotes = !inQuotes;
          } else if (c === "," && !inQuotes) {
            parts.push(cur.trim());
            cur = "";
          } else {
            cur += c;
          }
        }
        parts.push(cur.trim());
        return parts;
      };

      const parsed: FinancialMovementRecord[] = [];
      for (let i = 1; i < lines.length; i++) {
        const p = parseLine(lines[i]);
        if (p.length >= 4) {
          const fecha = p[0] || "";
          const tipo = p[1]?.toLowerCase().includes("ingreso") ? "Ingreso" : "Gasto";
          const categoria = p[2] || "Varios";
          const montoStr = p[3] || "0";
          const monto = parseFloat(montoStr.replace(/[\$\,\"]/g, "")) || 0;
          const descripcion = p[4] || "";
          const metodo_pago = p[5] || "Transferencia";
          const detalle = p[6] || "";
          const id = p[7] || `csv-${Date.now()}-${i}`;
          parsed.push({ id, fecha, tipo, categoria, monto, descripcion, metodo_pago, detalle });
        }
      }

      if (parsed.length > 0) {
        setMovements((prev) => {
          const existingIds = new Set(prev.map((m) => m.id));
          const toAdd = parsed.filter((m) => !existingIds.has(m.id));
          return [...toAdd, ...prev];
        });
        alert(`¡Se importaron ${parsed.length} movimientos financieros con éxito!`);
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="space-y-6">
      {/* =====================================================================
          1. HEADER Y SWITCHER DE SUB-VISTAS FINANCIERAS
         ===================================================================== */}
      <div className="rounded-2xl border border-indigo-500/30 bg-gradient-to-r from-slate-900 via-indigo-950/40 to-slate-950 p-6 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="flex h-8 w-8 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/40">
                <BarChart3 className="h-4 w-4" />
              </span>
              <h2 className="text-xl font-extrabold text-white">
                Módulo Financiero — Estructura Looker Studio
              </h2>
            </div>
            <p className="text-xs text-slate-400">
              Analítica ejecutiva de Ingresos, Gastos, Balance Neto y Flujo de Fondos basada en tu reporte de Google Data Studio.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setIsModalOpen(true)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 px-3.5 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/20 transition cursor-pointer"
            >
              <Plus className="h-4 w-4" /> Registrar Movimiento
            </button>
            <label className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer">
              <Upload className="h-3.5 w-3.5 text-indigo-400" />
              Importar CSV
              <input type="file" accept=".csv" onChange={handleFileUpload} className="hidden" />
            </label>
            <button
              onClick={handleExportCSV}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 bg-slate-800/80 hover:bg-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition cursor-pointer"
              title="Descargar datos en CSV compatible con Looker Studio"
            >
              <Download className="h-3.5 w-3.5 text-emerald-400" /> Exportar
            </button>
          </div>
        </div>

        {saveSuccessMsg && (
          <div className="mt-3 rounded-lg bg-emerald-500/15 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-300 font-semibold flex items-center gap-2 animate-pulse">
            <Check className="h-4 w-4 text-emerald-400" /> {saveSuccessMsg}
          </div>
        )}

        {/* SUB-TABS SELECTOR */}
        <div className="mt-6 flex flex-wrap gap-2 border-t border-slate-800 pt-4">
          <button
            onClick={() => setActiveSubTab("analytics")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              activeSubTab === "analytics"
                ? "bg-indigo-600 text-white shadow-lg ring-1 ring-indigo-400/50"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <PieChart className="h-3.5 w-3.5" /> Dashboard Looker Studio
          </button>
          <button
            onClick={() => setActiveSubTab("movements")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              activeSubTab === "movements"
                ? "bg-indigo-600 text-white shadow-lg ring-1 ring-indigo-400/50"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <FileSpreadsheet className="h-3.5 w-3.5" /> Tabla de Movimientos ({filteredMovements.length})
          </button>
          <button
            onClick={() => setActiveSubTab("looker_embed")}
            className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
              activeSubTab === "looker_embed"
                ? "bg-indigo-600 text-white shadow-lg ring-1 ring-indigo-400/50"
                : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white"
            }`}
          >
            <ExternalLink className="h-3.5 w-3.5 text-cyan-400" /> Visor Oficial Google Studio
          </button>
          {wishlistSlot && (
            <button
              onClick={() => setActiveSubTab("wishlist")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                activeSubTab === "wishlist"
                  ? "bg-amber-600 text-white shadow-lg ring-1 ring-amber-400/50"
                  : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <ShoppingBag className="h-3.5 w-3.5 text-amber-400" /> Wishlist & Recompensas
            </button>
          )}
          {debtBossesSlot && (
            <button
              onClick={() => setActiveSubTab("debts")}
              className={`inline-flex items-center gap-2 rounded-xl px-3.5 py-2 text-xs font-bold transition cursor-pointer ${
                activeSubTab === "debts"
                  ? "bg-rose-600 text-white shadow-lg ring-1 ring-rose-400/50"
                  : "bg-slate-900/60 text-slate-400 hover:bg-slate-800 hover:text-white"
              }`}
            >
              <Swords className="h-3.5 w-3.5 text-rose-400" /> Pasivos & Debt Bosses
            </button>
          )}
        </div>
      </div>

      {/* =====================================================================
          BARRA DE CONTROLES & FILTROS LOOKER STUDIO (Visible en Analytics y Tabla)
         ===================================================================== */}
      {(activeSubTab === "analytics" || activeSubTab === "movements") && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-indigo-400 flex items-center gap-1.5">
              <Filter className="h-3.5 w-3.5" /> Controles Globales de Filtro (Data Studio)
            </span>
            {(selectedMonth !== "all" ||
              selectedType !== "all" ||
              selectedCategory !== "all" ||
              selectedMethod !== "all" ||
              searchQuery.trim().length > 0) && (
              <button
                onClick={handleResetFilters}
                className="text-xs text-indigo-300 hover:text-white flex items-center gap-1 cursor-pointer font-medium"
              >
                <RefreshCw className="h-3 w-3" /> Restablecer filtros
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* 1. Selector de Mes */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Periodo / Mes
              </label>
              <select
                value={selectedMonth}
                onChange={(e) => {
                  setSelectedMonth(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Todos los Meses ({movements.length} regs)</option>
                {availableMonths.map((ym) => (
                  <option key={ym} value={ym}>
                    {ym === "2026-09"
                      ? "Septiembre 2026"
                      : ym === "2026-10"
                      ? "Octubre 2026"
                      : ym === "2026-11"
                      ? "Noviembre 2026"
                      : ym}
                  </option>
                ))}
              </select>
            </div>

            {/* 2. Selector de Tipo */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Tipo de Flujo
              </label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value as "all" | "Ingreso" | "Gasto");
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Todos (Ingresos + Gastos)</option>
                <option value="Ingreso">🟢 Solo Ingresos</option>
                <option value="Gasto">🔴 Solo Gastos</option>
              </select>
            </div>

            {/* 3. Selector de Categoría */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Categoría
              </label>
              <select
                value={selectedCategory}
                onChange={(e) => {
                  setSelectedCategory(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Todas las Categorías ({availableCategories.length})</option>
                {availableCategories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            {/* 4. Selector de Método de Pago */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Método de Pago
              </label>
              <select
                value={selectedMethod}
                onChange={(e) => {
                  setSelectedMethod(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
              >
                <option value="all">Todos los Métodos</option>
                {availableMethods.map((m) => (
                  <option key={m} value={m}>
                    {m}
                  </option>
                ))}
              </select>
            </div>

            {/* 5. Buscador de Texto */}
            <div>
              <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                Búsqueda en vivo
              </label>
              <div className="relative">
                <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-slate-400" />
                <input
                  type="text"
                  placeholder="Ej: Uber, Frisby, Addi..."
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setCurrentPage(1);
                  }}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:border-indigo-500 focus:outline-none"
                />
              </div>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 1: ANALYTICS & DASHBOARD LOOKER STUDIO
         ===================================================================== */}
      {activeSubTab === "analytics" && (
        <div className="space-y-6">
          {/* 5 SCORECARDS / TARJETAS KPI DE LOOKER STUDIO */}
          <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
            {/* KPI 1: TOTAL INGRESOS */}
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-950/20 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 flex items-center gap-1">
                <TrendingUp className="h-3.5 w-3.5" /> Total Ingresos
              </span>
              <p className="text-xl font-black text-emerald-300 font-mono">
                ${metrics.totalIngresos.toLocaleString("es-CO")}
              </p>
              <span className="text-[10px] text-slate-400 block">
                {selectedMonth === "all" ? "Acumulado total" : `En ${selectedMonth}`}
              </span>
            </div>

            {/* KPI 2: TOTAL GASTOS */}
            <div className="rounded-xl border border-rose-500/30 bg-rose-950/20 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-rose-400 flex items-center gap-1">
                <TrendingDown className="h-3.5 w-3.5" /> Total Gastos
              </span>
              <p className="text-xl font-black text-rose-300 font-mono">
                ${metrics.totalGastos.toLocaleString("es-CO")}
              </p>
              <span className="text-[10px] text-slate-400 block">
                Salidas registradas
              </span>
            </div>

            {/* KPI 3: BALANCE NETO */}
            <div
              className={`rounded-xl border p-4 space-y-1 ${
                metrics.balanceNeto >= 0
                  ? "border-indigo-500/30 bg-indigo-950/20"
                  : "border-amber-500/30 bg-amber-950/20"
              }`}
            >
              <span
                className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${
                  metrics.balanceNeto >= 0 ? "text-indigo-400" : "text-amber-400"
                }`}
              >
                <DollarSign className="h-3.5 w-3.5" /> Balance Neto (Flujo)
              </span>
              <p
                className={`text-xl font-black font-mono ${
                  metrics.balanceNeto >= 0 ? "text-white" : "text-amber-300"
                }`}
              >
                {metrics.balanceNeto >= 0 ? "+" : ""}
                ${metrics.balanceNeto.toLocaleString("es-CO")}
              </p>
              <span className="text-[10px] text-slate-400 block">
                {metrics.balanceNeto >= 0 ? "Superávit libre ✓" : "Déficit temporal ⚠️"}
              </span>
            </div>

            {/* KPI 4: TASA DE SUPERÁVIT / AHORRO */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-cyan-400 flex items-center gap-1">
                <Sparkles className="h-3.5 w-3.5" /> Tasa de Ahorro
              </span>
              <p className="text-xl font-black text-cyan-300 font-mono">
                {metrics.savingsRate}%
              </p>
              <span className="text-[10px] text-slate-400 block">
                {metrics.savingsRate > 15 ? "Eficiencia excelente" : "Margen moderado"}
              </span>
            </div>

            {/* KPI 5: GASTO PROMEDIO DIARIO */}
            <div className="rounded-xl border border-slate-800 bg-slate-900/80 p-4 space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5 text-amber-400" /> Promedio Diario
              </span>
              <p className="text-xl font-black text-amber-300 font-mono">
                ${metrics.dailyAvgExpense.toLocaleString("es-CO")}
              </p>
              <span className="text-[10px] text-slate-400 block">
                En días con consumo
              </span>
            </div>
          </div>

          {/* VISUALIZACIONES PRINCIPALES DE DATA STUDIO */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {/* GRÁFICO 1: EVOLUCIÓN MENSUAL INGRESOS VS GASTOS */}
            <div className="lg:col-span-2 rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <BarChart3 className="h-4 w-4 text-indigo-400" />
                  <h3 className="text-sm font-bold text-white">
                    Evolución Temporal: Ingresos vs Gastos
                  </h3>
                </div>
                <div className="flex items-center gap-3 text-xs">
                  <span className="flex items-center gap-1 text-emerald-400 font-semibold">
                    <span className="h-2.5 w-2.5 rounded bg-emerald-500 inline-block" /> Ingresos
                  </span>
                  <span className="flex items-center gap-1 text-rose-400 font-semibold">
                    <span className="h-2.5 w-2.5 rounded bg-rose-500 inline-block" /> Gastos
                  </span>
                </div>
              </div>

              {/* BARRAS DE COMPARACIÓN */}
              <div className="space-y-4 pt-2">
                {Object.entries(metrics.monthlyMap)
                  .sort(([a], [b]) => a.localeCompare(b))
                  .map(([month, data]) => {
                    const maxVal = Math.max(data.ingresos, data.gastos, 1);
                    const net = data.ingresos - data.gastos;
                    const label =
                      month === "2026-09"
                        ? "Septiembre 2026"
                        : month === "2026-10"
                        ? "Octubre 2026"
                        : month === "2026-11"
                        ? "Noviembre 2026"
                        : month;

                    return (
                      <div key={month} className="space-y-1.5 rounded-xl bg-slate-950/60 p-3 border border-slate-800/80">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-slate-200">{label}</span>
                          <span
                            className={`font-mono text-xs font-bold ${
                              net >= 0 ? "text-emerald-400" : "text-rose-400"
                            }`}
                          >
                            Neto: {net >= 0 ? "+" : ""}${net.toLocaleString("es-CO")}
                          </span>
                        </div>

                        {/* Barra Ingreso */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Ingresos</span>
                            <span className="text-emerald-300 font-mono font-medium">
                              ${data.ingresos.toLocaleString("es-CO")}
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-emerald-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.round((data.ingresos / maxVal) * 100))}%` }}
                            />
                          </div>
                        </div>

                        {/* Barra Gasto */}
                        <div className="space-y-0.5">
                          <div className="flex justify-between text-[11px] text-slate-400">
                            <span>Gastos</span>
                            <span className="text-rose-300 font-mono font-medium">
                              ${data.gastos.toLocaleString("es-CO")}
                            </span>
                          </div>
                          <div className="h-2.5 w-full bg-slate-800 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-rose-500 rounded-full transition-all duration-500"
                              style={{ width: `${Math.min(100, Math.round((data.gastos / maxVal) * 100))}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
              </div>
            </div>

            {/* GRÁFICO 2: PARTICIPACIÓN POR MÉTODO DE PAGO */}
            <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
              <div className="flex items-center gap-2 border-b border-slate-800 pb-3">
                <CreditCard className="h-4 w-4 text-cyan-400" />
                <h3 className="text-sm font-bold text-white">Métodos de Pago</h3>
              </div>

              <div className="space-y-3 pt-1">
                {Object.entries(metrics.methodMap).map(([method, val]) => {
                  const pct =
                    metrics.totalIngresos + metrics.totalGastos > 0
                      ? Math.round((val.total / (metrics.totalIngresos + metrics.totalGastos)) * 100)
                      : 0;

                  return (
                    <div
                      key={method}
                      className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                          {method === "Transferencia" ? (
                            <CreditCard className="h-3.5 w-3.5 text-indigo-400" />
                          ) : (
                            <Coins className="h-3.5 w-3.5 text-amber-400" />
                          )}
                          {method}
                        </span>
                        <span className="text-xs font-bold font-mono text-cyan-300">
                          {pct}%
                        </span>
                      </div>
                      <p className="text-base font-black text-white font-mono">
                        ${val.total.toLocaleString("es-CO")}
                      </p>
                      <div className="h-2 w-full bg-slate-800 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all duration-500 ${
                            method === "Transferencia" ? "bg-indigo-500" : "bg-amber-500"
                          }`}
                          style={{ width: `${Math.min(100, pct)}%` }}
                        />
                      </div>
                      <span className="text-[10px] text-slate-400 block text-right">
                        {val.count} movimientos registrados
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* TOP CATEGORÍAS DE GASTOS */}
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <div className="flex items-center gap-2">
                <PieChart className="h-4 w-4 text-amber-400" />
                <h3 className="text-sm font-bold text-white">
                  Distribución de Gastos por Categoría (Looker Studio Ranking)
                </h3>
              </div>
              <span className="text-xs text-slate-400">
                {metrics.sortedCategories.length} categorías activas
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {metrics.sortedCategories.map((item, idx) => {
                const badgeColor =
                  idx === 0
                    ? "bg-rose-500/20 text-rose-300 border-rose-500/40"
                    : idx === 1
                    ? "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    : idx === 2
                    ? "bg-indigo-500/20 text-indigo-300 border-indigo-500/40"
                    : "bg-slate-800 text-slate-300 border-slate-700";

                return (
                  <div
                    key={item.categoria}
                    className="rounded-xl border border-slate-800/80 bg-slate-950/60 p-3.5 space-y-2 hover:border-slate-700 transition"
                  >
                    <div className="flex items-center justify-between">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badgeColor}`}>
                        #{idx + 1} {item.categoria}
                      </span>
                      <span className="text-xs font-mono font-bold text-slate-300">
                        {item.percentage}%
                      </span>
                    </div>
                    <p className="text-base font-bold text-white font-mono">
                      ${item.total.toLocaleString("es-CO")}
                    </p>
                    <div className="h-1.5 w-full bg-slate-800 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-indigo-500 to-rose-500 rounded-full"
                        style={{ width: `${Math.min(100, item.percentage)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: TABLA DETALLADA DE MOVIMIENTOS ESTILO DATA STUDIO
         ===================================================================== */}
      {activeSubTab === "movements" && (
        <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <FileSpreadsheet className="h-4 w-4 text-emerald-400" /> Registro Detallado de Transacciones
              </h3>
              <p className="text-xs text-slate-400">
                Mostrando {sortedMovements.length} movimientos filtrados (Página {currentPage} de {totalPages})
              </p>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400">Ordenar por:</span>
              <button
                onClick={() => handleSort("fecha")}
                className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer font-semibold ${
                  sortField === "fecha"
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                Fecha {sortField === "fecha" ? (sortAsc ? "▲" : "▼") : ""}
              </button>
              <button
                onClick={() => handleSort("monto")}
                className={`text-xs px-2.5 py-1 rounded-lg border cursor-pointer font-semibold ${
                  sortField === "monto"
                    ? "border-indigo-500 bg-indigo-500/20 text-indigo-300"
                    : "border-slate-700 text-slate-400"
                }`}
              >
                Monto {sortField === "monto" ? (sortAsc ? "▲" : "▼") : ""}
              </button>
            </div>
          </div>

          {/* TABLA RESPONSIVA */}
          <div className="overflow-x-auto rounded-xl border border-slate-800 bg-slate-950">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-900/90 text-slate-400 border-b border-slate-800 font-semibold uppercase tracking-wider text-[10px]">
                <tr>
                  <th className="py-3 px-3">Fecha</th>
                  <th className="py-3 px-3">Tipo</th>
                  <th className="py-3 px-3">Categoría</th>
                  <th className="py-3 px-3">Descripción / Concepto</th>
                  <th className="py-3 px-3">Método</th>
                  <th className="py-3 px-3 text-right">Monto (COP)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/60 font-sans">
                {paginatedMovements.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-8 text-center text-slate-500 italic">
                      No se encontraron movimientos con los filtros seleccionados.
                    </td>
                  </tr>
                ) : (
                  paginatedMovements.map((m) => (
                    <tr key={m.id} className="hover:bg-slate-900/40 transition">
                      <td className="py-2.5 px-3 font-mono text-slate-300 whitespace-nowrap">
                        {m.fecha}
                      </td>
                      <td className="py-2.5 px-3">
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-bold ${
                            m.tipo === "Ingreso"
                              ? "bg-emerald-500/15 text-emerald-300 border border-emerald-500/30"
                              : "bg-rose-500/15 text-rose-300 border border-rose-500/30"
                          }`}
                        >
                          {m.tipo === "Ingreso" ? "🟢 Ingreso" : "🔴 Gasto"}
                        </span>
                      </td>
                      <td className="py-2.5 px-3">
                        <span className="font-semibold text-slate-200 bg-slate-800/80 px-2 py-0.5 rounded border border-slate-700/60">
                          {m.categoria}
                        </span>
                      </td>
                      <td className="py-2.5 px-3 text-white max-w-xs truncate">
                        {m.descripcion || "—"}
                        {m.detalle && (
                          <span className="text-[10px] text-slate-400 block truncate">
                            {m.detalle}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 px-3 text-slate-300 whitespace-nowrap">
                        {m.metodo_pago}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold whitespace-nowrap ${
                          m.tipo === "Ingreso" ? "text-emerald-300" : "text-rose-300"
                        }`}
                      >
                        {m.tipo === "Ingreso" ? "+" : "-"}${m.monto.toLocaleString("es-CO")}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              {/* FILA DE TOTALES */}
              {paginatedMovements.length > 0 && (
                <tfoot className="bg-slate-900 text-slate-200 border-t-2 border-slate-700 font-bold text-xs">
                  <tr>
                    <td colSpan={5} className="py-3 px-3 text-right uppercase tracking-wider text-[11px] text-slate-400">
                      Balance neto de los {sortedMovements.length} movimientos filtrados:
                    </td>
                    <td
                      className={`py-3 px-3 text-right font-mono text-sm ${
                        metrics.balanceNeto >= 0 ? "text-emerald-400" : "text-rose-400"
                      }`}
                    >
                      {metrics.balanceNeto >= 0 ? "+" : ""}${metrics.balanceNeto.toLocaleString("es-CO")} COP
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* CONTROLES DE PAGINACIÓN */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-2 text-xs text-slate-400">
              <span>
                Página {currentPage} de {totalPages}
              </span>
              <div className="flex items-center gap-1.5">
                <button
                  disabled={currentPage === 1}
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <button
                  disabled={currentPage === totalPages}
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs text-slate-300 hover:bg-slate-800 disabled:opacity-40 cursor-pointer"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: VISOR OFICIAL GOOGLE LOOKER STUDIO & INSTRUCCIONES
         ===================================================================== */}
      {activeSubTab === "looker_embed" && (
        <div className="rounded-2xl border border-cyan-500/30 bg-slate-900/80 p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 pb-4">
            <div>
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <ExternalLink className="h-5 w-5 text-cyan-400" /> Visor Directo Google Looker Studio
              </h3>
              <p className="text-xs text-slate-400">
                Incrustación en vivo del reporte oficial con identificador <code className="text-cyan-300">4c9fa182-fab9-4bb4-9cb8-85112592d85d</code>.
              </p>
            </div>

            <a
              href="https://datastudio.google.com/u/0/reporting/4c9fa182-fab9-4bb4-9cb8-85112592d85d/page/Dye8F"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-xl bg-cyan-600 hover:bg-cyan-500 px-4 py-2 text-xs font-bold text-white shadow-lg transition"
            >
              Abrir en Google Looker Studio ↗
            </a>
          </div>

          {/* GUÍA DE CONFIGURACIÓN DE INSERCIÓN */}
          <div className="rounded-xl border border-cyan-500/20 bg-cyan-950/20 p-4 text-xs text-slate-300 space-y-2">
            <h4 className="font-bold text-cyan-300 flex items-center gap-1.5">
              💡 ¿Cómo permitir la visualización incrustada dentro del sistema?
            </h4>
            <p>
              Google Looker Studio requiere dos permisos para permitir la incrustación dentro de plataformas web:
            </p>
            <ol className="list-decimal pl-5 space-y-1 text-slate-300">
              <li>
                <strong>Habilitar inserción:</strong> En tu reporte de Looker Studio, haz clic en <em>Archivo ➔ Insertar informe ➔ Marcar casilla "Habilitar inserción"</em>.
              </li>
              <li>
                <strong>Permiso de acceso:</strong> En el botón <em>Compartir</em> (esquina superior derecha), cambia el acceso a <em>"Cualquiera que tenga el vínculo puede ver"</em>.
              </li>
            </ol>
          </div>

          {/* IFRAME EMBED */}
          <div className="rounded-xl border border-slate-800 overflow-hidden bg-slate-950 shadow-2xl">
            <iframe
              src="https://lookerstudio.google.com/embed/reporting/4c9fa182-fab9-4bb4-9cb8-85112592d85d/page/Dye8F"
              width="100%"
              height="800"
              style={{ border: 0 }}
              allowFullScreen
              sandbox="allow-storage-access-by-user-activation allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
              title="Google Looker Studio Financial Report"
              className="w-full min-h-[700px]"
            />
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 4 & 5: SLOTS DE WISHLIST Y DEBT BOSSES
         ===================================================================== */}
      {activeSubTab === "wishlist" && wishlistSlot && <div>{wishlistSlot}</div>}
      {activeSubTab === "debts" && debtBossesSlot && <div>{debtBossesSlot}</div>}

      {/* =====================================================================
          MODAL: REGISTRAR NUEVO MOVIMIENTO FINANCIERO
         ===================================================================== */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-sm p-4">
          <div className="relative w-full max-w-lg rounded-2xl border border-indigo-500/40 bg-slate-900 p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-slate-800 pb-3">
              <h3 className="text-base font-bold text-white flex items-center gap-2">
                <Plus className="h-4 w-4 text-indigo-400" /> Registrar Nuevo Movimiento
              </h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <form onSubmit={handleCreateMovement} className="space-y-3.5">
              {/* TIPO */}
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setNewTipo("Gasto")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    newTipo === "Gasto"
                      ? "border-rose-500 bg-rose-500/20 text-rose-300 ring-1 ring-rose-500/40"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  🔴 Registrar Gasto
                </button>
                <button
                  type="button"
                  onClick={() => setNewTipo("Ingreso")}
                  className={`py-2 px-3 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    newTipo === "Ingreso"
                      ? "border-emerald-500 bg-emerald-500/20 text-emerald-300 ring-1 ring-emerald-500/40"
                      : "border-slate-800 bg-slate-950 text-slate-400"
                  }`}
                >
                  🟢 Registrar Ingreso
                </button>
              </div>

              {/* MONTO & FECHA */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Monto (COP) *
                  </label>
                  <input
                    type="number"
                    required
                    placeholder="Ej: 50000"
                    value={newMonto}
                    onChange={(e) => setNewMonto(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none font-mono"
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Fecha *
                  </label>
                  <input
                    type="date"
                    required
                    value={newFecha}
                    onChange={(e) => setNewFecha(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                </div>
              </div>

              {/* CATEGORÍA & MÉTODO DE PAGO */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Categoría
                  </label>
                  <input
                    type="text"
                    list="cat-suggestions"
                    value={newCategoria}
                    onChange={(e) => setNewCategoria(e.target.value)}
                    placeholder="Comida, Transporte, Sueldo..."
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  />
                  <datalist id="cat-suggestions">
                    {availableCategories.map((c) => (
                      <option key={c} value={c} />
                    ))}
                  </datalist>
                </div>
                <div>
                  <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                    Método de Pago
                  </label>
                  <select
                    value={newMetodo}
                    onChange={(e) => setNewMetodo(e.target.value)}
                    className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                  >
                    <option value="Transferencia">Transferencia</option>
                    <option value="Efectivo">Efectivo</option>
                    <option value="Tarjeta">Tarjeta Débito/Crédito</option>
                  </select>
                </div>
              </div>

              {/* DESCRIPCIÓN */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Descripción / Concepto
                </label>
                <input
                  type="text"
                  placeholder="Ej: Almuerzo con Saris, Uber a la sede..."
                  value={newDescripcion}
                  onChange={(e) => setNewDescripcion(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              {/* DETALLE OPCIONAL */}
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-1">
                  Detalle Adicional (Opcional)
                </label>
                <input
                  type="text"
                  placeholder="Ej: Factura #123, comprobante..."
                  value={newDetalle}
                  onChange={(e) => setNewDetalle(e.target.value)}
                  className="w-full rounded-xl border border-slate-700 bg-slate-950 px-3 py-2 text-xs text-white focus:border-indigo-500 focus:outline-none"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 rounded-xl bg-indigo-600 hover:bg-indigo-500 py-2.5 text-xs font-bold text-white shadow-lg transition cursor-pointer"
                >
                  Guardar Movimiento
                </button>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="rounded-xl bg-slate-800 hover:bg-slate-700 px-4 py-2.5 text-xs text-slate-300 cursor-pointer"
                >
                  Cancelar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
