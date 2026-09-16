import React, { useState, useMemo } from 'react';
import { useCategories, useAccounts, useRollover } from '../hooks/useData';
import { useDate } from '../contexts/DateContext';
import { ChevronDown, ChevronRight, PieChart, AlertCircle, Plus, X, Utensils, Home, Car, Star, HeartPulse, Landmark, LayoutGrid, Folder, ShoppingCart, Zap, Smartphone, Edit2, Trash2 } from 'lucide-react';
import { Category, CategoryLimitType, AccountPayable } from '../types';
import clsx from 'clsx';
import { twMerge } from 'tailwind-merge';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { CategoryIcon, PREDEFINED_ICONS, PREDEFINED_COLORS } from './CategoryIcon';
import { createCategoryFolderInDrive } from '../services/googleDrive';

function cn(...inputs: (string | undefined | null | false)[]) {
  return twMerge(clsx(inputs));
}

interface CategoryScreenProps {
  userId: string;
}

export function CategoryScreen({ userId }: CategoryScreenProps) {
  const { startDate, endDate } = useDate();
  const { categories, loading: catLoading } = useCategories(userId);
  const { accounts, loading: accLoading } = useAccounts(userId, startDate, endDate);
  const { rolloverBonuses, loadingRollover } = useRollover(userId, startDate, categories);
  const { upsertData, deleteData, accounts: allAccounts } = useFirestoreSync();
  
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
  const [showModal, setShowModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  // New/Edit Category State
  const [name, setName] = useState('');
  const [colorHex, setColorHex] = useState('#10B981');
  const [icon, setIcon] = useState('folder');
  const [maxLimit, setMaxLimit] = useState('');
  const [limitType, setLimitType] = useState<CategoryLimitType>('MONTHLY');
  const [parentId, setParentId] = useState('');
  const [isRolloverEnabled, setIsRolloverEnabled] = useState(false);
  const [notes, setNotes] = useState('');

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const formatBRL = (val: number | null | undefined): string => {
    if (val === null || val === undefined || isNaN(val) || val === 0) return '';
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val);
  };

  const formatDigitsToBRL = (digits: string): string => {
    const clean = digits.replace(/\D/g, '');
    if (!clean) return '';
    const num = parseInt(clean, 10) / 100;
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(num);
  };

  const parseBRLToNumber = (val: string): number | null => {
    if (!val) return null;
    const clean = val.replace(/\D/g, '');
    if (!clean) return null;
    const num = parseInt(clean, 10) / 100;
    return isNaN(num) || num === 0 ? null : num;
  };

  const handleLimitChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    if (!raw) {
      setMaxLimit('');
      return;
    }
    setMaxLimit(formatDigitsToBRL(raw));
  };

  const handleEditCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (cat) {
      setName(cat.name);
      setColorHex(cat.colorHex);
      setIcon(cat.icon);

      const isNone = cat.limitType === 'NONE' || (!cat.maxLimit && cat.limitType !== 'TOTAL');
      if (isNone) {
        setMaxLimit('');
        setLimitType('NONE');
      } else {
        setMaxLimit(cat.maxLimit ? formatBRL(cat.maxLimit) : '');
        setLimitType(cat.limitType || 'MONTHLY');
      }

      setParentId(cat.parentId || '');
      setIsRolloverEnabled(cat.isRolloverEnabled || false);
      setNotes(cat.notes || '');
      setEditingCategoryId(categoryId);
      setShowModal(true);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Deseja realmente excluir esta categoria? As despesas associadas perderão a categoria.')) return;
    try {
      await deleteData('categories', categoryId);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir categoria.');
    }
  };

  const handleOpenNewModal = () => {
    setName('');
    setColorHex('#10B981');
    setIcon('folder');
    setMaxLimit('');
    setLimitType('MONTHLY');
    setParentId('');
    setIsRolloverEnabled(false);
    setNotes('');
    setEditingCategoryId(null);
    setShowModal(true);
  };

  const toggleCategory = (categoryId: string) => {
    const newExpanded = new Set(expandedCategories);
    if (newExpanded.has(categoryId)) {
      newExpanded.delete(categoryId);
    } else {
      newExpanded.add(categoryId);
    }
    setExpandedCategories(newExpanded);
  };

  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !colorHex) return;
    setIsSubmitting(true);
    try {
      const numericLimit = limitType === 'NONE' ? null : parseBRLToNumber(maxLimit);
      const finalLimitType: CategoryLimitType = limitType === 'NONE' || (!numericLimit && limitType !== 'TOTAL') ? 'NONE' : limitType;
      const finalMaxLimit = finalLimitType === 'NONE' ? null : numericLimit;

      await upsertData('categories', editingCategoryId, {
        name,
        colorHex,
        icon,
        maxLimit: finalMaxLimit,
        limitType: finalLimitType,
        parentId: parentId || null,
        isRolloverEnabled: finalLimitType === 'MONTHLY' ? isRolloverEnabled : false,
        notes: notes || null,
      });

      // Se for uma nova categoria, cria/garante a pasta da categoria no Google Drive
      if (!editingCategoryId) {
        createCategoryFolderInDrive(name).catch(console.warn);
      }

      setShowModal(false);
      setName('');
      setColorHex('#10B981');
      setIcon('folder');
      setMaxLimit('');
      setLimitType('MONTHLY');
      setParentId('');
      setIsRolloverEnabled(false);
      setNotes('');
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar categoria');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Build Hierarchy and calculate totals
  const categoryHierarchy = useMemo(() => {
    if (!categories.length) return [];

    // Map all categories for easy lookup and apply rollover
    const catMap = new Map<string, Category & { subcategories: any[], totalSpent: number, topExpenses: AccountPayable[], effectiveLimit: number | null, rolloverAdded: number }>();
    categories.forEach(c => {
      const isNoLimit = c.limitType === 'NONE' || c.maxLimit === null || c.maxLimit === undefined;
      const isTotalLimit = c.limitType === 'TOTAL';
      const rolloverAdded = (isTotalLimit || isNoLimit) ? 0 : (rolloverBonuses.get(c.id!) || 0);
      const baseLimit = isNoLimit ? null : (c.maxLimit || 0);
      catMap.set(c.id!, { 
        ...c, 
        subcategories: [], 
        totalSpent: 0, 
        topExpenses: [],
        effectiveLimit: baseLimit !== null ? (baseLimit + rolloverAdded) : null,
        rolloverAdded
      });
    });

    // Assign expenses to their specific categories
    accounts.forEach(acc => {
      if (acc.categoryId && catMap.has(acc.categoryId)) {
        const cat = catMap.get(acc.categoryId)!;
        cat.totalSpent += acc.amount;
        cat.topExpenses.push(acc);
      }
    });

    // Sort top expenses
    catMap.forEach(cat => {
      cat.topExpenses.sort((a, b) => b.amount - a.amount);
      cat.topExpenses = cat.topExpenses.slice(0, 3); // Keep only top 3
    });

    const roots: any[] = [];

    // Build tree
    catMap.forEach(cat => {
      if (cat.parentId && catMap.has(cat.parentId)) {
        catMap.get(cat.parentId)!.subcategories.push(cat);
      } else {
        roots.push(cat);
      }
    });

    // Bubble up totals from children to parents
    const calculateTotalRecursively = (cat: any) => {
      let subTotal = 0;
      cat.subcategories.forEach((sub: any) => {
        subTotal += calculateTotalRecursively(sub);
      });
      cat.totalSpent += subTotal;
      return cat.totalSpent;
    };

    roots.forEach(calculateTotalRecursively);

    return roots;
  }, [categories, accounts, rolloverBonuses]);

  if (catLoading || accLoading || loadingRollover) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-medium text-slate-900">Cockpit Orçamentário</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie seus limites e acompanhe gastos por categoria</p>
        </div>
        <button onClick={handleOpenNewModal} className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors">
          Nova Categoria
        </button>
      </div>

      <div className="grid grid-cols-1 gap-4">
        {categoryHierarchy.map(category => {
          const isExpanded = expandedCategories.has(category.id!);
          const hasLimit = category.limitType !== 'NONE' && category.effectiveLimit !== null && category.effectiveLimit > 0;
          const progressPercentage = hasLimit ? Math.min(100, (category.totalSpent / category.effectiveLimit!) * 100) : 0;
          const isOverLimit = hasLimit && category.totalSpent > category.effectiveLimit!;

          return (
            <div key={category.id} className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
              {/* Category Header */}
              <div 
                className={cn(
                  "p-4 flex items-center justify-between cursor-pointer hover:bg-slate-100 transition-colors",
                  isExpanded && "border-b border-slate-200"
                )}
                onClick={() => toggleCategory(category.id!)}
              >
                <div className="flex items-center gap-4 flex-1">
                  <div 
                    className="w-10 h-10 rounded-lg flex items-center justify-center font-bold text-lg"
                    style={{ backgroundColor: `${category.colorHex}20`, color: category.colorHex }}
                  >
                    {category.icon ? (
                      <CategoryIcon iconName={category.icon} size={20} />
                    ) : (
                      category.name.charAt(0).toUpperCase()
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-slate-900 font-medium">{category.name}</h3>
                      {!hasLimit ? (
                        <span className="text-[10px] bg-slate-100 text-slate-600 px-2 py-0.5 rounded font-semibold border border-slate-200" title="Categoria sem teto orçamentário">
                          SEM LIMITE
                        </span>
                      ) : category.limitType === 'TOTAL' ? (
                        <span className="text-[10px] bg-purple-100 text-purple-700 px-2 py-0.5 rounded font-semibold border border-purple-300" title="Limite Geral Acumulado (Meta Global)">
                          LIMITE GERAL
                        </span>
                      ) : (
                        category.isRolloverEnabled && (
                          <span className="text-[10px] bg-blue-100 text-blue-600 px-2 py-0.5 rounded font-semibold border border-blue-500/30" title={`+ ${formatCurrency(category.rolloverAdded)} do mês anterior`}>
                            ROLLOVER {category.rolloverAdded > 0 && `(+${formatCurrency(category.rolloverAdded)})`}
                          </span>
                        )
                      )}
                    </div>
                    {hasLimit ? (
                      <div className="flex items-center gap-2 mt-2">
                        <div className="flex-1 h-2 bg-slate-100 rounded-full overflow-hidden">
                          <div 
                            className={cn("h-full rounded-full transition-all", isOverLimit ? "bg-red-500" : "bg-emerald-500")}
                            style={{ width: `${progressPercentage}%`, backgroundColor: isOverLimit ? undefined : category.colorHex }}
                          />
                        </div>
                        <span className="text-xs font-mono text-slate-500 min-w-[40px] text-right">
                          {progressPercentage.toFixed(0)}%
                        </span>
                      </div>
                    ) : (
                      <p className="text-xs text-slate-400 mt-1 font-normal">Gastos livres (sem teto definido)</p>
                    )}
                  </div>
                </div>
                
                <div className="flex items-center gap-6 ml-6">
                  <div className="text-right">
                    <div className="text-sm font-medium text-slate-900 font-mono">
                      {formatCurrency(category.totalSpent)}{' '}
                      {hasLimit ? (
                        <span className="text-slate-500 font-normal">/ {formatCurrency(category.effectiveLimit!)}</span>
                      ) : (
                        <span className="text-slate-400 font-normal text-xs">/ Sem Limite</span>
                      )}
                    </div>
                    {isOverLimit && (
                      <p className="text-xs text-red-600 mt-0.5">Estourou o limite</p>
                    )}
                  </div>
                  <div className="text-slate-500">
                    {isExpanded ? <ChevronDown className="w-5 h-5" /> : <ChevronRight className="w-5 h-5" />}
                  </div>
                </div>
              </div>

              {/* Drill-down Content */}
              {isExpanded && (
                <div className="bg-slate-50/30 p-4">
                  {/* Subcategories */}
                  {category.subcategories.length > 0 && (
                    <div className="mb-6">
                      <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Subcategorias</h4>
                      <div className="space-y-3 pl-14">
                        {category.subcategories.map((sub: any) => {
                           const subHasLimit = sub.limitType !== 'NONE' && sub.maxLimit !== null && sub.maxLimit > 0;
                           const subProgress = subHasLimit ? Math.min(100, (sub.totalSpent / sub.maxLimit) * 100) : 0;
                           return (
                            <div key={sub.id} className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: sub.colorHex }}></div>
                                <span className="text-sm text-slate-600">{sub.name}</span>
                                {!subHasLimit && (
                                  <span className="text-[10px] text-slate-400 font-medium">(sem limite)</span>
                                )}
                              </div>
                              <div className="flex items-center gap-4">
                                {subHasLimit && (
                                  <div className="w-24 h-1.5 bg-slate-100 rounded-full overflow-hidden">
                                    <div className="h-full rounded-full" style={{ width: `${subProgress}%`, backgroundColor: sub.colorHex }} />
                                  </div>
                                )}
                                <span className="text-sm font-mono text-slate-600">{formatCurrency(sub.totalSpent)}</span>
                              </div>
                            </div>
                           )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Top Expenses */}
                  <div>
                    <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Maiores Gastos</h4>
                    {category.topExpenses.length > 0 ? (
                      <div className="space-y-2 pl-14">
                        {category.topExpenses.map((expense: AccountPayable) => (
                          <div key={expense.id} className="flex justify-between items-center text-sm p-2 rounded-lg hover:bg-slate-100">
                            <span className="text-slate-600">{expense.title}</span>
                            <span className="font-mono text-slate-600">{formatCurrency(expense.amount)}</span>
                          </div>
                        ))}
                      </div>
                    ) : (
                      <p className="text-sm text-slate-500 pl-14">Nenhum gasto registrado nesta categoria.</p>
                    )}
                  </div>
                  <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-200">
                    <button onClick={(e) => { e.stopPropagation(); handleEditCategory(category.id!); }} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id!); }} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {categoryHierarchy.length === 0 && (
          <div className="text-center py-12 bg-white rounded-xl border border-slate-200">
            <PieChart className="w-12 h-12 text-slate-600 mx-auto mb-3" />
            <p className="text-slate-500">Nenhuma categoria encontrada.</p>
          </div>
        )}
      </div>

      {showModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <PieChart className="w-5 h-5 text-blue-600" /> {editingCategoryId ? "Editar Categoria" : "Nova Categoria"}
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleSaveCategory} className="p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Nome da Categoria</label>
                <input required type="text" value={name} onChange={e => setName(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="Ex: Alimentação" />
              </div>
              

              <div className="mt-6">
                <label className="block text-sm font-bold text-slate-700 mb-4">Selecione uma cor marcadora</label>
                <div className="flex flex-wrap gap-3 mb-8">
                  {PREDEFINED_COLORS.map(c => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setColorHex(c)}
                      className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${colorHex === c ? 'ring-2 ring-offset-2 ring-slate-800 scale-110' : 'hover:scale-110'}`}
                      style={{ backgroundColor: c }}
                    >
                      {colorHex === c && <div className="text-white"><CategoryIcon iconName="Check" size={20} /></div>}
                    </button>
                  ))}
                </div>

                <label className="block text-sm font-bold text-slate-700 mb-4">Selecione um ícone marcador</label>
                <div className="grid grid-cols-6 gap-3 sm:grid-cols-8 md:grid-cols-6 lg:grid-cols-8 mb-6">
                  {PREDEFINED_ICONS.map(ic => (
                    <button
                      key={ic}
                      type="button"
                      onClick={() => setIcon(ic)}
                      className={`aspect-square rounded-xl flex items-center justify-center transition-all ${icon === ic ? 'bg-blue-500 text-white shadow-md ring-2 ring-slate-800 ring-offset-2 scale-110' : 'bg-slate-100 text-slate-500 hover:bg-slate-200 hover:text-slate-700'}`}
                    >
                      <CategoryIcon iconName={ic} size={24} />
                    </button>
                  ))}
                </div>
              </div>

              {/* Limit Field with Currency format and Monthly vs General vs Sem Limite Toggle */}
              <div className="mt-4 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <label className="text-xs font-semibold text-slate-700">
                    {limitType === 'MONTHLY' ? 'Limite Mensal (Opcional)' : limitType === 'TOTAL' ? 'Limite Geral (Opcional)' : 'Sem Limite (Livre)'}
                  </label>
                  
                  {/* Selector Limite Mensal vs Limite Geral vs Sem Limite */}
                  <div className="inline-flex bg-slate-200/80 p-0.5 rounded-lg text-xs font-medium">
                    <button
                      type="button"
                      onClick={() => setLimitType('MONTHLY')}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        limitType === 'MONTHLY'
                          ? "bg-white text-blue-600 shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Limite Mensal
                    </button>
                    <button
                      type="button"
                      onClick={() => setLimitType('TOTAL')}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        limitType === 'TOTAL'
                          ? "bg-white text-blue-600 shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Limite Geral
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setLimitType('NONE');
                        setMaxLimit('');
                        setIsRolloverEnabled(false);
                      }}
                      className={cn(
                        "px-2.5 py-1 rounded-md transition-all",
                        limitType === 'NONE'
                          ? "bg-white text-blue-600 shadow-sm font-semibold"
                          : "text-slate-600 hover:text-slate-900"
                      )}
                    >
                      Sem Limite
                    </button>
                  </div>
                </div>

                {limitType === 'NONE' ? (
                  <div className="p-3 bg-white border border-dashed border-slate-300 rounded-lg flex items-center gap-3 text-slate-600">
                    <div className="w-8 h-8 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center text-slate-600 font-bold text-sm shrink-0">
                      ∞
                    </div>
                    <div className="text-xs">
                      <p className="font-semibold text-slate-800">Categoria Sem Limite</p>
                      <p className="text-slate-500 text-[11px] leading-tight">O sistema não contabilizará limite de gastos nem emitirá alertas para esta categoria.</p>
                    </div>
                  </div>
                ) : (
                  <div className="relative">
                    <input 
                      type="text" 
                      inputMode="numeric"
                      value={maxLimit} 
                      onChange={handleLimitChange} 
                      className="w-full bg-white border border-slate-300 rounded-lg px-3 py-2 text-slate-900 font-mono focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 text-sm" 
                      placeholder="R$ 0,00" 
                    />
                  </div>
                )}

                <p className="text-[11px] text-slate-500 leading-tight">
                  {limitType === 'MONTHLY' 
                    ? 'Define o teto de gastos que se renova a cada novo mês para esta categoria.' 
                    : limitType === 'TOTAL'
                      ? 'Define um teto de gastos global/acumulado (meta total) para esta categoria.'
                      : 'Os lançamentos e despesas desta categoria serão registrados normalmente sem teto orçamentário.'}
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Categoria Pai (Opcional)</label>
                <select value={parentId} onChange={e => setParentId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                  <option value="">Nenhuma (Categoria Principal)</option>
                  {categories.filter(c => !c.parentId).map(c => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>
              
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Informações Adicionais (Notas)</label>
                <textarea value={notes} onChange={e => setNotes(e.target.value)} rows={3} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm resize-none" placeholder="Ex: Conta corrente final 1234, faturamento automático..."></textarea>
              </div>

              <div className={cn(
                "flex items-start gap-3 mt-4 p-3 rounded-lg border transition-colors",
                limitType !== 'MONTHLY' 
                  ? "bg-slate-100/60 border-slate-200 opacity-60" 
                  : "bg-slate-50 border-slate-200/50"
              )}>
                <input 
                  type="checkbox" 
                  id="rollover" 
                  disabled={limitType !== 'MONTHLY'}
                  checked={limitType === 'MONTHLY' && isRolloverEnabled} 
                  onChange={e => setIsRolloverEnabled(e.target.checked)} 
                  className="mt-1 rounded border-slate-400 bg-white text-blue-500 disabled:cursor-not-allowed" 
                />
                <div className="flex-1">
                  <label htmlFor="rollover" className={cn("text-sm font-medium block", limitType !== 'MONTHLY' ? "text-slate-400" : "text-slate-600 cursor-pointer")}>
                    Habilitar Rollover (Acúmulo)
                  </label>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {limitType !== 'MONTHLY' 
                      ? 'Rollover só está disponível para categorias com Limite Mensal.' 
                      : 'Se o saldo no fim do mês for positivo, ele será somado ao limite do mês seguinte automaticamente.'}
                  </p>
                </div>
              </div>
            </form>
            
            <div className="p-4 border-t border-slate-200 flex justify-end gap-3 bg-slate-50">
              <button type="button" onClick={() => setShowModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-colors">
                Cancelar
              </button>
              <button onClick={handleSaveCategory} disabled={isSubmitting} className="bg-blue-600 hover:bg-blue-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                <Plus className="w-4 h-4" />
                {isSubmitting ? 'Salvando...' : (editingCategoryId ? 'Salvar Alterações' : 'Criar Categoria')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
