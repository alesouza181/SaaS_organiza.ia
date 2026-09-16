
import React, { useState, useMemo } from 'react';
import { useIncomes } from '../hooks/useData';

import { Plus, ArrowDownRight, Trash2, Edit2, X } from 'lucide-react';
import { useDate } from '../contexts/DateContext';
import { formatFriendlyDate } from '../utils/dateFormatter';
import { db } from '../firebaseConfig';
import { collection, doc, writeBatch, Timestamp, query, where, getDocs } from 'firebase/firestore';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { Income } from '../types';

export function IncomeManagementScreen({ userId }: { userId: string }) {
  const { startDate, endDate } = useDate();
  const { incomes } = useIncomes(userId, startDate, endDate);
  const { upsertData, deleteData } = useFirestoreSync();
  const [showAddModal, setShowAddModal] = useState(false);
  const totalIncomes = useMemo(() => incomes.reduce((acc, inc) => acc + (inc.amount || 0), 0), [incomes]);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const [source, setSource] = useState('');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState('');
  const [isRecurring, setIsRecurring] = useState(false);

  const [editingIncome, setEditingIncome] = useState<Income | null>(null);
  const [applyToAll, setApplyToAll] = useState(false);

  const [deleteIncome, setDeleteIncome] = useState<Income | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };


  const resetForm = () => {
    setSource('');
    setAmount('');
    setDate('');
    setIsRecurring(false);
    setEditingIncome(null);
    setApplyToAll(false);
  };

  const openAddModal = () => {
    resetForm();
    setDate(new Date().toISOString().split('T')[0]);
    setShowAddModal(true);
  };

  const openEditModal = (income: Income) => {
    resetForm();
    setEditingIncome(income);
    setSource(income.source);
    setAmount(income.amount.toString());
    
    let incDate: Date;
    if (typeof income.date.toDate === 'function') {
      incDate = income.date.toDate();
    } else if ((income.date as any).seconds) {
      incDate = new Date((income.date as any).seconds * 1000);
    } else {
      incDate = new Date();
    }
    setDate(incDate.toISOString().split('T')[0]);
    
    setIsRecurring(income.isRecurring);
    setShowAddModal(true);
  };

  const getMonthlyOccurrenceDate = (baseDate: Date, monthOffset: number): Date => {
    const targetDay = baseDate.getDate();
    const year = baseDate.getFullYear();
    const month = baseDate.getMonth() + monthOffset;
    
    const target = new Date(year, month, 1, 12, 0, 0);
    const daysInTargetMonth = new Date(target.getFullYear(), target.getMonth() + 1, 0).getDate();
    target.setDate(Math.min(targetDay, daysInTargetMonth));
    return target;
  };

  const handleAddIncome = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!source || !amount || !date) return;
    setIsSubmitting(true);
    
    try {
      const baseDate = new Date(date + 'T12:00:00');
      const baseAmount = parseFloat(amount);
      
      if (editingIncome) {
        const existingGroupId = editingIncome.groupId;

        if (isRecurring) {
          if (!existingGroupId) {
            // Turning single income into recurring: create groupId and launch next 11 months
            const newGroupId = `rec_inc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const batch = writeBatch(db);

            const currentDocRef = doc(db, `users/${userId}/incomes`, editingIncome.id!);
            batch.update(currentDocRef, {
              source,
              amount: baseAmount,
              date: Timestamp.fromDate(baseDate),
              isRecurring: true,
              groupId: newGroupId,
              lastSyncTimestamp: Date.now()
            });

            for (let i = 1; i < 12; i++) {
              const installmentDate = getMonthlyOccurrenceDate(baseDate, i);
              const newDocRef = doc(collection(db, `users/${userId}/incomes`));
              batch.set(newDocRef, {
                id: newDocRef.id,
                source,
                amount: baseAmount,
                date: Timestamp.fromDate(installmentDate),
                isRecurring: true,
                groupId: newGroupId,
                userId,
                lastSyncTimestamp: Date.now()
              });
            }

            await batch.commit();
            alert('Receita atualizada e lançada para os próximos 12 meses com sucesso!');
          } else {
            if (applyToAll) {
              const q = query(
                collection(db, `users/${userId}/incomes`),
                where("groupId", "==", existingGroupId)
              );
              const snapshot = await getDocs(q);
              const batch = writeBatch(db);
              snapshot.forEach(docSnap => {
                batch.update(docSnap.ref, {
                  source,
                  amount: baseAmount,
                  isRecurring: true,
                  lastSyncTimestamp: Date.now()
                });
              });
              
              const currentDocRef = doc(db, `users/${userId}/incomes`, editingIncome.id!);
              batch.update(currentDocRef, {
                date: Timestamp.fromDate(baseDate)
              });
              
              await batch.commit();
              alert('Receita e ocorrências futuras atualizadas com sucesso!');
            } else {
              await upsertData('incomes', editingIncome.id!, {
                source,
                amount: baseAmount,
                date: Timestamp.fromDate(baseDate),
                isRecurring: true,
                groupId: existingGroupId,
                lastSyncTimestamp: Date.now()
              });
              alert('Receita atualizada com sucesso!');
            }
          }
        } else {
          // isRecurring is false
          if (applyToAll && existingGroupId) {
            const q = query(
              collection(db, `users/${userId}/incomes`),
              where("groupId", "==", existingGroupId)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach(docSnap => {
              batch.update(docSnap.ref, {
                source,
                amount: baseAmount,
                isRecurring: false,
                lastSyncTimestamp: Date.now()
              });
            });
            await batch.commit();
            alert('Receita e ocorrências futuras atualizadas com sucesso!');
          } else {
            await upsertData('incomes', editingIncome.id!, {
              source,
              amount: baseAmount,
              date: Timestamp.fromDate(baseDate),
              isRecurring: false,
              lastSyncTimestamp: Date.now()
            });
            alert('Receita atualizada com sucesso!');
          }
        }
      } else {
        if (isRecurring) {
          const batch = writeBatch(db);
          const groupId = `rec_inc_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
          
          for (let i = 0; i < 12; i++) {
            const installmentDate = getMonthlyOccurrenceDate(baseDate, i);
            const newDocRef = doc(collection(db, `users/${userId}/incomes`));
            batch.set(newDocRef, {
              id: newDocRef.id,
              source,
              amount: baseAmount,
              date: Timestamp.fromDate(installmentDate),
              isRecurring: true,
              groupId,
              userId,
              lastSyncTimestamp: Date.now()
            });
          }
          await batch.commit();
          alert('Receita mensal recorrente lançada para os próximos 12 meses com sucesso!');
        } else {
          await upsertData('incomes', null, {
            source,
            amount: baseAmount,
            date: Timestamp.fromDate(baseDate),
            isRecurring: false,
            userId,
            lastSyncTimestamp: Date.now()
          });
          alert('Receita adicionada com sucesso!');
        }
      }
      
      setShowAddModal(false);
      resetForm();
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar receita.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const confirmDelete = async (deleteAll: boolean) => {
    if (!deleteIncome) return;
    setIsSubmitting(true);
    try {
      if (deleteAll && deleteIncome.groupId) {
        const q = query(
          collection(db, `users/${userId}/incomes`),
          where("groupId", "==", deleteIncome.groupId)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      } else {
        await deleteData('incomes', deleteIncome.id!);
      }
      setDeleteIncome(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir receita.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">      
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6">
        <div>
          <h2 className="text-xl font-semibold text-slate-900">Entradas Financeiras</h2>
          <p className="text-sm text-slate-500">Acompanhe suas receitas do mês</p>
        </div>
        <div className="flex items-center gap-4 w-full sm:w-auto">
          <div className="bg-emerald-50 border border-emerald-100 px-4 py-2 rounded-lg flex items-center gap-3 flex-1 sm:flex-none">
             <div className="bg-emerald-100 p-1.5 rounded-md hidden sm:block">
                <ArrowDownRight className="w-4 h-4 text-emerald-600" />
             </div>
             <div>
                <p className="text-[10px] uppercase font-semibold text-emerald-600 tracking-wider">Total de Receitas</p>
                <p className="text-lg font-bold text-emerald-700 font-mono leading-none mt-0.5">{formatCurrency(totalIncomes)}</p>
             </div>
          </div>
          <button onClick={openAddModal} className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 whitespace-nowrap">
            <Plus className="w-4 h-4" />
            Nova Receita
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-md shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <ArrowDownRight className="w-5 h-5 text-emerald-600" /> {editingIncome ? 'Editar Receita' : 'Nova Receita'}
              </h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            
            <form onSubmit={handleAddIncome} className="p-4 overflow-y-auto space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Origem / Fonte</label>
                <input required type="text" value={source} onChange={(e) => setSource(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" placeholder="Ex: Salário, Freelance" />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor Recebido (R$)</label>
                  <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" placeholder="Ex: 5000.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Data</label>
                  <input required type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" />
                </div>
              </div>

              {!editingIncome && (
                <div className="flex items-center mt-2 p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <input type="checkbox" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-slate-300 bg-white text-emerald-600 focus:ring-emerald-600" />
                    <span className="text-sm font-medium text-slate-700">Receita Fixa Mensal</span>
                  </label>
                </div>
              )}

              {editingIncome && editingIncome.groupId && (
                <div className="flex items-center mt-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <label className="flex items-center gap-2 cursor-pointer w-full">
                    <input type="checkbox" checked={applyToAll} onChange={(e) => setApplyToAll(e.target.checked)} className="rounded border-blue-300 bg-white text-blue-600 focus:ring-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Aplicar alterações a todas as recorrências</span>
                  </label>
                </div>
              )}
              
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button disabled={isSubmitting} type="submit" className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Salvando...' : 'Salvar'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Dialog */}
      {deleteIncome && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-50 p-4 backdrop-blur-sm">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-xl overflow-hidden flex flex-col">
            <div className="p-6 pb-0 flex justify-center">
              <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
            </div>
            <div className="p-6">
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Excluir Receita</h3>
              <p className="text-sm text-slate-600 text-center mb-6">
                Deseja realmente excluir <span className="font-semibold text-slate-800">'{deleteIncome.source}'</span>? Esta ação não pode ser desfeita.
              </p>

              {deleteIncome.groupId ? (
                <div className="space-y-3">
                  <button onClick={() => confirmDelete(false)} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Apenas Esta
                  </button>
                  <button onClick={() => confirmDelete(true)} disabled={isSubmitting} className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Todas as Recorrências
                  </button>
                  <button onClick={() => setDeleteIncome(null)} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setDeleteIncome(null)} className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Cancelar
                  </button>
                  <button onClick={() => confirmDelete(false)} disabled={isSubmitting} className="flex-1 bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Excluir
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl shadow-md overflow-hidden">
        <div className="p-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Detalhamento de Entradas</h3>
        </div>

        {/* Desktop Table View */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-left text-sm border-collapse">
            <thead className="bg-slate-100 text-slate-500 text-xs uppercase">
              <tr>
                <th className="px-6 py-3 font-medium">Origem</th>
                <th className="px-6 py-3 font-medium">Data</th>
                <th className="px-6 py-3 font-medium">Tipo</th>
                <th className="px-6 py-3 font-medium text-right">Valor</th>
                <th className="px-6 py-3 font-medium text-center">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {incomes.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-slate-500">
                    Nenhuma receita encontrada neste período.
                  </td>
                </tr>
              ) : (
                incomes.sort((a, b) => {
                  const msA = typeof a.date.toMillis === 'function' ? a.date.toMillis() : (a.date as any).seconds * 1000;
                  const msB = typeof b.date.toMillis === 'function' ? b.date.toMillis() : (b.date as any).seconds * 1000;
                  return msB - msA;
                }).map((income) => (
                  <tr key={income.id} className="hover:bg-slate-50 transition-colors">
                    <td className="px-6 py-4 font-medium text-slate-700">{income.source}</td>
                    <td className="px-6 py-4 text-slate-600 font-mono">{formatFriendlyDate(income.date)}</td>
                    <td className="px-6 py-4">
                      {income.isRecurring ? (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-blue-50 text-blue-600 border border-blue-200">
                          Fixa Mensal
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-medium bg-slate-100 text-slate-500 border border-slate-200">
                          Única
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-right font-medium text-emerald-600 font-mono">
                      {formatCurrency(income.amount)}
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="flex items-center justify-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(income)}
                          disabled={isSubmitting}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleteIncome(income)}
                          disabled={isSubmitting}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Mobile View Card List */}
        <div className="block md:hidden divide-y divide-slate-100">
          {incomes.length === 0 ? (
            <div className="p-6 text-center text-slate-500 text-sm">
              Nenhuma receita encontrada neste período.
            </div>
          ) : (
            incomes.sort((a, b) => {
              const msA = typeof a.date.toMillis === 'function' ? a.date.toMillis() : (a.date as any).seconds * 1000;
              const msB = typeof b.date.toMillis === 'function' ? b.date.toMillis() : (b.date as any).seconds * 1000;
              return msB - msA;
            }).map((income) => (
              <div key={income.id} className="p-4 flex flex-col gap-2 hover:bg-slate-50">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-medium text-slate-800 text-sm">{income.source}</span>
                    <div className="mt-1">
                      {income.isRecurring ? (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-blue-50 text-blue-600 border border-blue-100">
                          Fixa Mensal
                        </span>
                      ) : (
                        <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-medium bg-slate-100 text-slate-500 border border-slate-150">
                          Única
                        </span>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-col items-end">
                    <span className="font-mono font-bold text-emerald-600 text-sm whitespace-nowrap">
                      {formatCurrency(income.amount)}
                    </span>
                    <span className="text-[11px] text-slate-400 font-mono mt-1">
                      {formatFriendlyDate(income.date)}
                    </span>
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-2 border-t border-dashed border-slate-100 mt-1">
                  <button
                    type="button"
                    onClick={() => openEditModal(income)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-blue-600 rounded text-xs font-medium transition-colors"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteIncome(income)}
                    disabled={isSubmitting}
                    className="flex items-center gap-1.5 px-3 py-1 bg-slate-100 text-slate-700 hover:bg-slate-200 hover:text-red-600 rounded text-xs font-medium transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" /> Excluir
                  </button>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
