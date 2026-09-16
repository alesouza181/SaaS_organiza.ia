const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const correctBlock = `
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
`;

content = content.replace(/<div>\s*<label className="block text-xs font-medium text-slate-500 mb-1">Prioridade<\/label>[\s\S]*?<\/form>/, correctBlock.trim());

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
