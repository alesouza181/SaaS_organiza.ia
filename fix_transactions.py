import re

with open('src/components/TransactionsScreen.tsx', 'r') as f:
    content = f.read()

# Let's fix the JSX parse errors
# I will just write a completely well-formed return block
# I'll extract everything before `return (` and append my own return block

before_return = content.split('return (')[0]

return_block = """return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Contas Lançadas</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie suas despesas e faturas</p>
        </div>
      </div>

      <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
        <div className="p-6">
          <div className="space-y-8">
            <form onSubmit={handleAddExpense} className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                  <input required type="text" value={title} onChange={(e) => setTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="Ex: Conta de Luz" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor Total (R$)</label>
                  <input required type="number" step="0.01" value={amount} onChange={(e) => setAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="Ex: 150.00" />
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
                  <label className="block text-xs font-medium text-slate-500 mb-1">Link do Comprovante (Opcional)</label>
                  <input type="url" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="https://exemplo.com/comprovante.pdf" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Parcelas</label>
                  <input type="number" min="1" max="120" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="flex items-center mt-6">
                  <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-slate-200 bg-slate-50 text-blue-500 focus:ring-blue-500 focus:ring-offset-white" />
                  <label htmlFor="recurring" className="ml-2 text-sm text-slate-600">Despesa Mensal Recorrente</label>
                </div>
              </div>
              <div className="pt-4 flex justify-end">
                <button disabled={isSubmitting} type="submit" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Salvando...' : 'Registrar Despesa'}
                </button>
              </div>
            </form>

            <div className="border-t border-slate-200 pt-6">
              <h3 className="text-sm font-semibold text-slate-600 uppercase tracking-widest mb-4">Despesas deste Mês</h3>
              <div className="space-y-3">
                {accounts.length === 0 ? (
                  <p className="text-sm text-slate-500">Nenhuma despesa encontrada.</p>
                ) : (
                  accounts.sort((a, b) => a.dueDate.seconds - b.dueDate.seconds).map(acc => (
                    <div key={acc.id} className={`flex items-center justify-between p-4 rounded-xl border ${acc.status === 'ANTECIPADA' ? 'border-slate-200 bg-slate-50/50 opacity-50' : 'border-slate-200 bg-slate-50'} `}>
                      <div>
                        <p className={`text-sm font-medium ${acc.status === 'ANTECIPADA' ? 'text-slate-500 line-through' : 'text-slate-700'}`}>{acc.title}</p>
                        <p className="text-xs text-slate-500 mt-1 flex items-center gap-2">
                          Vence {formatFriendlyDate(acc.dueDate)}
                          <span className={
                            acc.status === 'PAID' ? 'bg-emerald-500/10 text-emerald-600 border border-emerald-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold' :
                            acc.status === 'ANTECIPADA' ? 'bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded text-[10px] font-bold' :
                            acc.status === 'OVERDUE' ? 'bg-red-500/10 text-red-600 border border-red-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold' :
                            'bg-amber-500/10 text-amber-600 border border-amber-500/20 px-1.5 py-0.5 rounded text-[10px] font-bold'
                          }>
                            {acc.status}
                          </span>
                        </p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-mono ${acc.status === 'ANTECIPADA' ? 'text-slate-500' : 'text-slate-700'}`}>{formatCurrency(acc.amount)}</span>
                        {acc.status === 'PENDING' || acc.status === 'OVERDUE' ? (
                          <button 
                            onClick={() => handleMarkAsPaid(acc)}
                            disabled={isSubmitting}
                            title="Marcar como Pago"
                            className="p-2 text-slate-500 hover:text-emerald-600 hover:bg-slate-200 rounded-lg transition-colors"
                          >
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        ) : null}
                        {acc.groupId && acc.status === 'PENDING' && (
                          <button 
                            onClick={() => handleEarlyPayoff(acc)}
                            disabled={isSubmitting}
                            title="Quitar parcelas futuras"
                            className="text-xs flex items-center gap-1 bg-indigo-500/10 text-indigo-400 hover:bg-indigo-500/20 px-2 py-1 rounded transition-colors"
                          >
                            <FastForward className="w-3.5 h-3.5" /> Quitar
                          </button>
                        )}
                        <button
                          onClick={() => openEditModal(acc)}
                          disabled={isSubmitting}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleDeleteExpense(acc)}
                          disabled={isSubmitting}
                          className="p-2 text-slate-500 hover:text-red-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Excluir"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Modal */}
      {editingExpense && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-md shadow-md">
            <div className="flex items-center justify-between p-4 border-b border-slate-200">
              <h3 className="text-lg font-medium text-slate-900">Editar Lançamento</h3>
              <button onClick={() => setEditingExpense(null)} className="text-slate-500 hover:text-slate-900 transition-colors">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Descrição</label>
                <input type="text" value={editTitle} onChange={e => setEditTitle(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Valor (R$)</label>
                  <input type="number" step="0.01" value={editAmount} onChange={e => setEditAmount(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vencimento</label>
                  <input type="date" value={editDate} onChange={e => setEditDate(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Categoria</label>
                <select value={editCategoryId} onChange={e => setEditCategoryId(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                  {categories.map(cat => <option key={cat.id} value={cat.id}>{cat.name}</option>)}
                </select>
              </div>
              {editingExpense.groupId && (
                <div className="flex items-center mt-2">
                  <input type="checkbox" id="applyAll" checked={applyToAll} onChange={e => setApplyToAll(e.target.checked)} className="rounded border-slate-200 bg-slate-50 text-blue-500" />
                  <label htmlFor="applyAll" className="ml-2 text-sm text-slate-600">Aplicar a esta e às parcelas futuras</label>
                </div>
              )}
              <button onClick={handleSaveEdit} disabled={isSubmitting} className="w-full bg-blue-600 hover:bg-blue-500 text-white py-2 rounded-lg text-sm font-medium transition-colors mt-4">
                {isSubmitting ? 'Salvando...' : 'Salvar Alterações'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
"""

with open('src/components/TransactionsScreen.tsx', 'w') as f:
    f.write(before_return + return_block)
