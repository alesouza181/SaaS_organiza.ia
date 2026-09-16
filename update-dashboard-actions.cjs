const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/components/Dashboard.tsx', 'utf8');

const importsOld = "import { AlertCircle, CheckCircle2, Clock, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Activity, ChevronUp, ChevronDown } from 'lucide-react';";
const importsNew = "import { AlertCircle, CheckCircle2, Clock, Wallet, ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Activity, ChevronUp, ChevronDown, CheckCircle, Receipt, X } from 'lucide-react';\nimport { Timestamp } from 'firebase/firestore';";

content = content.replace(importsOld, importsNew);

const hooksOld = `  const { startDate, endDate } = useDate();
  const { accounts: allAccounts } = useFirestoreSync();
  
  const { accounts, loading: accLoading } = useAccounts(userId, startDate, endDate);`;

const hooksNew = `  const { startDate, endDate } = useDate();
  const { accounts: allAccounts, upsertData } = useFirestoreSync();
  
  const { accounts, loading: accLoading } = useAccounts(userId, startDate, endDate);
  const [paymentAccount, setPaymentAccount] = useState<AccountPayable | null>(null);
  const [payDate, setPayDate] = useState('');
  const [payMethod, setPayMethod] = useState('');
  const [penaltyAmount, setPenaltyAmount] = useState('');
  const [discountAmount, setDiscountAmount] = useState('');
  const [payReceiptUrl, setPayReceiptUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const openPaymentDialog = (account: AccountPayable) => {
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

content = content.replace(hooksOld, hooksNew);

const actionsHeaderOld = `<th className="px-6 py-3 font-medium text-center cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('status')}>
                  Status {renderSortIcon('status')}
                </th>
              </tr>`;

const actionsHeaderNew = `<th className="px-6 py-3 font-medium text-center cursor-pointer hover:bg-slate-200 transition-colors select-none group" onClick={() => handleSort('status')}>
                  Status {renderSortIcon('status')}
                </th>
                <th className="px-6 py-3 font-medium text-center">Ações</th>
              </tr>`;

content = content.replace(actionsHeaderOld, actionsHeaderNew);


const rowStatusOld = `                        {account.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <AlertCircle className="w-3.5 h-3.5" /> Pendente
                          </span>
                        )}
                      </td>
                    </tr>`;

const rowStatusNew = `                        {account.status === 'PENDING' && (
                          <span className="inline-flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded-md">
                            <AlertCircle className="w-3.5 h-3.5" /> Pendente
                          </span>
                        )}
                      </td>
                      <td className="px-6 py-4 text-center">
                        {account.status === 'PENDING' && (
                          <button
                            onClick={() => openPaymentDialog(account)}
                            className="p-1.5 text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 rounded transition-colors"
                            title="Liquidar Fatura"
                          >
                            <CheckCircle2 className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>`;

content = content.replace(rowStatusOld, rowStatusNew);


const modalCode = `      </div>

      {/* Payment Dialog */}
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
                    {payReceiptUrl.toLowerCase().match(/\\.(jpeg|jpg|gif|png)$/) != null ? (
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

              <div className="pt-4 border-t border-slate-200">
                <div className="flex justify-between items-center mb-4">
                  <span className="text-sm font-medium text-slate-600">Valor Final Pago:</span>
                  <span className="text-lg font-bold font-mono text-emerald-600">
                    {formatCurrency(paymentAccount.amount + (parseFloat(penaltyAmount) || 0) - (parseFloat(discountAmount) || 0))}
                  </span>
                </div>
                <div className="flex justify-end gap-3">
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

    </div>
  );
}
`;

content = content.replace("      </div>\n    </div>\n  );\n}", modalCode);

fs.writeFileSync('/app/applet/src/components/Dashboard.tsx', content);
