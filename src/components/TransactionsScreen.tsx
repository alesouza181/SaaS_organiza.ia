import { isAccountPaid, isAccountLate, isAccountPending, getAccountInterest, getAccountDiscount, getAccountPaidAmount, getEffectiveAccountAmount } from '../utils/accountStatus';
import React, { useState, useEffect } from 'react';
import { db, storage } from '../firebaseConfig';
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { collection, addDoc, Timestamp, writeBatch, doc, query, where, getDocs } from 'firebase/firestore';
import { useCategories, useAccounts, useIncomes } from '../hooks/useData';
import { useDate } from '../contexts/DateContext';
import { Receipt, Plus, ArrowUpRight, ArrowDownRight, CreditCard, FastForward, Trash2, Edit2, X, CheckCircle, FileText, ListChecks, CheckSquare, Calculator, RotateCcw } from 'lucide-react';
import { FinancialCalculator } from './FinancialCalculator';
import { ReceiptPreview } from './ReceiptPreview';
import { AccountPayable, Income } from '../types';
import { formatFriendlyDate } from '../utils/dateFormatter';
import { useFirestoreSync } from '../contexts/FinanceContext';
import { getDriveToken, requestDriveToken, uploadReceiptToGoogleDrive } from '../services/googleDrive';

export function TransactionsScreen({ userId }: { userId: string }) {
  const { startDate, endDate } = useDate();
  const { categories } = useCategories(userId);
  const { accounts } = useAccounts(userId, startDate, endDate);
  const { incomes } = useIncomes(userId, startDate, endDate);
  const { upsertData, deleteData, preferences, reopenAccount } = useFirestoreSync();

  const [showAddModal, setShowAddModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [reopenConfirmAccount, setReopenConfirmAccount] = useState<AccountPayable | null>(null);
  const [isReopening, setIsReopening] = useState(false);

  // Expense Form State
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [installments, setInstallments] = useState('1');
  const [customInstallments, setCustomInstallments] = useState<{date: string, amount: number}[]>([]);
  const [isCustomInstallments, setIsCustomInstallments] = useState(false);
  const [isRecurring, setIsRecurring] = useState(false);
  const [paymentMethod, setPaymentMethod] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');

  // Income Form State
  // Edit Modal State
  const [editingExpense, setEditingExpense] = useState<AccountPayable | null>(null);
  // Custom Dialog States
  const [deleteAccount, setDeleteAccount] = useState<AccountPayable | null>(null);
  
  const [paymentAccount, setPaymentAccount] = useState<AccountPayable | null>(null);
  const [viewAccount, setViewAccount] = useState<AccountPayable | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [payReceiptUrl, setPayReceiptUrl] = useState('');

  const [editTitle, setEditTitle] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editDate, setEditDate] = useState('');
  const [editCategoryId, setEditCategoryId] = useState('');
  const [applyToAll, setApplyToAll] = useState(false);

  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [driveConnected, setDriveConnected] = useState(!!getDriveToken());

  // Financial Calculator Modal State
  const [calculatorOpen, setCalculatorOpen] = useState(false);
  const [calcMode, setCalcMode] = useState<'basic' | 'interest' | 'discount' | 'split'>('basic');
  const [calcBaseAmount, setCalcBaseAmount] = useState<number>(0);
  const [calcTarget, setCalcTarget] = useState<'payment' | 'expense'>('payment');

  // Multi-selection state for pending bills
  const [selectedAccountIds, setSelectedAccountIds] = useState<Set<string>>(new Set());

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
  };

  const { totalSelecionado, selectedCount, pendingAccountsCount } = React.useMemo(() => {
    const pendingAccounts = accounts.filter(a => isAccountPending(a));
    const selectedAccounts = pendingAccounts.filter(a => a.id && selectedAccountIds.has(a.id));
    const sum = selectedAccounts.reduce((acc, curr) => acc + curr.amount, 0);
    return {
      totalSelecionado: sum,
      selectedCount: selectedAccounts.length,
      pendingAccountsCount: pendingAccounts.length
    };
  }, [accounts, selectedAccountIds]);

  useEffect(() => {
    const savedPaymentId = sessionStorage.getItem('transactions_pending_payment_id');
    if (savedPaymentId && accounts.length > 0) {
      const account = accounts.find(a => a.id === savedPaymentId);
      if (account) {
        setPaymentAccount(account);
      }
      sessionStorage.removeItem('transactions_pending_payment_id');
    }
  }, [accounts]);

  const handleFileUpload = async (
    e: React.ChangeEvent<HTMLInputElement>, 
    setUrl: React.Dispatch<React.SetStateAction<string>>,
    selectedCatId?: string
  ) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      alert('O arquivo deve ter no máximo 5MB.');
      return;
    }

    setUploadingReceipt(true);
    try {
      // Use payDate if liquidating, else use dueDate from form, else use current date
      const getDueDateString = (d: any) => d ? (typeof d === 'string' ? d : d.toDate ? d.toDate().toISOString().split('T')[0] : new Date(d).toISOString().split('T')[0]) : new Date().toISOString().split('T')[0];
      const dateString = payDate || dueDate || (paymentAccount ? getDueDateString(paymentAccount.dueDate) : new Date().toISOString().split('T')[0]);
      
      const effectiveCatId = selectedCatId || categoryId || editCategoryId || paymentAccount?.categoryId;
      const catName = categories.find(c => c.id === effectiveCatId)?.name || 'Geral';

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
        alert('Erro ao fazer upload do comprovante para o Google Drive. Verifique se os popups estão habilitados para autorizar o acesso.');
      }
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleAttachClick = async (e: React.MouseEvent<HTMLButtonElement>) => {
    e.preventDefault(); // Prevent form submission
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


  
    const resetForm = () => {
    setTitle(''); setAmount(''); setDueDate(''); setInstallments('1');
    setPaymentMethod(''); setReceiptUrl(''); setIsRecurring(false); setCategoryId(''); setIsCustomInstallments(false); setCustomInstallments([]);
    setEditingExpense(null);
    setApplyToAll(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };

  React.useEffect(() => {
    if (!isCustomInstallments) {
      const numInstallments = parseInt(installments) || 1;
      const baseAmount = parseFloat(amount) || 0;
      if (numInstallments > 1 && dueDate) {
        const baseDate = new Date(dueDate + 'T12:00:00');
        const list = [];
        for (let i = 0; i < numInstallments; i++) {
          const nextDate = new Date(baseDate);
          nextDate.setMonth(baseDate.getMonth() + i);
          list.push({
            date: nextDate.toISOString().split('T')[0],
            amount: baseAmount / numInstallments
          });
        }
        setCustomInstallments(list);
      } else {
        setCustomInstallments([]);
      }
    }
  }, [installments, amount, dueDate, isCustomInstallments]);

  const handleCustomInstallmentChange = (index: number, field: 'date' | 'amount', value: string) => {
    const updated = [...customInstallments];
    if (field === 'date') {
      updated[index].date = value;
    } else {
      updated[index].amount = parseFloat(value) || 0;
    }
    setCustomInstallments(updated);
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };

  const confirmDelete = async (deleteFuture: boolean) => {
    if (!deleteAccount) return;
    setIsSubmitting(true);
    try {
      if (deleteFuture && deleteAccount.groupId) {
        const q = query(
          collection(db, `users/${userId}/accounts_payable`),
          where('groupId', '==', deleteAccount.groupId),
          where('dueDate', '>=', deleteAccount.dueDate)
        );
        const snapshot = await getDocs(q);
        const batch = writeBatch(db);
        snapshot.forEach(docSnap => {
          batch.delete(docSnap.ref);
        });
        await batch.commit();
      } else {
        await deleteData('accounts_payable', deleteAccount.id!);
      }
      setDeleteAccount(null);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir despesa.');
    } finally {
      setIsSubmitting(false);
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
    sessionStorage.setItem('transactions_pending_payment_id', account.id!);
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
      sessionStorage.removeItem('transactions_pending_payment_id');
      alert('Pagamento registrado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteIncome = async (income: Income) => {
    if (!confirm('Deseja realmente excluir esta receita?')) return;
    setIsSubmitting(true);
    try {
      await deleteData('incomes', income.id!);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir receita.');
    } finally {
      setIsSubmitting(false);
    }
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

  const handleAddExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title || !amount || !dueDate) return;
    setIsSubmitting(true);
    try {
      const numInstallments = parseInt(installments) || 1;
      const baseAmount = parseFloat(amount);
      const baseDate = new Date(dueDate + 'T12:00:00');
      const rUrl = receiptUrl || null;
      const rType = rUrl ? (rUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE') : null;

      if (editingExpense) {
        const existingGroupId = editingExpense.groupId;

        if (isRecurring) {
          if (!existingGroupId) {
            // Transform single non-recurring expense into recurring: create groupId and launch next 11 months
            const newGroupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
            const batch = writeBatch(db);

            const currentDocRef = doc(db, `users/${userId}/accounts_payable`, editingExpense.id!);
            batch.update(currentDocRef, {
              title,
              amount: baseAmount,
              dueDate: Timestamp.fromDate(baseDate),
              categoryId,
              priority,
              paymentMethod,
              receiptUrl: rUrl,
              receiptType: rType,
              isRecurring: true,
              groupId: newGroupId,
              lastSyncTimestamp: Date.now()
            });

            for (let i = 1; i < 12; i++) {
              const nextDate = getMonthlyOccurrenceDate(baseDate, i);
              const newDocRef = doc(collection(db, `users/${userId}/accounts_payable`));
              batch.set(newDocRef, {
                id: newDocRef.id,
                title,
                amount: baseAmount,
                dueDate: Timestamp.fromDate(nextDate),
                categoryId,
                priority,
                paymentMethod,
                receiptUrl: null,
                receiptType: null,
                status: 'PENDING',
                isRecurring: true,
                groupId: newGroupId,
                userId,
                lastSyncTimestamp: Date.now()
              });
            }

            await batch.commit();
            alert('Despesa atualizada e lançada para os próximos 12 meses com sucesso!');
          } else {
            // Already has a groupId
            if (applyToAll) {
              const q = query(
                collection(db, `users/${userId}/accounts_payable`),
                where('groupId', '==', existingGroupId),
                where('status', '==', 'PENDING'),
                where('dueDate', '>=', editingExpense.dueDate)
              );
              const snapshot = await getDocs(q);
              const batch = writeBatch(db);

              snapshot.forEach(docSnap => {
                batch.update(docSnap.ref, {
                  title,
                  amount: baseAmount,
                  categoryId,
                  priority,
                  paymentMethod,
                  receiptUrl: docSnap.id === editingExpense.id ? rUrl : null,
                  receiptType: docSnap.id === editingExpense.id ? rType : null,
                  isRecurring: true,
                  lastSyncTimestamp: Date.now()
                });
              });

              // If only this single doc existed in the group, generate subsequent 11 months
              if (snapshot.size <= 1) {
                for (let i = 1; i < 12; i++) {
                  const nextDate = getMonthlyOccurrenceDate(baseDate, i);
                  const newDocRef = doc(collection(db, `users/${userId}/accounts_payable`));
                  batch.set(newDocRef, {
                    id: newDocRef.id,
                    title,
                    amount: baseAmount,
                    dueDate: Timestamp.fromDate(nextDate),
                    categoryId,
                    priority,
                    paymentMethod,
                    receiptUrl: null,
                    receiptType: null,
                    status: 'PENDING',
                    isRecurring: true,
                    groupId: existingGroupId,
                    userId,
                    lastSyncTimestamp: Date.now()
                  });
                }
              }

              await batch.commit();
              alert('Despesa e ocorrências futuras atualizadas com sucesso!');
            } else {
              await upsertData('accounts_payable', editingExpense.id!, {
                title,
                amount: baseAmount,
                dueDate: Timestamp.fromDate(baseDate),
                categoryId,
                priority,
                paymentMethod,
                receiptUrl: rUrl,
                receiptType: rType,
                isRecurring: true,
                groupId: existingGroupId,
                lastSyncTimestamp: Date.now()
              });
              alert('Despesa atualizada com sucesso!');
            }
          }
        } else {
          // isRecurring is false
          if (applyToAll && existingGroupId) {
            const q = query(
              collection(db, `users/${userId}/accounts_payable`),
              where('groupId', '==', existingGroupId),
              where('status', '==', 'PENDING'),
              where('dueDate', '>=', editingExpense.dueDate)
            );
            const snapshot = await getDocs(q);
            const batch = writeBatch(db);
            snapshot.forEach(docSnap => {
              batch.update(docSnap.ref, {
                title,
                amount: baseAmount,
                categoryId,
                priority,
                paymentMethod,
                receiptUrl: docSnap.id === editingExpense.id ? rUrl : null,
                receiptType: docSnap.id === editingExpense.id ? rType : null,
                isRecurring: false,
                lastSyncTimestamp: Date.now()
              });
            });
            await batch.commit();
            alert('Despesa e ocorrências futuras atualizadas com sucesso!');
          } else {
            await upsertData('accounts_payable', editingExpense.id!, {
              title,
              amount: baseAmount,
              dueDate: Timestamp.fromDate(baseDate),
              categoryId,
              priority,
              paymentMethod,
              receiptUrl: rUrl,
              receiptType: rType,
              isRecurring: false,
              lastSyncTimestamp: Date.now()
            });
            alert('Despesa atualizada com sucesso!');
          }
        }
      } else {
        // Adding new expense
        if (numInstallments > 1) {
          const batch = writeBatch(db);
          const groupId = `group_${Date.now()}_${Math.random().toString(36).substring(7)}`;
          
          for (let i = 0; i < numInstallments; i++) {
            let installmentDate, installmentAmount;
            if (customInstallments.length === numInstallments) {
              installmentDate = new Date(customInstallments[i].date + 'T12:00:00');
              installmentAmount = customInstallments[i].amount;
            } else {
              installmentDate = getMonthlyOccurrenceDate(baseDate, i);
              installmentAmount = baseAmount / numInstallments;
            }
            const newDocRef = doc(collection(db, `users/${userId}/accounts_payable`));
            batch.set(newDocRef, {
              id: newDocRef.id,
              title: `${title} (${i + 1}/${numInstallments})`,
              amount: installmentAmount,
              dueDate: Timestamp.fromDate(installmentDate),
              categoryId,
              priority,
              paymentMethod,
              receiptUrl: i === 0 ? rUrl : null,
              receiptType: i === 0 ? rType : null,
              status: 'PENDING',
              isRecurring,
              groupId,
              installmentCurrent: i + 1,
              installmentTotal: numInstallments,
              userId,
              lastSyncTimestamp: Date.now()
            });
          }
          await batch.commit();
          alert('Despesa parcelada adicionada com sucesso!');
        } else if (isRecurring) {
          // Recurring monthly expense: generate current month + next 11 months (12 occurrences total)
          const batch = writeBatch(db);
          const groupId = `rec_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

          for (let i = 0; i < 12; i++) {
            const installmentDate = getMonthlyOccurrenceDate(baseDate, i);
            const newDocRef = doc(collection(db, `users/${userId}/accounts_payable`));
            batch.set(newDocRef, {
              id: newDocRef.id,
              title,
              amount: baseAmount,
              dueDate: Timestamp.fromDate(installmentDate),
              categoryId,
              priority,
              paymentMethod,
              receiptUrl: i === 0 ? rUrl : null,
              receiptType: i === 0 ? rType : null,
              status: 'PENDING',
              isRecurring: true,
              groupId,
              userId,
              lastSyncTimestamp: Date.now()
            });
          }
          await batch.commit();
          alert('Despesa mensal recorrente lançada para os próximos 12 meses com sucesso!');
        } else {
          // Single non-recurring expense
          await upsertData('accounts_payable', null, {
            title,
            amount: baseAmount,
            dueDate: Timestamp.fromDate(baseDate),
            categoryId,
            priority,
            paymentMethod,
            receiptUrl: rUrl,
            receiptType: rType,
            status: 'PENDING',
            isRecurring: false,
            userId,
            lastSyncTimestamp: Date.now()
          });
          alert('Despesa adicionada com sucesso!');
        }
      }

      // Reset form
      setTitle(''); setAmount(''); setDueDate(''); setInstallments('1');
      setPaymentMethod(''); setReceiptUrl(''); setIsRecurring(false); setCategoryId(''); setIsCustomInstallments(false); setCustomInstallments([]);
      setEditingExpense(null);
      setApplyToAll(false);
      setShowAddModal(false);
    } catch (error) {
      console.error(error);
      alert('Erro ao salvar despesa.');
    } finally {
      setIsSubmitting(false);
    }
  };
  const handleEarlyPayoff = async (account: AccountPayable) => {
    if (!account.groupId) return;
    if (!confirm('Deseja quitar antecipadamente todas as parcelas futuras desta compra?')) return;

    setIsSubmitting(true);
    try {
      const q = query(
        collection(db, `users/${userId}/accounts_payable`),
        where('groupId', '==', account.groupId),
        where('status', '==', 'PENDING')
      );
      
      const snapshot = await getDocs(q);
      const batch = writeBatch(db);
      
      let totalRemaining = 0;
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        if (docSnap.id !== account.id) {
          totalRemaining += data.amount;
          batch.update(docSnap.ref, { 
            status: 'ANTECIPADA', 
            amount: 0 
          });
        }
      });

      // Update current account to sum the remaining and mark as PAID
      batch.update(doc(db, `users/${userId}/accounts_payable`, account.id!), {
        amount: account.amount + totalRemaining,
        status: 'PAID'
      });

      await batch.commit();
      alert('Quitação antecipada realizada com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao realizar quitação antecipada.');
    } finally {
      setIsSubmitting(false);
    }
  };

    const openEditModal = (account: AccountPayable) => {
    setEditingExpense(account);
    setTitle(account.title);
    setAmount(account.amount.toString());
    setDueDate(account.dueDate.toDate().toISOString().split('T')[0]);
    setCategoryId(account.categoryId || '');
    setPaymentMethod(account.paymentMethod || '');
    setReceiptUrl(account.receiptUrl || '');
    setPriority(account.priority || 'MEDIUM');
    setIsRecurring(account.isRecurring || false);
    setApplyToAll(false);
    setShowAddModal(true);
  };

  

  return (
    <div className="space-y-6">
      {/* Page Header */}
      
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Contas Lançadas</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas despesas e faturas</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setCalcBaseAmount(0);
              setCalcMode('basic');
              setCalcTarget('expense');
              setCalculatorOpen(true);
            }}
            className="bg-white hover:bg-slate-50 border border-slate-200 text-slate-700 px-3.5 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-2xs cursor-pointer"
            title="Abrir Calculadora Financeira"
          >
            <Calculator className="w-4 h-4 text-emerald-600" />
            <span>Calculadora</span>
          </button>
          <button onClick={() => handleOpenAddModal()} className="bg-red-600 hover:bg-red-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
            <Plus className="w-4 h-4" />
            Nova Despesa
          </button>
        </div>
      </div>

      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-xl w-full max-w-2xl shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <Receipt className="w-5 h-5 text-red-600" /> {editingExpense ? "Editar Despesa" : "Nova Despesa"}
              </h3>
              <button onClick={handleCloseAddModal} className="text-slate-500 hover:text-slate-900 transition-colors">
                <Plus className="w-5 h-5 rotate-45" />
              </button>
            </div>
            <div className="overflow-y-auto p-4">
              <form onSubmit={handleAddExpense} className="space-y-4">

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                  <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="Ex: Conta de Luz" />
                </div>
                <div>
                  <div className="flex justify-between items-center mb-1">
                    <label className="block text-xs font-medium text-slate-500">Valor Total (R$)</label>
                    <button
                      type="button"
                      onClick={() => {
                        const numeric = parseFloat(amount) || 0;
                        setCalcBaseAmount(numeric);
                        setCalcMode('split');
                        setCalcTarget('expense');
                        setCalculatorOpen(true);
                      }}
                      className="text-[11px] text-blue-600 hover:text-blue-800 font-medium flex items-center gap-1 cursor-pointer"
                      title="Calcular divisão, parcelas ou operações"
                    >
                      <Calculator className="w-3 h-3" />
                      Calculadora
                    </button>
                  </div>
                  <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm font-mono" placeholder="Ex: 150.00" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento (Primeira Parcela se houver)</label>
                  <input required type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                  <select required value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="">Selecione uma categoria...</option>
                    {categories.map(cat => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Prioridade</label>
                  <select value={priority} onChange={(e) => setPriority(e.target.value as any)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="LOW">Baixa</option>
                    <option value="MEDIUM">Média</option>
                    <option value="HIGH">Alta</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Método de Pagamento</label>
                  <select value={paymentMethod} onChange={(e) => setPaymentMethod(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="">Selecione...</option>
                    <option value="Pix">Pix</option>
                    <option value="Boleto">Boleto</option>
                    <option value="Cartão de Crédito">Cartão de Crédito</option>
                    <option value="Cartão de Débito">Cartão de Débito</option>
                    <option value="Dinheiro">Dinheiro</option>
                  </select>
                </div>
                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Comprovante (Opcional)</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      value={receiptUrl} 
                      onChange={(e) => setReceiptUrl(e.target.value)} 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" 
                      placeholder="Link do comprovante" 
                    />
                    {driveConnected ? (
                      <label className="flex items-center justify-center bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-3 py-2 cursor-pointer transition-colors whitespace-nowrap">
                        {uploadingReceipt ? (
                          <div className="animate-spin rounded-full h-4 w-4 border-2 border-slate-400 border-t-slate-600"></div>
                        ) : (
                          <span className="text-sm text-slate-600 font-medium flex items-center gap-1">
                            Anexar
                          </span>
                        )}
                        <input 
                          type="file" 
                          accept="image/*,.pdf" 
                          className="hidden" 
                          onChange={(e) => handleFileUpload(e, setReceiptUrl, categoryId)}
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
                  {receiptUrl && (
                    <div className="mt-2">
                      <ReceiptPreview
                        url={receiptUrl}
                        onRemove={() => setReceiptUrl('')}
                        className="h-44"
                      />
                    </div>
                  )}
                </div>
                
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Parcelas</label>
                  <input type="number" disabled={!!editingExpense} min="1" max="120" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="flex flex-col justify-center mt-2 md:mt-0">
                  <div className="flex items-center">
                    <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-slate-300 bg-white text-blue-600 focus:ring-blue-500 cursor-pointer w-4 h-4" />
                    <label htmlFor="recurring" className="ml-2 text-sm text-slate-700 font-medium cursor-pointer">Despesa Mensal Recorrente</label>
                  </div>
                  {isRecurring && (
                    <span className="text-[11px] text-blue-600 font-medium mt-1">
                      ✓ Lança automaticamente para os próximos 12 meses.
                    </span>
                  )}
                </div>

                {parseInt(installments) > 1 && customInstallments.length > 0 && (
                  <div className="col-span-1 md:col-span-2 mt-2 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="bg-slate-100 p-2 px-3 border-b border-slate-200 flex justify-between items-center">
                      <h4 className="text-xs font-semibold text-slate-600 uppercase">Gerenciamento de Parcelas</h4>
                      <button type="button" onClick={() => setIsCustomInstallments(!isCustomInstallments)} className="text-xs text-blue-600 hover:text-blue-700 font-medium">
                        {isCustomInstallments ? 'Resetar valores' : 'Personalizar valores/datas'}
                      </button>
                    </div>
                    <div className="p-3 bg-slate-50 space-y-2 max-h-48 overflow-y-auto">
                      {customInstallments.map((inst, idx) => (
                        <div key={idx} className="flex gap-2 items-center">
                          <span className="text-xs font-medium text-slate-500 w-16">{idx + 1}ª Parcela</span>
                          <input 
                            type="date" 
                            value={inst.date}
                            onChange={(e) => handleCustomInstallmentChange(idx, 'date', e.target.value)}
                            disabled={!isCustomInstallments}
                            className="flex-1 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                          />
                          <input 
                            type="number" 
                            step="0.01"
                            value={isCustomInstallments ? inst.amount : inst.amount.toFixed(2)}
                            onChange={(e) => handleCustomInstallmentChange(idx, 'amount', e.target.value)}
                            disabled={!isCustomInstallments}
                            className="w-24 bg-white border border-slate-200 rounded px-2 py-1 text-xs focus:border-blue-500 outline-none disabled:bg-slate-100 disabled:text-slate-500"
                          />
                        </div>
                      ))}
                      {isCustomInstallments && (
                        <div className="text-right pt-2 border-t border-slate-200 text-xs font-medium text-slate-500">
                          Total: {formatCurrency(customInstallments.reduce((acc, curr) => acc + curr.amount, 0))}
                        </div>
                      )}
                    </div>
                  </div>
                )}

              </div>
              {editingExpense && editingExpense.groupId && (
                <div className="flex items-center mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <input type="checkbox" id="applyAll" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="rounded border-amber-300 bg-amber-50 text-amber-600 focus:ring-amber-500 cursor-pointer w-4 h-4" />
                  <label htmlFor="applyAll" className="ml-2 text-sm text-amber-800 font-medium cursor-pointer">
                    Aplicar esta edição para os próximos meses/parcelas desta despesa?
                  </label>
                </div>
              )}
              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={handleCloseAddModal} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button disabled={isSubmitting} type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Salvando...' : (editingExpense ? 'Salvar Alterações' : 'Registrar Despesa')}
                </button>
              </div>
            
              </form>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="space-y-6">
            <div>
              <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-widest">Despesas deste Mês</h3>
                
                {/* Selection Toolbar */}
                <div className="flex items-center gap-2 text-xs">
                  {selectedCount > 0 && (
                    <div className="bg-indigo-50 border border-indigo-200 text-indigo-800 px-3 py-1 rounded-lg font-medium flex items-center gap-2">
                      <ListChecks className="w-3.5 h-3.5 text-indigo-600" />
                      <span>{selectedCount} selecionada{selectedCount > 1 ? 's' : ''}: <strong>{formatCurrency(totalSelecionado)}</strong></span>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={selectAllPending}
                    disabled={pendingAccountsCount === 0}
                    className="px-2.5 py-1 bg-white hover:bg-slate-100 border border-slate-200 text-slate-700 rounded-lg text-xs font-medium transition-colors disabled:opacity-40"
                    title="Selecionar todas as pendentes"
                  >
                    Selecionar Todas ({pendingAccountsCount})
                  </button>
                  {selectedCount > 0 && (
                    <button
                      type="button"
                      onClick={clearSelection}
                      className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg text-xs font-medium transition-colors"
                    >
                      Limpar Seleção
                    </button>
                  )}
                </div>
              </div>

              <div className="space-y-3">
                {accounts.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma despesa encontrada.</p>
                ) : (
                  accounts.sort((a, b) => (a.dueDate as any)?.seconds - (b.dueDate as any)?.seconds).map(acc => {
                    const isSelected = acc.id ? selectedAccountIds.has(acc.id) && isAccountPending(acc) : false;
                    
                    return (
                      <div 
                        key={acc.id} 
                        className={`flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl border gap-3 cursor-pointer hover:bg-slate-100 transition-colors ${
                          isSelected ? 'border-indigo-300 bg-indigo-50/40 hover:bg-indigo-50/60' :
                          acc.status === 'ANTECIPADA' ? 'border-slate-200 bg-slate-50/50 opacity-50 hover:opacity-100' : 'border-slate-200 bg-slate-50'
                        }`}
                        onDoubleClick={() => setViewAccount(acc)}
                      >
                        <div className="flex items-start gap-3 min-w-0">
                          {/* Checkbox for Pending Accounts */}
                          <div className="pt-0.5" onClick={(e) => e.stopPropagation()}>
                            {isAccountPending(acc) ? (
                              <input 
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => acc.id && toggleSelectAccount(acc.id)}
                                className="w-4 h-4 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                                title="Selecionar para somar"
                              />
                            ) : (
                              <span className="w-4 inline-block text-slate-300 text-xs text-center font-mono">-</span>
                            )}
                          </div>
                          
                          <div className="min-w-0">
                            <p className={`text-sm font-medium break-words ${acc.status === 'ANTECIPADA' ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{acc.title}</p>
                            <p className="text-xs text-slate-500 mt-1.5 flex flex-wrap items-center gap-2">
                              <span>Vence {formatFriendlyDate(acc.dueDate)}</span>
                              <span className={
                                isAccountPaid(acc) ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap' :
                                acc.status === 'ANTECIPADA' ? 'bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap' :
                                isAccountLate(acc) ? 'bg-red-500/10 text-red-600 border border-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap' :
                                'bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold whitespace-nowrap'
                              }>
                                {isAccountPaid(acc) ? 'Pago' : acc.status === 'ANTECIPADA' ? 'Antecipada' : isAccountLate(acc) ? 'Vencida' : 'Pendente'}
                              </span>
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center justify-between sm:justify-end gap-3 sm:gap-4 w-full sm:w-auto border-t sm:border-t-0 border-slate-200 pt-2 sm:pt-0 mt-1 sm:mt-0 pl-7 sm:pl-0">
                          <div className="text-right">
                            <span className={`text-sm font-bold sm:font-normal font-mono whitespace-nowrap block ${acc.status === 'ANTECIPADA' ? 'text-slate-500' : 'text-slate-700'}`}>
                              {formatCurrency(getEffectiveAccountAmount(acc))}
                            </span>
                            {isAccountPaid(acc) && (getAccountInterest(acc) > 0 || getAccountDiscount(acc) > 0) && (
                              <span className="text-[10px] text-slate-500 font-mono block">
                                Orig: {formatCurrency(acc.amount)}
                              </span>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            {isAccountPending(acc) || isAccountLate(acc) ? (
                              <button 
                                type="button"
                                onClick={() => openPaymentDialog(acc)}
                                disabled={isSubmitting}
                                title="Marcar como Pago"
                                className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-200 rounded-lg transition-colors"
                              >
                                <CheckCircle className="w-4 h-4" />
                              </button>
                            ) : null}
                            {acc.groupId && isAccountPending(acc) && (
                              <button 
                                type="button"
                                onClick={() => handleEarlyPayoff(acc)}
                                disabled={isSubmitting}
                                title="Quitar parcelas futuras"
                                className="text-xs flex items-center gap-1 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors"
                              >
                                <FastForward className="w-3.5 h-3.5" /> Quitar
                              </button>
                            )}
                            {isAccountPaid(acc) && preferences?.allowEditPaidExpenses && (
                              <button
                                type="button"
                                onClick={() => setReopenConfirmAccount(acc)}
                                disabled={isSubmitting || isReopening}
                                className="p-2 text-slate-500 hover:text-indigo-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                title="Reabrir Despesa (Estornar para Pendente)"
                              >
                                <RotateCcw className="w-4 h-4" />
                              </button>
                            )}
                            {(!isAccountPaid(acc) || preferences?.allowEditPaidExpenses) && (
                              <button
                                type="button"
                                onClick={() => openEditModal(acc)}
                                disabled={isSubmitting || isReopening}
                                className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
                                title={isAccountPaid(acc) ? "Editar Despesa Liquidada" : "Editar"}
                              >
                                <Edit2 className="w-4 h-4" />
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setDeleteAccount(acc)}
                              disabled={isSubmitting}
                              className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-lg transition-colors"
                              title="Excluir"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

            {/* Payment Dialog */}
      {paymentAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" /> Liquidar Fatura
              </h3>
              <button onClick={() => { setPaymentAccount(null); sessionStorage.removeItem('transactions_pending_payment_id'); }} className="text-slate-500 hover:text-slate-900 transition-colors">
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
                        setCalcTarget('payment');
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
                        setCalcTarget('payment');
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
                        onChange={(e) => handleFileUpload(e, setPayReceiptUrl, paymentAccount?.categoryId)}
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

              {paymentAccount.groupId && (
                <div className="mt-4 p-3 bg-indigo-50 border border-indigo-100 rounded-lg">
                  <h4 className="text-sm font-semibold text-indigo-800 mb-2">Fast Forward (Quitação)</h4>
                  <p className="text-xs text-indigo-600 mb-3">Esta despesa é parcelada. Deseja somar todas as parcelas futuras na atual e liquidar tudo de uma vez?</p>
                  <button onClick={() => { handleEarlyPayoff(paymentAccount); setPaymentAccount(null); }} className="w-full bg-white text-indigo-600 border border-indigo-200 hover:bg-indigo-50 py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2">
                    <FastForward className="w-4 h-4" /> Quitar Restante do Grupo
                  </button>
                </div>
              )}

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
                  <button onClick={() => {
                    setEditingExpense(paymentAccount);
                    setTitle(paymentAccount.title);
                    setAmount(paymentAccount.amount.toString());
                    setDueDate(paymentAccount.dueDate.toDate().toISOString().split('T')[0]);
                    setCategoryId(paymentAccount.categoryId || '');
                    setPaymentMethod(paymentAccount.paymentMethod || '');
                    setReceiptUrl(paymentAccount.receiptUrl || '');
                    setPriority(paymentAccount.priority || 'MEDIUM');
                    setApplyToAll(false);
                    setPaymentAccount(null);
                    setShowAddModal(true);
                  }} className="px-4 py-2 rounded-lg text-sm font-medium text-blue-600 hover:bg-blue-50 transition-colors flex items-center gap-2">
                    <Edit2 className="w-4 h-4" /> Editar Despesa
                  </button>
                  <button onClick={confirmPayment} disabled={isSubmitting} className="bg-emerald-600 hover:bg-emerald-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
                    <CheckCircle className="w-4 h-4" />
                    {isSubmitting ? 'Processando...' : 'Confirmar Pago'}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Delete Alert Dialog */}
      {deleteAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-sm shadow-md overflow-hidden">
            <div className="p-6">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center mb-4 mx-auto">
                <Trash2 className="w-6 h-6 text-red-600" />
              </div>
              <h3 className="text-lg font-bold text-slate-900 text-center mb-2">Excluir Despesa</h3>
              <p className="text-sm text-slate-600 text-center mb-6">
                Deseja realmente excluir a fatura <span className="font-semibold text-slate-800">'{deleteAccount.title}'</span>? Esta ação não pode ser desfeita.
              </p>

              {deleteAccount.groupId ? (
                <div className="space-y-3">
                  <button onClick={() => confirmDelete(false)} disabled={isSubmitting} className="w-full bg-red-600 hover:bg-red-700 text-white py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Apenas Esta
                  </button>
                  <button onClick={() => confirmDelete(true)} disabled={isSubmitting} className="w-full bg-white border border-red-200 text-red-600 hover:bg-red-50 py-2.5 rounded-lg text-sm font-medium transition-colors">
                    Todas as Parcelas
                  </button>
                  <button onClick={() => setDeleteAccount(null)} className="w-full bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors mt-2">
                    Cancelar
                  </button>
                </div>
              ) : (
                <div className="flex gap-3">
                  <button onClick={() => setDeleteAccount(null)} className="flex-1 bg-slate-100 text-slate-600 hover:bg-slate-200 py-2.5 rounded-lg text-sm font-medium transition-colors">
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
                  <span className={`px-3 py-1 rounded-full text-xs font-medium border ${
                    isAccountPaid(viewAccount) ? "bg-emerald-50 text-emerald-700 border-emerald-200" :
                    (isAccountPending(viewAccount) && ((viewAccount.dueDate as any)?.seconds * 1000) < Date.now()) ? "bg-red-50 text-red-700 border-red-200" :
                    "bg-amber-50 text-amber-700 border-amber-200"
                  }`}>
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
              <div className="flex items-center gap-2">
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
                {(!isAccountPaid(viewAccount) || preferences?.allowEditPaidExpenses) && (
                  <button
                    type="button"
                    onClick={() => {
                      const acc = viewAccount;
                      setViewAccount(null);
                      openEditModal(acc);
                    }}
                    className="px-4 py-2 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-lg transition-colors font-medium text-xs flex items-center gap-1.5 cursor-pointer shadow-xs"
                  >
                    <Edit2 className="w-3.5 h-3.5" /> Editar
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
          setCalcTarget('expense');
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
        onApplyAmount={(amountVal) => {
          if (calcTarget === 'expense') {
            setAmount(amountVal > 0 ? amountVal.toFixed(2) : '');
          }
        }}
        onApplyInterest={(amountVal) => {
          setPenaltyAmount(amountVal > 0 ? amountVal.toFixed(2).replace('.', ',') : '');
        }}
        onApplyDiscount={(amountVal) => {
          setDiscountAmount(amountVal > 0 ? amountVal.toFixed(2).replace('.', ',') : '');
        }}
      />

    </div>
  );
}