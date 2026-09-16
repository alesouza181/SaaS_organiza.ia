// Notification Service - Suporte a Notificações em Primeiro e Segundo Plano para PWA
import { AccountPayable, SystemPreferences } from '../types';
import { playNotificationSound } from './notificationAudio';

export interface NotificationPayload {
  title: string;
  body: string;
  url?: string;
  tag?: string;
  sound?: string;
  customSoundUrl?: string | null;
}

export async function requestNotificationPermission(): Promise<NotificationPermission> {
  if (typeof window === 'undefined' || !('Notification' in window)) {
    return 'denied';
  }

  if (Notification.permission === 'granted') {
    return 'granted';
  }

  try {
    const perm = await Notification.requestPermission();
    return perm;
  } catch (err) {
    console.warn('[Notificação] Falha ao solicitar permissão:', err);
    return Notification.permission;
  }
}

export async function dispatchSystemNotification(payload: NotificationPayload) {
  const { title, body, url = '/', tag = 'organizaia-bill-alert', sound, customSoundUrl } = payload;

  // 1. Toca o alerta sonoro configurado
  playNotificationSound(sound || 'classic', customSoundUrl);

  // 2. Dispara Notificação Nativa do Sistema Operacional (Windows, Mac, Linux, Android)
  if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
    // Tenta via Service Worker primeiro (para suporte standalone de segundo plano)
    if ('serviceWorker' in navigator && navigator.serviceWorker.controller) {
      try {
        navigator.serviceWorker.controller.postMessage({
          type: 'SHOW_NOTIFICATION',
          title,
          body,
          icon: '/icon-192.png',
          badge: '/favicon.svg',
          data: { url, tag },
          actions: [
            { action: 'open', title: 'Visualizar Conta' }
          ]
        });
        return;
      } catch (e) {
        console.warn('[SW Notification] Fallback para Notification API:', e);
      }
    }

    // Fallback se Service Worker não estiver no controle imediato
    try {
      const options: NotificationOptions & { [key: string]: any } = {
        body,
        icon: '/icon-192.png',
        badge: '/favicon.svg',
        tag,
        renotify: true,
      };
      const notif = new Notification(title, options);

      notif.onclick = () => {
        window.focus();
        if (url && window.location.pathname !== url) {
          window.location.href = url;
        }
        notif.close();
      };
    } catch (err) {
      console.warn('[Notificação] Erro ao instanciar Notification:', err);
    }
  }
}

// Histórico de notificações disparadas no dia (evita alertas repetidos no mesmo minuto/hora)
const sentAlertKeys = new Set<string>();

/**
 * Avalia as contas a pagar do usuário e dispara alertas com base nas configurações
 */
export function checkAndTriggerDueBillAlerts(
  accounts: AccountPayable[],
  preferences: SystemPreferences
) {
  if (!preferences || preferences.notificationEnabled === false) return;

  const now = new Date();
  const currentHour = String(now.getHours()).padStart(2, '0');
  const currentMinute = String(now.getMinutes()).padStart(2, '0');
  const currentTimeStr = `${currentHour}:${currentMinute}`;
  const todayStr = now.toISOString().split('T')[0];
  const dayOfWeek = now.getDay(); // 0 = Domingo, 6 = Sábado

  // Verifica frequência configurada
  if (preferences.notificationFrequency === 'WEEKDAYS' && (dayOfWeek === 0 || dayOfWeek === 6)) {
    return; // Não dispara nos finais de semana se configurado apenas dias úteis
  }
  if (preferences.notificationFrequency === 'CUSTOM_DAYS' && preferences.notificationDays) {
    if (!preferences.notificationDays.includes(dayOfWeek)) {
      return;
    }
  }

  // Verifica se o minuto atual coincide com algum dos horários configurados
  const scheduledTimes = preferences.notificationTimes && preferences.notificationTimes.length > 0
    ? preferences.notificationTimes
    : [preferences.notificationTime || '08:00'];

  const isTimeToNotify = scheduledTimes.some((time) => {
    // Permite disparo na janela do minuto configurado
    return time === currentTimeStr;
  });

  if (!isTimeToNotify) return;

  // Filtrar contas não pagas
  const unpaidAccounts = accounts.filter((a) => a.status !== 'PAID');

  let overdueCount = 0;
  let dueTodayCount = 0;
  let dueSoonCount = 0;
  let totalDueTodayAmount = 0;
  let sampleBillName = '';

  unpaidAccounts.forEach((acc) => {
    let billDueDate: string = '';
    const dueDateVal = acc.dueDate as any;
    if (typeof dueDateVal === 'string') {
      billDueDate = dueDateVal.split('T')[0];
    } else if (dueDateVal && typeof dueDateVal.toDate === 'function') {
      billDueDate = dueDateVal.toDate().toISOString().split('T')[0];
    } else if (dueDateVal instanceof Date) {
      billDueDate = dueDateVal.toISOString().split('T')[0];
    }

    if (!billDueDate) return;

    const diffTime = new Date(billDueDate).getTime() - new Date(todayStr).getTime();
    const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) {
      overdueCount++;
    } else if (diffDays === 0) {
      dueTodayCount++;
      totalDueTodayAmount += acc.amount;
      if (!sampleBillName) sampleBillName = acc.title;
    } else if (preferences.notifyDaysBefore && preferences.notifyDaysBefore.includes(diffDays)) {
      dueSoonCount++;
    }
  });

  const alertKey = `alert_${todayStr}_${currentTimeStr}`;
  if (sentAlertKeys.has(alertKey)) return;

  // Dispara alertas específicos
  if (dueTodayCount > 0 && preferences.notifyOnDueDate !== false) {
    sentAlertKeys.add(alertKey);
    const formattedTotal = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(totalDueTodayAmount);
    
    dispatchSystemNotification({
      title: dueTodayCount === 1 ? `🔔 Conta vencendo hoje: ${sampleBillName}` : `🔔 ${dueTodayCount} Contas vencem hoje!`,
      body: dueTodayCount === 1 
        ? `Valor: ${formattedTotal}. Abra o OrganizaIA para dar baixa ou conferir os detalhes.`
        : `Total acumulado de ${formattedTotal} para pagar hoje. Clique para conferir o extrato.`,
      url: '/?tab=transactions',
      tag: `due-today-${todayStr}`,
      sound: preferences.notificationSound || 'classic',
      customSoundUrl: preferences.customNotificationSoundUrl,
    });
  } else if (overdueCount > 0 && preferences.notifyOverdue !== false) {
    sentAlertKeys.add(alertKey);
    dispatchSystemNotification({
      title: `⚠️ Atenção: ${overdueCount} fatura(s) em atraso`,
      body: `Você possui pendências financeiras em atraso. Regularize para evitar encargos.`,
      url: '/?tab=transactions',
      tag: `overdue-${todayStr}`,
      sound: preferences.notificationSound || 'classic',
      customSoundUrl: preferences.customNotificationSoundUrl,
    });
  }
}
