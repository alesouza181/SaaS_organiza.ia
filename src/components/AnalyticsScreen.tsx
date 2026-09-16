import React, { useState, useRef, useMemo, useEffect } from 'react';
import { AIInsightPanel } from './AIInsightPanel';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ComposedChart, Line
} from 'recharts';
import { Download, Printer, TrendingUp, ChevronDown, ChevronUp, FileText, FilterX } from 'lucide-react';
import { toPng } from 'html-to-image';
import jsPDF from 'jspdf';
import { format, subMonths, isSameMonth, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { CategoryIcon } from './CategoryIcon';
import { useDate } from '../contexts/DateContext';
import { AccountPayable, Income, Category } from '../types';
import { twMerge } from 'tailwind-merge';
import { isAccountPaid, isAccountPending, isAccountLate } from '../utils/accountStatus';
import { ReportPrintModal } from './ReportPrintModal';

interface AnalyticsScreenProps {
  userId: string;
}

type FilterType = 'ALL' | 'PAID' | 'OVERDUE' | 'UPCOMING' | 'CATEGORY' | 'FIXED' | 'VARIABLE';

interface ActiveFilter {
  type: FilterType;
  value?: any;
}

export function AnalyticsScreen({ userId }: AnalyticsScreenProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  const [activeTab, setActiveTab] = useState<'visao_geral' | 'visao_ia'>('visao_geral');
  const [activeFilter, setActiveFilter] = useState<ActiveFilter | null>(null);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  
  // Get all data globally
  const { accounts, incomes, categories } = useFirestoreSync();
  
  // Use context date for filtering
  const { selectedDate, isAllMonths, setSelectedDate, setIsAllMonths } = useDate();

  // Selected Date bounds
  const currentMonth = selectedDate.getMonth();
  const currentYear = selectedDate.getFullYear();

  // Helper to convert Timestamp to JS Date safely
  const getJSDate = (val: any) => {
    if (!val) return new Date();
    if (typeof val.toDate === 'function') return val.toDate();
    if (val.seconds) return new Date(val.seconds * 1000);
    return new Date();
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  // State for drill-down
  const [expandedCategory, setExpandedCategory] = useState<string | null>(null);

  // Computed Values for Current Month
  const currentMonthAccounts = useMemo(() => {
    if (isAllMonths) return accounts.filter(acc => getJSDate(acc.dueDate).getFullYear() === currentYear);
    return accounts.filter(acc => {
      const d = getJSDate(acc.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [accounts, currentMonth, currentYear, isAllMonths]);

  const currentMonthIncomes = useMemo(() => {
    if (isAllMonths) return incomes.filter(inc => getJSDate(inc.date).getFullYear() === currentYear);
    return incomes.filter(inc => {
      const d = getJSDate(inc.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [incomes, currentMonth, currentYear, isAllMonths]);

  const now = useMemo(() => new Date(), []);
  const next5Days = useMemo(() => addDays(now, 5), [now]);

  // KPIs
  const totalDespesas = currentMonthAccounts.reduce((acc, curr) => acc + curr.amount, 0);
  const totalRenda = currentMonthIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  
  const contasPagas = currentMonthAccounts.filter(acc => isAccountPaid(acc)).reduce((acc, curr) => acc + curr.amount, 0);
  const vencidas = currentMonthAccounts.filter(acc => isAccountLate(acc)).reduce((acc, curr) => acc + curr.amount, 0);
  const aVencer = currentMonthAccounts.filter(acc => isAccountPending(acc) && !isAccountLate(acc)).reduce((acc, curr) => acc + curr.amount, 0);
  
  const proximos5Dias = currentMonthAccounts.filter(acc => {
    if (!isAccountPending(acc)) return false;
    const d = getJSDate(acc.dueDate);
    return d >= now && d <= next5Days;
  }).reduce((acc, curr) => acc + curr.amount, 0);

  const saldoRestante = totalRenda - contasPagas - currentMonthAccounts.filter(a => isAccountPending(a)).reduce((acc, curr) => acc + curr.amount, 0);

  const toggleFilter = (type: FilterType, value?: any) => {
    if (activeFilter?.type === type && activeFilter?.value === value) {
      setActiveFilter(null);
    } else {
      setActiveFilter({ type, value });
    }
  };

  const isFilterActive = (type: FilterType, value?: any) => {
    return activeFilter?.type === type && activeFilter?.value === value;
  };

  const filteredAccounts = useMemo(() => {
    if (!activeFilter) return currentMonthAccounts;
    switch (activeFilter.type) {
      case 'PAID': return currentMonthAccounts.filter(a => isAccountPaid(a));
      case 'OVERDUE': return currentMonthAccounts.filter(a => isAccountLate(a));
      case 'UPCOMING': return currentMonthAccounts.filter(a => isAccountPending(a) && !isAccountLate(a));
      case 'CATEGORY': return currentMonthAccounts.filter(a => a.categoryId === activeFilter.value);
      case 'FIXED': return currentMonthAccounts.filter(a => a.isRecurring);
      case 'VARIABLE': return currentMonthAccounts.filter(a => !a.isRecurring);
      case 'ALL': return currentMonthAccounts;
      default: return currentMonthAccounts;
    }
  }, [currentMonthAccounts, activeFilter]);

  // Gauge (Saúde do Caixa)
  const comprometimento = totalRenda > 0 ? (totalDespesas / totalRenda) * 100 : 0;
  const isDeficit = comprometimento > 100;
  
  const gaugeData = [
    { name: 'Comprometido', value: Math.min(comprometimento, 100), fill: isDeficit ? '#ef4444' : '#3b82f6' },
    { name: 'Livre', value: Math.max(100 - comprometimento, 0), fill: '#f1f5f9' }
  ];

  // Donut (Status)
  // Always use the full month data for the Donut so it doesn't collapse to 100%
  const totalDonut = contasPagas + vencidas + aVencer;
  
  const donutData = [
    { name: 'Pagas', value: contasPagas, color: '#10b981', type: 'PAID' },
    { name: 'Vencidas', value: vencidas, color: '#ef4444', type: 'OVERDUE' },
    { name: 'A Vencer', value: aVencer, color: '#f59e0b', type: 'UPCOMING' },
  ].filter(d => d.value > 0);
  if (donutData.length === 0) donutData.push({ name: 'Vazio', value: 1, color: '#e2e8f0', type: 'ALL' });

  const handleDonutClick = (data: any) => {
     if (data && data.payload && data.payload.type && data.payload.type !== 'ALL') {
         toggleFilter(data.payload.type as FilterType);
     }
  };

  let centerTextValue = '100%';
  let centerTextLabel = 'TOTAL';
  
  if (activeFilter?.type === 'PAID') {
    centerTextValue = totalDonut > 0 ? `${((contasPagas / totalDonut) * 100).toFixed(0)}%` : '0%';
    centerTextLabel = 'PAGAS';
  } else if (activeFilter?.type === 'OVERDUE') {
    centerTextValue = totalDonut > 0 ? `${((vencidas / totalDonut) * 100).toFixed(0)}%` : '0%';
    centerTextLabel = 'VENCIDAS';
  } else if (activeFilter?.type === 'UPCOMING') {
    centerTextValue = totalDonut > 0 ? `${((aVencer / totalDonut) * 100).toFixed(0)}%` : '0%';
    centerTextLabel = 'A VENCER';
  }

  // Evolução Mensal
  const evolutionData = useMemo(() => {
    const data = [];
    const monthsToShow = isAllMonths ? 12 : 6;
    // For all months in a specific year, end date is Dec 31st of that year
    const endDate = isAllMonths ? new Date(currentYear, 11, 31) : selectedDate;

    for (let i = monthsToShow - 1; i >= 0; i--) {
      const d = subMonths(endDate, i);
      const m = d.getMonth();
      const y = d.getFullYear();
      
      const despesas = accounts.filter(acc => {
        const dt = getJSDate(acc.dueDate);
        return dt.getMonth() === m && dt.getFullYear() === y;
      }).reduce((sum, acc) => sum + acc.amount, 0);

      const rendas = incomes.filter(inc => {
        const dt = getJSDate(inc.date);
        return dt.getMonth() === m && dt.getFullYear() === y;
      }).reduce((sum, inc) => sum + inc.amount, 0);

      data.push({
        name: format(d, 'MMM/yy', { locale: ptBR }).toUpperCase(),
        month: m,
        year: y,
        Despesas: despesas,
        Receitas: rendas
      });
    }
    return data;
  }, [accounts, incomes, selectedDate, isAllMonths, currentYear]);

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      const newDate = new Date(payload.year, payload.month, 1);
      setSelectedDate(newDate);
      setIsAllMonths(false);
      setActiveFilter(null); // clear filter when changing month
    }
  };

  // Gastos por Categoria
  const baseAccountsForCategory = activeFilter?.type === 'CATEGORY' ? currentMonthAccounts : filteredAccounts;

  const categoryData = useMemo(() => {
    return categories.map(cat => {
      const spent = baseAccountsForCategory
        .filter(acc => acc.categoryId === cat.id)
        .reduce((sum, acc) => sum + acc.amount, 0);
      const hasLimit = cat.limitType !== 'NONE' && cat.maxLimit !== null && cat.maxLimit > 0;
      return {
        ...cat,
        spent,
        limit: hasLimit ? (cat.maxLimit || 0) : 0,
        hasLimit
      };
    }).filter(c => c.spent > 0 || c.limit > 0)
    .sort((a, b) => b.spent - a.spent);
  }, [categories, baseAccountsForCategory]);

  // Fixos vs Variáveis
  const totalFilteredDespesas = filteredAccounts.reduce((acc, curr) => acc + curr.amount, 0);
  const fixos = filteredAccounts.filter(a => a.isRecurring).reduce((acc, curr) => acc + curr.amount, 0);
  const variaveis = totalFilteredDespesas - fixos;

  // Lançamentos do Mês
  const lancamentos = [...filteredAccounts].sort((a, b) => getJSDate(a.dueDate).getTime() - getJSDate(b.dueDate).getTime());

  // PDF Export
  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    try {
      const dataUrl = await toPng(chartRef.current, { backgroundColor: '#f8fafc', cacheBust: true });
      const img = new Image();
      img.src = dataUrl;
      await new Promise((resolve) => { img.onload = resolve; });
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (img.height * pdfWidth) / img.width;
      
      pdf.setFontSize(16);
      pdf.text('Relatório Financeiro', 15, 15);
      pdf.addImage(dataUrl, 'PNG', 0, 25, pdfWidth, pdfHeight);
      pdf.save('relatorio-financeiro.pdf');
    } catch (err) {
      console.error('Failed to export PDF', err);
    }
  };

  return (
    <div className="w-full max-w-7xl mx-auto space-y-6 pb-12" ref={chartRef}>
      
      {/* Header Export & Tabs */}
      <div className="flex flex-wrap justify-between items-center gap-4 mb-6">
        <div className="flex bg-slate-100/90 p-1 rounded-xl">
          <button 
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${activeTab === 'visao_geral' ? 'bg-white text-blue-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('visao_geral')}
          >
            Visão Geral
          </button>
          <button 
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all flex items-center gap-1.5 ${activeTab === 'visao_ia' ? 'bg-white text-purple-600 shadow-2xs' : 'text-slate-500 hover:text-slate-800'}`}
            onClick={() => setActiveTab('visao_ia')}
          >
            <span>✨</span> Visão IA
          </button>
        </div>
        
        <div className="flex items-center gap-3">
          {activeFilter && (
            <button onClick={() => setActiveFilter(null)} className="text-xs font-bold text-slate-500 hover:text-slate-800 transition-colors flex items-center gap-1 bg-slate-100 px-3 py-2 rounded-xl">
               <FilterX className="w-4 h-4" />
               Limpar Filtros
            </button>
          )}
          <button 
            onClick={() => setIsPrintModalOpen(true)}
            className="bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition-all flex items-center gap-2 shadow-xs cursor-pointer"
            title="Abrir página de impressão com visualização da folha A4 e opções de relatório"
          >
            <Printer className="w-4 h-4" />
            <span>Página de Impressão</span>
          </button>
        </div>
      </div>

      {activeTab === 'visao_ia' && (
        <AIInsightPanel 
           accounts={currentMonthAccounts} 
           incomes={currentMonthIncomes} 
           categories={categoryData}
          totalDespesas={totalDespesas}
          totalRenda={totalRenda}
        />
      )}

      {activeTab === 'visao_geral' && (
        <>
      {/* Grid de Métricas Rápidas */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div 
           className={twMerge("bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-sm", isFilterActive('ALL') ? 'border-blue-500 ring-1 ring-blue-500' : 'border-slate-200/90')}
           onClick={() => toggleFilter('ALL')}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TOTAL DO MÊS</span>
          <span className="text-2xl font-bold text-blue-600 mt-2">{formatCurrency(totalDespesas)}</span>
        </div>
        <div 
           className={twMerge("bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-sm", isFilterActive('PAID') ? 'border-emerald-500 ring-1 ring-emerald-500' : 'border-slate-200/90')}
           onClick={() => toggleFilter('PAID')}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CONTAS PAGAS</span>
          <span className="text-2xl font-bold text-emerald-500 mt-2">{formatCurrency(contasPagas)}</span>
        </div>
        <div 
           className={twMerge("bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-sm", isFilterActive('OVERDUE') ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-200/90')}
           onClick={() => toggleFilter('OVERDUE')}
        >
          <div className="flex justify-between items-center">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">VENCIDAS</span>
             <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-bold">
               {currentMonthAccounts.filter(a => a.status === 'PENDING' && isBefore(getJSDate(a.dueDate), now)).length} itens
             </span>
          </div>
          <span className="text-2xl font-bold text-red-500 mt-2">{formatCurrency(vencidas)}</span>
        </div>
        <div 
           className={twMerge("bg-white border rounded-2xl p-5 shadow-xs flex flex-col justify-between cursor-pointer transition-all hover:shadow-sm", isFilterActive('UPCOMING') ? 'border-amber-500 ring-1 ring-amber-500' : 'border-slate-200/90')}
           onClick={() => toggleFilter('UPCOMING')}
        >
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PRÓXIMOS 5 DIAS</span>
          <span className="text-2xl font-bold text-amber-500 mt-2">{formatCurrency(proximos5Dias)}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 shadow-xs">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SALDO RESTANTE ESTIMADO</span>
        <div className="text-3xl font-black mt-1 text-slate-900 tracking-tight">
          {saldoRestante < 0 ? '-' : ''}{formatCurrency(Math.abs(saldoRestante))}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Saúde do Caixa e Metas */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-6">SAÚDE DO CAIXA E METAS</h3>
          
          <div className="flex items-center justify-between flex-1">
            <div className="w-1/2 h-32 relative">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={gaugeData}
                    cx="50%"
                    cy="100%"
                    startAngle={180}
                    endAngle={0}
                    innerRadius="75%"
                    outerRadius="100%"
                    dataKey="value"
                    stroke="none"
                    cornerRadius={5}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Needle Pin and Indicator */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-slate-900 rounded-full border-4 border-white shadow-md z-10"></div>
              <div 
                 className="absolute bottom-0 left-1/2 h-[50px] w-1 bg-slate-900 origin-bottom rounded-full z-0 transition-transform duration-1000 ease-out" 
                 style={{ transform: `translateX(-50%) rotate(${-90 + (Math.min(comprometimento, 100) / 100) * 180}deg)`}}
              ></div>
            </div>
            
            <div className="w-1/2 pl-6">
              <p className="text-xs text-slate-500 font-medium">Comprometimento</p>
              <p className={`text-3xl font-bold ${isDeficit ? 'text-red-500' : 'text-slate-800'}`}>{comprometimento.toFixed(0)}%</p>
              <p className="text-xs text-slate-500 mt-1">Renda: {formatCurrency(totalRenda)}</p>
              {isDeficit && <p className="text-xs font-bold text-red-500 mt-1 uppercase tracking-wider">DÉFICIT DETECTADO!</p>}
            </div>
          </div>
        </div>

        {/* Saúde das Contas (Status) */}
        <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs flex flex-col">
          <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-4">SAÚDE DAS CONTAS (STATUS)</h3>
          <div className="flex items-center flex-1">
            <div className="w-1/2 h-36 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={donutData}
                    cx="50%"
                    cy="50%"
                    innerRadius="65%"
                    outerRadius="100%"
                    paddingAngle={2}
                    dataKey="value"
                    stroke="none"
                    cornerRadius={4}
                    onClick={handleDonutClick}
                    className="cursor-pointer outline-none"
                  > 
                     {donutData.map((entry, index) => (
                      <Cell 
                        key={`cell-${index}`} 
                        fill={entry.color} 
                        className="transition-all outline-none hover:opacity-80" 
                        stroke={isFilterActive(entry.type as FilterType) ? '#334155' : 'none'} 
                        strokeWidth={isFilterActive(entry.type as FilterType) ? 2 : 0} 
                        opacity={activeFilter && !isFilterActive(entry.type as FilterType) ? 0.3 : 1}
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div 
                  className="flex flex-col items-center justify-center w-24 h-24 rounded-full pointer-events-auto cursor-pointer hover:bg-slate-50 transition-colors"
                  onClick={() => {
                    if (activeFilter?.type === 'PAID' || activeFilter?.type === 'OVERDUE' || activeFilter?.type === 'UPCOMING') {
                      setActiveFilter(null);
                    }
                  }}
                  title={activeFilter ? "Limpar filtro" : ""}
                >
                  <span className="text-xl font-bold text-slate-800">{centerTextValue}</span>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{centerTextLabel}</span>
                </div>
              </div>
            </div>
            <div className="w-1/2 pl-4 space-y-2">
               <div className={twMerge("flex flex-col p-1.5 -ml-1.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50", isFilterActive('PAID') ? 'bg-slate-100 ring-1 ring-slate-200' : '')} onClick={() => toggleFilter('PAID')}>
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-600">Pagas</span></div>
                   <span className="text-xs font-bold text-slate-400">{totalDonut > 0 ? ((contasPagas / totalDonut) * 100).toFixed(0) : 0}%</span>
                 </div>
                 <span className="text-sm font-medium text-slate-900 ml-4.5">{formatCurrency(contasPagas)}</span>
               </div>
               <div className={twMerge("flex flex-col p-1.5 -ml-1.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50", isFilterActive('OVERDUE') ? 'bg-slate-100 ring-1 ring-slate-200' : '')} onClick={() => toggleFilter('OVERDUE')}>
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-xs font-bold text-slate-600">Vencidas</span></div>
                   <span className="text-xs font-bold text-slate-400">{totalDonut > 0 ? ((vencidas / totalDonut) * 100).toFixed(0) : 0}%</span>
                 </div>
                 <span className="text-sm font-medium text-slate-900 ml-4.5">{formatCurrency(vencidas)}</span>
               </div>
               <div className={twMerge("flex flex-col p-1.5 -ml-1.5 rounded-xl cursor-pointer transition-colors hover:bg-slate-50", isFilterActive('UPCOMING') ? 'bg-slate-100 ring-1 ring-slate-200' : '')} onClick={() => toggleFilter('UPCOMING')}>
                 <div className="flex items-center justify-between">
                   <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-xs font-bold text-slate-600">A Vencer</span></div>
                   <span className="text-xs font-bold text-slate-400">{totalDonut > 0 ? ((aVencer / totalDonut) * 100).toFixed(0) : 0}%</span>
                 </div>
                 <span className="text-sm font-medium text-slate-900 ml-4.5">{formatCurrency(aVencer)}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evolução Mensal */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-6">EVOLUÇÃO MENSAL DE GASTOS</h3>
        <div className="h-52 w-full cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evolutionData} margin={{ top: 15, right: 10, left: -15, bottom: 0 }} onClick={handleBarClick}>
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#a855f7" stopOpacity={0.85}/>
                  <stop offset="100%" stopColor="#c084fc" stopOpacity={0.25}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#94a3b8' }} tickFormatter={(val) => `R$ ${val}`} />
              <RechartsTooltip 
                 cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '12px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.05)' }}
                formatter={(val: number) => formatCurrency(val)}
              />
              <Bar dataKey="Despesas" fill="url(#colorBar)" radius={[6, 6, 0, 0]} maxBarSize={44} className="hover:opacity-85" />
              <Line type="monotone" dataKey="Despesas" stroke="#2563eb" strokeWidth={2.5} dot={{ r: 4, fill: '#ffffff', stroke: '#2563eb', strokeWidth: 2 }} activeDot={{ r: 6, fill: '#2563eb' }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gastos por Categoria */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-6 shadow-xs">
        <h3 className="text-xs font-bold text-slate-700 uppercase tracking-wider mb-6">GASTOS POR CATEGORIA</h3>
        <div className="space-y-6">
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum gasto registrado neste período.</p>
          ) : categoryData.map(cat => {
             const percent = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;
             const isOverLimit = percent > 100;
             const isExpanded = expandedCategory === cat.id;
             const catTransactions = (activeFilter?.type === 'CATEGORY' ? currentMonthAccounts : filteredAccounts).filter(a => a.categoryId === cat.id).sort((a,b) => getJSDate(a.dueDate).getTime() - getJSDate(b.dueDate).getTime());
             
             return (
               <div key={cat.id} className="group">
                 <div className="flex justify-between items-center mb-2">
                   <div 
                     className={twMerge("flex items-center gap-3 cursor-pointer flex-1 p-2 -ml-2 rounded-lg transition-colors hover:bg-slate-50", isFilterActive('CATEGORY', cat.id) ? 'bg-blue-50 ring-1 ring-blue-100' : '')}
                     onClick={() => toggleFilter('CATEGORY', cat.id)}
                     title="Filtrar por esta categoria"
                   >
                     <div className={twMerge("w-8 h-8 rounded-full flex items-center justify-center opacity-80 transition-transform", isFilterActive('CATEGORY', cat.id) ? 'scale-110 ring-2 ring-blue-500 ring-offset-1' : 'hover:scale-110')} style={{ backgroundColor: `${cat.colorHex}20`, color: cat.colorHex }}>
                        {cat.icon ? <CategoryIcon iconName={cat.icon} size={16} /> : <span className="text-xs font-bold">{cat.name.charAt(0)}</span>}
                     </div>
                     <span className="text-sm font-bold text-slate-800">{cat.name}</span>
                   </div>
                   <div className="flex items-center gap-3 pl-2">
                     <span className="text-sm font-bold text-slate-900">{formatCurrency(cat.spent)}</span>
                     <button onClick={() => setExpandedCategory(isExpanded ? null : cat.id!)} className="p-1 hover:bg-slate-100 rounded-md" title={isExpanded ? "Recolher detalhes" : "Ver detalhes"}>
                       {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                     </button>
                   </div>
                 </div>
                 {cat.hasLimit ? (
                   <>
                     <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                       <div 
                         className={`absolute left-0 top-0 h-full rounded-full transition-all ${isOverLimit ? 'bg-red-500' : 'bg-blue-500'}`} 
                         style={{ width: `${Math.min(percent, 100)}%`, backgroundColor: !isOverLimit ? cat.colorHex : undefined }}
                       ></div>
                     </div>
                     <p className="text-[10px] text-slate-400 font-medium mt-1 text-right">Limite: {formatCurrency(cat.limit)}</p>
                   </>
                 ) : (
                   <p className="text-[10px] text-slate-400 font-medium text-right">Sem limite definido</p>
                 )}
                 
                 {isExpanded && (
                   <div className="mt-4 pl-11 pr-2 border-l-2 border-slate-100 ml-4 overflow-x-auto">
                     {catTransactions.length > 0 ? (
                       <table className="w-full text-left text-xs text-slate-600 border-collapse">
                         <thead>
                           <tr className="border-b border-slate-200">
                             <th className="pb-2 font-bold text-slate-700">Título</th>
                             <th className="pb-2 font-bold text-slate-700">Vencimento</th>
                             <th className="pb-2 font-bold text-slate-700">Pagamento</th>
                             <th className="pb-2 font-bold text-slate-700">Valor</th>
                             <th className="pb-2 font-bold text-slate-700 text-right">Status</th>
                           </tr>
                         </thead>
                         <tbody>
                           {catTransactions.map(t => {
                             const isLate = t.status === 'PENDING' && isBefore(getJSDate(t.dueDate), now);
                             const statusText = t.status === 'PAID' ? 'Paga' : (isLate ? 'Vencida' : 'Pendente');
                             const statusColor = t.status === 'PAID' ? 'text-emerald-600 bg-emerald-50' : (isLate ? 'text-red-600 bg-red-50' : 'text-amber-600 bg-amber-50');
                             return (
                               <tr key={t.id} className="border-b border-slate-50 hover:bg-slate-50/50">
                                 <td className="py-2 pr-2 font-medium">{t.title}</td>
                                 <td className="py-2 pr-2">{format(getJSDate(t.dueDate), 'dd/MM/yyyy')}</td>
                                 <td className="py-2 pr-2">{t.paymentDate ? format(getJSDate(t.paymentDate), 'dd/MM/yyyy') : '-'}</td>
                                 <td className="py-2 pr-2 font-bold text-slate-800">{formatCurrency(t.amount)}</td>
                                 <td className="py-2 text-right">
                                   <span className={`inline-block px-2 py-0.5 rounded font-medium text-[10px] uppercase tracking-wider ${statusColor}`}>
                                     {statusText}
                                   </span>
                                 </td>
                               </tr>
                             );
                           })}
                         </tbody>
                       </table>
                     ) : (
                       <p className="text-xs text-slate-400">Nenhum lançamento.</p>
                     )}
                   </div>
                 )}
               </div>
             )
          })}
        </div>
      </div>

      {/* Custos Fixos vs Variáveis & Lançamentos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col h-fit">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">CUSTOS FIXOS VS VARIÁVEIS</h3>
          
          <div className="h-10 w-full flex rounded-xl overflow-hidden mt-2 mb-6 shadow-inner">
             <div 
               className={twMerge("h-full bg-blue-500 transition-all cursor-pointer hover:brightness-110", isFilterActive('FIXED') ? 'brightness-125' : '')} 
               style={{ width: `${totalFilteredDespesas > 0 ? (fixos/totalFilteredDespesas)*100 : 50}%`}}
               onClick={() => toggleFilter('FIXED')}
               title="Filtrar Custos Fixos"
             ></div>
             <div 
               className={twMerge("h-full bg-teal-500 transition-all cursor-pointer hover:brightness-110", isFilterActive('VARIABLE') ? 'brightness-125' : '')} 
               style={{ width: `${totalFilteredDespesas > 0 ? (variaveis/totalFilteredDespesas)*100 : 50}%`}}
               onClick={() => toggleFilter('VARIABLE')}
               title="Filtrar Custos Variáveis"
             ></div>
          </div>
          <div className="flex justify-between mt-auto">
            <div className={twMerge("flex flex-col p-2 -ml-2 rounded-lg cursor-pointer transition-colors hover:bg-blue-50", isFilterActive('FIXED') ? 'bg-blue-50 ring-1 ring-blue-500' : '')} onClick={() => toggleFilter('FIXED')}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs font-medium text-slate-500">Fixas (Recorrentes)</span>
              </div>
              <span className="text-base font-bold text-slate-900">{formatCurrency(fixos)}</span>
            </div>
            <div className={twMerge("flex flex-col items-end p-2 -mr-2 rounded-lg cursor-pointer transition-colors hover:bg-teal-50", isFilterActive('VARIABLE') ? 'bg-teal-50 ring-1 ring-teal-500' : '')} onClick={() => toggleFilter('VARIABLE')}>
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                <span className="text-xs font-medium text-slate-500">Variáveis</span>
              </div>
              <span className="text-base font-bold text-slate-900">{formatCurrency(variaveis)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col max-h-96">
          <div className="flex justify-between items-center mb-4">
             <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider">LANÇAMENTOS</h3>
             {activeFilter && <span className="text-[10px] bg-slate-100 text-slate-500 px-2 py-0.5 rounded font-bold uppercase tracking-wider">Filtrados</span>}
          </div>
          <div className="overflow-y-auto pr-2 space-y-4 flex-1">
            {lancamentos.length === 0 ? (
               <p className="text-sm text-slate-500 text-center py-4">Nenhum lançamento.</p>
            ) : (
              lancamentos.map(acc => {
                const dt = getJSDate(acc.dueDate);
                const isPaid = isAccountPaid(acc);
                const isLate = isAccountLate(acc);
                let color = 'bg-slate-300';
                if (isPaid) color = 'bg-emerald-500';
                else if (isLate) color = 'bg-red-500';
                else color = 'bg-amber-500';
                return (
                  <div key={acc.id} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={`w-2.5 h-2.5 rounded-full ${color}`}></div>
                      <span className="text-xs font-bold text-slate-500 w-10">{format(dt, 'dd/MM')}</span>
                      <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]" title={acc.title}>{acc.title}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(acc.amount)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>
      </>
      )}

      {/* Mecanismo com Página de Impressão de Relatórios */}
      {isPrintModalOpen && (
        <ReportPrintModal
          isOpen={isPrintModalOpen}
          onClose={() => setIsPrintModalOpen(false)}
          allAccounts={accounts}
          allIncomes={incomes}
          categories={categories}
          initialSelectedDate={selectedDate}
          initialIsAllMonths={isAllMonths}
          initialCategoryId={activeFilter?.type === 'CATEGORY' ? activeFilter.value : undefined}
          initialStatusFilter={activeFilter?.type === 'PAID' ? 'PAID' : activeFilter?.type === 'OVERDUE' ? 'LATE' : activeFilter?.type === 'UPCOMING' ? 'PENDING' : 'ALL'}
        />
      )}
    </div>
  );
}
