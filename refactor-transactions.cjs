const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

// We will inject new states for Delete and Pay Dialogs
const statesToAdd = `  // Custom Dialog States
  const [deleteAccount, setDeleteAccount] = useState<AccountPayable | null>(null);
  
  const [paymentAccount, setPaymentAccount] = useState<AccountPayable | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [payReceiptUrl, setPayReceiptUrl] = useState('');
`;

code = code.replace(
  "const [editingExpense, setEditingExpense] = useState<AccountPayable | null>(null);",
  "const [editingExpense, setEditingExpense] = useState<AccountPayable | null>(null);\n" + statesToAdd
);

// We change openEditModal
const newOpenEditModal = `  const openEditModal = (account: AccountPayable) => {
    setEditingExpense(account);
    setTitle(account.title);
    setAmount(account.amount.toString());
    setDueDate(account.dueDate.toDate().toISOString().split('T')[0]);
    setCategoryId(account.categoryId || '');
    setPaymentMethod(account.paymentMethod || '');
    setReceiptUrl(account.receiptUrl || '');
    setPriority(account.priority || 'MEDIUM');
    setApplyToAll(false);
    setShowAddModal(true);
  };`;

// Let's replace the whole old openEditModal
code = code.replace(
  /const openEditModal = \(account: AccountPayable\) => \{[\s\S]*?setApplyToAll\(false\);\s*\};/,
  newOpenEditModal
);

// Update handleAddExpense to handle updates too
const oldHandleAdd = /const handleAddExpense = async \(e: React\.FormEvent\) => \{[\s\S]*?setIsSubmitting\(false\);\n    \}\n  \};/;

const newHandleAdd = `const handleAddExpense = async (e: React.FormEvent) => {
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
        if (applyToAll && editingExpense.groupId) {
          const q = query(
            collection(db, \`users/\${userId}/accounts_payable\`),
            where('groupId', '==', editingExpense.groupId),
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
              receiptUrl: rUrl,
              receiptType: rType,
              lastSyncTimestamp: Date.now()
            });
          });
          await batch.commit();
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
          });
        }
        alert('Despesa atualizada com sucesso!');
      } else {
        if (numInstallments > 1) {
          const batch = writeBatch(db);
          const groupId = \`group_\${Date.now()}_\${Math.random().toString(36).substring(7)}\`;
          
          for (let i = 0; i < numInstallments; i++) {
            let installmentDate, installmentAmount;
            if (customInstallments.length === numInstallments) {
              installmentDate = new Date(customInstallments[i].date + 'T12:00:00');
              installmentAmount = customInstallments[i].amount;
            } else {
              installmentDate = new Date(baseDate);
              installmentDate.setMonth(baseDate.getMonth() + i);
              installmentAmount = baseAmount / numInstallments;
            }
            const newDocRef = doc(collection(db, \`users/\${userId}/accounts_payable\`));
            batch.set(newDocRef, {
              title: \`\${title} (\${i + 1}/\${numInstallments})\`,
              amount: installmentAmount,
              dueDate: Timestamp.fromDate(installmentDate),
              categoryId,
              priority,
              paymentMethod,
              receiptUrl: rUrl,
              receiptType: rType,
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
        } else {
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
            isRecurring,
            userId,
            lastSyncTimestamp: Date.now()
          });
        }
        alert('Despesa adicionada com sucesso!');
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
  };`;
code = code.replace(oldHandleAdd, newHandleAdd);

// Remove handleSaveEdit entirely
code = code.replace(
  /const handleSaveEdit = async \(\) => \{[\s\S]*?setIsSubmitting\(false\);\n    \}\n  \};/,
  ""
);

// We update handleMarkAsPaid to open the PaymentDialog instead
const oldHandleMarkAsPaid = /const handleMarkAsPaid = async \(account: AccountPayable\) => \{[\s\S]*?setIsSubmitting\(false\);\n    \}\n  \};/;
const newHandleMarkAsPaid = `const openPaymentDialog = (account: AccountPayable) => {
    setPaymentAccount(account);
    setPayDate(new Date().toISOString().split('T')[0]);
    setPayMethod(account.paymentMethod || 'Pix');
    setPenaltyAmount('');
    setDiscountAmount('');
    setPayReceiptUrl(account.receiptUrl || '');
  };

  const confirmPayment = async () => {
    if (!paymentAccount) return;
    setIsSubmitting(true);
    try {
      const pDate = new Date(payDate + 'T12:00:00');
      const penalty = parseFloat(penaltyAmount) || 0;
      const discount = parseFloat(discountAmount) || 0;
      
      const pUrl = payReceiptUrl || null;
      const pType = pUrl ? (pUrl.toLowerCase().endsWith('.pdf') ? 'PDF' : 'IMAGE') : null;

      await upsertData('accounts_payable', paymentAccount.id!, {
        status: 'PAID',
        paymentDate: Timestamp.fromDate(pDate),
        paymentMethod: payMethod,
        receiptUrl: pUrl,
        receiptType: pType,
        penaltyAmount: penalty,
        discountAmount: discount,
        amountPaid: paymentAccount.amount + penalty - discount,
        lastSyncTimestamp: Date.now()
      });
      
      setPaymentAccount(null);
      alert('Pagamento registrado com sucesso!');
    } catch (error) {
      console.error(error);
      alert('Erro ao confirmar pagamento.');
    } finally {
      setIsSubmitting(false);
    }
  };`;
code = code.replace(oldHandleMarkAsPaid, newHandleMarkAsPaid);

// Modify handleDeleteExpense to open AlertDialog
const oldHandleDelete = /const handleDeleteExpense = async \(account: AccountPayable\) => \{[\s\S]*?alert\('Erro ao excluir despesa\.'\);\n    \}\n  \};/;
const newHandleDelete = `const confirmDelete = async (deleteFuture: boolean) => {
    if (!deleteAccount) return;
    setIsSubmitting(true);
    try {
      if (deleteFuture && deleteAccount.groupId) {
        const q = query(
          collection(db, \`users/\${userId}/accounts_payable\`),
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
  };`;
code = code.replace(oldHandleDelete, newHandleDelete);


// Replace the markAsPaid button onClick to openPaymentDialog
code = code.replace(/onClick=\{\(\) => handleMarkAsPaid\(acc\)\}/g, "onClick={() => openPaymentDialog(acc)}");

// Replace the delete button onClick to open the Delete Alert Dialog
code = code.replace(/onClick=\{\(\) => handleDeleteExpense\(acc\)\}/g, "onClick={() => setDeleteAccount(acc)}");

// Now we need to modify the Nova Despesa Modal JSX to accommodate "Editing" state
code = code.replace(
  /<h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">\s*<Receipt className="w-5 h-5 text-red-600" \/> Nova Despesa\s*<\/h3>/,
  '<h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">\n                <Receipt className="w-5 h-5 text-red-600" /> {editingExpense ? "Editar Despesa" : "Nova Despesa"}\n              </h3>'
);

code = code.replace(
  /\{isSubmitting \? 'Salvando\.\.\.' : 'Registrar Despesa'\}/,
  "{isSubmitting ? 'Salvando...' : (editingExpense ? 'Salvar Alterações' : 'Registrar Despesa')}"
);

// Disable installments if editing
code = code.replace(
  /<input type="number" min="1" max="120" value=\{installments\}/,
  '<input type="number" disabled={!!editingExpense} min="1" max="120" value={installments}'
);
code = code.replace(
  /<input type="checkbox" id="recurring" checked=\{isRecurring\}/,
  '<input type="checkbox" disabled={!!editingExpense} id="recurring" checked={isRecurring}'
);

// Add applyToAll checkbox if editing group
const applyToAllUI = `              {editingExpense && editingExpense.groupId && (
                <div className="flex items-center mt-2 p-3 bg-amber-50 rounded-lg border border-amber-200">
                  <input type="checkbox" id="applyAll" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="rounded border-amber-300 bg-amber-50 text-amber-600 focus:ring-amber-500" />
                  <label htmlFor="applyAll" className="ml-2 text-sm text-amber-800 font-medium">Aplicar esta edição para as próximas parcelas?</label>
                </div>
              )}`;
code = code.replace(
  /<div className="pt-4 flex justify-end gap-3">/,
  applyToAllUI + '\n              <div className="pt-4 flex justify-end gap-3">'
);


// Replace the separate Edit Modal with Payment Dialog and Delete Alert Dialog
const newDialogsUI = `      {/* Payment Dialog */}
      {paymentAccount && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="p-4 border-b border-slate-200 flex justify-between items-center bg-slate-100">
              <h3 className="text-lg font-medium text-slate-900 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-emerald-600" /> Liquidar Fatura
              </h3>
              <button onClick={() => setPaymentAccount(null)} className="text-slate-500 hover:text-slate-900 transition-colors">
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Juros/Multa (R$)</label>
                  <input type="number" step="0.01" value={penaltyAmount} onChange={e => setPenaltyAmount(e.target.value)} placeholder="0.00" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Desconto (R$)</label>
                  <input type="number" step="0.01" value={discountAmount} onChange={e => setDiscountAmount(e.target.value)} placeholder="0.00" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" />
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Comprovante (Link/URL)</label>
                <input type="url" value={payReceiptUrl} onChange={e => setPayReceiptUrl(e.target.value)} placeholder="https://exemplo.com/recibo.pdf" className="w-full bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" />
                {payReceiptUrl && (
                  <div className="mt-2 p-2 border border-slate-200 rounded bg-slate-50 flex items-center justify-center h-20 overflow-hidden">
                    {payReceiptUrl.toLowerCase().match(/\.(jpeg|jpg|gif|png)$/) != null ? (
                      <img src={payReceiptUrl} alt="Comprovante" className="max-h-full object-contain" />
                    ) : (
                      <div className="text-xs text-slate-500 text-center">
                        <Receipt className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                        Comprovante Anexado
                      </div>
                    )}
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
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-slate-600">Valor Final Pago:</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    {formatCurrency(paymentAccount.amount + (parseFloat(penaltyAmount) || 0) - (parseFloat(discountAmount) || 0))}
                  </span>
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
`;

code = code.replace(
  /\{\/\* Edit Modal \*\/\}[\s\S]*/,
  newDialogsUI + '\n    </div>\n  );\n}'
);

fs.writeFileSync('src/components/TransactionsScreen.tsx', code);
