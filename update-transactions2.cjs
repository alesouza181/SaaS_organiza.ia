const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const installmentsUI = `
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Parcelas</label>
                  <input type="number" min="1" max="120" value={installments} onChange={(e) => setInstallments(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" />
                </div>
                <div className="flex items-center mt-6">
                  <input type="checkbox" id="recurring" checked={isRecurring} onChange={(e) => setIsRecurring(e.target.checked)} className="rounded border-slate-200 bg-slate-50 text-blue-500 focus:ring-blue-500 focus:ring-offset-white" />
                  <label htmlFor="recurring" className="ml-2 text-sm text-slate-600">Despesa Mensal Recorrente</label>
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
`;

content = content.replace(
  /<div>\s*<label className="block text-xs font-medium text-slate-500 mb-1">Parcelas<\/label>\s*<input type="number" min="1" max="120" value=\{installments\} onChange=\{\(e\) => setInstallments\(e\.target\.value\)\} className="[^"]*" \/>\s*<\/div>\s*<div className="flex items-center mt-6">\s*<input type="checkbox" id="recurring" checked=\{isRecurring\} onChange=\{\(e\) => setIsRecurring\(e\.target\.checked\)\} className="[^"]*" \/>\s*<label htmlFor="recurring" className="ml-2 text-sm text-slate-600">Despesa Mensal Recorrente<\/label>\s*<\/div>/,
  installmentsUI
);

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);

