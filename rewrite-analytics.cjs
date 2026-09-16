const fs = require('fs');

const content = `
import React, { useState, useRef, useMemo } from 'react';
import { 
  ResponsiveContainer, PieChart, Pie, Cell, BarChart, Bar, 
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, 
  ComposedChart, Line
} from 'recharts';
import { Download, Printer, TrendingUp, ChevronDown, ChevronUp, FileText } from 'lucide-react';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { format, subMonths, isSameMonth, addDays, isBefore } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { useDate } from '../contexts/DateContext';
import { AccountPayable, Income, Category } from '../types';

interface AnalyticsScreenProps {
  userId: string;
}

export function AnalyticsScreen({ userId }: AnalyticsScreenProps) {
  const chartRef = useRef<HTMLDivElement>(null);
  
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
    if (isAllMonths) return accounts;
    return accounts.filter(acc => {
      const d = getJSDate(acc.dueDate);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [accounts, currentMonth, currentYear, isAllMonths]);

  const currentMonthIncomes = useMemo(() => {
    if (isAllMonths) return incomes;
    return incomes.filter(inc => {
      const d = getJSDate(inc.date);
      return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
    });
  }, [incomes, currentMonth, currentYear, isAllMonths]);

  // KPIs
  const totalDespesas = currentMonthAccounts.reduce((acc, curr) => acc + curr.amount, 0);
  const totalRenda = currentMonthIncomes.reduce((acc, curr) => acc + curr.amount, 0);
  
  const contasPagas = currentMonthAccounts.filter(acc => acc.status === 'PAID').reduce((acc, curr) => acc + curr.amount, 0);
  
  const now = new Date();
  const next5Days = addDays(now, 5);
  
  const vencidas = currentMonthAccounts.filter(acc => acc.status === 'PENDING' && isBefore(getJSDate(acc.dueDate), now)).reduce((acc, curr) => acc + curr.amount, 0);
  
  const proximos5Dias = currentMonthAccounts.filter(acc => {
    if (acc.status !== 'PENDING') return false;
    const d = getJSDate(acc.dueDate);
    return d >= now && d <= next5Days;
  }).reduce((acc, curr) => acc + curr.amount, 0);

  const saldoRestante = totalRenda - contasPagas - currentMonthAccounts.filter(a => a.status === 'PENDING').reduce((acc, curr) => acc + curr.amount, 0);

  // Gauge (Saúde do Caixa)
  const comprometimento = totalRenda > 0 ? (totalDespesas / totalRenda) * 100 : 0;
  const isDeficit = comprometimento > 100;
  
  const gaugeData = [
    { name: 'Comprometido', value: Math.min(comprometimento, 100), fill: isDeficit ? '#ef4444' : '#3b82f6' },
    { name: 'Livre', value: Math.max(100 - comprometimento, 0), fill: '#f1f5f9' }
  ];

  // Donut (Status)
  const aVencer = currentMonthAccounts.filter(acc => acc.status === 'PENDING' && !isBefore(getJSDate(acc.dueDate), now)).reduce((acc, curr) => acc + curr.amount, 0);
  const donutData = [
    { name: 'Pagas', value: contasPagas, color: '#10b981' }, // emerald-500
    { name: 'Vencidas', value: vencidas, color: '#ef4444' }, // red-500
    { name: 'A Vencer', value: aVencer, color: '#f59e0b' }, // amber-500
  ].filter(d => d.value > 0);
  if (donutData.length === 0) donutData.push({ name: 'Vazio', value: 1, color: '#e2e8f0' });

  // Evolução Mensal (Últimos 6 meses)
  const evolutionData = useMemo(() => {
    const data = [];
    for (let i = 5; i >= 0; i--) {
      const d = subMonths(now, i);
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
        name: format(d, 'MMM', { locale: ptBR }).toUpperCase(),
        month: m,
        year: y,
        Despesas: despesas,
        Receitas: rendas
      });
    }
    return data;
  }, [accounts, incomes]);

  const handleBarClick = (data: any) => {
    if (data && data.activePayload && data.activePayload.length > 0) {
      const payload = data.activePayload[0].payload;
      const newDate = new Date(payload.year, payload.month, 1);
      setSelectedDate(newDate);
      setIsAllMonths(false);
    }
  };

  // Gastos por Categoria
  const categoryData = useMemo(() => {
    return categories.map(cat => {
      const spent = currentMonthAccounts
        .filter(acc => acc.categoryId === cat.id)
        .reduce((sum, acc) => sum + acc.amount, 0);
      return {
        ...cat,
        spent,
        limit: cat.maxLimit || 0
      };
    }).filter(c => c.spent > 0 || c.limit > 0)
    .sort((a, b) => b.spent - a.spent);
  }, [categories, currentMonthAccounts]);

  // Fixos vs Variáveis
  const fixos = currentMonthAccounts.filter(a => a.isRecurring).reduce((acc, curr) => acc + curr.amount, 0);
  const variaveis = totalDespesas - fixos;

  // Lançamentos do Mês
  const lancamentos = [...currentMonthAccounts].sort((a, b) => getJSDate(a.dueDate).getTime() - getJSDate(b.dueDate).getTime());

  // PDF Export
  const handleExportPDF = async () => {
    if (!chartRef.current) return;
    try {
      const canvas = await html2canvas(chartRef.current, { backgroundColor: '#f8fafc' });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
      
      pdf.setFontSize(16);
      pdf.text('Relatório Financeiro', 15, 15);
      pdf.addImage(imgData, 'PNG', 0, 25, pdfWidth, pdfHeight);
      pdf.save('relatorio-financeiro.pdf');
    } catch (err) {
      console.error('Failed to export PDF', err);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl mx-auto pb-10" ref={chartRef}>
      
      {/* Header Export */}
      <div className="flex justify-end mb-4">
        <button onClick={handleExportPDF} className="bg-slate-800 hover:bg-slate-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
          <FileText className="w-4 h-4" />
          Gerar PDF
        </button>
      </div>

      {/* Grid de Métricas Rápidas */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">TOTAL DO MÊS</span>
          <span className="text-xl font-bold text-blue-600 mt-2">{formatCurrency(totalDespesas)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">CONTAS PAGAS</span>
          <span className="text-xl font-bold text-emerald-500 mt-2">{formatCurrency(contasPagas)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <div className="flex justify-between items-start">
             <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">VENCIDAS</span>
             <span className="text-[10px] bg-red-50 text-red-600 px-1.5 py-0.5 rounded font-medium">{currentMonthAccounts.filter(a => a.status === 'PENDING' && isBefore(getJSDate(a.dueDate), now)).length} itens</span>
          </div>
          <span className="text-xl font-bold text-red-500 mt-2">{formatCurrency(vencidas)}</span>
        </div>
        <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col justify-between">
          <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">PRÓXIMOS 5 DIAS</span>
          <span className="text-xl font-bold text-amber-500 mt-2">{formatCurrency(proximos5Dias)}</span>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-sm">
        <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">SALDO RESTANTE ESTIMADO</span>
        <div className="text-2xl font-bold mt-1 text-slate-800">
          {saldoRestante < 0 ? '-' : ''}{formatCurrency(Math.abs(saldoRestante))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Saúde do Caixa e Metas */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">SAÚDE DO CAIXA E METAS</h3>
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
              {/* Pointer placeholder */}
              <div className="absolute bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2 w-4 h-4 bg-slate-800 rounded-full border-4 border-white shadow-md z-10"></div>
              <div 
                className="absolute bottom-0 left-1/2 h-[50px] w-1 bg-slate-800 origin-bottom rounded-full z-0 transition-transform duration-1000 ease-out" 
                style={{ transform: \`translateX(-50%) rotate(\${-90 + (Math.min(comprometimento, 100) / 100) * 180}deg)\`}}
              ></div>
            </div>
            <div className="w-1/2 pl-6">
              <p className="text-xs text-slate-500 font-medium">Comprometimento</p>
              <p className={\`text-2xl font-bold \${isDeficit ? 'text-red-500' : 'text-slate-800'}\`}>{comprometimento.toFixed(0)}%</p>
              <p className="text-xs text-slate-500 mt-2">Renda: {formatCurrency(totalRenda)}</p>
              {isDeficit && <p className="text-xs font-bold text-red-500 mt-1">DÉFICIT DETECTADO!</p>}
            </div>
          </div>
        </div>

        {/* Saúde das Contas (Status) */}
        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-2">SAÚDE DAS CONTAS (STATUS)</h3>
          <div className="flex items-center flex-1">
            <div className="w-1/2 h-32 relative flex items-center justify-center">
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
                  >
                     {donutData.map((entry, index) => (
                      <Cell key={\`cell-\${index}\`} fill={entry.color} />
                    ))}
                  </Pie>
                  <RechartsTooltip formatter={(val: number) => formatCurrency(val)} />
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-bold text-slate-800">100%</span>
                <span className="text-[10px] font-bold text-slate-400 uppercase">TOTAL</span>
              </div>
            </div>
            <div className="w-1/2 pl-4 space-y-3">
               <div className="flex flex-col">
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-emerald-500"></div><span className="text-xs font-bold text-slate-600">Pagas</span></div>
                 <span className="text-sm font-medium text-slate-900 ml-4.5">{formatCurrency(contasPagas)}</span>
               </div>
               <div className="flex flex-col">
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-red-500"></div><span className="text-xs font-bold text-slate-600">Vencidas</span></div>
                 <span className="text-sm font-medium text-slate-900 ml-4.5">{formatCurrency(vencidas)}</span>
               </div>
               <div className="flex flex-col">
                 <div className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full bg-amber-500"></div><span className="text-xs font-bold text-slate-600">A Vencer</span></div>
                 <span className="text-sm font-medium text-slate-900 ml-4.5">{formatCurrency(aVencer)}</span>
               </div>
            </div>
          </div>
        </div>
      </div>

      {/* Evolução Mensal */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">EVOLUÇÃO MENSAL DE GASTOS</h3>
        <div className="h-48 w-full cursor-pointer">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={evolutionData} margin={{ top: 10, right: 0, left: -20, bottom: 0 }} onClick={handleBarClick}>
              <defs>
                <linearGradient id="colorBar" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#8b5cf6" stopOpacity={0.8}/>
                  <stop offset="100%" stopColor="#8b5cf6" stopOpacity={0.2}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
              <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#64748b', fontWeight: 700 }} dy={10} />
              <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 10, fill: '#cbd5e1' }} tickFormatter={(val) => \`R$ \${val}\`} />
              <RechartsTooltip 
                cursor={{ fill: '#f8fafc' }}
                contentStyle={{ borderRadius: '8px', border: 'none', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                formatter={(val: number) => formatCurrency(val)}
              />
              <Bar dataKey="Despesas" fill="url(#colorBar)" radius={[6, 6, 0, 0]} maxBarSize={40} />
              <Line type="monotone" dataKey="Receitas" stroke="#3b82f6" strokeWidth={3} dot={{ r: 4, fill: '#3b82f6', stroke: '#fff', strokeWidth: 2 }} activeDot={{ r: 6 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Gastos por Categoria */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6">GASTOS POR CATEGORIA</h3>
        <div className="space-y-6">
          {categoryData.length === 0 ? (
            <p className="text-sm text-slate-500 text-center py-4">Nenhum gasto registrado neste período.</p>
          ) : categoryData.map(cat => {
             const percent = cat.limit > 0 ? (cat.spent / cat.limit) * 100 : 0;
             const isOverLimit = percent > 100;
             const isExpanded = expandedCategory === cat.id;
             const catTransactions = currentMonthAccounts.filter(a => a.categoryId === cat.id).sort((a,b) => b.amount - a.amount);
             
             return (
               <div key={cat.id} className="group">
                 <div 
                   className="flex justify-between items-center mb-2 cursor-pointer"
                   onClick={() => setExpandedCategory(isExpanded ? null : cat.id!)}
                 >
                   <div className="flex items-center gap-3">
                     <div className="w-8 h-8 rounded-full flex items-center justify-center opacity-80" style={{ backgroundColor: \`\${cat.colorHex}20\`, color: cat.colorHex }}>
                        {/* Fake icon based on name or first letter */}
                        <span className="text-xs font-bold">{cat.name.charAt(0)}</span>
                     </div>
                     <span className="text-sm font-bold text-slate-800">{cat.name}</span>
                   </div>
                   <div className="flex items-center gap-2">
                     <span className="text-sm font-bold text-slate-900">{formatCurrency(cat.spent)}</span>
                     {isExpanded ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
                   </div>
                 </div>
                 <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden relative">
                   <div 
                     className={\`absolute left-0 top-0 h-full rounded-full transition-all \${isOverLimit ? 'bg-red-500' : 'bg-blue-500'}\`} 
                     style={{ width: \`\${Math.min(percent, 100)}%\`, backgroundColor: !isOverLimit ? cat.colorHex : undefined }}
                   ></div>
                 </div>
                 {cat.limit > 0 && (
                   <p className="text-[10px] text-slate-400 font-medium mt-1 text-right">Limite: {formatCurrency(cat.limit)}</p>
                 )}
                 
                 {isExpanded && (
                   <div className="mt-4 pl-11 pr-2 space-y-3 border-l-2 border-slate-100 ml-4">
                     {catTransactions.slice(0, 5).map(t => (
                       <div key={t.id} className="flex justify-between items-center">
                         <span className="text-xs font-medium text-slate-600">{t.title}</span>
                         <span className="text-xs font-bold text-slate-800">{formatCurrency(t.amount)}</span>
                       </div>
                     ))}
                     {catTransactions.length === 0 && <p className="text-xs text-slate-400">Nenhum lançamento.</p>}
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
          
          <div className="h-10 w-full flex rounded-xl overflow-hidden mt-2 mb-6">
             <div className="h-full bg-blue-500 transition-all" style={{ width: \`\${totalDespesas > 0 ? (fixos/totalDespesas)*100 : 50}%\`}}></div>
             <div className="h-full bg-teal-500 transition-all" style={{ width: \`\${totalDespesas > 0 ? (variaveis/totalDespesas)*100 : 50}%\`}}></div>
          </div>

          <div className="flex justify-between mt-auto">
            <div className="flex flex-col">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-blue-500"></div>
                <span className="text-xs font-medium text-slate-500">Fixas (Recorrentes)</span>
              </div>
              <span className="text-base font-bold text-slate-900">{formatCurrency(fixos)}</span>
            </div>
            <div className="flex flex-col items-end">
              <div className="flex items-center gap-2 mb-1">
                <div className="w-3 h-3 rounded-full bg-teal-500"></div>
                <span className="text-xs font-medium text-slate-500">Variáveis</span>
              </div>
              <span className="text-base font-bold text-slate-900">{formatCurrency(variaveis)}</span>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col max-h-96">
          <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-4">LANÇAMENTOS POR DATA</h3>
          <div className="overflow-y-auto pr-2 space-y-4 flex-1">
            {lancamentos.length === 0 ? (
               <p className="text-sm text-slate-500 text-center py-4">Nenhum lançamento.</p>
            ) : (
              lancamentos.map(acc => {
                const dt = getJSDate(acc.dueDate);
                const isPaid = acc.status === 'PAID';
                const isLate = acc.status === 'PENDING' && isBefore(dt, now);
                let color = 'bg-slate-300';
                if (isPaid) color = 'bg-emerald-500';
                else if (isLate) color = 'bg-red-500';
                else color = 'bg-amber-500';

                return (
                  <div key={acc.id} className="flex justify-between items-center py-1 border-b border-slate-50 last:border-0">
                    <div className="flex items-center gap-3">
                      <div className={\`w-2.5 h-2.5 rounded-full \${color}\`}></div>
                      <span className="text-xs font-bold text-slate-500 w-10">{format(dt, 'dd/MM')}</span>
                      <span className="text-sm font-bold text-slate-700 truncate max-w-[120px]">{acc.title}</span>
                    </div>
                    <span className="text-sm font-bold text-slate-900">{formatCurrency(acc.amount)}</span>
                  </div>
                )
              })
            )}
          </div>
        </div>
      </div>

    </div>
  );
}
`
fs.writeFileSync('src/components/AnalyticsScreen.tsx', content);
