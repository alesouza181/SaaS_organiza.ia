import React, { useState, useEffect, useRef } from 'react';
import { db, auth } from '../firebaseConfig';
import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, addDoc, Timestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { SystemPreferences, WhatsAppLog, NotificationFrequency } from '../types';
import { Save, Lock, Brain, Bell, MessageCircle, Cloud, Download, Upload, Trash2, User, LogOut, Wallet, UserCog, CheckCircle2, Clock, XCircle, Send, Calendar, AlertTriangle, Plus, X, Volume2, Sparkles, Check, Music, Play, Square, FileAudio, RotateCcw, KeyRound, Laptop, Monitor, Smartphone, ShieldCheck, DownloadCloud } from 'lucide-react';
import { UserProfileModal } from './UserProfileModal';
import { PinConfirmModal } from './PinConfirmModal';
import { signOut } from 'firebase/auth';
import { isAppInstalled, promptPWAInstall, subscribeToInstallPrompt } from '../services/pwaService';
import { requestNotificationPermission, dispatchSystemNotification } from '../services/notificationService';
import { playNotificationSound } from '../services/notificationAudio';
import { PWAInstallModal } from './PWAInstallModal';
import { usePWAInstall } from '../hooks/usePWAInstall';

export function SettingsScreen({ userId, onNavigateToIncomes }: { userId: string; onNavigateToIncomes?: () => void }) {
  const [preferences, setPreferences] = useState<SystemPreferences>({
    userId,
    enterDirectly: false,
    accessPin: '',
    biometricEnabled: false,
    allowEditPaidExpenses: false,
    aiModel: 'gemini-1.5-flash',
    autoCategoryLearning: true,
    notificationEnabled: false,
    notificationTime: '08:00',
    notificationTimes: ['08:00'],
    notificationRepeatCount: 1,
    notificationFrequency: 'DAILY',
    notificationDays: [0, 1, 2, 3, 4, 5, 6],
    notifyOnDueDate: true,
    notifyDaysBefore: [1, 3],
    notifyOverdue: true,
    notificationSound: 'classic',
    customNotificationSoundUrl: null,
    customNotificationSoundName: null,
    whatsappEnabled: false,
    userPhone: '',
    backupSchedule: 'OFF',
    whatsappTemplate: 'Olá! Sua fatura {categoria} no valor de R$ {valor} vence em {data}.'
  });
  
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [showProfileModal, setShowProfileModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isLinkingPhone, setIsLinkingPhone] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState(false);
  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [testAlertToast, setTestAlertToast] = useState<string | null>(null);
  const [playingSoundId, setPlayingSoundId] = useState<string | null>(null);
  const [audioFileError, setAudioFileError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const backupFileInputRef = useRef<HTMLInputElement>(null);
  const audioPreviewRef = useRef<HTMLAudioElement | null>(null);
  const audioCtxRef = useRef<AudioContext | null>(null);

  // Backup & sync state
  const [lastBackup, setLastBackup] = useState<string>('Nunca sincronizado');
  const [backupSize, setBackupSize] = useState<string>('--');
  const [isSyncing, setIsSyncing] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [syncStatusMsg, setSyncStatusMsg] = useState<string | null>(null);

  // Reopen & Edit Paid Expenses Security PIN State
  const [showPinModalForEditPaid, setShowPinModalForEditPaid] = useState(false);
  const [editPaidToast, setEditPaidToast] = useState<string | null>(null);

  // PWA & Desktop Integration State
  const [isAppInstalledState, setIsAppInstalledState] = useState<boolean>(false);
  const [canInstallPWA, setCanInstallPWA] = useState<boolean>(false);
  const [notifPermission, setNotifPermission] = useState<NotificationPermission>('default');
  const [showPwaModal, setShowPwaModal] = useState<boolean>(false);
  const { isInstallable: pwaInstallable, isInstalled: pwaInstalled, isIOS: pwaIOS, isAndroid: pwaAndroid, install: pwaDirectInstall } = usePWAInstall();

  useEffect(() => {
    setIsAppInstalledState(isAppInstalled());
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setNotifPermission(Notification.permission);
    }
    const unsub = subscribeToInstallPrompt((canInstall) => {
      setCanInstallPWA(canInstall);
      setIsAppInstalledState(isAppInstalled());
    });
    return () => unsub();
  }, []);

  const handleRequestNotifPermission = async () => {
    const perm = await requestNotificationPermission();
    setNotifPermission(perm);
    if (perm === 'granted') {
      setTestAlertToast('Permissão de notificações concedida com sucesso no sistema!');
      setTimeout(() => setTestAlertToast(null), 4000);
    }
  };

  const handleInstallAppClick = async () => {
    const accepted = await promptPWAInstall();
    if (accepted) {
      setIsAppInstalledState(true);
      setTestAlertToast('Aplicativo instalado com sucesso no seu computador!');
      setTimeout(() => setTestAlertToast(null), 5000);
    }
  };

  const formatPhone = (value: string) => {
    const v = value.replace(/\D/g, '');
    if (v.length <= 10) {
      return v.replace(/(\d{2})(\d{4})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
    }
    return v.replace(/(\d{2})(\d{5})(\d{0,4})/, '($1) $2-$3').replace(/-$/, '');
  };

  // Safe AudioContext Singleton
  const getAudioContext = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return null;
      if (!audioCtxRef.current || audioCtxRef.current.state === 'closed') {
        audioCtxRef.current = new AudioCtx();
      }
      if (audioCtxRef.current.state === 'suspended') {
        audioCtxRef.current.resume();
      }
      return audioCtxRef.current;
    } catch {
      return null;
    }
  };

  useEffect(() => {
    return () => {
      if (audioCtxRef.current && audioCtxRef.current.state !== 'closed') {
        audioCtxRef.current.close().catch(() => {});
      }
    };
  }, []);

  useEffect(() => {
    const fetchPrefs = async () => {
      try {
        const snap = await getDoc(doc(db, `users/${userId}/preferences`, 'system'));
        const profileSnap = await getDoc(doc(db, `users/${userId}/profile`, 'data'));
        
        let prefsData = snap.exists() ? snap.data() : {};
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          if (profileData.phone && !prefsData.userPhone) {
            prefsData.userPhone = profileData.phone;
          }
        }
        
        // Recover custom audio if saved in localStorage
        const cachedAudio = localStorage.getItem(`custom_notif_audio_${userId}`);
        let customAudioUrl = prefsData.customNotificationSoundUrl || null;
        if (customAudioUrl === '__LOCAL_STORAGE__' || (!customAudioUrl && cachedAudio)) {
          customAudioUrl = cachedAudio;
        }

        if (prefsData.lastBackupDate) {
          try {
            const date = prefsData.lastBackupDate.toDate ? prefsData.lastBackupDate.toDate() : new Date(prefsData.lastBackupDate);
            setLastBackup(date.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
          } catch {
            setLastBackup('Recente');
          }
        }
        if (prefsData.lastBackupSize) {
          setBackupSize(prefsData.lastBackupSize);
        }
        
        if (Object.keys(prefsData).length > 0) {
          // Normalize notification times
          const times = prefsData.notificationTimes && Array.isArray(prefsData.notificationTimes) && prefsData.notificationTimes.length > 0
            ? prefsData.notificationTimes
            : [prefsData.notificationTime || '08:00'];

          setPreferences((prev: any) => ({ 
            ...prev, 
            ...prefsData,
            notificationTimes: times,
            notificationRepeatCount: prefsData.notificationRepeatCount || times.length || 1,
            notificationFrequency: prefsData.notificationFrequency || 'DAILY',
            notificationDays: prefsData.notificationDays || [0, 1, 2, 3, 4, 5, 6],
            notifyOnDueDate: prefsData.notifyOnDueDate ?? true,
            notifyDaysBefore: prefsData.notifyDaysBefore || [1, 3],
            notifyOverdue: prefsData.notifyOverdue ?? true,
            notificationSound: prefsData.notificationSound || 'classic',
            customNotificationSoundUrl: customAudioUrl,
            customNotificationSoundName: prefsData.customNotificationSoundName || null,
          }));
        }

        const logsQuery = query(collection(db, `users/${userId}/whatsapp_logs`), orderBy('date', 'desc'), limit(10));
        const logsSnap = await getDocs(logsQuery);
        setWhatsappLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhatsAppLog)));
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
      // Avoid Firestore 1MB document quota overflow:
      // If custom audio is large (> 200KB), store in localStorage and write reference in Firestore
      const prefsToSave = { ...preferences };
      if (prefsToSave.customNotificationSoundUrl && prefsToSave.customNotificationSoundUrl.length > 150000) {
        localStorage.setItem(`custom_notif_audio_${userId}`, prefsToSave.customNotificationSoundUrl);
        prefsToSave.customNotificationSoundUrl = '__LOCAL_STORAGE__';
      }

      await setDoc(doc(db, `users/${userId}/preferences`, 'system'), prefsToSave);
      
      // Also update the phone in the profile if it was changed
      if (preferences.userPhone) {
        await setDoc(doc(db, `users/${userId}/profile`, 'data'), { phone: preferences.userPhone }, { merge: true });
      }

      alert('Configurações salvas com sucesso!');
    } catch (err: any) {
      console.error(err);
      alert(`Erro ao salvar configurações: ${err?.message || err}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleInitiateToggleEditPaid = () => {
    if (!preferences.accessPin || preferences.accessPin.trim().length < 4) {
      alert('Para habilitar ou alterar esta função, defina e salve primeiro um PIN de acesso de 4 dígitos no campo "Definir Novo PIN de Acesso" acima.');
      return;
    }
    setShowPinModalForEditPaid(true);
  };

  const handlePinSuccessForEditPaid = async () => {
    const nextVal = !preferences.allowEditPaidExpenses;
    setPreferences(prev => ({ ...prev, allowEditPaidExpenses: nextVal }));
    try {
      await setDoc(doc(db, `users/${userId}/preferences`, 'system'), {
        ...preferences,
        allowEditPaidExpenses: nextVal
      }, { merge: true });
      setEditPaidToast(
        nextVal 
          ? '✓ Função ATIVADA: Agora você pode reabrir e editar despesas liquidadas.' 
          : '✓ Função DESATIVADA: Despesas liquidadas voltaram ao modo protegido.'
      );
      setTimeout(() => setEditPaidToast(null), 4500);
    } catch (err: any) {
      console.error('Erro ao salvar preferência:', err);
      alert('Erro ao atualizar configuração: ' + (err?.message || err));
    }
  };

  const handleLinkPhone = async () => {
    if (!preferences.userPhone || preferences.userPhone.replace(/\D/g, '').length < 10) {
      alert('Digite um número de telefone válido com DDD.');
      return;
    }
    setIsLinkingPhone(true);
    try {
      await setDoc(doc(db, `users/${userId}/preferences`, 'system'), { userPhone: preferences.userPhone }, { merge: true });
      await setDoc(doc(db, `users/${userId}/profile`, 'data'), { phone: preferences.userPhone }, { merge: true });
      setLinkSuccess(true);
      setTimeout(() => setLinkSuccess(false), 3000);
    } catch (err) {
      console.error(err);
      alert('Erro ao vincular número.');
    } finally {
      setIsLinkingPhone(false);
    }
  };

  const handleTestConnection = async () => {
    if (!preferences.userPhone) {
      alert('Vincule um número de telefone primeiro.');
      return;
    }
    setIsTestingConnection(true);
    try {
      // Clean phone number to get digits only
      let cleanPhone = preferences.userPhone.replace(/\D/g, '');
      // If no country code, default to 55 (Brazil)
      if (cleanPhone.length === 11 || cleanPhone.length === 10) {
        cleanPhone = '55' + cleanPhone;
      }

      const testMessage = preferences.whatsappTemplate
        ? preferences.whatsappTemplate
            .replace('{valor}', '150,00')
            .replace('{data}', new Date().toLocaleDateString('pt-BR'))
            .replace('{categoria}', 'Teste')
        : 'Mensagem de teste do OrganizaIA';
        
      const newLog: Omit<WhatsAppLog, 'id'> = {
        userId,
        date: Timestamp.now(),
        status: 'sent',
        message: testMessage,
        contact: preferences.userPhone
      };
      
      const docRef = await addDoc(collection(db, `users/${userId}/whatsapp_logs`), newLog);
      setWhatsappLogs(prev => [{ id: docRef.id, ...newLog }, ...prev]);

      // Open WhatsApp Web/App so the message is ACTUALLY SENT!
      const waUrl = `https://api.whatsapp.com/send?phone=${cleanPhone}&text=${encodeURIComponent(testMessage)}`;
      window.open(waUrl, '_blank');

      alert('Conexão testada! O OrganizaIA registrou o envio no log do sistema e abriu o seu WhatsApp para que você envie a mensagem real de teste com 1 clique de forma gratuita!');
    } catch (error) {
      console.error(error);
      alert('Erro ao testar conexão.');
      
      const errorLog: Omit<WhatsAppLog, 'id'> = {
        userId,
        date: Timestamp.now(),
        status: 'error',
        message: 'Falha ao enviar mensagem de teste.',
        contact: preferences.userPhone || 'Desconhecido'
      };
      const docRef = await addDoc(collection(db, `users/${userId}/whatsapp_logs`), errorLog);
      setWhatsappLogs(prev => [{ id: docRef.id, ...errorLog }, ...prev]);
    } finally {
      setIsTestingConnection(false);
    }
  };

  
  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error("Error signing out: ", error);
    }
  };

  const playSoundByType = (soundId?: string, customUrlOverride?: string | null) => {
    const sound = soundId || preferences.notificationSound || 'classic';
    const customUrl = customUrlOverride !== undefined ? customUrlOverride : preferences.customNotificationSoundUrl;

    setPlayingSoundId(sound);
    setTimeout(() => {
      setPlayingSoundId(prev => prev === sound ? null : prev);
    }, 1200);

    // If custom sound and URL exists
    if (sound === 'custom') {
      if (customUrl) {
        try {
          if (audioPreviewRef.current) {
            audioPreviewRef.current.pause();
            audioPreviewRef.current.currentTime = 0;
          }
          const audio = new Audio(customUrl);
          audioPreviewRef.current = audio;
          audio.volume = 0.9;
          audio.play().catch(err => {
            console.warn('Playback error for custom audio:', err);
          });
          audio.onended = () => {
            setPlayingSoundId(null);
          };
        } catch (err) {
          console.warn('Audio tag failed:', err);
        }
      }
      return;
    }

    // Synthesizer with Web Audio API singleton for presets
    try {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      if (sound === 'chime') {
        // 4-note marimba: C5, E5, G5, C6
        const notes = [523.25, 659.25, 783.99, 1046.50];
        notes.forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.08);
          gain.gain.setValueAtTime(0.18, now + i * 0.08);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.08 + 0.35);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.08);
          osc.stop(now + i * 0.08 + 0.36);
        });
      } else if (sound === 'bell') {
        // Crystal bell harmonics
        [880, 1760, 2640].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now);
          const initialGain = 0.22 / (idx + 1);
          gain.gain.setValueAtTime(initialGain, now);
          gain.gain.exponentialRampToValueAtTime(0.001, now + 0.85);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now);
          osc.stop(now + 0.86);
        });
      } else if (sound === 'modern') {
        // Tech double blip
        [1200, 1800].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + i * 0.11);
          gain.gain.setValueAtTime(0.2, now + i * 0.11);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.09);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.11);
          osc.stop(now + i * 0.11 + 0.1);
        });
      } else if (sound === 'zen') {
        // 432Hz deep bowl
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(432, now);
        gain.gain.setValueAtTime(0.25, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 1.2);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 1.21);
      } else if (sound === 'cash') {
        // Cash register coin jingle
        [987.77, 1318.51, 1760.00].forEach((freq, i) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'triangle';
          osc.frequency.setValueAtTime(freq, now + i * 0.07);
          gain.gain.setValueAtTime(0.2, now + i * 0.07);
          gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.07 + 0.3);
          osc.connect(gain);
          gain.connect(ctx.destination);
          osc.start(now + i * 0.07);
          osc.stop(now + i * 0.07 + 0.31);
        });
      } else {
        // Classic D5 -> A5
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(587.33, now);
        osc.frequency.setValueAtTime(880, now + 0.15);
        gain.gain.setValueAtTime(0.22, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.45);
        osc.connect(gain);
        gain.connect(ctx.destination);
        osc.start(now);
        osc.stop(now + 0.46);
      }
    } catch (e) {
      console.warn('AudioContext error:', e);
    }
  };

  const handleTestNotification = async () => {
    playSoundByType();
    
    // Dispara via Service Worker e Notificação Nativa do Sistema com o ícone do sistema
    await dispatchSystemNotification({
      title: '🔔 OrganizaIA - Alerta de Teste',
      body: `Você tem 2 faturas simuladas vencendo hoje (R$ 340,00)! Horários configurados: ${(preferences.notificationTimes || ['08:00']).join(', ')}.`,
      url: '/?tab=transactions',
      tag: 'test-alert',
      sound: preferences.notificationSound || 'classic',
      customSoundUrl: preferences.customNotificationSoundUrl,
    });

    const soundLabel = preferences.notificationSound === 'custom' 
      ? `Áudio Importado (${preferences.customNotificationSoundName || 'Personalizado'})`
      : preferences.notificationSound === 'chime' ? 'Marimba Suave'
      : preferences.notificationSound === 'bell' ? 'Campainha Cristal'
      : preferences.notificationSound === 'modern' ? 'Alerta Moderno'
      : preferences.notificationSound === 'zen' ? 'Tigela Zen'
      : preferences.notificationSound === 'cash' ? 'Tilintar de Moedas'
      : 'Sino Clássico';

    setTestAlertToast(
      `Alerta de teste emitido com som "${soundLabel}" e ícone nativo! ${(preferences.notificationTimes || ['08:00']).length}x ao dia nos horários: ${(preferences.notificationTimes || ['08:00']).join(', ')}.`
    );
    setTimeout(() => setTestAlertToast(null), 6000);
  };

  const handleAudioFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Safety constraint: max 1 MB for audio to avoid high memory / storage
    if (file.size > 1024 * 1024) {
      setAudioFileError('Por favor, escolha um áudio curto de até 1 MB para efeito sonoro de notificação.');
      return;
    }

    setAudioFileError(null);
    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (dataUrl) {
        // Cache locally to prevent document bloat
        try {
          localStorage.setItem(`custom_notif_audio_${userId}`, dataUrl);
        } catch (storageErr) {
          console.warn('LocalStorage audio quota:', storageErr);
        }

        setPreferences(prev => ({
          ...prev,
          notificationSound: 'custom',
          customNotificationSoundUrl: dataUrl,
          customNotificationSoundName: file.name
        }));
        // Test imported audio immediately
        playSoundByType('custom', dataUrl);
      }
    };
    reader.readAsDataURL(file);
  };

  const handleRemoveCustomAudio = () => {
    if (audioPreviewRef.current) {
      audioPreviewRef.current.pause();
    }
    localStorage.removeItem(`custom_notif_audio_${userId}`);
    setPreferences(prev => ({
      ...prev,
      notificationSound: 'classic',
      customNotificationSoundUrl: null,
      customNotificationSoundName: null
    }));
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const toggleDaysBefore = (days: number) => {
    const current = preferences.notifyDaysBefore || [];
    const next = current.includes(days) ? current.filter(d => d !== days) : [...current, days].sort((a, b) => a - b);
    setPreferences({ ...preferences, notifyDaysBefore: next });
  };

  const toggleCustomDay = (dayIndex: number) => {
    const current = preferences.notificationDays || [];
    const next = current.includes(dayIndex) ? current.filter(d => d !== dayIndex) : [...current, dayIndex].sort((a, b) => a - b);
    setPreferences({ ...preferences, notificationDays: next });
  };

  const handleRepeatCountChange = (count: number) => {
    const defaultSuggestions = ['08:00', '12:30', '16:00', '19:30', '21:00'];
    let currentTimes = [...(preferences.notificationTimes || ['08:00'])];
    if (count > currentTimes.length) {
      while (currentTimes.length < count) {
        currentTimes.push(defaultSuggestions[currentTimes.length] || '12:00');
      }
    } else if (count < currentTimes.length) {
      currentTimes = currentTimes.slice(0, count);
    }
    setPreferences({
      ...preferences,
      notificationRepeatCount: count,
      notificationTimes: currentTimes,
      notificationTime: currentTimes[0] || '08:00'
    });
  };

  const handleTimeChange = (index: number, newTime: string) => {
    const currentTimes = [...(preferences.notificationTimes || ['08:00'])];
    currentTimes[index] = newTime;
    setPreferences({
      ...preferences,
      notificationTimes: currentTimes,
      notificationTime: currentTimes[0] || newTime
    });
  };

  const handleAddTime = () => {
    const defaultSuggestions = ['08:00', '12:30', '16:00', '19:30', '21:00', '22:00'];
    const currentTimes = [...(preferences.notificationTimes || ['08:00'])];
    if (currentTimes.length >= 6) return;
    const nextTime = defaultSuggestions[currentTimes.length] || '12:00';
    currentTimes.push(nextTime);
    setPreferences({
      ...preferences,
      notificationTimes: currentTimes,
      notificationRepeatCount: currentTimes.length,
      notificationTime: currentTimes[0]
    });
  };

  const handleRemoveTime = (index: number) => {
    const currentTimes = [...(preferences.notificationTimes || ['08:00'])];
    if (currentTimes.length <= 1) return;
    currentTimes.splice(index, 1);
    setPreferences({
      ...preferences,
      notificationTimes: currentTimes,
      notificationRepeatCount: currentTimes.length,
      notificationTime: currentTimes[0] || '08:00'
    });
  };

  // Real Cloud Synchronization
  const handleSync = async () => {
    if (!userId) return;
    setIsSyncing(true);
    setSyncStatusMsg(null);
    try {
      const [accountsSnap, incomesSnap, categoriesSnap, logsSnap] = await Promise.all([
        getDocs(collection(db, `users/${userId}/accounts_payable`)),
        getDocs(collection(db, `users/${userId}/incomes`)),
        getDocs(collection(db, `users/${userId}/categories`)),
        getDocs(collection(db, `users/${userId}/whatsapp_logs`))
      ]);

      const totalRecords = accountsSnap.size + incomesSnap.size + categoriesSnap.size + logsSnap.size;
      const allData = {
        accounts: accountsSnap.docs.map(d => d.data()),
        incomes: incomesSnap.docs.map(d => d.data()),
        categories: categoriesSnap.docs.map(d => d.data()),
        preferences: preferences
      };
      
      const approxBytes = new Blob([JSON.stringify(allData)]).size;
      const formattedSize = approxBytes > 1024 * 1024 
        ? `${(approxBytes / (1024 * 1024)).toFixed(1)} MB`
        : `${(approxBytes / 1024).toFixed(1)} KB`;

      const now = new Date();
      const formattedDate = now.toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' });

      setLastBackup(formattedDate);
      setBackupSize(formattedSize);

      // Save sync status to preferences
      await setDoc(doc(db, `users/${userId}/preferences`, 'system'), {
        lastBackupDate: Timestamp.now(),
        lastBackupSize: formattedSize
      }, { merge: true });

      setSyncStatusMsg(`Sincronização concluída com sucesso! ${totalRecords} registros seguros na nuvem (${formattedSize}).`);
      setTimeout(() => setSyncStatusMsg(null), 6000);
    } catch (err: any) {
      console.error('Erro na sincronização:', err);
      alert(`Falha na sincronização: ${err?.message || err}`);
    } finally {
      setIsSyncing(false);
    }
  };

  // Real Export to CSV
  const handleExportCSV = async () => {
    if (!userId) return;
    setIsExporting(true);
    try {
      const [accountsSnap, incomesSnap, categoriesSnap] = await Promise.all([
        getDocs(collection(db, `users/${userId}/accounts_payable`)),
        getDocs(collection(db, `users/${userId}/incomes`)),
        getDocs(collection(db, `users/${userId}/categories`))
      ]);

      const categoriesMap = new Map<string, string>();
      categoriesSnap.docs.forEach(d => {
        const data = d.data();
        categoriesMap.set(d.id, data.name || 'Geral');
      });

      const headers = ['Tipo', 'Descrição', 'Categoria', 'Valor (R$)', 'Data Vencimento/Competência', 'Status', 'Recorrente', 'Observações', 'Data Pagamento'];
      const rows: string[][] = [headers];

      accountsSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        const catName = d.categoryId ? (categoriesMap.get(d.categoryId) || d.categoryName || 'Despesa') : (d.categoryName || 'Despesa');
        const dueDate = d.dueDate ? (typeof d.dueDate === 'string' ? d.dueDate : d.dueDate.toDate ? d.dueDate.toDate().toISOString().split('T')[0] : '') : '';
        const paidDate = d.paidAt ? (typeof d.paidAt === 'string' ? d.paidAt : d.paidAt.toDate ? d.paidAt.toDate().toISOString().split('T')[0] : '') : '';

        rows.push([
          'Despesa',
          `"${(d.description || '').replace(/"/g, '""')}"`,
          `"${catName.replace(/"/g, '""')}"`,
          (Number(d.amount) || 0).toFixed(2).replace('.', ','),
          dueDate,
          d.status === 'paid' ? 'Pago' : d.status === 'late' ? 'Vencido' : 'Pendente',
          d.isRecurring ? 'Sim' : 'Não',
          `"${(d.notes || '').replace(/"/g, '""')}"`,
          paidDate
        ]);
      });

      incomesSnap.docs.forEach(docSnap => {
        const d = docSnap.data();
        const incDate = d.date ? (typeof d.date === 'string' ? d.date : d.date.toDate ? d.date.toDate().toISOString().split('T')[0] : '') : '';
        rows.push([
          'Receita',
          `"${(d.description || d.source || '').replace(/"/g, '""')}"`,
          `"${(d.category || 'Receita').replace(/"/g, '""')}"`,
          (Number(d.amount) || 0).toFixed(2).replace('.', ','),
          incDate,
          'Recebido',
          d.isRecurring ? 'Sim' : 'Não',
          `"${(d.notes || '').replace(/"/g, '""')}"`,
          incDate
        ]);
      });

      const csvString = '\uFEFF' + rows.map(r => r.join(';')).join('\r\n');
      const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const todayStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `organiza_ia_lancamentos_${todayStr}.csv`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao exportar CSV:', err);
      alert(`Falha ao exportar CSV: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Real Full Backup to JSON
  const handleExportJSON = async () => {
    if (!userId) return;
    setIsExporting(true);
    try {
      const [accountsSnap, incomesSnap, categoriesSnap, prefsSnap] = await Promise.all([
        getDocs(collection(db, `users/${userId}/accounts_payable`)),
        getDocs(collection(db, `users/${userId}/incomes`)),
        getDocs(collection(db, `users/${userId}/categories`)),
        getDoc(doc(db, `users/${userId}/preferences`, 'system'))
      ]);

      const backupData = {
        app: 'OrganizaIA',
        version: '2.0',
        exportedAt: new Date().toISOString(),
        userId,
        accounts_payable: accountsSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        incomes: incomesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        categories: categoriesSnap.docs.map(d => ({ id: d.id, ...d.data() })),
        preferences: prefsSnap.exists() ? prefsSnap.data() : preferences
      };

      const jsonStr = JSON.stringify(backupData, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.setAttribute('href', url);
      const todayStr = new Date().toISOString().split('T')[0];
      link.setAttribute('download', `organiza_ia_backup_completo_${todayStr}.json`);
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch (err: any) {
      console.error('Erro ao exportar JSON:', err);
      alert(`Falha ao gerar arquivo de backup: ${err?.message || err}`);
    } finally {
      setIsExporting(false);
    }
  };

  // Restore payload from JSON object
  const processImportData = async (data: any) => {
    if (!data || typeof data !== 'object') {
      throw new Error('Formato de dados inválido.');
    }

    const accounts = Array.isArray(data.accounts_payable) ? data.accounts_payable : [];
    const incomes = Array.isArray(data.incomes) ? data.incomes : [];
    const categories = Array.isArray(data.categories) ? data.categories : [];

    if (accounts.length === 0 && incomes.length === 0 && categories.length === 0) {
      throw new Error('Nenhum dado financeiro reconhecido no arquivo (despesas, receitas ou categorias).');
    }

    const confirmed = window.confirm(
      `Confirmar restauração de dados?\n\n- ${accounts.length} Despesas/Faturas\n- ${incomes.length} Receitas/Entradas\n- ${categories.length} Categorias\n\nOs registros serão integrados com segurança ao seu banco de dados.`
    );

    if (!confirmed) return;

    setIsImporting(true);
    try {
      const batch = writeBatch(db);

      categories.forEach((cat: any) => {
        const { id, ...rest } = cat;
        const ref = id ? doc(db, `users/${userId}/categories`, id) : doc(collection(db, `users/${userId}/categories`));
        batch.set(ref, rest, { merge: true });
      });

      accounts.forEach((acc: any) => {
        const { id, ...rest } = acc;
        const ref = id ? doc(db, `users/${userId}/accounts_payable`, id) : doc(collection(db, `users/${userId}/accounts_payable`));
        batch.set(ref, rest, { merge: true });
      });

      incomes.forEach((inc: any) => {
        const { id, ...rest } = inc;
        const ref = id ? doc(db, `users/${userId}/incomes`, id) : doc(collection(db, `users/${userId}/incomes`));
        batch.set(ref, rest, { merge: true });
      });

      await batch.commit();
      alert(`Restauração concluída com sucesso! Foram importados: ${accounts.length} despesas, ${incomes.length} receitas e ${categories.length} categorias.`);
      window.location.reload();
    } catch (batchErr: any) {
      console.error('Erro na gravação do backup:', batchErr);
      alert(`Falha ao restaurar dados: ${batchErr?.message || batchErr}`);
    } finally {
      setIsImporting(false);
    }
  };

  const handleBackupFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const content = event.target?.result as string;
        const parsed = JSON.parse(content);
        await processImportData(parsed);
      } catch (err: any) {
        alert(`Erro ao ler arquivo de backup: ${err?.message || 'Arquivo corrompido ou formato inválido.'}`);
      } finally {
        if (backupFileInputRef.current) {
          backupFileInputRef.current.value = '';
        }
      }
    };
    reader.readAsText(file);
  };

  const handlePasteClipboard = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (!text || text.trim().length === 0) {
        alert('A área de transferência está vazia. Copie um JSON de backup antes de colar.');
        return;
      }
      const parsed = JSON.parse(text);
      await processImportData(parsed);
    } catch (err: any) {
      const manualInput = window.prompt('Cole o código JSON do seu backup abaixo:');
      if (manualInput && manualInput.trim().length > 0) {
        try {
          const parsed = JSON.parse(manualInput);
          await processImportData(parsed);
        } catch (parseErr: any) {
          alert(`JSON inválido: ${parseErr?.message || parseErr}`);
        }
      }
    }
  };
  const handleDeleteAll = async () => {
    if (!userId) return;
    setIsSubmitting(true);
    try {
      const batch = writeBatch(db);
      
      // 1. Fetch & add accounts to batch
      const accountsSnap = await getDocs(collection(db, `users/${userId}/accounts_payable`));
      accountsSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 2. Fetch & add categories to batch
      const categoriesSnap = await getDocs(collection(db, `users/${userId}/categories`));
      categoriesSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 3. Fetch & add incomes to batch
      const incomesSnap = await getDocs(collection(db, `users/${userId}/incomes`));
      incomesSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 4. Fetch & add whatsapp logs to batch
      const logsSnap = await getDocs(collection(db, `users/${userId}/whatsapp_logs`));
      logsSnap.docs.forEach(d => batch.delete(d.ref));
      
      // 5. Add profile and preferences to batch
      batch.delete(doc(db, `users/${userId}/profile`, 'data'));
      batch.delete(doc(db, `users/${userId}/preferences`, 'system'));
      
      // Commit the batch deletion
      await batch.commit();
      
      // Clear migration flag from localStorage so default categories can be reloaded on refresh
      localStorage.removeItem(`migration_done_v2_${userId}`);
      
      // Reset local preferences state
      setPreferences({
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
        backupSchedule: 'OFF',
        whatsappTemplate: 'Olá! Sua fatura {categoria} no valor de R$ {valor} vence em {data}.'
      });
      setWhatsappLogs([]);
      setShowDeleteConfirm(false);
      
      alert('Todos os seus dados pessoais foram excluídos com sucesso do banco de dados! O sistema será reiniciado para restabelecer os dados padrões.');
      window.location.reload();
    } catch (error: any) {
      console.error("Erro ao excluir dados: ", error);
      alert(`Ocorreu um erro ao excluir seus dados: ${error?.message || error}. Por favor, tente novamente.`);
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return <div className="p-8 text-slate-500">Carregando configurações...</div>;
  }

  const currentUser = auth.currentUser;

  return (
    <div className="space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configurações</h2>
          <p className="text-sm text-slate-500 mt-1">Gerencie seu perfil, preferências, backups, segurança e notificações</p>
        </div>
        <div className="flex items-center gap-2">
          <button 
            disabled={isSubmitting} 
            type="button"
            onClick={(e) => handleSave(e as any)}
            className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-sm font-semibold rounded-lg transition-all flex items-center gap-2 shadow-xs cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>{isSubmitting ? 'Salvando...' : 'Salvar Alterações'}</span>
          </button>
        </div>
      </div>

      {/* Perfil e Gestão de Sessão */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 sm:p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 min-w-0">
          <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 shrink-0">
            <User className="w-6 h-6" />
          </div>
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 uppercase break-all sm:break-words leading-tight">{currentUser?.displayName || 'USUÁRIO'}</h3>
            <p className="text-xs sm:text-sm text-slate-600 font-medium truncate">{currentUser?.email || 'email@exemplo.com'}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 sm:gap-3 w-full md:w-auto">
          <button type="button" onClick={onNavigateToIncomes} className="flex-1 md:flex-none justify-center px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
            <Wallet className="w-4 h-4" />
            <span className="truncate">Entradas</span>
          </button>
          <button type="button" onClick={() => setShowProfileModal(true)} className="flex-1 md:flex-none justify-center px-3 py-2 bg-blue-50 hover:bg-blue-100 text-blue-600 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
            <UserCog className="w-4 h-4" />
            <span className="truncate">Editar Perfil</span>
          </button>
          <button type="button" onClick={handleLogout} className="flex-1 md:flex-none justify-center px-3 py-2 bg-red-50 hover:bg-red-100 text-red-600 text-xs sm:text-sm font-medium rounded-lg transition-colors flex items-center gap-1.5 whitespace-nowrap">
            <LogOut className="w-4 h-4" />
            <span className="truncate">Sair</span>
          </button>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-6">
        
        {/* Top Grid: Backup & Segurança/App */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

          {/* Card 1: Central de Backup e Dados */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
            <div>
              <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Cloud className="w-5 h-5 text-blue-600" />
                  <h3 className="text-base sm:text-lg font-semibold text-slate-900">Central de Backup e Nuvem</h3>
                </div>
                <span className="text-xs bg-blue-100 text-blue-800 font-semibold px-2.5 py-1 rounded-full flex items-center gap-1">
                  <CheckCircle2 className="w-3.5 h-3.5 text-blue-600" />
                  Nuvem Ativa
                </span>
              </div>
              
              <div className="p-5 sm:p-6 space-y-6">
                {/* Input oculto para importação de backup */}
                <input
                  type="file"
                  ref={backupFileInputRef}
                  onChange={handleBackupFileSelect}
                  accept=".json"
                  className="hidden"
                />

                {/* Status Card com Sincronização em Tempo Real */}
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-blue-50/80 to-indigo-50/60 p-4 rounded-xl border border-blue-100/80">
                  <div className="space-y-1">
                    <p className="text-xs text-blue-700 font-semibold uppercase tracking-wider">Status do Armazenamento em Nuvem</p>
                    <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-slate-800">
                      <p>Última Sincronização: <span className="font-semibold text-slate-950">{lastBackup}</span></p>
                      <p>Tamanho Estimado: <span className="font-semibold text-slate-950">{backupSize}</span></p>
                    </div>
                  </div>
                  <button 
                    type="button" 
                    onClick={handleSync} 
                    disabled={isSyncing}
                    className="px-4 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white text-xs sm:text-sm font-semibold rounded-lg transition-all flex items-center justify-center gap-2 shadow-xs cursor-pointer shrink-0"
                  >
                    <Upload className={`w-4 h-4 ${isSyncing ? 'animate-bounce' : ''}`} />
                    {isSyncing ? 'Sincronizando...' : 'Sincronizar Agora'}
                  </button>
                </div>

                {syncStatusMsg && (
                  <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg text-xs text-emerald-800 flex items-center gap-2">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span>{syncStatusMsg}</span>
                  </div>
                )}

                {/* Ações de Exportação e Restauração */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-2 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Download className="w-3.5 h-3.5 text-emerald-600" />
                      Exportação de Dados
                    </h4>
                    <p className="text-[11px] text-slate-500">Baixe uma cópia completa das suas faturas e receitas.</p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button 
                        type="button" 
                        onClick={handleExportCSV} 
                        disabled={isExporting}
                        className="w-full px-3 py-2 border border-slate-200 bg-white hover:bg-emerald-50 hover:border-emerald-300 text-slate-700 hover:text-emerald-800 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                        title="Exporta tabela compatível com Excel e Google Sheets"
                      >
                        <Download className="w-3.5 h-3.5 text-emerald-600" />
                        {isExporting ? 'Exportando...' : 'Exportar CSV (Excel)'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handleExportJSON} 
                        disabled={isExporting}
                        className="w-full px-3 py-2 border border-slate-200 bg-white hover:bg-blue-50 hover:border-blue-300 text-slate-700 hover:text-blue-800 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                        title="Baixar arquivo de backup completo compatível com o OrganizaIA"
                      >
                        <Save className="w-3.5 h-3.5 text-blue-600" />
                        {isExporting ? 'Exportando...' : 'Backup Completo (JSON)'}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2 p-3.5 bg-slate-50/70 border border-slate-200/80 rounded-xl">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 flex items-center gap-1.5">
                      <Upload className="w-3.5 h-3.5 text-indigo-600" />
                      Restauração de Backup
                    </h4>
                    <p className="text-[11px] text-slate-500">Recupere seus dados a partir de arquivo ou clipboard.</p>
                    <div className="flex flex-col gap-2 pt-1">
                      <button 
                        type="button" 
                        onClick={() => backupFileInputRef.current?.click()} 
                        disabled={isImporting}
                        className="w-full px-3 py-2 border border-slate-200 bg-white hover:bg-indigo-50 hover:border-indigo-300 text-slate-700 hover:text-indigo-800 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Upload className="w-3.5 h-3.5 text-indigo-600" />
                        {isImporting ? 'Importando...' : 'Restaurar de Arquivo'}
                      </button>
                      <button 
                        type="button" 
                        onClick={handlePasteClipboard} 
                        disabled={isImporting}
                        className="w-full px-3 py-2 border border-slate-200 bg-white hover:bg-purple-50 hover:border-purple-300 text-slate-700 hover:text-purple-800 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-1.5 shadow-2xs"
                      >
                        <Save className="w-3.5 h-3.5 text-purple-600" />
                        Colar do Clipboard
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Rotina Automática no Rodapé do Card */}
            <div className="p-4 sm:p-5 bg-slate-50 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700">Frequência de Backup Automático em Nuvem</label>
                <span className="text-[11px] text-slate-500">Armazena periodicamente seus dados no Firestore</span>
              </div>
              <select 
                value={preferences.backupSchedule || 'DAILY'} 
                onChange={e => setPreferences({...preferences, backupSchedule: e.target.value as any})} 
                className="bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-slate-800 focus:outline-none focus:border-blue-500 text-xs font-medium w-full sm:w-auto"
              >
                <option value="OFF">Desligado (Manual)</option>
                <option value="DAILY">Diário (Recomendado)</option>
                <option value="WEEKLY">Semanal</option>
                <option value="MONTHLY">Mensal</option>
              </select>
            </div>
          </div>

          {/* Card 2: Segurança, Acesso e Inteligência Artificial */}
          <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm flex flex-col justify-between">
            <div>
              <div className="bg-slate-50 border-b border-slate-200 p-4 flex items-center gap-2">
                <Lock className="w-5 h-5 text-slate-600" />
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Segurança, Acesso e IA</h3>
              </div>
              
              <div className="p-5 sm:p-6 space-y-6">
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3">Segurança e Acesso</h4>
                  <div className="space-y-3">
                    <div className="flex items-center p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/60">
                      <input type="checkbox" id="enterDirectly" checked={preferences.enterDirectly} onChange={e => setPreferences({...preferences, enterDirectly: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                      <label htmlFor="enterDirectly" className="ml-2.5 text-xs sm:text-sm text-slate-700 font-medium cursor-pointer">Entrar Direto (Pular senha em aparelhos confiáveis)</label>
                    </div>
                    <div className="flex items-center justify-between p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/60">
                      <div className="flex items-center">
                        <input type="checkbox" id="biometricEnabled" checked={preferences.biometricEnabled} onChange={e => setPreferences({...preferences, biometricEnabled: e.target.checked})} className="w-4 h-4 rounded border-slate-300 text-blue-600 cursor-pointer" />
                        <label htmlFor="biometricEnabled" className="ml-2.5 text-xs sm:text-sm text-slate-700 font-medium cursor-pointer">
                          Desbloqueio por Biometria / Digital
                        </label>
                      </div>
                      {preferences.biometricEnabled && <span className="text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">Ativada</span>}
                    </div>
                    <div className="p-2.5 bg-slate-50/70 rounded-lg border border-slate-200/60 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                      <div>
                        <label className="block text-xs font-semibold text-slate-700">PIN de Acesso (4 dígitos)</label>
                        <span className="text-[11px] text-slate-500">Usado no login rápido e operações de segurança</span>
                      </div>
                      <input type="text" maxLength={4} value={preferences.accessPin || ''} onChange={e => setPreferences({...preferences, accessPin: e.target.value.replace(/\D/g, '')})} className="bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-slate-900 focus:outline-none focus:border-blue-500 text-sm font-bold w-28 tracking-widest text-center" placeholder="****" />
                    </div>

                    {/* Função: Reabrir e Editar Despesas Liquidadas */}
                    <div className="pt-2">
                      <div className="bg-slate-50/90 rounded-xl p-3.5 border border-slate-200">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              <RotateCcw className="w-4 h-4 text-blue-600 shrink-0" />
                              <span className="text-xs sm:text-sm font-semibold text-slate-900">Reabrir / Editar Faturas Pagas</span>
                              {preferences.allowEditPaidExpenses ? (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-emerald-100 text-emerald-700 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  <Check className="w-3 h-3" /> Habilitado
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 text-[10px] bg-slate-200 text-slate-600 px-2 py-0.5 rounded-full font-bold uppercase tracking-wider">
                                  <Lock className="w-3 h-3" /> Bloqueado
                                </span>
                              )}
                            </div>
                            <p className="text-[11px] text-slate-500 leading-relaxed">
                              Permite estornar despesas pagas para pendente com autenticação por PIN.
                            </p>
                          </div>

                          <button
                            type="button"
                            onClick={handleInitiateToggleEditPaid}
                            className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5 transition-all cursor-pointer shadow-2xs shrink-0 ${
                              preferences.allowEditPaidExpenses
                                ? 'bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300'
                                : 'bg-blue-600 hover:bg-blue-700 text-white'
                            }`}
                          >
                            <KeyRound className="w-3.5 h-3.5" />
                            <span>{preferences.allowEditPaidExpenses ? 'Desativar' : 'Habilitar'}</span>
                          </button>
                        </div>

                        {editPaidToast && (
                          <div className="mt-2.5 p-2 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg text-xs flex items-center gap-2 animate-in fade-in duration-200">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span className="font-medium">{editPaidToast}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-200 pt-5">
                  <div className="flex items-center gap-2 mb-3">
                    <Brain className="w-4 h-4 text-purple-600" />
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800">Inteligência Artificial (Gemini)</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <label className="block text-xs font-medium text-slate-500 mb-1">Modelo de Processamento</label>
                      <select value={preferences.aiModel} onChange={e => setPreferences({...preferences, aiModel: e.target.value as any})} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-purple-500 text-xs sm:text-sm w-full font-medium">
                        <option value="gemini-1.5-flash">Gemini 1.5 Flash (Rápido e Econômico)</option>
                        <option value="gemini-1.5-pro">Gemini 1.5 Pro (Análises Complexas)</option>
                      </select>
                    </div>
                    <div className="flex items-center p-2.5 bg-purple-50/40 rounded-lg border border-purple-100">
                      <input type="checkbox" id="autoCategoryLearning" checked={preferences.autoCategoryLearning} onChange={e => setPreferences({...preferences, autoCategoryLearning: e.target.checked})} className="w-4 h-4 rounded border-purple-300 text-purple-600 focus:ring-purple-600 cursor-pointer" />
                      <label htmlFor="autoCategoryLearning" className="ml-2.5 text-xs sm:text-sm text-purple-900 font-medium cursor-pointer">Aprendizado de Categoria Automático</label>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

        </div>

        {/* Card 3: Central de Notificações, Lembretes e Alertas Sonoros (Full Width) */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-amber-500/10 border-b border-amber-200/60 p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-amber-500/20 flex items-center justify-center text-amber-700">
                <Bell className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base sm:text-lg font-semibold text-slate-900">Central de Notificações e Alertas Sonoros</h3>
                <p className="text-xs text-slate-500">Configure os lembretes automáticos de vencimento e alertas de faturas</p>
              </div>
            </div>
            <button 
              type="button" 
              onClick={handleTestNotification} 
              className="text-xs bg-white hover:bg-amber-50 border border-amber-300 text-amber-900 px-3.5 py-2 rounded-lg font-semibold transition-colors flex items-center gap-1.5 shadow-2xs cursor-pointer"
            >
              <Volume2 className="w-4 h-4 text-amber-600" />
              Testar Alerta
            </button>
          </div>

          <div className="p-5 sm:p-6 space-y-6">
            {/* Toast de Teste de Alerta */}
            {testAlertToast && (
              <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-xs text-amber-900 flex items-start gap-2 animate-fadeIn">
                <Sparkles className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="flex-1">{testAlertToast}</div>
                <button type="button" onClick={() => setTestAlertToast(null)} className="text-amber-500 hover:text-amber-800">
                  <X className="w-4 h-4" />
                </button>
              </div>
            )}

            {/* Switch Master */}
            <div className="flex items-center justify-between p-4 bg-slate-50 border border-slate-200 rounded-xl">
              <div className="flex items-center gap-3">
                <input 
                  type="checkbox" 
                  id="notificationEnabled" 
                  checked={preferences.notificationEnabled} 
                  onChange={e => setPreferences({...preferences, notificationEnabled: e.target.checked})} 
                  className="w-5 h-5 rounded border-slate-300 text-amber-600 focus:ring-amber-500 cursor-pointer" 
                />
                <div>
                  <label htmlFor="notificationEnabled" className="text-sm font-bold text-slate-900 cursor-pointer block">
                    Ativar Todos os Alertas de Vencimento
                  </label>
                  <p className="text-xs text-slate-500">Emite notificações sonoras e visuais para suas despesas</p>
                </div>
              </div>
              <span className={`text-xs px-3 py-1 rounded-full font-bold uppercase tracking-wider ${preferences.notificationEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'}`}>
                {preferences.notificationEnabled ? 'Ativado' : 'Desativado'}
              </span>
            </div>

            {/* PWA & Desktop App Integration Box */}
            <div className="p-4 bg-gradient-to-r from-blue-50/70 to-indigo-50/70 border border-blue-200/80 rounded-xl">
              <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-white border border-blue-200 shadow-2xs flex items-center justify-center shrink-0 p-1">
                    <img src="/pwa-192x192.png" alt="OrganizaIA" className="w-8 h-8 rounded-lg" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <h4 className="text-sm font-bold text-slate-900">Instalação do Aplicativo (Android, iOS & Computador)</h4>
                      {isAppInstalledState || pwaInstalled ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-md border border-emerald-300/60">
                          <Check className="w-3 h-3 text-emerald-600" /> App Instalado
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-blue-100 text-blue-800 font-semibold px-2 py-0.5 rounded-md border border-blue-200">
                          <Smartphone className="w-3 h-3 text-blue-600" /> PWA Compatível
                        </span>
                      )}

                      {notifPermission === 'granted' ? (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-emerald-50 text-emerald-700 font-medium px-2 py-0.5 rounded-md border border-emerald-200">
                          <ShieldCheck className="w-3 h-3 text-emerald-600" /> Notificações SO Ativas
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-[11px] bg-amber-100 text-amber-800 font-medium px-2 py-0.5 rounded-md border border-amber-300">
                          <AlertTriangle className="w-3 h-3 text-amber-600" /> Permissão SO Pendente
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 mt-1">
                      Ao instalar o <strong>OrganizaIA</strong> como aplicativo, o sistema opera em tela cheia com ícone próprio na tela de início ou barra de tarefas, carregamento ultrarrápido e notificações em tempo real.
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 w-full md:w-auto shrink-0 flex-wrap">
                  {notifPermission !== 'granted' && (
                    <button
                      type="button"
                      onClick={handleRequestNotifPermission}
                      className="text-xs bg-amber-600 hover:bg-amber-700 text-white font-semibold px-3 py-2 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      Permitir no Sistema
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setShowPwaModal(true)}
                    className="text-xs bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white font-semibold px-3.5 py-2 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                  >
                    <Smartphone className="w-4 h-4" />
                    Instalar no Celular (Android & iOS)
                  </button>

                  {(canInstallPWA || pwaInstallable) && !isAppInstalledState && (
                    <button
                      type="button"
                      onClick={handleInstallAppClick}
                      className="text-xs bg-slate-800 hover:bg-slate-900 text-white font-semibold px-3.5 py-2 rounded-lg shadow-2xs flex items-center gap-1.5 transition-colors cursor-pointer"
                    >
                      <DownloadCloud className="w-4 h-4" />
                      Instalar no PC
                    </button>
                  )}
                </div>
              </div>
            </div>

            <PWAInstallModal
              isOpen={showPwaModal}
              onClose={() => setShowPwaModal(false)}
              isInstallable={pwaInstallable || canInstallPWA}
              isIOS={pwaIOS}
              isAndroid={pwaAndroid}
              onDirectInstall={async () => {
                const res = await pwaDirectInstall();
                if (res) setIsAppInstalledState(true);
                return res;
              }}
            />
            
            {preferences.notificationEnabled && (
              <div className="space-y-6 bg-slate-50/80 p-4 sm:p-6 rounded-xl border border-slate-200">
                
                {/* 1. QUANDO ENVIAR OS ALERTAS (GATILHOS) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    1. Quando enviar os alertas (Gatilhos de Vencimento)
                  </label>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 bg-white p-3.5 rounded-xl border border-slate-200">
                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={preferences.notifyOnDueDate ?? true} 
                        onChange={e => setPreferences({...preferences, notifyOnDueDate: e.target.checked})} 
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer" 
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">No dia do vencimento</span>
                        <span className="text-[11px] text-slate-500">Alerta no próprio dia em que a conta vence</span>
                      </div>
                    </label>

                    <label className="flex items-start gap-2.5 cursor-pointer p-2 rounded-lg hover:bg-slate-50 transition-colors">
                      <input 
                        type="checkbox" 
                        checked={preferences.notifyOverdue ?? true} 
                        onChange={e => setPreferences({...preferences, notifyOverdue: e.target.checked})} 
                        className="mt-0.5 w-4 h-4 rounded border-slate-300 text-red-600 focus:ring-red-500 cursor-pointer" 
                      />
                      <div>
                        <span className="text-xs font-semibold text-slate-800 block">Contas vencidas em atraso</span>
                        <span className="text-[11px] text-slate-500">Continua alertando enquanto não for quitada</span>
                      </div>
                    </label>
                  </div>

                  {/* Antecedência em dias */}
                  <div className="mt-2.5 bg-white p-3.5 rounded-xl border border-slate-200">
                    <span className="text-xs font-semibold text-slate-700 block mb-2">
                      Alertar com antecedência (quantos dias antes):
                    </span>
                    <div className="flex flex-wrap gap-2">
                      {[1, 2, 3, 5, 7, 15].map((days) => {
                        const isSelected = (preferences.notifyDaysBefore || []).includes(days);
                        return (
                          <button
                            key={days}
                            type="button"
                            onClick={() => toggleDaysBefore(days)}
                            className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-all flex items-center gap-1.5 ${
                              isSelected 
                                ? 'bg-blue-50 border-blue-300 text-blue-700 font-semibold shadow-xs' 
                                : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                            }`}
                          >
                            {isSelected && <Check className="w-3 h-3 text-blue-600" />}
                            {days} {days === 1 ? 'dia antes' : 'dias antes'}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                </div>

                {/* 2. EM QUAL FREQUÊNCIA (DIAS DE ENVIO) */}
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 mb-2 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-indigo-600" />
                    2. Em qual frequência (Periodicidade de Envio)
                  </label>

                  <div className="bg-white p-3.5 sm:p-4 rounded-xl border border-slate-200 space-y-3">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                      {[
                        { id: 'DAILY', label: 'Todos os dias', desc: 'Segunda a Domingo' },
                        { id: 'WEEKDAYS', label: 'Apenas dias úteis', desc: 'Segunda a Sexta' },
                        { id: 'CUSTOM_DAYS', label: 'Personalizado', desc: 'Escolher dias' }
                      ].map((freq) => (
                        <button
                          key={freq.id}
                          type="button"
                          onClick={() => setPreferences({ ...preferences, notificationFrequency: freq.id as NotificationFrequency })}
                          className={`p-3 rounded-xl text-left border transition-all ${
                            (preferences.notificationFrequency || 'DAILY') === freq.id
                              ? 'bg-indigo-50 border-indigo-300 text-indigo-900 shadow-xs'
                              : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                          }`}
                        >
                          <div className="text-xs font-bold">{freq.label}</div>
                          <div className="text-[11px] text-slate-500 mt-0.5">{freq.desc}</div>
                        </button>
                      ))}
                    </div>

                    {/* Seletor de dias da semana se CUSTOM_DAYS */}
                    {preferences.notificationFrequency === 'CUSTOM_DAYS' && (
                      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center gap-2">
                        {[
                          { day: 0, label: 'Dom' },
                          { day: 1, label: 'Seg' },
                          { day: 2, label: 'Ter' },
                          { day: 3, label: 'Qua' },
                          { day: 4, label: 'Qui' },
                          { day: 5, label: 'Sex' },
                          { day: 6, label: 'Sáb' }
                        ].map(({ day, label }) => {
                          const isDaySelected = (preferences.notificationDays || []).includes(day);
                          return (
                            <button
                              key={day}
                              type="button"
                              onClick={() => toggleCustomDay(day)}
                              className={`w-10 h-10 rounded-xl text-xs font-bold transition-all flex items-center justify-center ${
                                isDaySelected 
                                  ? 'bg-indigo-600 text-white shadow-xs' 
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                              }`}
                            >
                              {label}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                {/* 3 & 4: Quantidade de Disparos e Horários lado a lado */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {/* 3. QUANTAS VEZES AO DIA */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Bell className="w-3.5 h-3.5 text-amber-600" />
                        3. Quantas vezes ao dia
                      </label>
                      <span className="text-xs font-bold text-amber-700 bg-amber-100 px-2 py-0.5 rounded-md">
                        {preferences.notificationRepeatCount || 1}x por dia
                      </span>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 h-[calc(100%-28px)] flex flex-col justify-center">
                      <div className="flex flex-wrap gap-2">
                        {[1, 2, 3, 4, 5].map((count) => {
                          const isCountActive = (preferences.notificationRepeatCount || 1) === count;
                          return (
                            <button
                              key={count}
                              type="button"
                              onClick={() => handleRepeatCountChange(count)}
                              className={`flex-1 min-w-[50px] py-2 px-2.5 rounded-lg text-xs font-semibold border transition-all text-center ${
                                isCountActive 
                                  ? 'bg-amber-50 border-amber-300 text-amber-800 shadow-xs' 
                                  : 'bg-slate-50 hover:bg-slate-100 border-slate-200 text-slate-600'
                              }`}
                            >
                              {count}x
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  </div>

                  {/* 4. QUAIS OS HORÁRIOS */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600" />
                        4. Horários de disparo
                      </label>
                      <button
                        type="button"
                        onClick={handleAddTime}
                        disabled={(preferences.notificationTimes || []).length >= 6}
                        className="text-xs text-emerald-700 hover:text-emerald-800 font-semibold flex items-center gap-1 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 px-2.5 py-0.5 rounded-lg transition-colors disabled:opacity-40"
                      >
                        <Plus className="w-3.5 h-3.5" /> Adicionar
                      </button>
                    </div>

                    <div className="bg-white p-3.5 rounded-xl border border-slate-200 space-y-3">
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                        {(preferences.notificationTimes || ['08:00']).map((time, idx) => (
                          <div key={idx} className="p-2 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
                            <div className="flex items-center justify-between">
                              <span className="text-[10px] font-semibold text-slate-500">
                                {idx + 1}º Disparo
                              </span>
                              {(preferences.notificationTimes || []).length > 1 && (
                                <button
                                  type="button"
                                  onClick={() => handleRemoveTime(idx)}
                                  className="text-slate-400 hover:text-red-500 p-0.5 rounded transition-colors"
                                  title="Remover"
                                >
                                  <Trash2 className="w-3 h-3" />
                                </button>
                              )}
                            </div>
                            <input
                              type="time"
                              value={time}
                              onChange={e => handleTimeChange(idx, e.target.value)}
                              className="w-full bg-white border border-slate-300 rounded px-2 py-1 text-slate-900 font-mono text-xs focus:outline-none focus:border-emerald-500"
                            />
                          </div>
                        ))}
                      </div>

                      {/* Sugestões rápidas */}
                      <div className="pt-2 border-t border-slate-100 flex flex-wrap items-center gap-1 text-[11px] text-slate-500">
                        <span className="text-slate-400">Sugestões:</span>
                        {['08:00', '12:30', '17:00', '20:00'].map((sugTime, i) => (
                          <button
                            key={i}
                            type="button"
                            onClick={() => {
                              const current = [...(preferences.notificationTimes || ['08:00'])];
                              if (!current.includes(sugTime)) {
                                current[0] = sugTime;
                                setPreferences({ ...preferences, notificationTimes: current, notificationTime: sugTime });
                              }
                            }}
                            className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-2 py-0.5 rounded transition-colors"
                          >
                            {sugTime}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>

                {/* 5. SOM DA NOTIFICAÇÃO (ÁUDIO DO ALERTA) */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                      <Music className="w-4 h-4 text-purple-600" />
                      5. Som da Notificação (Áudio do Alerta)
                    </label>
                    <span className="text-xs font-medium text-purple-700 bg-purple-100 px-2.5 py-0.5 rounded-md">
                      {preferences.notificationSound === 'custom'
                        ? `Áudio Personalizado: ${preferences.customNotificationSoundName || 'Importado'}`
                        : preferences.notificationSound === 'chime' ? 'Marimba Suave'
                        : preferences.notificationSound === 'bell' ? 'Campainha Cristal'
                        : preferences.notificationSound === 'modern' ? 'Alerta Moderno'
                        : preferences.notificationSound === 'zen' ? 'Tigela Zen'
                        : preferences.notificationSound === 'cash' ? 'Tilintar de Moedas'
                        : 'Sino Clássico (Padrão)'}
                    </span>
                  </div>

                  <div className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 space-y-4">
                    {/* Grade de Sons Pré-definidos do Sistema */}
                    <div className="space-y-2">
                      <span className="text-xs font-semibold text-slate-700 block">Sons Disponíveis no Sistema:</span>
                      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                        {[
                          { id: 'classic', name: 'Sino Clássico', desc: 'Tradicional D5 / A5', tag: 'Padrão' },
                          { id: 'chime', name: 'Marimba Suave', desc: 'Arpejo melódico 4 notas', tag: 'Suave' },
                          { id: 'bell', name: 'Campainha Cristal', desc: 'Harmônicos brilhantes', tag: 'Elegante' },
                          { id: 'modern', name: 'Alerta Moderno', desc: 'Bip duplo estilo tech', tag: 'Tech' },
                          { id: 'zen', name: 'Tigela Zen (432Hz)', desc: 'Tom meditativo calmo', tag: 'Calmo' },
                          { id: 'cash', name: 'Tilintar de Moedas', desc: 'Som financeiro / caixa', tag: 'Finanças' }
                        ].map((sound) => {
                          const isSelected = (preferences.notificationSound || 'classic') === sound.id;
                          const isPlayingThis = playingSoundId === sound.id;
                          return (
                            <div
                              key={sound.id}
                              onClick={() => setPreferences({ ...preferences, notificationSound: sound.id as any })}
                              className={`p-3 rounded-xl border transition-all cursor-pointer flex flex-col justify-between relative ${
                                isSelected 
                                  ? 'bg-purple-50/70 border-purple-400 ring-2 ring-purple-400/30' 
                                  : 'bg-slate-50/60 hover:bg-slate-100 border-slate-200'
                              }`}
                            >
                              <div className="flex items-start justify-between gap-1 mb-1.5">
                                <div className="flex items-center gap-1.5">
                                  <div className={`w-3.5 h-3.5 rounded-full border flex items-center justify-center ${isSelected ? 'border-purple-600 bg-purple-600' : 'border-slate-300 bg-white'}`}>
                                    {isSelected && <div className="w-1.5 h-1.5 rounded-full bg-white" />}
                                  </div>
                                  <span className="text-xs font-semibold text-slate-800">{sound.name}</span>
                                </div>
                                <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-slate-200/70 text-slate-600">
                                  {sound.tag}
                                </span>
                              </div>

                              <p className="text-[11px] text-slate-500 mb-3">{sound.desc}</p>

                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setPreferences({ ...preferences, notificationSound: sound.id as any });
                                  playSoundByType(sound.id);
                                }}
                                className={`w-full py-1.5 px-2 rounded-lg text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${
                                  isPlayingThis
                                    ? 'bg-purple-600 text-white animate-pulse'
                                    : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-200'
                                }`}
                              >
                                {isPlayingThis ? (
                                  <>
                                    <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                                    <span>Tocando...</span>
                                  </>
                                ) : (
                                  <>
                                    <Play className="w-3.5 h-3.5 fill-current" />
                                    <span>Testar Áudio</span>
                                  </>
                                )}
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Importar Áudio Personalizado */}
                    <div className="pt-3 border-t border-slate-200">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 mb-2">
                        <span className="text-xs font-semibold text-slate-700 flex items-center gap-1.5">
                          <FileAudio className="w-4 h-4 text-purple-600" />
                          Ou Importe Seu Próprio Áudio:
                        </span>
                        <span className="text-[11px] text-slate-400">Formatos: MP3, WAV, AAC, OGG (máx 6 MB)</span>
                      </div>

                      <input
                        type="file"
                        ref={fileInputRef}
                        onChange={handleAudioFileUpload}
                        accept="audio/*"
                        className="hidden"
                      />

                      {preferences.customNotificationSoundUrl ? (
                        <div className={`p-3.5 rounded-xl border transition-all ${
                          preferences.notificationSound === 'custom'
                            ? 'bg-purple-50/80 border-purple-400 ring-2 ring-purple-400/30'
                            : 'bg-slate-50 border-slate-200'
                        }`}>
                          <div className="flex flex-wrap items-center justify-between gap-2 mb-2.5">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-lg bg-purple-100 text-purple-700 flex items-center justify-center">
                                <FileAudio className="w-5 h-5" />
                              </div>
                              <div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs font-bold text-slate-900 truncate max-w-[200px] sm:max-w-xs">
                                    {preferences.customNotificationSoundName || 'audio_personalizado.mp3'}
                                  </span>
                                  <span className="text-[10px] bg-purple-100 text-purple-700 px-1.5 py-0.5 rounded font-semibold border border-purple-200">
                                    Áudio Importado
                                  </span>
                                </div>
                                <p className="text-[11px] text-slate-500">Pronto para ser usado nas suas notificações</p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => setPreferences({ ...preferences, notificationSound: 'custom' })}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                  preferences.notificationSound === 'custom'
                                    ? 'bg-purple-600 text-white'
                                    : 'bg-white border border-slate-300 text-slate-700 hover:bg-slate-50'
                                }`}
                              >
                                {preferences.notificationSound === 'custom' ? '✓ Selecionado' : 'Usar este áudio'}
                              </button>
                            </div>
                          </div>

                          <div className="flex flex-wrap items-center gap-2 pt-2 border-t border-slate-200/60">
                            <button
                              type="button"
                              onClick={() => {
                                setPreferences({ ...preferences, notificationSound: 'custom' });
                                playSoundByType('custom');
                              }}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium flex items-center gap-1.5 transition-all ${
                                playingSoundId === 'custom'
                                  ? 'bg-purple-600 text-white'
                                  : 'bg-white hover:bg-purple-50 text-purple-700 border border-purple-200'
                              }`}
                            >
                              {playingSoundId === 'custom' ? (
                                <>
                                  <Volume2 className="w-3.5 h-3.5 animate-bounce" />
                                  <span>Ouvindo Áudio...</span>
                                </>
                              ) : (
                                <>
                                  <Play className="w-3.5 h-3.5 fill-current" />
                                  <span>Testar / Ouvir Áudio</span>
                                </>
                              )}
                            </button>

                            <button
                              type="button"
                              onClick={() => fileInputRef.current?.click()}
                              className="px-3 py-1.5 rounded-lg text-xs font-medium bg-white hover:bg-slate-100 text-slate-700 border border-slate-200 flex items-center gap-1.5 transition-colors"
                            >
                              <Upload className="w-3.5 h-3.5" />
                              <span>Substituir Arquivo</span>
                            </button>

                            <button
                              type="button"
                              onClick={handleRemoveCustomAudio}
                              className="px-2.5 py-1.5 rounded-lg text-xs font-medium text-red-600 hover:bg-red-50 border border-transparent hover:border-red-200 flex items-center gap-1 transition-colors ml-auto"
                              title="Remover áudio importado"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remover</span>
                            </button>
                          </div>
                        </div>
                      ) : (
                        <div 
                          onClick={() => fileInputRef.current?.click()}
                          className="border-2 border-dashed border-slate-200 hover:border-purple-400 bg-slate-50 hover:bg-purple-50/40 rounded-xl p-4 text-center cursor-pointer transition-all group"
                        >
                          <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-white group-hover:bg-purple-100 flex items-center justify-center text-slate-500 group-hover:text-purple-600 shadow-xs transition-colors">
                            <Upload className="w-5 h-5" />
                          </div>
                          <span className="text-xs font-semibold text-slate-800 group-hover:text-purple-700 block">
                            Clique para selecionar um áudio do seu dispositivo
                          </span>
                          <span className="text-[11px] text-slate-500 mt-0.5 block">
                            Envie um toque personalizado ou gravação de voz (MP3, WAV, OGG)
                          </span>
                        </div>
                      )}

                      {audioFileError && (
                        <p className="text-xs text-red-600 mt-2 flex items-center gap-1">
                          <XCircle className="w-3.5 h-3.5" /> {audioFileError}
                        </p>
                      )}
                    </div>
                  </div>
                </div>

              </div>
            )}

            <p className="text-xs text-amber-700 bg-amber-50 p-3 rounded-xl border border-amber-200/80 flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <span>
                <strong className="font-semibold">Aviso de Precisão:</strong> Para garantir que os alertas toquem no horário exato, remova o OrganizaIA da otimização de bateria nas configurações do seu aparelho.
              </span>
            </p>
          </div>
        </div>

        {/* Card 4: Integração WhatsApp (Full Width) */}
        <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
          <div className="bg-emerald-50 border-b border-emerald-100 p-4 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <MessageCircle className="w-5 h-5 text-emerald-600" />
              <h3 className="text-base sm:text-lg font-semibold text-emerald-900">Integração WhatsApp (Omnichannel)</h3>
            </div>
            <div className="flex items-center gap-2">
               <span className="text-xs font-medium text-emerald-700">Status:</span>
               {preferences.whatsappEnabled ? (
                 <span className="px-2.5 py-1 bg-emerald-100 text-emerald-700 text-xs font-semibold rounded-md flex items-center gap-1"><CheckCircle2 className="w-3 h-3"/> Ativo</span>
               ) : (
                 <span className="px-2.5 py-1 bg-slate-100 text-slate-600 text-xs font-semibold rounded-md">Desativado</span>
               )}
            </div>
          </div>
          <div className="p-5 sm:p-6 space-y-6">
            <div className="flex items-center bg-slate-50 p-4 rounded-xl border border-slate-200">
              <input type="checkbox" id="whatsappEnabled" checked={preferences.whatsappEnabled} onChange={e => setPreferences({...preferences, whatsappEnabled: e.target.checked})} className="w-5 h-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-600 cursor-pointer" />
              <label htmlFor="whatsappEnabled" className="ml-3 text-sm font-semibold text-slate-800 cursor-pointer">Habilitar Assistente Omnichannel via WhatsApp</label>
            </div>
            
            {preferences.whatsappEnabled && (
              <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-300">
                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <User className="w-4 h-4 text-emerald-600" />
                    1. Vínculo de Contato
                  </h4>
                  <div className="flex flex-col md:flex-row gap-4 items-end">
                    <div className="flex-1 w-full">
                      <label className="block text-xs font-medium text-slate-500 mb-1">Seu Número do WhatsApp (com DDD)</label>
                      <input type="tel" value={preferences.userPhone || ''} onChange={e => setPreferences({...preferences, userPhone: formatPhone(e.target.value)})} className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-900 focus:outline-none focus:border-emerald-500 text-sm w-full font-medium" placeholder="(11) 99999-9999" />
                    </div>
                    <div className="flex gap-2 w-full md:w-auto">
                      <button disabled={isLinkingPhone} type="button" onClick={handleLinkPhone} className="flex-1 md:flex-none px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-lg transition-colors h-[38px] flex items-center justify-center gap-2 shadow-2xs">
                        {isLinkingPhone ? (
                          <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                        ) : linkSuccess ? (
                          <span className="text-white font-semibold">✓ Salvo</span>
                        ) : (
                          <span>Salvar Número</span>
                        )}
                      </button>
                      <button disabled={isTestingConnection || !preferences.userPhone} type="button" onClick={handleTestConnection} className="flex-1 md:flex-none px-4 py-2 bg-white border border-emerald-200 hover:bg-emerald-50 text-emerald-700 text-sm font-semibold rounded-lg transition-colors h-[38px] flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-2xs">
                        {isTestingConnection ? (
                          <span className="w-4 h-4 border-2 border-emerald-600/30 border-t-emerald-600 rounded-full animate-spin"></span>
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                        Teste de Conexão
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-emerald-800 bg-emerald-50/70 p-3 rounded-lg border border-emerald-100 mt-4 leading-relaxed">
                    <span className="font-semibold">ℹ️ Nota sobre a Conexão:</span> Disparar mensagens de forma silenciosa/automatizada exige a configuração de uma conta comercial paga (WhatsApp Cloud API da Meta) que gera cobranças recorrentes por template enviado. Para manter o sistema gratuito, seguro e livre de taxas, o OrganizaIA utiliza os logs para registrar as transações e o redirecionamento oficial por Link Direto para que você envie suas mensagens via WhatsApp Web ou Aplicativo com apenas um toque!
                  </p>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
                    2. Template de Notificação
                  </h4>
                  <p className="text-xs text-slate-500 mb-3">Customize a mensagem que será enviada. Utilize as variáveis abaixo clicando nelas:</p>
                  
                  <div className="flex gap-2 mb-2">
                    <button type="button" onClick={() => setPreferences(prev => ({...prev, whatsappTemplate: (prev.whatsappTemplate || '') + '{valor}'}))} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono rounded-lg border border-slate-200 transition-colors font-semibold">{'{valor}'}</button>
                    <button type="button" onClick={() => setPreferences(prev => ({...prev, whatsappTemplate: (prev.whatsappTemplate || '') + '{data}'}))} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono rounded-lg border border-slate-200 transition-colors font-semibold">{'{data}'}</button>
                    <button type="button" onClick={() => setPreferences(prev => ({...prev, whatsappTemplate: (prev.whatsappTemplate || '') + '{categoria}'}))} className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-mono rounded-lg border border-slate-200 transition-colors font-semibold">{'{categoria}'}</button>
                  </div>
                  
                  <textarea 
                    value={preferences.whatsappTemplate || ''}
                    onChange={e => setPreferences({...preferences, whatsappTemplate: e.target.value})}
                    rows={3}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-3 text-sm text-slate-700 focus:outline-none focus:border-emerald-500 resize-none font-sans"
                    placeholder="Ex: Olá! Sua fatura {categoria} de {valor} vence em {data}."
                  ></textarea>
                </div>

                <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-2xs">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-800 mb-3 flex items-center gap-2">
                    <Clock className="w-4 h-4 text-emerald-600" />
                    3. Log de Disparos
                  </h4>
                  <div className="bg-slate-50 border border-slate-200 rounded-lg overflow-hidden">
                    <div className="max-h-48 overflow-y-auto">
                      {whatsappLogs.length === 0 ? (
                        <div className="p-4 text-center text-xs sm:text-sm text-slate-500">Nenhuma mensagem enviada ainda.</div>
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
        </div>

        {/* Zona de Risco e Ação Global */}
        <div className="bg-white border border-red-200 rounded-xl p-5 shadow-sm flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <h4 className="text-sm font-bold text-red-600 flex items-center gap-1.5">
              <Trash2 className="w-4 h-4 text-red-600" />
              Zona de Risco e Limpeza
            </h4>
            <p className="text-xs text-slate-500 mt-0.5">Apaga permanentemente todos os registros, faturas, receitas e preferências do usuário.</p>
          </div>
          <button 
            type="button" 
            onClick={() => setShowDeleteConfirm(true)} 
            className="px-4 py-2.5 bg-red-50 hover:bg-red-100 border border-red-200 text-red-600 hover:text-red-700 text-xs font-semibold rounded-lg transition-colors flex items-center justify-center gap-2 shrink-0 cursor-pointer"
          >
            <Trash2 className="w-4 h-4" />
            Excluir Tudo (Limpar Dados)
          </button>
        </div>

        {/* Botão Final de Salvar */}
        <div className="flex justify-end pt-2">
          <button 
            disabled={isSubmitting} 
            type="submit" 
            className="bg-blue-600 hover:bg-blue-700 disabled:bg-blue-400 text-white px-8 py-3.5 rounded-xl text-sm font-bold shadow-md hover:shadow-lg transition-all flex items-center gap-2 w-full md:w-auto justify-center cursor-pointer"
          >
            <Save className="w-5 h-5" />
            {isSubmitting ? 'Salvando...' : 'Salvar Todas as Configurações'}
          </button>
        </div>
      </form>
      {showProfileModal && currentUser && (
        <UserProfileModal 
          user={currentUser} 
          onComplete={() => setShowProfileModal(false)} 
          isSettingsMode={true} 
          onClose={() => setShowProfileModal(false)}
        />
      )}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-2xl max-w-md w-full border border-slate-100 shadow-2xl p-6 space-y-6 animate-scale-up">
            <div className="flex items-start gap-4">
              <div className="w-12 h-12 bg-red-100 rounded-full flex items-center justify-center text-red-600 shrink-0">
                <Trash2 className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">Confirmar Exclusão Permanente?</h3>
                <p className="text-sm text-slate-500 mt-1">
                  Esta ação é irreversível e apagará permanentemente todos os seus dados pessoais do nosso banco de dados.
                </p>
              </div>
            </div>

            <div className="bg-red-50 rounded-xl p-4 border border-red-100 space-y-2">
              <p className="text-xs font-semibold text-red-800 uppercase tracking-wider text-left">O que será apagado:</p>
              <ul className="text-xs text-red-700 list-disc list-inside space-y-1 text-left">
                <li>Todas as suas faturas e contas a pagar</li>
                <li>Suas categorias personalizadas de gastos</li>
                <li>Seus registros e fontes de receitas</li>
                <li>Suas preferências de sistema personalizadas</li>
                <li>Todos os logs de disparos do WhatsApp</li>
              </ul>
              <div className="pt-2 border-t border-red-100 mt-2 text-left">
                <p className="text-xs text-red-900 font-semibold leading-relaxed">
                  🛡️ Segurança: Apenas os dados vinculados à sua conta ({currentUser?.email}) serão afetados. Os dados dos demais usuários permanecem intactos.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-semibold rounded-xl transition-colors text-center"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleDeleteAll}
                disabled={isSubmitting}
                className="flex-1 px-4 py-2.5 bg-red-600 hover:bg-red-700 disabled:bg-red-400 text-white text-sm font-semibold rounded-xl transition-colors text-center flex items-center justify-center gap-1"
              >
                {isSubmitting ? 'Excluindo...' : 'Sim, Excluir'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de Confirmação por Senha PIN */}
      <PinConfirmModal
        isOpen={showPinModalForEditPaid}
        onClose={() => setShowPinModalForEditPaid(false)}
        onSuccess={handlePinSuccessForEditPaid}
        correctPin={preferences.accessPin}
        title={preferences.allowEditPaidExpenses ? "Desativar Edição de Despesas" : "Autorizar Reabrir/Editar Despesas"}
        description={
          preferences.allowEditPaidExpenses
            ? "Digite seu PIN de 4 dígitos cadastrado para bloquear a reabertura e edição de despesas liquidadas."
            : "Digite seu PIN de 4 dígitos cadastrado para autorizar a reabertura e edição de despesas já liquidadas."
        }
        actionLabel={preferences.allowEditPaidExpenses ? "Desativar Permissão" : "Autorizar e Ativar"}
      />
    </div>
  );
}