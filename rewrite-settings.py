import re

content = """import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { SystemPreferences } from '../types';
import { Save, Lock, Brain, Bell, MessageCircle, Cloud, Download, Upload, Trash2, User, LogOut, Wallet } from 'lucide-react';
import { signOut } from 'firebase/auth';

export function SettingsScreen({ userId }: { userId: string }) {
  const [preferences, setPreferences] = useState<SystemPreferences>({
    userId,
    enterDirectly: false,
    accessPin: '',
    biometricEnabled: false,
    aiModel: 'gemini-1.5-flash',
    autoCategoryLearning: true,
    notificationEnabled: false,
    notificationTime: '08:00',
    notificationRepeatCount: 1,
    whatsappEnabled: false,
    userPhone: '',
    backupSchedule: 'OFF'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  
  // Mock data for backup
  const lastBackup = 'Hoje, 22:15';
  const backupSize = '2.4 MB';

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const snap = await getDoc(doc(db, \`users/\${userId}/preferences\`, 'system'));
        if (snap.exists()) {
          setPreferences({ ...preferences, ...snap.data() });
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await setDoc(doc(db, \`users/\${userId}/preferences\`, 'system'), preferences);
      alert('Configurações salvas com sucesso!');
    } catch (err) {
      console.error(err);
      alert('Erro ao salvar configurações.');
    } finally {
      setIsSubmitting(false);
    }
  };
  
  const handleLogout = async () => {
    if (confirm('Deseja realmente sair da conta?')) {
      await signOut(auth);
    }
  };

  const handleSync = () => alert('Sincronizando com a nuvem...');
  const handleExportCSV = () => alert('Exportando para CSV...');
  const handlePasteClipboard = () => alert('Restaurando do Clipboard...');
  const handleTestNotification = () => alert('Testando notificação (Som/Vibração)...');
  const handleDeleteAll = () => {
    if (confirm('ZONA DE RISCO: Deseja EXCLUIR TODOS OS DADOS permanentemente? Isso não pode ser desfeito.')) {
      alert('Dados excluídos (simulação).');
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando configurações...</div>;
  }

  const currentUser = auth.currentUser;

  return (
    <div className="space-y-6 max-w-4xl pb-10">
      <div>
        <h2 className="text-2xl font-bold text-slate-900 tracking-tight">Configurações</h2>
        <p className="text-sm text-slate-500 mt-1">Gerencie seu perfil, backups, segurança e notificações</p>
      </div>

      {/* Perfil e Gestão de Sessão */}
      <div className="bg-white border border-slate-200 rounded-xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600">
            <User className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900 uppercase">{currentUser?.displayName || 'USUÁRIO'}</h3>
            <p className="text-sm text-slate-600 font-medium">{currentUser?.email || 'email@exemplo.com'}</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <Wallet className="w-4 h-4" />
            Gestão de Entradas
          </button>
          <button onClick={handleLogout} className="px-4 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
            <LogOut className="w-4 h-4" />
            Sair
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Central de Backup e Dados */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-2">
            <Cloud className="w-5 h-5 text-blue-600" />
            <h3 className="text-lg font-medium text-slate-900">Central de Backup e Dados</h3>
          </div>
          
          <div className="p-6 space-y-8">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-blue-50/50 p-4 rounded-lg border border-blue-100">
              <div>
                <p className="text-sm text-slate-500 font-medium">Estado do Backup</p>
                <div className="flex gap-4 mt-1">
                  <p className="text-sm text-slate-900">Último Realizado: <span className="font-semibold">{lastBackup}</span></p>
                  <p className="text-sm text-slate-900">Tamanho: <span className="font-semibold">{backupSize}</span></p>
                </div>
              </div>
              <button type="button" onClick={handleSync} className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <Upload className="w-4 h-4" />
                Sincronizar Agora
              </button>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">Ações Manuais</h4>
                <div className="flex gap-2">
                  <button type="button" onClick={handleExportCSV} className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Download className="w-4 h-4" />
                    Exportar para CSV
                  </button>
                  <button type="button" onClick={handlePasteClipboard} className="flex-1 px-4 py-2 border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-medium rounded-lg transition-colors flex items-center justify-center gap-2">
                    <Save className="w-4 h-4" />
                    Colar do Clipboard
                  </button>
                </div>
              </div>

              <div className="space-y-4">
                <h4 className="text-sm font-semibold text-slate-900">Automação</h4>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Programar Backup Automático</label>
                  <select value={preferences.backupSchedule} onChange={e => setPreferences({...preferences, backupSchedule: e.target.value as any})} className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm">
                    <option value="OFF">Desligado (OFF)</option>
                    <option value="DAILY">Diário</option>
                    <option value="WEEKLY">Semanal</option>
                    <option value="MONTHLY">Mensal</option>
                  </select>
                </div>
              </div>
            </div>

            {/* Gestão de Notificações */}
            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 mb-4">
                <Bell className="w-5 h-5 text-amber-500" />
                <h4 className="text-sm font-semibold text-slate-900">Gestão de Notificações em Lote</h4>
              </div>
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center">
                    <input type="checkbox" id="notificationEnabled" checked={preferences.notificationEnabled} onChange={e => setPreferences({...preferences, notificationEnabled: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                    <label htmlFor="notificationEnabled" className="ml-2 text-sm font-medium text-slate-700">Ativar Todos os Alertas de Vencimento</label>
                  </div>
                  <button type="button" onClick={handleTestNotification} className="text-xs bg-slate-100 hover:bg-slate-200 text-slate-700 px-3 py-1.5 rounded-md font-medium transition-colors">
                    Testar Alerta
                  </button>
                </div>
                
                {preferences.notificationEnabled && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 bg-slate-50 p-4 rounded-lg border border-slate-200">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Horário de Disparo (Resumo Matinal)</label>
                      <input type="time" value={preferences.notificationTime || ''} onChange={e => setPreferences({...preferences, notificationTime: e.target.value})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm w-full" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Frequência Diária (Repetições)</label>
                      <div className="flex items-center gap-2">
                        <input type="range" min="1" max="5" value={preferences.notificationRepeatCount} onChange={e => setPreferences({...preferences, notificationRepeatCount: parseInt(e.target.value)})} className="flex-1" />
                        <span className="text-sm font-medium text-slate-700 w-8">{preferences.notificationRepeatCount}x</span>
                      </div>
                    </div>
                  </div>
                )}
                <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded border border-amber-100">
                  <span className="font-semibold">Aviso de Precisão:</span> Para garantir que os alertas toquem no horário exato, remova o OrganizaIA da otimização de bateria nas configurações do seu Android.
                </p>
              </div>
            </div>

            {/* Zona de Risco */}
            <div className="border-t border-slate-200 pt-6">
              <h4 className="text-sm font-semibold text-red-600 mb-2">Zona de Risco</h4>
              <button type="button" onClick={handleDeleteAll} className="px-4 py-2 bg-white border border-red-200 hover:bg-red-50 text-red-600 text-sm font-medium rounded-lg transition-colors flex items-center gap-2">
                <Trash2 className="w-4 h-4" />
                Excluir Tudo (Limpar Dados Permanentemente)
              </button>
            </div>
          </div>
        </div>

        {/* Configurações do App */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-2">
            <Lock className="w-5 h-5 text-slate-600" />
            <h3 className="text-lg font-medium text-slate-900">Configurações do App</h3>
          </div>
          <div className="p-6 space-y-6">
            <div>
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Segurança e Acesso</h4>
              <div className="space-y-4">
                <div className="flex items-center">
                  <input type="checkbox" id="enterDirectly" checked={preferences.enterDirectly} onChange={e => setPreferences({...preferences, enterDirectly: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <label htmlFor="enterDirectly" className="ml-2 text-sm text-slate-700">Entrar Direto (Pular senha em aparelhos confiáveis)</label>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="biometricEnabled" checked={preferences.biometricEnabled} onChange={e => setPreferences({...preferences, biometricEnabled: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600" />
                  <label htmlFor="biometricEnabled" className="ml-2 text-sm text-slate-700 flex items-center gap-2">
                    Ativar desbloqueio por Biometria / Digital
                    {preferences.biometricEnabled && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Digital Ativada</span>}
                  </label>
                </div>
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Definir Novo PIN de Acesso (4 dígitos)</label>
                  <input type="text" maxLength={4} value={preferences.accessPin || ''} onChange={e => setPreferences({...preferences, accessPin: e.target.value.replace(/\\D/g, '')})} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-blue-500 text-sm w-32 tracking-widest text-center" placeholder="****" />
                </div>
              </div>
            </div>

            <div className="border-t border-slate-200 pt-6">
              <div className="flex items-center gap-2 mb-3">
                <Brain className="w-5 h-5 text-purple-600" />
                <h4 className="text-sm font-semibold text-slate-900">Inteligência Artificial</h4>
              </div>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-medium text-slate-500 mb-1">Escolha do Modelo Gemini</label>
                  <select value={preferences.aiModel} onChange={e => setPreferences({...preferences, aiModel: e.target.value as any})} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-purple-500 text-sm w-full md:w-64">
                    <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido e Econômico)</option>
                    <option value="gemini-1.5-pro">Gemini 1.5 Pro (Análises Complexas)</option>
                  </select>
                </div>
                <div className="flex items-center">
                  <input type="checkbox" id="autoCategoryLearning" checked={preferences.autoCategoryLearning} onChange={e => setPreferences({...preferences, autoCategoryLearning: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-purple-600 focus:ring-purple-600" />
                  <label htmlFor="autoCategoryLearning" className="ml-2 text-sm text-slate-700">Aprendizado de Categoria Automático</label>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Integração WhatsApp */}
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
              <div className="bg-slate-50 p-4 rounded-lg border border-slate-200 flex flex-col md:flex-row gap-4 items-end">
                <div className="flex-1 w-full">
                  <label className="block text-xs font-medium text-slate-500 mb-1">Vínculo de Telefone (DDD + Número)</label>
                  <input type="tel" value={preferences.userPhone || ''} onChange={e => setPreferences({...preferences, userPhone: e.target.value})} className="bg-white border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm w-full" placeholder="11 99999-9999" />
                </div>
                <button type="button" onClick={() => alert('Número vinculado com sucesso no banco de dados.')} className="px-6 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-medium rounded-lg transition-colors w-full md:w-auto h-[38px]">
                  Vincular Número
                </button>
              </div>
            )}
          </div>
        </div>

        <div className="flex justify-end pt-4">
          <button disabled={isSubmitting} type="submit" className="bg-blue-600 hover:bg-blue-500 text-white px-8 py-3 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 w-full md:w-auto justify-center">
            <Save className="w-5 h-5" />
            {isSubmitting ? 'Salvando...' : 'Salvar Todas as Configurações'}
          </button>
        </div>
      </form>
    </div>
  );
}
"""

with open('src/components/SettingsScreen.tsx', 'w') as f:
    f.write(content)

