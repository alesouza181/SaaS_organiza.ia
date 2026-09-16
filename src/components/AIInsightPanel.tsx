import React, { useState, useEffect } from 'react';
import { AccountPayable, Income, Category } from '../types';
import { Bot, RefreshCw, TrendingUp, TrendingDown, Target, Zap } from 'lucide-react';
const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};

interface AIInsightPanelProps {
  accounts: AccountPayable[];
  incomes: Income[];
  categories: (Category & { spent: number; limit: number })[];
  totalDespesas: number;
  totalRenda: number;
}

export function AIInsightPanel({ accounts, incomes, categories, totalDespesas, totalRenda }: AIInsightPanelProps) {
  const [loading, setLoading] = useState(false);
  const [data, setData] = useState<{ score: number, insight: string } | null>(null);

  const computeFallbackInsights = () => {
    const commitPercentage = totalRenda > 0 ? Math.round((totalDespesas / totalRenda) * 100) : (totalDespesas > 0 ? 100 : 0);
    const overdueCount = accounts.filter(a => a.status === 'PENDING' && a.dueDate && new Date(a.dueDate.seconds * 1000) < new Date()).length;
    
    let calculatedScore = 100;
    if (commitPercentage > 100) calculatedScore -= 40;
    else if (commitPercentage > 80) calculatedScore -= 25;
    else if (commitPercentage > 60) calculatedScore -= 10;
    
    calculatedScore -= Math.min(30, overdueCount * 10);
    calculatedScore = Math.max(10, Math.min(100, calculatedScore));
    
    let insightText = '';
    if (overdueCount > 0) {
      insightText = `Atenção: você possui ${overdueCount} conta${overdueCount > 1 ? 's' : ''} em atraso. Priorize a quitação para evitar multas e juros.`;
    } else if (commitPercentage >= 90) {
      insightText = `Seus gastos já comprometeram ${commitPercentage}% da sua renda. Considere reduzir despesas variáveis.`;
    } else if (commitPercentage <= 60 && totalRenda > 0) {
      insightText = `Excelente ritmo financeiro! Você comprometeu apenas ${commitPercentage}% da sua renda até agora.`;
    } else {
      insightText = 'Suas finanças estão estáveis. Continue acompanhando seus limites por categoria para fechar o mês no azul.';
    }
    
    return { score: calculatedScore, insight: insightText };
  };

  const fetchInsights = async () => {
    setLoading(true);
    try {
      const prompt = `Gere o painel de insights da aba Visão IA para a vida financeira atual do usuário. 
Aja como um analista experiente.
Calcule um "score" financeiro de 0 a 100 baseado na proporção de gastos vs renda, contas atrasadas, e limites ultrapassados. 
Crie uma dica "insight" curta, direta, inteligente e personalizada baseada nos maiores gastos.
Retorne APENAS um JSON no formato: {"score": número de 0 a 100, "insight": "Sua dica aqui"}. Não use markdown nem blocos de código. Apenas o texto JSON.`;
      
      const context = {
        totalDespesas,
        totalRenda,
        gastosPorCategoria: categories.map(c => ({ nome: c.name, gasto: c.spent, limite: c.limit > 0 ? c.limit : 'Sem limite' })),
        contasAtrasadas: accounts.filter(a => a.status === 'PENDING' && a.dueDate && new Date(a.dueDate.seconds * 1000) < new Date()).length
      };

      const res = await fetch('/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: prompt, context })
      });
      
      if (!res.ok) {
        throw new Error(`API returned status ${res.status}`);
      }

      const json = await res.json();
      let reply = json?.reply;
      
      if (typeof reply === 'string') {
        let cleanReply = reply.trim();
        if (cleanReply.startsWith('```json')) {
          cleanReply = cleanReply.replace(/^```json/i, '').replace(/```$/i, '').trim();
        } else if (cleanReply.startsWith('```')) {
          cleanReply = cleanReply.replace(/^```/i, '').replace(/```$/i, '').trim();
        }
        
        try {
          const parsed = JSON.parse(cleanReply);
          if (parsed && typeof parsed.score === 'number' && typeof parsed.insight === 'string') {
            setData(parsed);
            return;
          }
        } catch {
          if (cleanReply) {
            const fallback = computeFallbackInsights();
            setData({ score: fallback.score, insight: cleanReply });
            return;
          }
        }
      }
      
      // Fallback if reply is missing or not parseable
      setData(computeFallbackInsights());
    } catch (err) {
      console.warn('AI insight fetch fallback:', err);
      setData(computeFallbackInsights());
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInsights();
  }, [totalDespesas, totalRenda]); // Refetch if main numbers change significantly

  const score = data?.score || 0;
  let scoreColor = 'text-blue-500';
  let scoreBg = 'bg-blue-50';
  if (score >= 80) { scoreColor = 'text-emerald-500'; scoreBg = 'bg-emerald-50'; }
  else if (score < 50) { scoreColor = 'text-red-500'; scoreBg = 'bg-red-50'; }
  else if (score < 80) { scoreColor = 'text-amber-500'; scoreBg = 'bg-amber-50'; }

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
      
      {/* Score Circular */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col items-center justify-center relative md:col-span-1">
        <h3 className="text-sm font-bold text-slate-700 uppercase tracking-wider mb-6 self-start w-full text-center">Score Financeiro</h3>
        
        {loading ? (
          <div className="h-32 w-32 flex items-center justify-center">
            <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
          </div>
        ) : (
          <div className="relative w-32 h-32 flex items-center justify-center">
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 36 36">
              <path
                className="text-slate-100"
                strokeWidth="3"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
              <path
                className={scoreColor}
                strokeWidth="3"
                strokeDasharray={`${score}, 100`}
                strokeLinecap="round"
                stroke="currentColor"
                fill="none"
                d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831"
              />
            </svg>
            <div className="absolute flex flex-col items-center">
              <span className={`text-3xl font-bold ${scoreColor}`}>{score}</span>
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">/ 100</span>
            </div>
          </div>
        )}
        <p className="text-xs text-slate-500 text-center mt-6 max-w-[200px]">
          Baseado no comprometimento da sua renda e pagamentos em dia.
        </p>
      </div>

      {/* Insight Text */}
      <div className="bg-gradient-to-br from-indigo-500 to-purple-600 rounded-xl p-6 shadow-sm flex flex-col md:col-span-2 text-white">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Bot className="w-5 h-5 text-purple-200" />
            <h3 className="text-sm font-bold text-white uppercase tracking-wider">Insight da IA</h3>
          </div>
          <button 
            onClick={fetchInsights} 
            disabled={loading}
            className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
          >
            <RefreshCw className={`w-4 h-4 text-white ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
        
        {loading ? (
          <div className="flex-1 flex flex-col justify-center items-center opacity-70">
            <div className="flex gap-1 mb-2">
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
              <div className="w-2 h-2 bg-white rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
            <p className="text-sm">Analisando seus dados...</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col justify-center">
            <p className="text-lg font-medium leading-relaxed">
              {data?.insight || "Tudo parece em ordem com suas finanças no momento!"}
            </p>
          </div>
        )}
        
        <div className="mt-6 pt-4 border-t border-white/20 grid grid-cols-2 gap-4">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/10 rounded-lg">
               <Target className="w-4 h-4 text-purple-200" />
             </div>
             <div>
               <p className="text-xs text-purple-200 uppercase font-bold">Renda</p>
               <p className="text-sm font-bold">{formatCurrency(totalRenda)}</p>
             </div>
          </div>
          <div className="flex items-center gap-3">
             <div className="p-2 bg-white/10 rounded-lg">
               <Zap className="w-4 h-4 text-purple-200" />
             </div>
             <div>
               <p className="text-xs text-purple-200 uppercase font-bold">Despesas</p>
               <p className="text-sm font-bold">{formatCurrency(totalDespesas)}</p>
             </div>
          </div>
        </div>
      </div>

    </div>
  );
}
