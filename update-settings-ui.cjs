const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

const oldUI = `        {/* Integração WhatsApp */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center gap-2">
            <MessageCircle className="w-5 h-5 text-emerald-600" />
            <h3 className="text-lg font-medium text-emerald-900">Integração WhatsApp (Omnichannel)</h3>
          </div>
          <div className="p-6 space-y-4">
            <div className="flex items-center">
              <input type="checkbox" id="whatsappEnabled" checked={preferences.whatsappEnabled} onChange={e => setPreferences({...preferences, whatsappEnabled: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
              <label htmlFor="whatsappEnabled" className="ml-2 text-sm font-medium text-slate-700">Assistente Omnichannel Ativo</label>
            </div>
            {preferences.whatsappEnabled && (
              <div className="bg-slate-50 p-5 rounded-lg border border-slate-200 flex flex-col space-y-4">
                <div className="flex items-start gap-3">
                  <div className="p-2 bg-emerald-100 rounded-lg shrink-0">
                    <MessageCircle className="w-5 h-5 text-emerald-600" />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-slate-900">Integração Ativa</h4>
                    <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                      Conecte seu WhatsApp para receber alertas de vencimentos, adicionar despesas via áudio ou texto, e consultar saldos através do Assistente de IA.
                    </p>
                  </div>
                </div>
                <div className="flex flex-col md:flex-row gap-4 items-end pt-2 border-t border-slate-200">
                  <div className="flex-1 w-full">
                    <label className="block text-xs font-medium text-slate-500 mb-1">Seu Número do WhatsApp</label>
                    <input type="tel" value={preferences.userPhone || ''} onChange={e => setPreferences({...preferences, userPhone: formatPhone(e.target.value)})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm w-full" placeholder="(11) 99999-9999" />
                  </div>
                  <button disabled={isLinkingPhone} type="button" onClick={handleLinkPhone} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors w-full md:w-auto h-[38px] flex items-center justify-center gap-2">
                    {isLinkingPhone ? (
                      <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    ) : linkSuccess ? (
                      <span className="text-white font-semibold">✓ Vinculado</span>
                    ) : (
                      <span>Vincular Número</span>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>`;

const newUI = `        {/* Integração WhatsApp */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="text-lg font-medium text-emerald-900">Integração WhatsApp (Omnichannel)</h3>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-emerald-700">Status:</span>
               {preferences.whatsappEnabled ? (
                 <span className="px-2 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ativo</span>
               ) : (
                 <span className="px-2 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md">Desativado</span>
               )}
            </div>
          </div>
          <div className="p-6 space-y-6">
            <div className="flex items-center bg-slate-50 p-4 rounded-lg border border-slate-200">
              <input type="checkbox" id="whatsappEnabled" checked={preferences.whatsappEnabled} onChange={e => setPreferences({...preferences, whatsappEnabled: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600" />
              <label htmlFor="whatsappEnabled" className="ml-3 text-sm font-medium text-slate-700 cursor-pointer">Habilitar Assistente Omnichannel via WhatsApp</label>
            </div>
            
            {preferences.whatsappEnabled && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    1. Vínculo de Contato
                  </h4>
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Seu Número do WhatsApp (com DDD)</label>
                      <input type="tel" value={preferences.userPhone || ''} onChange={e => setPreferences({...preferences, userPhone: formatPhone(e.target.value)})} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm w-full" placeholder="(11) 99999-9999" />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button disabled={isLinkingPhone} type="button" onClick={handleLinkPhone} className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors h-[38px] flex items-center justify-center gap-2">
                        {isLinkingPhone ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : linkSuccess ? (
                          <span className="text-white font-semibold">✓ Salvo</span>
                        ) : (
                          <span>Salvar Número</span>
                        )}
                      </button>
                      <button disabled={isTestingConnection || !preferences.userPhone} type="button" onClick={handleTestConnection} className="flex-1 md:flex-none px-4 py-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-sm font-medium rounded-lg transition-colors h-[38px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
                        {isTestingConnection ? (
                          <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></span>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Teste de Conexão
                      </button>
                    </div>
                  </div>
                </div>

                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    2. Template de Notificação
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">Customize a mensagem que será enviada. Utilize as variáveis abaixo clicando nelas:</p>
                  
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setPreferences(prev => ({...prev, whatsappTemplate: (prev.whatsappTemplate || '') + '{valor}'}))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-mono rounded border border-slate-200 transition-colors">{'{valor}'}</button>
                    <button type="button" onClick={() => setPreferences(prev => ({...prev, whatsappTemplate: (prev.whatsappTemplate || '') + '{data}'}))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-mono rounded border border-slate-200 transition-colors">{'{data}'}</button>
                    <button type="button" onClick={() => setPreferences(prev => ({...prev, whatsappTemplate: (prev.whatsappTemplate || '') + '{categoria}'}))} className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-600 text-xs font-mono rounded border border-slate-200 transition-colors">{'{categoria}'}</button>
                  </div>
                  
                  <textarea 
                    value={preferences.whatsappTemplate || ''}
                    onChange={e => setPreferences({...preferences, whatsappTemplate: e.target.value})}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 resize-none"
                    placeholder="Ex: Olá! Sua fatura {categoria} de {valor} vence em {data}."
                  ></textarea>
                </div>

                <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
                  <h4 className="text-sm font-semibold text-slate-900 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    3. Log de Disparos
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      {whatsappLogs.length === 0 ? (
                        <div className="p-4 text-center text-sm text-slate-500">Nenhuma mensagem enviada ainda.</div>
                      ) : (
                        <table className="w-full text-left text-sm">
                          <thead className="bg-slate-100 text-slate-600 text-xs uppercase sticky top-0">
                            <tr>
                              <th className="px-4 py-2 font-medium">Data/Hora</th>
                              <th className="px-4 py-2 font-medium">Status</th>
                              <th className="px-4 py-2 font-medium hidden sm:table-cell">Mensagem</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-200">
                            {whatsappLogs.map(log => (
                              <tr key={log.id} className="hover:bg-slate-100/50">
                                <td className="px-4 py-3 text-slate-600 text-xs">
                                  {log.date instanceof Timestamp ? log.date.toDate().toLocaleString('pt-BR') : new Date(log.date).toLocaleString('pt-BR')}
                                </td>
                                <td className="px-4 py-3">
                                  {log.status === 'sent' && <span className="inline-flex items-center gap-1 text-emerald-600 text-xs font-medium bg-emerald-50 px-2 py-1 rounded-full"><CheckCircle2 className="w-3 h-3"/> Enviado</span>}
                                  {log.status === 'pending' && <span className="inline-flex items-center gap-1 text-amber-600 text-xs font-medium bg-amber-50 px-2 py-1 rounded-full"><Clock className="w-3 h-3"/> Pendente</span>}
                                  {log.status === 'error' && <span className="inline-flex items-center gap-1 text-red-600 text-xs font-medium bg-red-50 px-2 py-1 rounded-full"><XCircle className="w-3 h-3"/> Erro</span>}
                                </td>
                                <td className="px-4 py-3 text-slate-600 text-xs truncate max-w-[200px] hidden sm:table-cell" title={log.message}>
                                  {log.message}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>`;

content = content.replace(oldUI, newUI);

fs.writeFileSync('src/components/SettingsScreen.tsx', content);
