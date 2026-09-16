const fs = require('fs');
let tsx = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const t1Old = `                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Link do Comprovante (Opcional)</label>
                  <input type="url" value={receiptUrl} onChange={(e) => setReceiptUrl(e.target.value)} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" placeholder="https://exemplo.com/comprovante.pdf" />
                </div>`;

const t1New = `                <div className="md:col-span-2">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Comprovante (Opcional)</label>
                  <div className="flex gap-2">
                    <input 
                      type="url" 
                      value={receiptUrl} 
                      onChange={(e) => setReceiptUrl(e.target.value)} 
                      className="flex-1 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm" 
                      placeholder="Link do comprovante" 
                    />
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
                        onChange={(e) => handleFileUpload(e, setReceiptUrl)}
                        disabled={uploadingReceipt}
                      />
                    </label>
                  </div>
                  {receiptUrl && (
                    <div className="mt-2 p-2 border border-slate-200 rounded bg-slate-50 flex items-center justify-center h-20 overflow-hidden relative">
                      <button type="button" onClick={() => setReceiptUrl('')} className="absolute top-1 right-1 p-1 bg-white/80 rounded-full hover:bg-white text-slate-500">
                        <X className="w-3 h-3" />
                      </button>
                      {receiptUrl.toLowerCase().match(/\\.(jpeg|jpg|gif|png|webp)/) != null || receiptUrl.includes('firebasestorage.googleapis.com') ? (
                        <img src={receiptUrl} alt="Comprovante" className="max-h-full object-contain" />
                      ) : (
                        <div className="text-xs text-slate-500 text-center">
                          <Receipt className="w-6 h-6 mx-auto mb-1 text-slate-400" />
                          Comprovante Anexado
                        </div>
                      )}
                    </div>
                  )}
                </div>`;

tsx = tsx.replace(t1Old, t1New);
fs.writeFileSync('src/components/TransactionsScreen.tsx', tsx);

let dash = fs.readFileSync('src/components/Dashboard.tsx', 'utf8');

const dashOld = `              <div>
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

const dashNew = `              <div>
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

dash = dash.replace(dashOld, dashNew);
fs.writeFileSync('src/components/Dashboard.tsx', dash);

