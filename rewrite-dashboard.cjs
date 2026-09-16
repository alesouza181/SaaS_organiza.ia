const fs = require('fs');

const content = `
import React, { useMemo, useState } from 'react';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { useAccounts, useCategories, useIncomes, useRollover } from '../hooks/useData';
import { useDate } from '../contexts/DateContext';
import { AccountPayable } from '../types';
import { formatFriendlyDate } from '../utils/dateFormatter';
import { subMonths, startOfMonth, endOfMonth, subWeeks } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Activity, ChevronUp, ChevronDown } from 'lucide-react';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

import { AutoMigration } from './AutoMigration';

interface DashboardProps {
  userId: string;
}

export function Dashboard({ userId }: DashboardProps) {
  const { startDate, endDate } = useDate();
  const { accounts: allAccounts } = useFirestoreSync();
  
  const { accounts, loading: accLoading } = useAccounts(userId, startDate, endDate);
  const { incomes, loading: incLoading } = useIncomes(userId, startDate, endDate);
  const { categories, loading: catLoading } = useCategories(userId);
  const { rolloverBonuses, loadingRollover } = useRollover(userId, startDate, categories);
  
  const loading = accLoading || incLoading || catLoading || loadingRollover;

  // Filtros dinâmicos e Ordenação
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);

  const {
    saldoPrevisto,
    totalDespesas,
    totalPago,
    totalPendente,
    pacingColor,
    pacingPercentage,
    sparklineData
  } = useMemo(() => {
    const totalIncomes = incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const totalPayable = accounts.reduce((acc, curr) => acc + curr.amount, 0);
    
    const pago = accounts.filter(a => a.status === 'PAID').reduce((acc, curr) => acc + curr.amount, 0);
    const pendente = accounts.filter(a => a.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0);

    let totalLimits = 0;
    categories.forEach(c => {
      if (c.maxLimit) {
        totalLimits += c.maxLimit + (rolloverBonuses.get(c.id!) || 0);
      }
    });

    const saldoPrevisto = totalIncomes - totalPayable - totalLimits;
    
    // Pacing de Gastos
    const today = new Date();
    const currentDay = today.getDate();
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const timePercentage = currentDay / daysInMonth;
    
    const baseline = totalIncomes > 0 ? totalIncomes : (totalLimits > 0 ? totalLimits : 1);
    const spentPercentage = totalPayable / baseline;
    
    const pacingRatio = spentPercentage / timePercentage;
    let pacingColor = 'bg-emerald-500';
    if (pacingRatio > 1.2) pacingColor = 'bg-red-500';
    else if (pacingRatio > 1.0) pacingColor = 'bg-yellow-500';
    const pacingPercentageFormatted = Math.min(100, Math.round(spentPercentage * 100));

    // Sparkline - 4 weeks
    const sparklineData = [20, 35, 25, 45, 30, 50, 40]; // mock sparkline for visual

    return {
      saldoPrevisto,
      totalDespesas: totalPayable,
      totalPago: pago,
      totalPendente: pendente,
      pacingColor,
      pacingPercentage: pacingPercentageFormatted,
      sparklineData
    };
  }, [accounts, incomes, categories, rolloverBonuses, startDate]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const handleSort = (key: string) => {
    let direction: 'asc' | 'desc' = 'asc';
    if (sortConfig && sortConfig.key === key && sortConfig.direction === 'asc') {
      direction = 'desc';
    }
    setSortConfig({ key, direction });
  };

  const renderSortIcon = (key: string) => {
    if (!sortConfig || sortConfig.key !== key) return <ChevronDown className="inline w-3 h-3 ml-1 text-slate-300" />;
    return sortConfig.direction === 'asc' ? <ChevronUp className="inline w-3 h-3 ml-1 text-blue-500" /> : <ChevronDown className="inline w-3 h-3 ml-1 text-blue-500" />;
  };

  // Filtrando contas
  let filteredAccounts = [...accounts];
  if (statusFilter === 'PAID') {
    filteredAccounts = filteredAccounts.filter(a => a.status === 'PAID');
  } else if (statusFilter === 'PENDING') {
    filteredAccounts = filteredAccounts.filter(a => a.status === 'PENDING');
  }

  // Ordenando contas
  filteredAccounts.sort((a, b) => {
    if (!sortConfig) {
       return (b.dueDate as any)?.seconds - (a.dueDate as any)?.seconds; // default
    }
    
    if (sortConfig.key === 'title') {
      return sortConfig.direction === 'asc' ? a.title.localeCompare(b.title) : b.title.localeCompare(a.title);
    }
    if (sortConfig.key === 'dueDate') {
      const aVal = (a.dueDate as any)?.seconds || 0;
      const bVal = (b.dueDate as any)?.seconds || 0;
      return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
    }
    if (sortConfig.key === 'amount') {
      return sortConfig.direction === 'asc' ? a.amount - b.amount : b.amount - a.amount;
    }
    if (sortConfig.key === 'status') {
      return sortConfig.direction === 'asc' ? a.status.localeCompare(b.status) : b.status.localeCompare(a.status);
    }
    if (sortConfig.key === 'category') {
      const catA = categories.find(c => c.id === a.categoryId)?.name || '';
      const catB = categories.find(c => c.id === b.categoryId)?.name || '';
      return sortConfig.direction === 'asc' ? catA.localeCompare(catB) : catB.localeCompare(catA);
    }
    return 0;
  });

  return (
    <div className="space-y-6">
      <AutoMigration userId={userId} />

      {/* Top Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 md:gap-6">
        
        {/* Saldo Previsto */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={cn("bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all", statusFilter === 'ALL' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300')}
        >
          <div className="flex items-center gap-3 text-slate-500 mb-1">
            <span className="font-medium text-sm">Saldo Previsto</span>
          </div>
          <div className={cn("text-2xl lg:text-3xl font-bold tracking-tight font-mono", saldoPrevisto >= 0 ? "text-emerald-600" : "text-red-600")}>
            {formatCurrency(saldoPrevisto)}
          </div>
          <div className="text-xs text-slate-500 mt-2 truncate">Ver Todas</div>
        </div>
        
        {/* Total Despesas */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={cn("bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all", statusFilter === 'ALL' ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200 hover:border-blue-300')}
        >
          <div className="flex items-center gap-3 text-slate-500 mb-1">
            <span className="font-medium text-sm">Total Despesas</span>
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono">{formatCurrency(totalDespesas)}</div>
          <div className="text-xs text-slate-500 mt-2 truncate">Todas faturas</div>
        </div>

        {/* Total Pago */}
        <div 
          onClick={() => setStatusFilter('PAID')}
          className={cn("bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all", statusFilter === 'PAID' ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200 hover:border-emerald-300')}
        >
          <div className="flex items-center gap-3 text-slate-500 mb-1">
            <span className="font-medium text-sm text-emerald-600 flex items-center gap-1"><CheckCircle2 className="w-4 h-4"/> Total Pago</span>
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono">{formatCurrency(totalPago)}</div>
          <div className="text-xs text-slate-500 mt-2 truncate">Apenas pagas</div>
        </div>

        {/* Total Pendente */}
        <div 
          onClick={() => setStatusFilter('PENDING')}
          className={cn("bg-white border rounded-xl p-5 shadow-sm cursor-pointer transition-all", statusFilter === 'PENDING' ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200 hover:border-amber-300')}
        >
          <div className="flex items-center gap-3 text-slate-500 mb-1">
            <span className="font-medium text-sm text-amber-600 flex items-center gap-1"><AlertCircle className="w-4 h-4"/> Total Pendente</span>
          </div>
          <div className="text-2xl lg:text-3xl font-bold text-slate-900 tracking-tight font-mono">{formatCurrency(totalPendente)}</div>
          <div className="text-xs text-slate-500 mt-2 truncate">Apenas a pagar</div>
        </div>

        {/* Pacing de Gastos */}
        <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm col-span-2 lg:col-span-1">
          <div className="flex items-center gap-3 text-slate-500 mb-1">
            <span className="font-medium text-sm">Pacing de Gastos</span>
          </div>
          <div className="flex items-center gap-4 mt-2">
            <div className="flex-1 h-3 bg-slate-100 rounded-full overflow-hidden">
              <div className={cn("h-full rounded-full transition-all duration-1000", pacingColor)} style={{ width: \`\${pacingPercentage}%\` }} />
            </div>
            <span className="text-lg lg:text-xl font-bold font-mono text-slate-900">{pacingPercentage}%</span>
          </div>
          <div className="text-xs text-slate-500 mt-2">Gasto vs. Tempo do Mês</div>
        </div>

      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex justify-between items-center">
          <h4 className="text-sm font-semibold text-slate-600 uppercase tracking-widest">
            Lista de Faturas Recentes
            {statusFilter !== 'ALL' && (
              <span className="ml-2 inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-medium bg-blue-100 text-blue-800">
                Filtro: {statusFilter === 'PAID' ? 'Pagas' : 'Pendentes'}
              </span>
            )}
          </h4>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('title')}>
                  Descrição {renderSortIcon('title')}
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('dueDate')}>
                  Vencimento {renderSortIcon('dueDate')}
                </th>
                <th className="px-6 py-3 font-medium cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('category')}>
                  Categoria {renderSortIcon('category')}
                </th>
                <th className="px-6 py-3 font-medium text-right cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('amount')}>
                  Valor {renderSortIcon('amount')}
                </th>
                <th className="px-6 py-3 font-medium text-center cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('status')}>
                  Status {renderSortIcon('status')}
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {filteredAccounts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma fatura encontrada com os filtros atuais.
                  </td>
                </tr>
              ) : (
                filteredAccounts.slice(0, 15).map((account) => {
                  const cat = categories.find(c => c.id === account.categoryId);
                  const isLate = account.status === 'PENDING' && ((account.dueDate as any)?.seconds * 1000) < Date.now();
                  
                  return (
                    <tr key={account.id} className="hover:bg-slate-50 transition-colors">
                      <td className="px-6 py-4 font-medium text-slate-700">
                        {account.title}
                        {account.groupId && <span className="ml-2 text-[10px] bg-slate-100 px-2 py-0.5 rounded text-slate-500 border border-slate-200">{account.installmentCurrent}/{account.installmentTotal}</span>}
                      </td>
                      <td className="px-6 py-4 text-slate-600 font-mono">
                        <div className="flex items-center gap-2">
                          <Clock className={cn("w-3.5 h-3.5", isLate ? "text-red-600" : "text-slate-500")} />
                          <span className={isLate ? "text-red-600 font-bold" : ""}>{formatFriendlyDate(account.dueDate)}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        {cat ? (
                          <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium bg-slate-100 border border-slate-200" style={{ color: cat.colorHex }}>
                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: cat.colorHex }} />
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900 font-mono">
                        {formatCurrency(account.amount)}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {account.status === 'PAID' && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                          </span>
                        )}
                        {account.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <AlertCircle className="w-3.5 h-3.5" /> Pendente
                          </span>
                        )}
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
`

fs.writeFileSync('src/components/Dashboard.tsx', content);
