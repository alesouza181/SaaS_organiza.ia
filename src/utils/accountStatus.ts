
import { AccountPayable } from '../types';

export const isAccountPaid = (account: Partial<AccountPayable> | null | undefined) => {
  if (!account) return false;
  const status = account.status?.toUpperCase();
  return status === 'PAID' || status === 'PAGO' || status === 'LIQUIDADO' || !!account.paymentDate;
};

export const isAccountPending = (account: Partial<AccountPayable> | null | undefined) => {
  if (!account) return false;
  if (isAccountPaid(account)) return false;
  const status = account.status?.toUpperCase();
  if (status === 'ANTECIPADA') return false;
  return status === 'PENDING' || status === 'PENDENTE' || status === 'OVERDUE' || status === 'EM_ABERTO' || !status;
};

export const isAccountLate = (account: Partial<AccountPayable> | null | undefined) => {
  if (!account) return false;
  if (isAccountPaid(account)) return false;
  const status = account.status?.toUpperCase();
  if (status === 'ANTECIPADA') return false;
  if (status === 'OVERDUE') return true;
  
  if (!account.dueDate) return false;
  try {
    const ms = typeof (account.dueDate as any).toMillis === 'function' 
      ? (account.dueDate as any).toMillis() 
      : typeof (account.dueDate as any).seconds === 'number'
      ? (account.dueDate as any).seconds * 1000
      : (account.dueDate as any) instanceof Date
      ? (account.dueDate as any).getTime()
      : typeof account.dueDate === 'string'
      ? new Date(account.dueDate).getTime()
      : null;
    return ms !== null && ms < Date.now();
  } catch (e) {
    return false;
  }
};

export const getAccountInterest = (account: Partial<AccountPayable> | null | undefined): number => {
  if (!account) return 0;
  const val = account.interest ?? (account as any).penaltyAmount;
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0).replace(',', '.'));
  return isNaN(num) ? 0 : Math.max(0, num);
};

export const getAccountDiscount = (account: Partial<AccountPayable> | null | undefined): number => {
  if (!account) return 0;
  const val = account.discount ?? (account as any).discountAmount;
  const num = typeof val === 'number' ? val : parseFloat(String(val || 0).replace(',', '.'));
  return isNaN(num) ? 0 : Math.max(0, num);
};

export const getAccountPaidAmount = (account: Partial<AccountPayable> | null | undefined): number => {
  if (!account) return 0;
  if (typeof account.amountPaid === 'number' && !isNaN(account.amountPaid)) {
    return account.amountPaid;
  }
  const baseAmount = Number(account.amount || 0);
  const interest = getAccountInterest(account);
  const discount = getAccountDiscount(account);
  return Math.max(0, baseAmount + interest - discount);
};

export const getEffectiveAccountAmount = (account: Partial<AccountPayable> | null | undefined): number => {
  if (!account) return 0;
  if (account.status?.toUpperCase() === 'ANTECIPADA') return Number(account.amount || 0);
  if (isAccountPaid(account)) {
    return getAccountPaidAmount(account);
  }
  return Number(account.amount || 0);
};
