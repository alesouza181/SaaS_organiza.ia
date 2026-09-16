import { isAccountPaid, isAccountLate, isAccountPending, getAccountInterest, getAccountDiscount, getAccountPaidAmount, getEffectiveAccountAmount } from '../utils/accountStatus';

import React, { useMemo, useState, useEffect } from 'react';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { CategoryIcon } from './CategoryIcon';
import { useAccounts, useCategories, useIncomes, useRollover } from '../hooks/useData';
import { useDate } from '../contexts/DateContext';
import { AccountPayable } from '../types';
import { formatFriendlyDate } from '../utils/dateFormatter';
import { subMonths, startOfMonth, endOfMonth, subWeeks } from 'date-fns';
import { AlertCircle, CheckCircle2, Clock, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Activity, ChevronUp, ChevronDown, CheckCircle, Receipt, X, FileText, RefreshCw, ListChecks, CheckSquare, Calculator, RotateCcw } from 'lucide-react';
import { FinancialCalculator } from './FinancialCalculator';
import { ReceiptPreview } from './ReceiptPreview';
import { Timestamp } from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { storage } from '../firebaseConfig';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';

import { getDriveToken, requestDriveToken, uploadReceiptToGoogleDrive } from '../services/googleDrive';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

import { AutoMigration } from './AutoMigration';

interface DashboardProps {
  userId: string;
}

export function Dashboard({ userId }: DashboardProps) {
  const { startDate, endDate } = useDate();
  const { accounts: allAccounts, upsertData, preferences, reopenAccount } = useFirestoreSync();
  
  const { accounts, loading: accLoading } = useAccounts(userId, startDate, endDate);
  const [paymentAccount, setPaymentAccount] = useState<AccountPayable | null>(null);
  const [viewAccount, setViewAccount] = useState<AccountPayable | null>(null);
  const [reopenConfirmAccount, setReopenConfirmAccount] = useState<AccountPayable | null>(null);
  const [isReopening, setIsReopening] = useState(false);
  const [payDate, setPayDate] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [payReceiptUrl, setPayReceiptUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [driveConnected, setDriveConnected] = useState(!!getDriveToken());

  // Financial Calculator Modal State
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcMode, setCalcMode] = useState<'basic' | 'interest' | 'discount' | 'split'>('basic');
  const [calcBaseAmount, setCalcBaseAmount] = useState<number>(0);

  useEffect(() => {
    const savedPaymentId = sessionStorage.getItem('dashboard_pending_payment_id');
    if (savedPaymentId && accounts.length > 0) {
      const account = accounts.find(a => a.id === savedPaymentId);
      if (account) {
        setPaymentAccount(account);
      }
      sessionStorage.removeItem('dashboard_pending_payment_id');
    }
  }, [accounts]);

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, setUrl: React.Dispatch<React.SetStateAction<string>>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 5MB.');
      return;
    }

    setUploadingReceipt(true);
    try {
      const getDueDateString = (d: any) => d ? (typeof d === 'string' ? d : d.toDate ? d.toDate().toISOString().split('T')[0] : new Date(d).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
      const dateString = payDate || (paymentAccount ? getDueDateString(paymentAccount.dueDate) : new Date().toISOString().split('T')[0]);
      const catName = categories.find(c => c.id === paymentAccount?.categoryId)?.name || 'Geral';
      const url = await uploadReceiptToGoogleDrive(file, dateString, catName);
      setUrl(url);
    } catch (error: any) {
      if (error.message === 'UNAUTHORIZED') {
        setDriveConnected(false);
        alert('Sua sessão do Google Drive expirou. Por favor, clique em Anexar novamente para reautenticar.');
      } else if (error.message === 'API_DISABLED') {
        alert('A API do Google Drive não está ativada no projeto do Firebase. Acesse o Google Cloud Console para ativá-la: https://console.developers.google.com/apis/api/drive.googleapis.com/overview');
      } else {
        console.error("Erro no upload:", error);
        alert('Erro ao fazer upload do comprovante para o Google Drive.');
      }
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleAttachClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault();
    try {
      await requestDriveToken();
      setDriveConnected(true);
    } catch (error: any) {
      console.error(error);
      if (error.code === 'auth/popup-blocked') {
        alert("O popup de autenticação foi bloqueado pelo navegador. Por favor, permita popups para este site e tente novamente.");
      } else {
        alert("Erro ao conectar com o Google Drive.");
      }
    }
  };

  
  const parseMoneyInput = (val: string | number | undefined | null): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim().replace(/\s/g, '').replace('R$', '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : Math.max(0, num);
  };

  const openPaymentDialog = (account: AccountPayable) => {
    setPaymentAccount(account);
    sessionStorage.setItem('dashboard_pending_payment_id', account.id!);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod(account.paymentMethod || 'Pix');
    const existingPenalty = getAccountInterest(account);
    const existingDiscount = getAccountDiscount(account);
    setPenaltyAmount(existingPenalty > 0 ? String(existingPenalty) : '');
    setDiscountAmount(existingDiscount > 0 ? String(existingDiscount) : '');
    setPayReceiptUrl(account.receiptUrl || '');
  };

  const confirmPayment = async () => {
    if (!paymentAccount) return;
    setIsSubmitting(true);
    try {
      const pDate = new Date(payDate + 'T12:00:00');
      const penalty = parseMoneyInput(penaltyAmount);
      const discount = parseMoneyInput(discountAmount);
      const finalPaid = Math.max(0, paymentAccount.amount + penalty - discount);
      
      const pUrl = payReceiptUrl || null;
      const pType = pUrl ? (pUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE') : null;

      await upsertData('accounts_payable', paymentAccount.id!, {
        status: 'PAID',
        paymentDate: Timestamp.fromDate(pDate),
        paymentMethod: payMethod,
        receiptUrl: pUrl,
        receiptType: pType,
        interest: penalty,
        penaltyAmount: penalty,
        discount: discount,
        discountAmount: discount,
        amountPaid: finalPaid,
        lastSyncTimestamp: Date.now()
      });
      
      setPaymentAccount(null);
      sessionStorage.removeItem('dashboard_pending_payment_id');
      alert('Pagamento registrado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const { incomes, loading: incLoading } = useIncomes(userId, startDate, endDate);
  const { categories, loading: catLoading } = useCategories(userId);
  const { rolloverBonuses, loadingRollover } = useRollover(userId, startDate, categories);
  
  const loading = accLoading || incLoading || catLoading || loadingRollover;

  // Multi-selection state for pending bills
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

  // Filtros dinâmicos e Ordenação
  const [statusFilter, setStatusFilter] = useState<'ALL' | 'PAID' | 'PENDING' | 'SELECTED'>('ALL');
  const [sortConfig, setSortConfig] = useState<{ key: string, direction: 'asc' | 'desc' } | null>(null);
  const [pageSize, setPageSize] = useState<number | 'ALL'>('ALL');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const toggleSelectAccount = (id: string) => {
    setSelectedAccountIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const selectAllPending = () => {
    const pendingIds = accounts.filter(a => isAccountPending(a) && a.id).map(a => a.id!);
    setSelectedAccountIds(new Set(pendingIds));
  };

  const clearSelection = () => {
    setSelectedAccountIds(new Set());
    if (statusFilter === 'SELECTED') {
      setStatusFilter('ALL');
    }
  };

  const { totalSelecionado, selectedCount, pendingAccountsCount, paidAccountsCount } = useMemo(() => {
    const pendingAccounts = accounts.filter(a => isAccountPending(a));
    const paidAccounts = accounts.filter(a => isAccountPaid(a));
    const selectedAccounts = accounts.filter(a => a.id && selectedAccountIds.has(a.id));
    const sum = selectedAccounts.reduce((acc, curr) => acc + curr.amount, 0);
    return {
      totalSelecionado: sum,
      selectedCount: selectedAccounts.length,
      pendingAccountsCount: pendingAccounts.length,
      paidAccountsCount: paidAccounts.length
    };
  }, [accounts, selectedAccountIds]);

  const {
    saldoPrevisto,
    totalDespesas,
    totalPago,
    totalPendente,
    sparklineData
  } = useMemo(() => {
    const totalIncomes = incomes.reduce((acc, curr) => acc + curr.amount, 0);
    const pago = accounts.filter(a => isAccountPaid(a)).reduce((acc, curr) => acc + getAccountPaidAmount(curr), 0);
    const pendente = accounts.filter(a => isAccountPending(a)).reduce((acc, curr) => acc + curr.amount, 0);
    const totalPayable = pago + pendente;

    const saldoPrevisto = totalIncomes - totalPayable;
    
    // Sparkline - 4 weeks
    const sparklineData = [20, 35, 25, 45, 30, 50, 40]; // mock sparkline for visual

    return {
      saldoPrevisto,
      totalDespesas: totalPayable,
      totalPago: pago,
      totalPendente: pendente,
      sparklineData
    };
  }, [accounts, incomes, startDate]);

  // Reset page when filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [statusFilter, accounts.length]);

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

  // Filtrando contas com base no card de valor clicado
  let filteredAccounts = [...accounts];
  if (statusFilter === 'PAID') {
    filteredAccounts = filteredAccounts.filter(a => isAccountPaid(a));
  } else if (statusFilter === 'PENDING') {
    filteredAccounts = filteredAccounts.filter(a => isAccountPending(a));
  } else if (statusFilter === 'SELECTED') {
    filteredAccounts = filteredAccounts.filter(a => a.id && selectedAccountIds.has(a.id));
  }

  // Ordenando contas
  filteredAccounts.sort((a, b) => {
    if (!sortConfig) {
       return (b.dueDate as any)?.seconds - (a.dueDate as any)?.seconds; // default: mais recentes primeiro
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

  // Paginação dinâmica (mostra todas por padrão para não ocultar meses anteriores)
  const totalItems = filteredAccounts.length;
  const itemsLimit = pageSize === 'ALL' ? totalItems : pageSize;
  const totalPages = Math.max(1, Math.ceil(totalItems / itemsLimit));
  const startIndex = pageSize === 'ALL' ? 0 : (currentPage - 1) * itemsLimit;
  const displayedAccounts = pageSize === 'ALL' ? filteredAccounts : filteredAccounts.slice(startIndex, startIndex + itemsLimit);

  return (
    <div className="space-y-6">
      <AutoMigration userId={userId} />

      {/* Top Stats - 5 Cards Interativos (Clique para filtrar resultados) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 sm:gap-4">
        
        {/* Saldo Previsto */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={cn(
            "bg-white border rounded-xl p-3 sm:p-5 shadow-xs cursor-pointer transition-all duration-200 select-none relative group",
            statusFilter === 'ALL' 
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-sm" 
              : "border-slate-200 hover:border-blue-300 hover:shadow-xs"
          )}
          title="Clique para ver todas as faturas (Receitas - Despesas)"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px] sm:text-sm text-slate-700">Saldo Previsto</span>
            {statusFilter === 'ALL' && (
              <span className="text-[9px] font-semibold uppercase px-1.5 py-0.5 bg-blue-100 text-blue-700 rounded">Ativo</span>
            )}
          </div>
          <div className={cn("text-sm sm:text-lg md:text-xl font-bold tracking-tight font-mono truncate", saldoPrevisto >= 0 ? "text-emerald-600" : "text-red-600")} title={formatCurrency(saldoPrevisto)}>
            {formatCurrency(saldoPrevisto)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 truncate flex items-center justify-between">
            <span>Receitas - Despesas</span>
          </div>
        </div>
        
        {/* Total Despesas */}
        <div 
          onClick={() => setStatusFilter('ALL')}
          className={cn(
            "bg-white border rounded-xl p-3 sm:p-5 shadow-xs cursor-pointer transition-all duration-200 select-none relative group",
            statusFilter === 'ALL' 
              ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/20 shadow-sm" 
              : "border-slate-200 hover:border-blue-300 hover:shadow-xs"
          )}
          title="Clique para listar todas as despesas ({accounts.length} faturas)"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px] sm:text-sm text-slate-700">Total Despesas</span>
            <span className="text-[10px] font-semibold bg-slate-100 text-slate-600 px-1.5 py-0.5 rounded-full">{accounts.length}</span>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-bold text-slate-900 tracking-tight font-mono truncate" title={formatCurrency(totalDespesas)}>
            {formatCurrency(totalDespesas)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 truncate">Todas as faturas</div>
        </div>

        {/* Total Pago */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'PAID' ? 'ALL' : 'PAID')}
          className={cn(
            "bg-white border rounded-xl p-3 sm:p-5 shadow-xs cursor-pointer transition-all duration-200 select-none relative group",
            statusFilter === 'PAID' 
              ? "border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-50/30 shadow-sm" 
              : "border-slate-200 hover:border-emerald-300 hover:shadow-xs"
          )}
          title="Clique para filtrar apenas faturas PAGAS ({paidAccountsCount} faturas)"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px] sm:text-sm text-emerald-600 flex items-center gap-1">
              <CheckCircle2 className="w-3.5 h-3.5 shrink-0"/> 
              <span className="truncate">Total Pago</span>
            </span>
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              statusFilter === 'PAID' ? "bg-emerald-600 text-white" : "bg-emerald-100 text-emerald-700"
            )}>
              {paidAccountsCount}
            </span>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-bold text-emerald-700 tracking-tight font-mono truncate" title={formatCurrency(totalPago)}>
            {formatCurrency(totalPago)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 truncate flex items-center justify-between">
            <span>{statusFilter === 'PAID' ? 'Filtro aplicado' : 'Apenas pagas'}</span>
            <span className="text-[10px] text-emerald-600 font-medium group-hover:underline">Filtrar</span>
          </div>
        </div>

        {/* Total Pendente */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'PENDING' ? 'ALL' : 'PENDING')}
          className={cn(
            "bg-white border rounded-xl p-3 sm:p-5 shadow-xs cursor-pointer transition-all duration-200 select-none relative group",
            statusFilter === 'PENDING' 
              ? "border-amber-500 ring-2 ring-amber-500/25 bg-amber-50/30 shadow-sm" 
              : "border-slate-200 hover:border-amber-300 hover:shadow-xs"
          )}
          title="Clique para filtrar apenas faturas PENDENTES ({pendingAccountsCount} faturas)"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px] sm:text-sm text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3.5 h-3.5 shrink-0"/> 
              <span className="truncate">Total Pendente</span>
            </span>
            <span className={cn(
              "text-[10px] font-semibold px-1.5 py-0.5 rounded-full",
              statusFilter === 'PENDING' ? "bg-amber-600 text-white" : "bg-amber-100 text-amber-700"
            )}>
              {pendingAccountsCount}
            </span>
          </div>
          <div className="text-sm sm:text-lg md:text-xl font-bold text-amber-700 tracking-tight font-mono truncate" title={formatCurrency(totalPendente)}>
            {formatCurrency(totalPendente)}
          </div>
          <div className="text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2 truncate flex items-center justify-between">
            <span>{statusFilter === 'PENDING' ? 'Filtro aplicado' : 'Apenas a pagar'}</span>
            <span className="text-[10px] text-amber-600 font-medium group-hover:underline">Filtrar</span>
          </div>
        </div>

        {/* Selecionadas / Total Escolhido */}
        <div 
          onClick={() => setStatusFilter(prev => prev === 'SELECTED' ? 'ALL' : 'SELECTED')}
          className={cn(
            "col-span-2 sm:col-span-1 bg-white border rounded-xl p-3 sm:p-5 shadow-xs cursor-pointer transition-all duration-200 select-none relative group",
            statusFilter === 'SELECTED' 
              ? "border-indigo-500 ring-2 ring-indigo-500/25 bg-indigo-50/30 shadow-sm" 
              : selectedCount > 0 
                ? "border-indigo-300 bg-indigo-50/10 hover:border-indigo-400" 
                : "border-slate-200 hover:border-indigo-200 hover:shadow-xs"
          )}
          title="Clique para filtrar apenas faturas SELECIONADAS ({selectedCount} faturas)"
        >
          <div className="flex items-center justify-between text-slate-500 mb-1">
            <span className="font-medium text-[11px] sm:text-sm text-indigo-600 flex items-center gap-1.5">
              <ListChecks className="w-4 h-4 shrink-0 text-indigo-600" />
              <span className="truncate">Selecionadas</span>
            </span>
            {selectedCount > 0 && (
              <span className="bg-indigo-600 text-white text-[10px] font-bold px-1.5 py-0.5 rounded-full">
                {selectedCount}
              </span>
            )}
          </div>
          <div className={cn("text-sm sm:text-lg md:text-xl font-bold tracking-tight font-mono truncate", selectedCount > 0 ? "text-indigo-600" : "text-slate-700")} title={formatCurrency(totalSelecionado)}>
            {formatCurrency(totalSelecionado)}
          </div>
          <div className="flex items-center justify-between text-[10px] sm:text-xs text-slate-500 mt-1 sm:mt-2">
            <span className="truncate">{selectedCount > 0 ? `${selectedCount} marcada${selectedCount > 1 ? 's' : ''}` : 'Clique p/ filtrar'}</span>
            {selectedCount > 0 && (
              <button 
                type="button"
                onClick={(e) => { e.stopPropagation(); clearSelection(); }} 
                className="text-indigo-600 hover:text-indigo-800 font-semibold underline text-[10px] ml-1 shrink-0"
              >
                Limpar
              </button>
            )}
          </div>
        </div>

      </div>

      {/* Invoices Table */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-200 flex flex-wrap gap-3 justify-between items-center bg-slate-50/50">
          <div className="flex flex-wrap items-center gap-3">
            <h4 className="text-sm font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-2">
              <span>Lista de Faturas</span>
              <span className="text-xs font-normal normal-case text-slate-500">
                ({filteredAccounts.length} {filteredAccounts.length === 1 ? 'fatura' : 'faturas'})
              </span>
            </h4>

            {/* Badges de Filtro Ativo */}
            {statusFilter !== 'ALL' && (
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-blue-50 text-blue-700 border border-blue-200">
                <span>
                  Filtro: {statusFilter === 'PAID' ? 'Apenas Pagas' : statusFilter === 'PENDING' ? 'Apenas Pendentes' : 'Apenas Selecionadas'}
                </span>
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors"
                  title="Remover filtro (ver todas)"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            <button 
              onClick={() => window.location.reload()} 
              className="text-slate-400 hover:text-blue-600 transition-colors p-1 rounded-full hover:bg-slate-100" 
              title="Sincronizar / Atualizar"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>

          {/* Selection Actions & Page Controls */}
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {selectedCount > 0 && (
              <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-2.5 py-1 rounded-lg font-medium flex items-center gap-2">
                <span>{selectedCount} selecionada{selectedCount > 1 ? 's' : ''}: <strong>{formatCurrency(totalSelecionado)}</strong></span>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                setCalcBaseAmount(0);
                setCalcMode('basic');
                setCalculatorOpen(true);
              }}
              className="px-2.5 py-1 bg-white hover:bg-emerald-50 border border-slate-200 text-slate-700 hover:text-emerald-700 rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5 cursor-pointer shadow-2xs"
              title="Abrir Calculadora Financeira"
            >
              <Calculator className="w-3.5 h-3.5 text-emerald-600" />
              <span>Calculadora</span>
            </button>
            <button
              type="button"
              onClick={selectAllPending}
              disabled={pendingAccountsCount === 0}
              className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-40 cursor-pointer"
              title="Selecionar todas as contas com status Pendente"
            >
              Selecionar Todas ({pendingAccountsCount})
            </button>
            {selectedCount > 0 && (
              <button
                type="button"
                onClick={clearSelection}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors cursor-pointer"
                title="Limpar seleção atual"
              >
                Limpar Seleção
              </button>
            )}

            {/* Seletor de Quantidade por Página */}
            {filteredAccounts.length > 25 && (
              <div className="flex items-center gap-1 border-l border-slate-200 pl-2 ml-1">
                <span className="text-slate-400 text-[11px]">Exibir:</span>
                <select
                  value={pageSize === 'ALL' ? 'ALL' : pageSize}
                  onChange={(e) => {
                    const val = e.target.value;
                    setPageSize(val === 'ALL' ? 'ALL' : parseInt(val));
                    setCurrentPage(1);
                  }}
                  className="bg-white border border-slate-200 rounded px-1.5 py-0.5 text-xs text-slate-600 focus:outline-none focus:border-blue-500 cursor-pointer"
                >
                  <option value="ALL">Todas ({filteredAccounts.length})</option>
                  <option value="25">25</option>
                  <option value="50">50</option>
                  <option value="100">100</option>
                </select>
              </div>
            )}
          </div>
        </div>

        {/* Desktop View Table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="w-12 px-4 py-3 text-center">
                  <input
                    type="checkbox"
                    checked={pendingAccountsCount > 0 && selectedCount === pendingAccountsCount}
                    ref={el => { if (el) el.indeterminate = selectedCount > 0 && selectedCount < pendingAccountsCount; }}
                    onChange={(e) => e.target.checked ? selectAllPending() : clearSelection()}
                    disabled={pendingAccountsCount === 0}
                    className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer disabled:opacity-30"
                    title={selectedCount === pendingAccountsCount ? "Desmarcar todas" : "Selecionar todas as pendentes"}
                  />
                </th>
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
                <th className="px-6 py-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {displayedAccounts.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-6 py-10 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center gap-2">
                      <p className="font-medium text-slate-700">Nenhuma fatura encontrada.</p>
                      {statusFilter !== 'ALL' && (
                        <button
                          onClick={() => setStatusFilter('ALL')}
                          className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold mt-1"
                        >
                          Limpar filtro para mostrar todas as faturas
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                displayedAccounts.map((account) => {
                  const cat = categories.find(c => c.id === account.categoryId);
                  const isLate = isAccountPending(account) && ((account.dueDate as any)?.seconds * 1000) < Date.now();
                  const isSelected = account.id ? selectedAccountIds.has(account.id) && isAccountPending(account) : false;
                  
                  return (
                    <tr 
                      key={account.id} 
                      className={cn(
                        "hover:bg-slate-50 transition-colors cursor-pointer",
                        isSelected && "bg-indigo-50/40 hover:bg-indigo-50/60"
                      )}
                      onDoubleClick={() => setViewAccount(account)}
                    >
                      <td className="w-12 px-4 py-4 text-center" onClick={(e) => e.stopPropagation()}>
                        {isAccountPending(account) ? (
                          <input 
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => account.id && toggleSelectAccount(account.id)}
                            className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                            title="Selecionar conta para somar total"
                          />
                        ) : (
                          <span className="text-slate-300 text-xs font-mono">-</span>
                        )}
                      </td>
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
                            <CategoryIcon iconName={cat.icon || 'Folder'} size={14} />
                            {cat.name}
                          </span>
                        ) : (
                          <span className="text-slate-500 text-xs italic">-</span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-right font-medium text-slate-900 font-mono">
                        <div>{formatCurrency(getEffectiveAccountAmount(account))}</div>
                        {isAccountPaid(account) && (getAccountInterest(account) > 0 || getAccountDiscount(account) > 0) && (
                          <div className="text-[10px] text-slate-500 font-normal">
                            Orig: {formatCurrency(account.amount)}
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {isAccountPaid(account) && (
                          <span className="inline-flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded-md font-medium">
                            <CheckCircle2 className="w-3.5 h-3.5" /> Pago
                          </span>
                        )}
                        {isAccountPending(account) && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md font-medium">
                            <AlertCircle className="w-3.5 h-3.5" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex items-center justify-center gap-1">
                          {isAccountPaid(account) && preferences?.allowEditPaidExpenses && (
                            <button
                              onClick={() => setReopenConfirmAccount(account)}
                              disabled={isReopening}
                              className="px-2 py-1 text-amber-700 bg-amber-50 hover:bg-amber-100 border border-amber-300 rounded text-xs font-medium transition-colors flex items-center gap-1"
                              title="Reabrir fatura"
                            >
                              <RotateCcw className="w-3 h-3" /> Reabrir
                            </button>
                          )}
                          {isAccountPending(account) && (
                            <button
                              onClick={() => openPaymentDialog(account)}
                              className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                              title="Liquidar Fatura"
                            >
                              <CheckCircle2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="block md:hidden divide-y divide-slate-100">
          {displayedAccounts.length === 0 ? (
            <div className="p-8 text-center text-slate-500 text-sm">
              <p className="font-medium text-slate-700">Nenhuma fatura encontrada.</p>
              {statusFilter !== 'ALL' && (
                <button
                  onClick={() => setStatusFilter('ALL')}
                  className="text-xs text-blue-600 hover:text-blue-800 underline font-semibold mt-1"
                >
                  Limpar filtro para mostrar todas
                </button>
              )}
            </div>
          ) : (
            displayedAccounts.map((account) => {
              const cat = categories.find(c => c.id === account.categoryId);
              const isLate = isAccountPending(account) && ((account.dueDate as any)?.seconds * 1000) < Date.now();
              const isSelected = account.id ? selectedAccountIds.has(account.id) && isAccountPending(account) : false;

              return (
                <div 
                  key={account.id} 
                  className={cn(
                    "p-4 flex flex-col gap-2 hover:bg-slate-50 transition-colors",
                    isSelected && "bg-indigo-50/40"
                  )}
                >
                  <div className="flex justify-between items-start gap-2">
                    <div className="flex items-start gap-2.5 min-w-0">
                      {isAccountPending(account) ? (
                        <input 
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => account.id && toggleSelectAccount(account.id)}
                          className="w-4 h-4 mt-0.5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer shrink-0"
                          title="Selecionar conta"
                        />
                      ) : (
                        <span className="w-4 text-slate-300 text-xs text-center shrink-0 font-mono">-</span>
                      )}
                      <div className="font-medium text-slate-800 text-sm flex flex-wrap items-center gap-1">
                        <span>{account.title}</span>
                        {account.groupId && <span className="text-[9px] bg-slate-100 px-1.5 py-0.5 rounded text-slate-500 border border-slate-200">{account.installmentCurrent}/{account.installmentTotal}</span>}
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <span className="font-mono font-bold text-slate-900 text-sm whitespace-nowrap block">
                        {formatCurrency(getEffectiveAccountAmount(account))}
                      </span>
                      {isAccountPaid(account) && (getAccountInterest(account) > 0 || getAccountDiscount(account) > 0) && (
                        <span className="text-[10px] text-slate-500 font-mono block">
                          Orig: {formatCurrency(account.amount)}
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex justify-between items-center text-xs pl-6.5">
                    <div className="flex items-center gap-1.5 text-slate-500">
                      <Clock className={cn("w-3.5 h-3.5", isLate ? "text-red-600" : "text-slate-400")} />
                      <span className={cn("font-mono", isLate ? "text-red-600 font-bold" : "")}>
                        {formatFriendlyDate(account.dueDate)}
                      </span>
                    </div>
                    {cat && (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 border border-slate-200" style={{ color: cat.colorHex }}>
                        <CategoryIcon iconName={cat.icon || 'Folder'} size={12} />
                        {cat.name}
                      </span>
                    )}
                  </div>
                  <div className="flex justify-between items-center pt-2 border-t border-dashed border-slate-100 mt-1 pl-6.5">
                    <div>
                      {isAccountPaid(account) ? (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded">
                          <CheckCircle2 className="w-3 h-3" /> Pago
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 bg-amber-50 px-2 py-0.5 rounded">
                          <AlertCircle className="w-3 h-3" /> Pendente
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5">
                      {isAccountPaid(account) && preferences?.allowEditPaidExpenses && (
                        <button
                          onClick={() => setReopenConfirmAccount(account)}
                          disabled={isReopening}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded text-xs font-semibold flex items-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                          title="Reabrir despesa liquidada"
                        >
                          <RotateCcw className="w-3 h-3" /> Reabrir
                        </button>
                      )}
                      {isAccountPending(account) && (
                        <button
                          onClick={() => openPaymentDialog(account)}
                          className="px-3 py-1 bg-emerald-600 hover:bg-emerald-700 text-white rounded text-xs font-medium flex items-center gap-1.5 transition-colors shadow-sm cursor-pointer"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" /> Liquidar
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Paginação / Rodapé de Exibição */}
        {pageSize !== 'ALL' && totalPages > 1 && (
          <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-600">
            <span>
              Mostrando {startIndex + 1} a {Math.min(startIndex + pageSize, totalItems)} de {totalItems} faturas
            </span>
            <div className="flex items-center gap-1">
              <button
                disabled={currentPage === 1}
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Anterior
              </button>
              <span className="px-2 py-1 font-semibold">
                {currentPage} / {totalPages}
              </span>
              <button
                disabled={currentPage === totalPages}
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                className="px-2.5 py-1 bg-white border border-slate-200 rounded hover:bg-slate-100 disabled:opacity-40 disabled:cursor-not-allowed font-medium"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Payment Dialog */}
      {paymentAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" /> Liquidar Fatura
              </h3>
              <button onClick={() => { setPaymentAccount(null); sessionStorage.removeItem('dashboard_pending_payment_id'); }} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 overflow-y-auto space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-slate-200">
                <p className="text-sm font-medium text-slate-700">{paymentAccount.title}</p>
                <p className="text-xs text-slate-500 mt-1">Valor Original: <span className="font-mono">{formatCurrency(paymentAccount.amount)}</span></p>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data do Pagamento</label>
                  <input type="date" value={payDate} onChange={e => setPayDate(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Método de Pagamento</label>
                  <select value={payMethod} onChange={e => setPayMethod(e.target.value)} className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm">
                    <option value="Pix">Pix</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-slate-600">Juros / Multa (R$)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCalcBaseAmount(paymentAccount.amount);
                        setCalcMode('interest');
                        setCalculatorOpen(true);
                      }}
                      className="text-[11px] text-red-600 hover:text-red-800 font-medium flex items-center gap-1 cursor-pointer"
                      title="Calcular juros ou multa por dias de atraso ou porcentagem"
                    >
                      <Calculator className="w-3 h-3" />
                      Calcular
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={penaltyAmount} 
                      onChange={e => setPenaltyAmount(e.target.value.replace(/[^0-9.,]/g, ''))} 
                      placeholder="0,00" 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                    />
                    {parseMoneyInput(penaltyAmount) > 0 && (
                      <span className="absolute right-2 top-2 text-xs text-red-500 font-semibold">
                        +{formatCurrency(parseMoneyInput(penaltyAmount))}
                      </span>
                    )}
                  </div>
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-slate-600">Desconto (R$)</label>
                    <button
                      type="button"
                      onClick={() => {
                        setCalcBaseAmount(paymentAccount.amount);
                        setCalcMode('discount');
                        setCalculatorOpen(true);
                      }}
                      className="text-[11px] text-emerald-600 hover:text-emerald-800 font-medium flex items-center gap-1 cursor-pointer"
                      title="Calcular desconto à vista ou percentual"
                    >
                      <Calculator className="w-3 h-3" />
                      Calcular
                    </button>
                  </div>
                  <div className="relative">
                    <input 
                      type="text" 
                      inputMode="decimal"
                      value={discountAmount} 
                      onChange={e => setDiscountAmount(e.target.value.replace(/[^0-9.,]/g, ''))} 
                      placeholder="0,00" 
                      className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm font-mono" 
                    />
                    {parseMoneyInput(discountAmount) > 0 && (
                      <span className="absolute right-2 top-2 text-xs text-emerald-600 font-semibold">
                        -{formatCurrency(parseMoneyInput(discountAmount))}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Comprovante</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={payReceiptUrl} 
                    onChange={e => setPayReceiptUrl(e.target.value)} 
                    placeholder="Link do comprovante" 
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
                  {driveConnected ? (
                    <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer transition-colors whitespace-nowrap">
                      {uploadingReceipt ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-emerald-600"></div>
                      ) : (
                        <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                          Anexar
                        </span>
                      )}
                      <input 
                        type="file" 
                        accept="image/*,.pdf" 
                        className="hidden" 
                        onChange={(e) => handleFileUpload(e, setPayReceiptUrl)}
                        disabled={uploadingReceipt}
                      />
                    </label>
                  ) : (
                    <button 
                      type="button"
                      onClick={handleAttachClick}
                      disabled={uploadingReceipt}
                      className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer transition-colors whitespace-nowrap"
                    >
                      <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                        Anexar
                      </span>
                    </button>
                  )}
                </div>
                {payReceiptUrl && (
                  <div className="mt-2">
                    <ReceiptPreview
                      url={payReceiptUrl}
                      onRemove={() => setPayReceiptUrl('')}
                      className="h-44"
                    />
                  </div>
                )}
              </div>

              <div className="pt-4 border-t border-slate-200">
                <div className="bg-slate-50 p-3.5 rounded-xl border border-slate-200/80 mb-4 space-y-2">
                  <div className="flex justify-between text-xs text-slate-500">
                    <span>Valor Original da Fatura:</span>
                    <span className="font-mono">{formatCurrency(paymentAccount.amount)}</span>
                  </div>
                  {parseMoneyInput(penaltyAmount) > 0 && (
                    <div className="flex justify-between text-xs text-red-600 font-medium">
                      <span>(+) Juros / Multa adicionada:</span>
                      <span className="font-mono">+{formatCurrency(parseMoneyInput(penaltyAmount))}</span>
                    </div>
                  )}
                  {parseMoneyInput(discountAmount) > 0 && (
                    <div className="flex justify-between text-xs text-emerald-600 font-medium">
                      <span>(-) Desconto obtido:</span>
                      <span className="font-mono">-{formatCurrency(parseMoneyInput(discountAmount))}</span>
                    </div>
                  )}
                  <div className="flex justify-between items-center pt-2 border-t border-slate-200">
                    <span className="text-sm font-semibold text-slate-700">Valor Final Pago:</span>
                    <span className="text-xl font-bold font-mono text-emerald-600">
                      {formatCurrency(Math.max(0, paymentAccount.amount + parseMoneyInput(penaltyAmount) - parseMoneyInput(discountAmount)))}
                    </span>
                  </div>
                </div>

                <div className="flex justify-end gap-3">
                  <button onClick={confirmPayment} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2.5 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm cursor-pointer">
                    <CheckCircle className="w-4 h-4" />
                    {isSubmitting ? 'Processando...' : 'Confirmar Pago'}
                  </button>
                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* View Account Details Dialog (Espelho da Fatura) */}
      {viewAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-xl flex flex-col max-h-[90vh]">
            <div className="p-5 border-b border-slate-100 flex justify-between items-center bg-slate-50 rounded-t-2xl">
              <h3 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                Espelho da Fatura
              </h3>
              <button onClick={() => setViewAccount(null)} className="text-slate-400 hover:text-slate-600 transition-colors p-1 hover:bg-slate-200 rounded-full">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <div className="p-6 overflow-y-auto space-y-4">
              <div className="flex flex-col gap-1 items-center pb-4 border-b border-slate-100">
                <div className="text-sm font-medium text-slate-500 uppercase tracking-wider">{categories.find(c => c.id === viewAccount.categoryId)?.name || 'Sem categoria'}</div>
                <div className="text-2xl font-bold text-slate-900">{viewAccount.title}</div>
                <div className="text-3xl font-bold font-mono text-slate-800 mt-2">{formatCurrency(viewAccount.amount)}</div>
                <div className="mt-2">
                  <span className={cn(
                    "px-3 py-1 rounded-full text-xs font-medium border",
                    isAccountPaid(viewAccount) ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    (isAccountPending(viewAccount) && ((viewAccount.dueDate as any)?.seconds * 1000) < Date.now()) ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {isAccountPaid(viewAccount) ? 'Pago' : 
                     (isAccountPending(viewAccount) && ((viewAccount.dueDate as any)?.seconds * 1000) < Date.now()) ? 'Vencido' : 'Pendente'}
                  </span>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4 text-sm">
                <div>
                  <div className="text-slate-500 mb-1">Vencimento</div>
                  <div className="font-medium text-slate-900">{formatFriendlyDate(viewAccount.dueDate)}</div>
                </div>
                
                {viewAccount.groupId && viewAccount.installmentCurrent && viewAccount.installmentTotal && (
                  <div>
                    <div className="text-slate-500 mb-1">Parcela</div>
                    <div className="font-medium text-slate-900">{viewAccount.installmentCurrent} de {viewAccount.installmentTotal}</div>
                  </div>
                )}
                
                {isAccountPaid(viewAccount) && (
                  <>
                    <div>
                      <div className="text-slate-500 mb-1">Data Pagamento</div>
                      <div className="font-medium text-slate-900">{viewAccount.paymentDate ? formatFriendlyDate(viewAccount.paymentDate) : '-'}</div>
                    </div>
                    {viewAccount.paymentMethod && (
                      <div>
                        <div className="text-slate-500 mb-1">Forma de Pag.</div>
                        <div className="font-medium text-slate-900">{viewAccount.paymentMethod}</div>
                      </div>
                    )}
                    {getAccountInterest(viewAccount) > 0 && (
                      <div>
                        <div className="text-slate-500 mb-1">Juros/Multa</div>
                        <div className="font-medium text-red-600">+{formatCurrency(getAccountInterest(viewAccount))}</div>
                      </div>
                    )}
                    {getAccountDiscount(viewAccount) > 0 && (
                      <div>
                        <div className="text-slate-500 mb-1">Desconto</div>
                        <div className="font-medium text-emerald-600">-{formatCurrency(getAccountDiscount(viewAccount))}</div>
                      </div>
                    )}
                    {(getAccountInterest(viewAccount) > 0 || getAccountDiscount(viewAccount) > 0 || viewAccount.amountPaid !== undefined) && (
                      <div className="col-span-2 pt-2 border-t border-slate-100">
                        <div className="text-slate-500 mb-1">Valor Final Pago</div>
                        <div className="font-bold text-emerald-700 text-lg">{formatCurrency(getAccountPaidAmount(viewAccount))}</div>
                      </div>
                    )}
                  </>
                )}
                
                {viewAccount.notes && (
                  <div className="col-span-2 pt-2 border-t border-slate-100">
                    <div className="text-slate-500 mb-1">Observações</div>
                    <div className="text-slate-700 bg-slate-50 p-3 rounded-lg border border-slate-100 whitespace-pre-wrap">{viewAccount.notes}</div>
                  </div>
                )}
              </div>
              
              {viewAccount.receiptUrl && (
                <div className="mt-4 pt-4 border-t border-slate-100">
                  <div className="text-slate-500 mb-2 text-sm font-medium">Comprovante Anexado</div>
                  <ReceiptPreview
                    url={viewAccount.receiptUrl}
                    className="h-48"
                  />
                </div>
              )}
            </div>
            
            <div className="p-4 border-t border-slate-100 bg-slate-50 rounded-b-2xl flex flex-wrap items-center justify-between gap-3">
              <div>
                {isAccountPaid(viewAccount) && preferences?.allowEditPaidExpenses && (
                  <button
                    type="button"
                    onClick={() => {
                      const acc = viewAccount;
                      setViewAccount(null);
                      setReopenConfirmAccount(acc);
                    }}
                    className="px-4 py-2 bg-amber-50 hover:bg-amber-100 text-amber-900 border border-amber-300 rounded-lg transition-colors font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Reabrir Fatura
                  </button>
                )}
              </div>

              <button 
                onClick={() => setViewAccount(null)} 
                className="px-5 py-2 bg-white border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors font-medium shadow-sm cursor-pointer"
              >
                Fechar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação para Reabrir Despesa */}
      {reopenConfirmAccount && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4 z-50 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-slate-100 space-y-4">
            <div className="w-12 h-12 rounded-full bg-amber-50 border border-amber-200 flex items-center justify-center text-amber-600 mx-auto">
              <RotateCcw className="w-6 h-6" />
            </div>

            <div className="text-center space-y-2">
              <h3 className="text-lg font-bold text-slate-900">Reabrir Despesa Liquidada?</h3>
              <p className="text-sm text-slate-600 leading-relaxed">
                Você está prestes a estornar a conta <strong className="text-slate-900">"{reopenConfirmAccount.title}"</strong>.
              </p>
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs text-slate-600 text-left space-y-1.5">
                <p className="font-semibold text-slate-800">O que acontece ao reabrir:</p>
                <ul className="list-disc list-inside space-y-1 text-slate-600">
                  <li>O status volta a ser <strong className="text-amber-700">Pendente</strong>.</li>
                  <li>Data de liquidação, juros, multa e descontos pagos serão zerados.</li>
                  <li>Você poderá editar ou liquidar a despesa novamente.</li>
                </ul>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setReopenConfirmAccount(null)}
                disabled={isReopening}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 font-semibold rounded-xl text-sm transition-colors cursor-pointer"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (!reopenConfirmAccount) return;
                  setIsReopening(true);
                  try {
                    await reopenAccount(reopenConfirmAccount);
                    setReopenConfirmAccount(null);
                  } catch (err: any) {
                    console.error('Erro ao reabrir despesa:', err);
                    alert('Erro ao reabrir despesa: ' + (err?.message || err));
                  } finally {
                    setIsReopening(false);
                  }
                }}
                disabled={isReopening}
                className="flex-1 px-4 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-xl text-sm transition-colors flex items-center justify-center gap-2 cursor-pointer shadow-sm disabled:opacity-50"
              >
                {isReopening ? (
                  <span>Reabrindo...</span>
                ) : (
                  <>
                    <RotateCcw className="w-4 h-4" />
                    <span>Sim, Reabrir</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Floating Financial Calculator Button */}
      <button
        type="button"
        onClick={() => {
          setCalcBaseAmount(0);
          setCalcMode('basic');
          setCalculatorOpen(true);
        }}
        className="fixed bottom-6 right-6 z-40 bg-slate-900 hover:bg-emerald-600 text-white p-3.5 rounded-full shadow-xl border border-slate-700/60 flex items-center gap-2 group transition-all hover:scale-105 cursor-pointer"
        title="Abrir Calculadora Financeira"
      >
        <Calculator className="w-5 h-5 text-emerald-400 group-hover:rotate-12 transition-transform" />
        <span className="text-xs font-bold hidden group-hover:inline-block pr-1">Calculadora</span>
      </button>

      {/* Integrated Financial Calculator Modal */}
      <FinancialCalculator
        isOpen={calculatorOpen}
        onClose={() => setCalculatorOpen(false)}
        initialBaseAmount={calcBaseAmount}
        initialMode={calcMode}
        onApplyInterest={(amount) => {
          setPenaltyAmount(amount > 0 ? amount.toFixed(2).replace('.', ',') : '');
        }}
        onApplyDiscount={(amount) => {
          setDiscountAmount(amount > 0 ? amount.toFixed(2).replace('.', ',') : '');
        }}
      />

    </div>
  );
}

