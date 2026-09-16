import { useState, useEffect, useMemo } from 'react';
import { AccountPayable, Category, Income } from '../types';
import { subMonths, startOfMonth, endOfMonth } from 'date-fns';
import { useFirestoreSync } from '../contexts/FinanceContext';

const getMs = (val: any): number | null => {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return val;
  if (typeof val.toMillis === 'function') return val.toMillis();
  if (typeof val.seconds === 'number') return val.seconds * 1000;
  if (val instanceof Date) return val.getTime();
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return null;
    const dateStr = trimmed.includes('T') ? trimmed : `${trimmed}T12:00:00`;
    const t = new Date(dateStr).getTime();
    return isNaN(t) ? null : t;
  }
  return null;
};

export function useRollover(userId: string, currentStartDate: Date, categories: Category[]) {
  const { accounts, loading } = useFirestoreSync();

  const rolloverBonuses = useMemo(() => {
    const bonuses = new Map<string, number>();
    if (loading) return bonuses;

    const prevMonthDate = subMonths(currentStartDate, 1);
    const startTime = startOfMonth(prevMonthDate).getTime();
    const endTime = endOfMonth(prevMonthDate).getTime();

    // Filter accounts from previous month
    const prevAccounts = accounts.filter(acc => {
      const ms = getMs(acc.dueDate);
      return ms !== null && ms >= startTime && ms <= endTime;
    });

    categories.forEach(cat => {
      if (cat.isRolloverEnabled && cat.limitType !== 'NONE' && cat.maxLimit !== null && (cat.limitType || 'MONTHLY') === 'MONTHLY') {
        const prevSpent = prevAccounts
          .filter(acc => acc.categoryId === cat.id)
          .reduce((sum, acc) => sum + acc.amount, 0);
        
        const leftover = cat.maxLimit - prevSpent;
        if (leftover > 0) {
          bonuses.set(cat.id!, leftover);
        }
      }
    });

    return bonuses;
  }, [categories, accounts, loading, currentStartDate]);

  return { rolloverBonuses, loadingRollover: loading };
}

export function useAccounts(userId: string, startDate: Date, endDate: Date) {
  const { accounts: allAccounts, loading } = useFirestoreSync();
  
  const accounts = useMemo(() => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return allAccounts.filter(acc => {
      const ms = getMs(acc.dueDate);
      return ms !== null && ms >= startMs && ms <= endMs;
    });
  }, [allAccounts, startDate, endDate]);

  return { accounts, loading };
}

export function useIncomes(userId: string, startDate: Date, endDate: Date) {
  const { incomes: allIncomes, loading } = useFirestoreSync();
  
  const incomes = useMemo(() => {
    const startMs = startDate.getTime();
    const endMs = endDate.getTime();
    return allIncomes.filter(inc => {
      const ms = getMs(inc.date);
      return ms !== null && ms >= startMs && ms <= endMs;
    });
  }, [allIncomes, startDate, endDate]);

  return { incomes, loading };
}

export function useCategories(userId: string) {
  const { categories, loading } = useFirestoreSync();
  return { categories, loading };
}
