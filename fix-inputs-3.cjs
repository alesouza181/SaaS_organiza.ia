const fs = require('fs');
let tsx = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const payOld = `              <div>
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
              </div>`;

const payNew = `              <div>
                <label className="block text-xs font-medium text-slate-500 mb-1">Comprovante</label>
                <div className="flex gap-2">
                  <input 
                    type="url" 
                    value={payReceiptUrl} 
                    onChange={e => setPayReceiptUrl(e.target.value)} 
                    placeholder="Link do comprovante" 
                    className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm" 
                  />
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
                      onChange={(e) => handleFileUpload(e, setPayReceiptUrl)}
                      disabled={uploadingReceipt}
                    />
                  </label>
                </div>
                {payReceiptUrl && (
                  <div className="mt-2 p-2 border border-slate-200 rounded bg-slate-50 flex items-center justify-center h-20 overflow-hidden relative">
                    <button type="button" onClick={() => setPayReceiptUrl('')} className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white text-slate-500">
                      <X className="w-3 h-3" />
                    </button>
                    {payReceiptUrl.toLowerCase().match(/\\.(jpeg|jpg|gif|png|webp)/) != null || payReceiptUrl.includes('firebasestorage.googleapis.com') ? (
                      <img src={payReceiptUrl} alt="Comprovante" className="max-h-full object-contain" />
                    ) : (
                      <div className="text-xs text-slate-500 text-center">
                        <Receipt className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                        Comprovante Anexado
                      </div>
                    )}
                  </div>
                )}
              </div>`;

tsx = tsx.replace(payOld, payNew);
fs.writeFileSync('src/components/TransactionsScreen.tsx', tsx);
