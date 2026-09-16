import React, { useState, useEffect } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { User, signOut } from 'firebase/auth';

interface UserProfileModalProps {
  user: User;
  onComplete: () => void;
  isSettingsMode?: boolean;
  onClose?: () => void;
}

export function UserProfileModal({ user, onComplete, isSettingsMode = false, onClose }: UserProfileModalProps) {
  const [loading, setLoading] = useState(!isSettingsMode);
  const [saving, setSaving] = useState(false);
  
  const [name, setName] = useState(user.displayName || '');
  const [email, setEmail] = useState(user.email || '');
  const [phone, setPhone] = useState('');
  const [financialGoal, setFinancialGoal] = useState('');
  const [monthlyIncomeTarget, setMonthlyIncomeTarget] = useState('');
  const [birthDate, setBirthDate] = useState('');

  const handleCancel = async () => {
    if (isSettingsMode) {
      if (onClose) onClose();
    } else {
      try {
        await signOut(auth);
      } catch (err) {
        console.error('Erro ao sair:', err);
      }
    }
  };

  useEffect(() => {
    // Reset local states to prevent cross-account visual leaks when switching users
    setLoading(!isSettingsMode);
    setName(user.displayName || '');
    setEmail(user.email || '');
    setPhone('');
    setFinancialGoal('');
    setMonthlyIncomeTarget('');
    setBirthDate('');

    const fetchProfile = async () => {
      try {
        const docRef = doc(db, `users/${user.uid}/profile`, 'data');
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          const data = docSnap.data() as UserProfile;
          setName(data.name || user.displayName || '');
          setEmail(data.email || user.email || '');
          setPhone(data.phone || '');
          setFinancialGoal(data.financialGoal || '');
          setMonthlyIncomeTarget(data.monthlyIncomeTarget ? String(data.monthlyIncomeTarget) : '');
          setBirthDate(data.birthDate || '');
          
          if (!isSettingsMode && data.name && data.email) {
            // Profile exists and is valid, skip modal
            onComplete();
            return;
          }
        }
      } catch (err) {
        console.error('Error fetching user profile:', err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchProfile();
  }, [user.uid, isSettingsMode, onComplete, user.displayName, user.email]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    
    try {
      const profile: UserProfile = {
        userId: user.uid,
        name,
        email,
        phone: phone || null,
        financialGoal: financialGoal || null,
        monthlyIncomeTarget: monthlyIncomeTarget ? Number(monthlyIncomeTarget) : null,
        birthDate: birthDate || null,
        createdAt: Date.now()
      };
      
      await setDoc(doc(db, `users/${user.uid}/profile`, 'data'), profile, { merge: true });
      onComplete();
    } catch (err) {
      console.error('Error saving user profile:', err);
      alert('Erro ao salvar o perfil.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-white"></div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-slate-900/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-slate-100 flex justify-between items-center bg-slate-50">
          <div>
            <h2 className="text-xl font-bold text-slate-800">
              {isSettingsMode ? 'Editar Perfil' : 'Complete seu Cadastro'}
            </h2>
            <p className="text-sm text-slate-500 mt-1">
              {isSettingsMode ? 'Atualize suas informações pessoais e objetivos.' : 'Precisamos de algumas informações para personalizar sua experiência.'}
            </p>
          </div>
          <button 
            type="button" 
            onClick={handleCancel} 
            className="text-slate-400 hover:text-slate-600 p-1 hover:bg-slate-100 rounded-lg transition-colors"
            title="Cancelar"
          >
            ✕
          </button>
        </div>
        
        <div className="p-6 overflow-y-auto">
          <form id="profile-form" onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Nome Completo *</label>
              <input
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Seu nome"
              />
            </div>
            
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">E-mail *</label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 bg-slate-50"
                readOnly
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Telefone / WhatsApp</label>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="(00) 00000-0000"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Data de Nascimento</label>
                <input
                  type="date"
                  value={birthDate}
                  onChange={(e) => setBirthDate(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Meta Financeira Principal</label>
              <input
                type="text"
                value={financialGoal}
                onChange={(e) => setFinancialGoal(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="Ex: Comprar um carro, Viagem, Reserva de Emergência..."
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Alvo de Renda Mensal (R$)</label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={monthlyIncomeTarget}
                onChange={(e) => setMonthlyIncomeTarget(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                placeholder="0,00"
              />
            </div>
          </form>
        </div>
        
        <div className="p-6 border-t border-slate-100 bg-slate-50 flex justify-end gap-3">
          <button
            type="button"
            onClick={handleCancel}
            className="px-4 py-2 font-medium text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="profile-form"
            disabled={saving}
            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors flex items-center gap-2"
          >
            {saving ? (
              <span className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
            ) : null}
            {isSettingsMode ? 'Salvar Alterações' : 'Concluir Cadastro'}
          </button>
        </div>
      </div>
    </div>
  );
}
