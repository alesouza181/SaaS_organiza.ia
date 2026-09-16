const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

// Add states
content = content.replace(
  "const [showProfileModal, setShowProfileModal] = useState(false);",
  "const [showProfileModal, setShowProfileModal] = useState(false);\n  const [isLinkingPhone, setIsLinkingPhone] = useState(false);\n  const [linkSuccess, setLinkSuccess] = useState(false);\n\n  const formatPhone = (value) => {\n    const v = value.replace(/\\D/g, '');\n    if (v.length <= 10) {\n      return v.replace(/(\\d{2})(\\d{4})(\\d{0,4})/, '($1) $2-$3').replace(/-$/, '');\n    }\n    return v.replace(/(\\d{2})(\\d{5})(\\d{0,4})/, '($1) $2-$3').replace(/-$/, '');\n  };\n"
);

// Update handleLinkPhone
content = content.replace(
  "  const handleLinkPhone = async () => {\n    if (!preferences.userPhone) {\n      alert('Digite um número de telefone válido.');\n      return;\n    }\n    try {\n      await setDoc(doc(db, `users/${userId}/preferences`, 'system'), { userPhone: preferences.userPhone }, { merge: true });\n      await setDoc(doc(db, `users/${userId}/profile`, 'data'), { phone: preferences.userPhone }, { merge: true });\n      alert('Número vinculado com sucesso no banco de dados!');\n    } catch (err) {\n      console.error(err);\n      alert('Erro ao vincular número.');\n    }\n  };",
  "  const handleLinkPhone = async () => {\n    if (!preferences.userPhone || preferences.userPhone.replace(/\\D/g, '').length < 10) {\n      alert('Digite um número de telefone válido com DDD.');\n      return;\n    }\n    setIsLinkingPhone(true);\n    try {\n      await setDoc(doc(db, `users/${userId}/preferences`, 'system'), { userPhone: preferences.userPhone }, { merge: true });\n      await setDoc(doc(db, `users/${userId}/profile`, 'data'), { phone: preferences.userPhone }, { merge: true });\n      setLinkSuccess(true);\n      setTimeout(() => setLinkSuccess(false), 3000);\n    } catch (err) {\n      console.error(err);\n      alert('Erro ao vincular número.');\n    } finally {\n      setIsLinkingPhone(false);\n    }\n  };"
);

// Update UI
const oldUI = `            {preferences.whatsappEnabled && (
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vínculo de Telefone (DDD + Número)</label>
                  <input type="tel" value={preferences.userPhone || ''} onChange={e => setPreferences({...preferences, userPhone: e.target.value})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm w-full" placeholder="11 99999-9999" />
                </div>
                <button type="button" onClick={handleLinkPhone} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors w-full md:w-auto h-[38px]">
                  Vincular Número
                </button>
              </div>
            )}`;

const newUI = `            {preferences.whatsappEnabled && (
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
            )}`;

content = content.replace(oldUI, newUI);

fs.writeFileSync('src/components/SettingsScreen.tsx', content);
