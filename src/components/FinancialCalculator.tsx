import React, { useState, useEffect, useMemo } from 'react';
import { 
  Calculator, 
  Percent, 
  X, 
  Copy, 
  Check, 
  RotateCcw, 
  ArrowRight, 
  Divide, 
  Plus, 
  Minus, 
  TrendingUp, 
  Tag, 
  Users, 
  Clock, 
  History,
  Sparkles,
  ChevronDown
} from 'lucide-react';

export interface CalculationHistoryItem {
  id: string;
  expression: string;
  result: number;
  type?: 'basic' | 'interest' | 'discount' | 'split';
  timestamp: Date;
}

interface FinancialCalculatorProps {
  isOpen: boolean;
  onClose: () => void;
  initialBaseAmount?: number;
  initialMode?: 'basic' | 'interest' | 'discount' | 'split';
  onApplyInterest?: (amount: number) => void;
  onApplyDiscount?: (amount: number) => void;
  onApplyAmount?: (amount: number) => void;
  title?: string;
  isFloating?: boolean;
}

export function FinancialCalculator({
  isOpen,
  onClose,
  initialBaseAmount = 0,
  initialMode = 'basic',
  onApplyInterest,
  onApplyDiscount,
  onApplyAmount,
  title = 'Calculadora Financeira',
  isFloating = false,
}: FinancialCalculatorProps) {
  const [activeTab, setActiveTab] = useState<'basic' | 'interest' | 'discount' | 'split'>(initialMode);
  
  // Basic calc state
  const [displayValue, setDisplayValue] = useState<string>('0');
  const [expression, setExpression] = useState<string>('');
  const [hasCalculated, setHasCalculated] = useState<boolean>(false);
  const [copied, setCopied] = useState<boolean>(false);

  // Interest state
  const [interestBase, setInterestBase] = useState<string>(initialBaseAmount > 0 ? initialBaseAmount.toFixed(2) : '100.00');
  const [interestRate, setInterestRate] = useState<string>('2'); // 2%
  const [interestDays, setInterestDays] = useState<string>('0');
  const [dailyRate, setDailyRate] = useState<string>('0.033'); // ~1% per month
  const [fixedPenaltyRate, setFixedPenaltyRate] = useState<string>('2'); // 2% flat penalty

  // Discount state
  const [discountBase, setDiscountBase] = useState<string>(initialBaseAmount > 0 ? initialBaseAmount.toFixed(2) : '100.00');
  const [discountRate, setDiscountRate] = useState<string>('5'); // 5%
  const [discountNominal, setDiscountNominal] = useState<string>('');

  // Split state
  const [splitBase, setSplitBase] = useState<string>(initialBaseAmount > 0 ? initialBaseAmount.toFixed(2) : '100.00');
  const [splitCount, setSplitCount] = useState<number>(2);

  // History state
  const [history, setHistory] = useState<CalculationHistoryItem[]>([]);
  const [showHistory, setShowHistory] = useState<boolean>(false);

  // Synchronize initial base amount when it changes or modal opens
  useEffect(() => {
    if (initialBaseAmount > 0) {
      setInterestBase(initialBaseAmount.toFixed(2));
      setDiscountBase(initialBaseAmount.toFixed(2));
      setSplitBase(initialBaseAmount.toFixed(2));
      setDisplayValue(initialBaseAmount.toFixed(2));
    }
  }, [initialBaseAmount, isOpen]);

  useEffect(() => {
    setActiveTab(initialMode);
  }, [initialMode]);

  const formatBRL = (val: number) => {
    return new Intl.NumberFormat('pt-BR', {
      style: 'currency',
      currency: 'BRL',
    }).format(val);
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  // Safe parse helper
  const parseNum = (val: string | number | undefined): number => {
    if (typeof val === 'number') return isNaN(val) ? 0 : val;
    if (!val) return 0;
    const str = String(val).trim().replace(/\s/g, '').replace('R$', '').replace(',', '.');
    const num = parseFloat(str);
    return isNaN(num) ? 0 : num;
  };

  // Keypad actions for Basic Calculator
  const handleDigit = (digit: string) => {
    if (hasCalculated) {
      setDisplayValue(digit === '.' ? '0.' : digit);
      setExpression('');
      setHasCalculated(false);
      return;
    }

    if (digit === '.') {
      if (!displayValue.includes('.')) {
        setDisplayValue(prev => prev + '.');
      }
      return;
    }

    if (displayValue === '0') {
      setDisplayValue(digit);
    } else {
      setDisplayValue(prev => prev + digit);
    }
  };

  const handleOperator = (op: string) => {
    setHasCalculated(false);
    if (expression && !hasCalculated && displayValue === '') {
      setExpression(prev => prev.slice(0, -1) + ' ' + op + ' ');
      return;
    }
    setExpression(prev => (prev ? prev + ' ' + displayValue + ' ' + op : displayValue + ' ' + op));
    setDisplayValue('');
  };

  const handleClear = () => {
    setDisplayValue('0');
    setExpression('');
    setHasCalculated(false);
  };

  const handleBackspace = () => {
    if (hasCalculated) {
      handleClear();
      return;
    }
    if (displayValue.length <= 1) {
      setDisplayValue('0');
    } else {
      setDisplayValue(prev => prev.slice(0, -1));
    }
  };

  const handleToggleSign = () => {
    if (displayValue === '0') return;
    if (displayValue.startsWith('-')) {
      setDisplayValue(displayValue.slice(1));
    } else {
      setDisplayValue('-' + displayValue);
    }
  };

  const handleCalculate = () => {
    try {
      const fullExp = expression ? `${expression} ${displayValue}` : displayValue;
      if (!fullExp.trim()) return;

      // Tokenize and evaluate safely
      // Replace symbols
      let sanitized = fullExp
        .replace(/×/g, '*')
        .replace(/÷/g, '/')
        .replace(/,/g, '.');

      // Percentage calculation heuristic: e.g. "100 + 10%" -> "100 + (100 * 0.10)"
      // Or "200 - 5%" -> "200 - (200 * 0.05)"
      sanitized = sanitized.replace(/(\d+(\.\d+)?)\s*([\+\-])\s*(\d+(\.\d+)?)%/g, '($1 $3 ($1 * ($4 / 100)))');
      // Direct percentage e.g. "500 * 20%" -> "500 * 0.20"
      sanitized = sanitized.replace(/(\d+(\.\d+)?)%/g, '($1 / 100)');

      // Validate sanitized string only contains numbers and allowed operators
      if (!/^[0-9+\-*/().\s]+$/.test(sanitized)) {
        throw new Error('Expressão inválida');
      }

      // Safe evaluation using Function
      const result = Function(`'use strict'; return (${sanitized})`)();
      
      if (typeof result !== 'number' || isNaN(result) || !isFinite(result)) {
        setDisplayValue('Erro');
      } else {
        const rounded = Math.round(result * 100) / 100;
        setDisplayValue(String(rounded));
        setExpression('');
        setHasCalculated(true);

        // Add to history
        setHistory(prev => [
          {
            id: Math.random().toString(36).substring(2, 9),
            expression: fullExp,
            result: rounded,
            type: 'basic',
            timestamp: new Date(),
          },
          ...prev.slice(0, 19),
        ]);
      }
    } catch {
      setDisplayValue('Erro');
    }
  };

  // Interest calculations
  const interestCalculations = useMemo(() => {
    const base = parseNum(interestBase);
    const rate = parseNum(interestRate);
    const days = Math.max(0, parseInt(interestDays) || 0);
    const dRate = parseNum(dailyRate);
    const flatPenaltyRate = parseNum(fixedPenaltyRate);

    // Simple % mode
    const simpleInterestAmount = (base * rate) / 100;
    const simpleTotal = base + simpleInterestAmount;

    // Overdue/Days mode: Flat Penalty + (Days * daily rate)
    const flatPenaltyAmount = (base * flatPenaltyRate) / 100;
    const dailyMoraAmount = (base * (dRate / 100)) * days;
    const totalLateInterest = flatPenaltyAmount + dailyMoraAmount;
    const totalLatePayable = base + totalLateInterest;

    return {
      base,
      simpleInterestAmount,
      simpleTotal,
      days,
      flatPenaltyAmount,
      dailyMoraAmount,
      totalLateInterest,
      totalLatePayable,
    };
  }, [interestBase, interestRate, interestDays, dailyRate, fixedPenaltyRate]);

  // Discount calculations
  const discountCalculations = useMemo(() => {
    const base = parseNum(discountBase);
    const rate = parseNum(discountRate);
    const nominal = parseNum(discountNominal);

    let finalDiscount = 0;
    if (discountNominal !== '') {
      finalDiscount = nominal;
    } else {
      finalDiscount = (base * rate) / 100;
    }

    finalDiscount = Math.min(base, Math.max(0, finalDiscount));
    const finalAmount = Math.max(0, base - finalDiscount);
    const percentEffective = base > 0 ? (finalDiscount / base) * 100 : 0;

    return {
      base,
      discountAmount: finalDiscount,
      finalAmount,
      percentEffective,
    };
  }, [discountBase, discountRate, discountNominal]);

  // Split calculations
  const splitCalculations = useMemo(() => {
    const base = parseNum(splitBase);
    const count = Math.max(1, splitCount);
    const perShare = Math.floor((base / count) * 100) / 100;
    const remainder = Math.round((base - (perShare * count)) * 100) / 100;

    return {
      base,
      count,
      perShare,
      remainder,
      shares: Array.from({ length: count }, (_, i) => ({
        index: i + 1,
        amount: i === 0 ? perShare + remainder : perShare,
      })),
    };
  }, [splitBase, splitCount]);

  if (!isOpen) return null;

  return (
    <div 
      className={
        isFloating 
          ? "fixed inset-0 sm:inset-auto sm:bottom-6 sm:right-6 z-50 flex items-center justify-center sm:block" 
          : "fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-200"
      }
    >
      <div 
        className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[90vh]"
      >
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 text-emerald-400 flex items-center justify-center font-bold">
              <Calculator className="w-4 h-4" />
            </div>
            <div>
              <h3 className="font-bold text-sm tracking-tight leading-tight">{title}</h3>
              <p className="text-[11px] text-slate-400">Juros, descontos, divisões e contas rápidas</p>
            </div>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setShowHistory(!showHistory)}
              title="Histórico de Cálculos"
              className={`p-1.5 rounded-lg transition-colors cursor-pointer ${showHistory ? 'bg-emerald-500/20 text-emerald-400' : 'text-slate-400 hover:text-white hover:bg-slate-800'}`}
            >
              <History className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="grid grid-cols-4 bg-slate-100 p-1 border-b border-slate-200 text-xs font-semibold text-slate-600">
          <button
            onClick={() => setActiveTab('basic')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'basic' ? 'bg-white text-slate-900 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Calculator className="w-3.5 h-3.5 text-blue-500" />
            <span>Padrão</span>
          </button>
          <button
            onClick={() => setActiveTab('interest')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'interest' ? 'bg-white text-red-600 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <TrendingUp className="w-3.5 h-3.5 text-red-500" />
            <span>Juros</span>
          </button>
          <button
            onClick={() => setActiveTab('discount')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'discount' ? 'bg-white text-emerald-700 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Tag className="w-3.5 h-3.5 text-emerald-600" />
            <span>Desconto</span>
          </button>
          <button
            onClick={() => setActiveTab('split')}
            className={`py-2 rounded-lg transition-all flex items-center justify-center gap-1.5 cursor-pointer ${
              activeTab === 'split' ? 'bg-white text-indigo-700 shadow-xs font-bold' : 'hover:text-slate-900'
            }`}
          >
            <Users className="w-3.5 h-3.5 text-indigo-600" />
            <span>Rateio</span>
          </button>
        </div>

        {/* Content Body */}
        <div className="p-4 flex-1 overflow-y-auto space-y-4">
          
          {/* History Drawer if open */}
          {showHistory && (
            <div className="bg-slate-50 border border-slate-200 rounded-xl p-3 mb-3 animate-in slide-in-from-top-2 duration-150">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-bold text-slate-700 uppercase tracking-wider flex items-center gap-1">
                  <History className="w-3.5 h-3.5 text-slate-500" /> Histórico Recente
                </span>
                {history.length > 0 && (
                  <button 
                    onClick={() => setHistory([])}
                    className="text-[10px] text-slate-400 hover:text-red-500 font-medium cursor-pointer"
                  >
                    Limpar
                  </button>
                )}
              </div>
              {history.length === 0 ? (
                <p className="text-xs text-slate-400 py-3 text-center italic">Nenhum cálculo recente ainda.</p>
              ) : (
                <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                  {history.map((item) => (
                    <div 
                      key={item.id}
                      onClick={() => {
                        setDisplayValue(String(item.result));
                        setShowHistory(false);
                      }}
                      className="p-1.5 bg-white hover:bg-emerald-50 rounded-lg border border-slate-200/70 flex justify-between items-center text-xs cursor-pointer transition-colors"
                    >
                      <span className="text-slate-500 font-mono truncate max-w-[180px]">{item.expression}</span>
                      <span className="font-mono font-bold text-slate-800">={formatBRL(item.result)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 1: BASIC CALCULATOR */}
          {activeTab === 'basic' && (
            <div className="space-y-3">
              {/* Display Screen */}
              <div className="bg-slate-900 rounded-xl p-3.5 text-right border border-slate-800 shadow-inner">
                <div className="text-xs text-slate-400 font-mono h-4 truncate">
                  {expression || ' '}
                </div>
                <div className="text-2xl sm:text-3xl font-bold font-mono text-emerald-400 truncate tracking-tight mt-1 flex items-center justify-between">
                  <div className="flex items-center gap-1">
                    <button
                      onClick={() => copyToClipboard(displayValue)}
                      title="Copiar resultado"
                      className="text-slate-500 hover:text-white p-1 rounded transition-colors text-xs flex items-center gap-1 cursor-pointer"
                    >
                      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <span>{displayValue}</span>
                </div>
              </div>

              {/* Action Keypad */}
              <div className="grid grid-cols-4 gap-2 text-sm font-medium">
                {/* Row 1 */}
                <button 
                  onClick={handleClear} 
                  className="bg-red-50 hover:bg-red-100 text-red-600 font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  AC
                </button>
                <button 
                  onClick={handleBackspace} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  ⌫
                </button>
                <button 
                  onClick={() => handleOperator('%')} 
                  className="bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  %
                </button>
                <button 
                  onClick={() => handleOperator('÷')} 
                  className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-xl transition-colors cursor-pointer"
                >
                  ÷
                </button>

                {/* Row 2 */}
                <button onClick={() => handleDigit('7')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">7</button>
                <button onClick={() => handleDigit('8')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">8</button>
                <button onClick={() => handleDigit('9')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">9</button>
                <button onClick={() => handleOperator('×')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-xl transition-colors cursor-pointer">×</button>

                {/* Row 3 */}
                <button onClick={() => handleDigit('4')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">4</button>
                <button onClick={() => handleDigit('5')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">5</button>
                <button onClick={() => handleDigit('6')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">6</button>
                <button onClick={() => handleOperator('-')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-xl transition-colors cursor-pointer">-</button>

                {/* Row 4 */}
                <button onClick={() => handleDigit('1')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">1</button>
                <button onClick={() => handleDigit('2')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">2</button>
                <button onClick={() => handleDigit('3')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">3</button>
                <button onClick={() => handleOperator('+')} className="bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold py-3 rounded-xl transition-colors cursor-pointer">+</button>

                {/* Row 5 */}
                <button onClick={handleToggleSign} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">±</button>
                <button onClick={() => handleDigit('0')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">0</button>
                <button onClick={() => handleDigit('.')} className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-800 font-bold py-3 rounded-xl shadow-2xs transition-colors cursor-pointer">,</button>
                <button onClick={handleCalculate} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl shadow-sm transition-colors cursor-pointer text-lg">=</button>
              </div>

              {/* Direct Apply actions */}
              {(onApplyInterest || onApplyDiscount || onApplyAmount) && (
                <div className="pt-2 border-t border-slate-200 flex flex-wrap gap-2">
                  {onApplyInterest && (
                    <button
                      onClick={() => {
                        const val = parseNum(displayValue);
                        onApplyInterest(val);
                        onClose();
                      }}
                      className="flex-1 bg-red-50 hover:bg-red-100 text-red-700 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-red-200"
                    >
                      <TrendingUp className="w-3.5 h-3.5" />
                      Aplicar em Juros/Multa
                    </button>
                  )}
                  {onApplyDiscount && (
                    <button
                      onClick={() => {
                        const val = parseNum(displayValue);
                        onApplyDiscount(val);
                        onClose();
                      }}
                      className="flex-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer border border-emerald-200"
                    >
                      <Tag className="w-3.5 h-3.5" />
                      Aplicar em Desconto
                    </button>
                  )}
                  {onApplyAmount && (
                    <button
                      onClick={() => {
                        const val = parseNum(displayValue);
                        onApplyAmount(val);
                        onClose();
                      }}
                      className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-2 px-3 rounded-xl text-xs flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <Check className="w-3.5 h-3.5" />
                      Usar como Valor do Registro
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {/* TAB 2: INTEREST & PENALTY */}
          {activeTab === 'interest' && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valor Original da Fatura (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={interestBase}
                    onChange={e => setInterestBase(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="0,00"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-red-500 font-bold"
                  />
                </div>

                {/* Quick % Buttons */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Acréscimo Rápido (%)</label>
                    <span className="text-[11px] font-mono text-red-600 font-bold">+{interestRate}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['1', '2', '5', '10'].map(pct => (
                      <button
                        key={pct}
                        onClick={() => {
                          setInterestRate(pct);
                          setInterestDays('0');
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors cursor-pointer border ${
                          interestRate === pct && interestDays === '0'
                            ? 'bg-red-600 text-white border-red-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-red-50 hover:text-red-700'
                        }`}
                      >
                        +{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Overdue / Days calculation */}
                <div className="pt-3 border-t border-slate-200/80">
                  <div className="flex items-center gap-1.5 text-xs font-bold text-slate-700 mb-2">
                    <Clock className="w-3.5 h-3.5 text-amber-500" />
                    <span>Ou Calcular por Dias de Atraso</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Dias em Atraso</label>
                      <input
                        type="number"
                        min="0"
                        value={interestDays}
                        onChange={e => setInterestDays(e.target.value)}
                        placeholder="Ex: 5"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] text-slate-500 mb-1">Multa Fixa (%)</label>
                      <input
                        type="text"
                        value={fixedPenaltyRate}
                        onChange={e => setFixedPenaltyRate(e.target.value.replace(/[^0-9.,]/g, ''))}
                        placeholder="2.0"
                        className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-red-500"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {/* Result Summary Box */}
              <div className="bg-red-50/70 border border-red-200 rounded-xl p-3.5 space-y-2">
                {parseInt(interestDays) > 0 ? (
                  <>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Multa Fixa ({fixedPenaltyRate}%):</span>
                      <span className="font-mono font-medium text-red-600">+{formatBRL(interestCalculations.flatPenaltyAmount)}</span>
                    </div>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Juros Mora ({interestDays} dias × 0.033%/dia):</span>
                      <span className="font-mono font-medium text-red-600">+{formatBRL(interestCalculations.dailyMoraAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-red-200 text-sm">
                      <span className="font-bold text-red-900">Total de Juros/Multa:</span>
                      <span className="font-bold font-mono text-red-700 text-base">
                        +{formatBRL(interestCalculations.totalLateInterest)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                      <span>Novo Valor Final da Fatura:</span>
                      <span className="font-mono font-bold text-slate-800">{formatBRL(interestCalculations.totalLatePayable)}</span>
                    </div>
                  </>
                ) : (
                  <>
                    <div className="flex justify-between text-xs text-slate-600">
                      <span>Acréscimo de {interestRate}%:</span>
                      <span className="font-mono font-medium text-red-600">+{formatBRL(interestCalculations.simpleInterestAmount)}</span>
                    </div>
                    <div className="flex justify-between items-center pt-2 border-t border-red-200 text-sm">
                      <span className="font-bold text-red-900">Valor de Juros/Multa:</span>
                      <span className="font-bold font-mono text-red-700 text-base">
                        +{formatBRL(interestCalculations.simpleInterestAmount)}
                      </span>
                    </div>
                    <div className="flex justify-between items-center text-xs text-slate-500 pt-1">
                      <span>Novo Valor Final da Fatura:</span>
                      <span className="font-mono font-bold text-slate-800">{formatBRL(interestCalculations.simpleTotal)}</span>
                    </div>
                  </>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => {
                    const finalJuros = parseInt(interestDays) > 0 
                      ? interestCalculations.totalLateInterest 
                      : interestCalculations.simpleInterestAmount;
                    copyToClipboard(finalJuros.toFixed(2));
                  }}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Juros
                </button>
                {onApplyInterest && (
                  <button
                    onClick={() => {
                      const finalJuros = parseInt(interestDays) > 0 
                        ? interestCalculations.totalLateInterest 
                        : interestCalculations.simpleInterestAmount;
                      onApplyInterest(finalJuros);
                      onClose();
                    }}
                    className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aplicar na Fatura
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 3: DISCOUNT */}
          {activeTab === 'discount' && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valor Original da Fatura (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountBase}
                    onChange={e => setDiscountBase(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="0,00"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-emerald-500 font-bold"
                  />
                </div>

                {/* Quick % Buttons */}
                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Desconto Rápido (%)</label>
                    <span className="text-[11px] font-mono text-emerald-600 font-bold">-{discountRate}%</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1.5">
                    {['2', '5', '7.5', '10'].map(pct => (
                      <button
                        key={pct}
                        onClick={() => {
                          setDiscountRate(pct);
                          setDiscountNominal('');
                        }}
                        className={`py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors cursor-pointer border ${
                          discountRate === pct && discountNominal === ''
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-emerald-50 hover:text-emerald-700'
                        }`}
                      >
                        -{pct}%
                      </button>
                    ))}
                  </div>
                </div>

                {/* Custom nominal discount */}
                <div className="pt-3 border-t border-slate-200/80">
                  <label className="block text-[11px] text-slate-500 mb-1">Ou Digitar Desconto Fixo em Reais (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={discountNominal}
                    onChange={e => setDiscountNominal(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="Ex: 15,00"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                  />
                </div>
              </div>

              {/* Result Summary Box */}
              <div className="bg-emerald-50/70 border border-emerald-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between text-xs text-slate-600">
                  <span>Percentual Efetivo:</span>
                  <span className="font-mono font-medium text-emerald-700">{discountCalculations.percentEffective.toFixed(1)}% de economia</span>
                </div>
                <div className="flex justify-between items-center pt-2 border-t border-emerald-200 text-sm">
                  <span className="font-bold text-emerald-900">Economia / Desconto:</span>
                  <span className="font-bold font-mono text-emerald-700 text-base">
                    -{formatBRL(discountCalculations.discountAmount)}
                  </span>
                </div>
                <div className="flex justify-between items-center text-xs text-slate-600 pt-1">
                  <span className="font-medium">Valor Líquido a Pagar:</span>
                  <span className="font-mono font-bold text-slate-900 text-sm">{formatBRL(discountCalculations.finalAmount)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(discountCalculations.discountAmount.toFixed(2))}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Desconto
                </button>
                {onApplyDiscount && (
                  <button
                    onClick={() => {
                      onApplyDiscount(discountCalculations.discountAmount);
                      onClose();
                    }}
                    className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Aplicar na Fatura
                  </button>
                )}
              </div>
            </div>
          )}

          {/* TAB 4: SPLIT & INSTALLMENTS */}
          {activeTab === 'split' && (
            <div className="space-y-4">
              <div className="space-y-3 bg-slate-50 p-3.5 rounded-xl border border-slate-200">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Valor Total a Dividir (R$)</label>
                  <input
                    type="text"
                    inputMode="decimal"
                    value={splitBase}
                    onChange={e => setSplitBase(e.target.value.replace(/[^0-9.,]/g, ''))}
                    placeholder="0,00"
                    className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 font-mono text-sm focus:outline-none focus:border-indigo-500 font-bold"
                  />
                </div>

                <div>
                  <div className="flex justify-between items-center mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">Dividir por Quantas Pessoas/Parcelas?</label>
                    <span className="text-xs font-mono text-indigo-600 font-bold">{splitCount}x</span>
                  </div>
                  <div className="grid grid-cols-5 gap-1.5">
                    {[2, 3, 4, 5, 6].map(n => (
                      <button
                        key={n}
                        onClick={() => setSplitCount(n)}
                        className={`py-1.5 rounded-lg text-xs font-semibold font-mono transition-colors cursor-pointer border ${
                          splitCount === n
                            ? 'bg-indigo-600 text-white border-indigo-600'
                            : 'bg-white text-slate-700 border-slate-200 hover:bg-indigo-50 hover:text-indigo-700'
                        }`}
                      >
                        {n}x
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <input
                    type="range"
                    min="1"
                    max="24"
                    value={splitCount}
                    onChange={e => setSplitCount(parseInt(e.target.value))}
                    className="w-full accent-indigo-600 cursor-pointer"
                  />
                  <div className="flex justify-between text-[10px] text-slate-400 font-mono">
                    <span>1x</span>
                    <span>12x</span>
                    <span>24x</span>
                  </div>
                </div>
              </div>

              {/* Split Summary Box */}
              <div className="bg-indigo-50/70 border border-indigo-200 rounded-xl p-3.5 space-y-2">
                <div className="flex justify-between items-center">
                  <span className="text-xs font-bold text-indigo-900">Valor de Cada Parcela/Cota:</span>
                  <span className="font-bold font-mono text-indigo-700 text-lg">
                    {formatBRL(splitCalculations.perShare)}
                  </span>
                </div>
                {splitCalculations.remainder > 0 && (
                  <p className="text-[11px] text-indigo-600/80 leading-tight">
                    * 1ª cota fica em {formatBRL(splitCalculations.perShare + splitCalculations.remainder)} devido ao ajuste de centavos.
                  </p>
                )}
              </div>

              {/* Actions */}
              <div className="flex gap-2">
                <button
                  onClick={() => copyToClipboard(splitCalculations.perShare.toFixed(2))}
                  className="flex-1 bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors cursor-pointer"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  Copiar Cota ({formatBRL(splitCalculations.perShare)})
                </button>
                {onApplyAmount && (
                  <button
                    onClick={() => {
                      onApplyAmount(splitCalculations.perShare);
                      onClose();
                    }}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-colors shadow-xs cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Usar Parcela
                  </button>
                )}
              </div>
            </div>
          )}

        </div>

        {/* Footer info */}
        <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span className="flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-emerald-500" />
            Cálculos com arredondamento fiscal padrão
          </span>
          <button 
            onClick={onClose}
            className="text-slate-600 hover:text-slate-900 font-semibold cursor-pointer"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
}
