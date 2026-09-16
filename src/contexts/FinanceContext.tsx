import React, { createContext, useContext, useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, query, onSnapshot, doc, setDoc, deleteDoc, Timestamp, getDoc } from 'firebase/firestore';
import { AccountPayable, Category, Income, SystemPreferences } from '../types';

interface FinanceState {
  accounts: AccountPayable[];
  categories: Category[];
  incomes: Income[];
  preferences: SystemPreferences | null;
  loading: boolean;
  upsertData: (collectionName: 'accounts_payable' | 'categories' | 'incomes', docId: string | null, data: any) => Promise<void>;
  deleteData: (collectionName: 'accounts_payable' | 'categories' | 'incomes', docId: string) => Promise<void>;
  reopenAccount: (account: AccountPayable) => Promise<void>;
}

const FinanceContext = createContext<FinanceState>({
  accounts: [],
  categories: [],
  incomes: [],
  preferences: null,
  loading: true,
  upsertData: async () => {},
  deleteData: async () => {},
  reopenAccount: async () => {},
});

export function FinanceProvider({ userId, children }: { userId: string, children: React.ReactNode }) {
  const [accounts, setAccounts] = useState<AccountPayable[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [incomes, setIncomes] = useState<Income[]>([]);
  const [preferences, setPreferences] = useState<SystemPreferences | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setAccounts([]);
      setCategories([]);
      setIncomes([]);
      setPreferences(null);
      setLoading(false);
      return;
    }
    
    // Clear old data immediately to prevent visual flashing of other account's data
    setAccounts([]);
    setCategories([]);
    setIncomes([]);
    setLoading(true);

    const accountsRef = collection(db, `users/${userId}/accounts_payable`);
    const categoriesRef = collection(db, `users/${userId}/categories`);
    const incomesRef = collection(db, `users/${userId}/incomes`);
    const prefsRef = doc(db, `users/${userId}/preferences`, 'system');

    const normalizeDate = (val: any) => {
      if (val === null || val === undefined) return val;
      if (typeof val === 'number') return Timestamp.fromMillis(val);
      if (typeof val === 'string') return Timestamp.fromDate(new Date(val));
      if (val instanceof Date) return Timestamp.fromDate(val);
      if (val && typeof val.toMillis === 'function') return val; // already a Timestamp
      if (val && typeof val.seconds === 'number') return Timestamp.fromMillis(val.seconds * 1000); // plain object looking like Timestamp
      return val;
    };

    const unsubAccounts = onSnapshot(accountsRef, (snapshot) => {
      setAccounts(snapshot.docs.map(doc => {
        const data = doc.data();
        const paymentDate = normalizeDate(data.paymentDate);
        let status = data.status;
        if (!status) {
          status = paymentDate ? 'PAID' : 'PENDING';
        }
        return {
          id: doc.id,
          ...data,
          status,
          dueDate: normalizeDate(data.dueDate),
          invoiceDate: normalizeDate(data.invoiceDate),
          paymentDate
        } as AccountPayable;
      }));
    });

    const unsubCategories = onSnapshot(categoriesRef, (snapshot) => {
      setCategories(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Category)));
    });

    const unsubIncomes = onSnapshot(incomesRef, (snapshot) => {
      setIncomes(snapshot.docs.map(doc => {
        const data = doc.data();
        return {
          id: doc.id,
          ...data,
          date: normalizeDate(data.date)
        } as Income;
      }));
    });

    const unsubPrefs = onSnapshot(prefsRef, (docSnap) => {
      if (docSnap.exists()) {
        setPreferences(docSnap.data() as SystemPreferences);
      } else {
        setPreferences(null);
      }
    });

    setLoading(false);

    return () => {
      unsubAccounts();
      unsubCategories();
      unsubIncomes();
      unsubPrefs();
    };
  }, [userId]);

  const upsertData = async (collectionName: 'accounts_payable' | 'categories' | 'incomes', docId: string | null, data: any) => {
    if (!userId) return;
    const ref = docId 
      ? doc(db, `users/${userId}/${collectionName}`, docId)
      : doc(collection(db, `users/${userId}/${collectionName}`));
    
    // Conflito de Sincronia: Verifica se o servidor tem um dado mais recente
    if (docId && data.lastSyncTimestamp) {
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const remoteSync = snap.data().lastSyncTimestamp || 0;
        if (remoteSync > data.lastSyncTimestamp) {
          console.warn('Conflito detectado: Dados do servidor são mais recentes.');
          // Em vez de bloquear e causar bugs se o relógio estiver errado, apenas registramos
        }
      }
    }

    const payload = {
      ...data,
      id: docId || ref.id,
      userId, // Ensure userId is saved
      lastSyncTimestamp: Date.now() // Timestamps in ms for Android compatibility
    };
    
    await setDoc(ref, payload, { merge: true });
  };

  const deleteData = async (collectionName: 'accounts_payable' | 'categories' | 'incomes', docId: string) => {
    if (!userId) return;
    await deleteDoc(doc(db, `users/${userId}/${collectionName}`, docId));
  };

  const reopenAccount = async (account: AccountPayable) => {
    if (!userId || !account.id) return;
    const ref = doc(db, `users/${userId}/accounts_payable`, account.id);
    await setDoc(ref, {
      status: 'PENDING',
      paymentDate: null,
      paidAmount: null,
      interest: 0,
      discount: 0,
      penaltyAmount: 0,
      discountAmount: 0,
      lastSyncTimestamp: Date.now()
    }, { merge: true });
  };

  return (
    <FinanceContext.Provider value={{ accounts, categories, incomes, preferences, loading, upsertData, deleteData, reopenAccount }}>
      {children}
    </FinanceContext.Provider>
  );
}

export function useFirestoreSync() {
  return useContext(FinanceContext);
}
