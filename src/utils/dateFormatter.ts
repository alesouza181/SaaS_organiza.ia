import { Timestamp } from 'firebase/firestore';

/**
 * Converte um Timestamp do Firebase para uma string de data amigável em Português.
 * @param timestamp O objeto Timestamp do Firestore
 * @param showTime Se deve incluir a hora (opcional)
 */
export const formatFriendlyDate = (
  timestamp: Timestamp | null | undefined,
  showTime: boolean = false
): string => {
  if (!timestamp) return '---';

  const date = timestamp.toDate();
  const now = new Date();
  
  // Zerando as horas para comparação de dias
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const targetDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  
  const diffInDays = Math.round((targetDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));

  // Lógica de nomes amigáveis
  let friendlyPrefix = '';
  if (diffInDays === 0) friendlyPrefix = 'Hoje';
  else if (diffInDays === 1) friendlyPrefix = 'Amanhã';
  else if (diffInDays === -1) friendlyPrefix = 'Ontem';
  else {
    // Formato padrão: 25 de mai. de 2024
    friendlyPrefix = new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    }).format(date);
  }

  if (showTime) {
    const timeString = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
    return `${friendlyPrefix} às ${timeString}`;
  }

  return friendlyPrefix;
};
