import React, { useEffect, useState } from 'react';
import { db } from '../firebaseConfig';
import { collection, writeBatch, doc, Timestamp, getDocs } from 'firebase/firestore';
import migrationData from '../data/migration.json';

interface AutoMigrationProps {
  userId: string;
}

export const AutoMigration: React.FC<AutoMigrationProps> = ({ userId }) => {
  const [migrating, setMigrating] = useState(false);
  const [done, setDone] = useState(false);

  useEffect(() => {
    const runMigration = async () => {
      if (!userId) return;
      
      const storageKey = `migration_done_v2_${userId}`;
      if (localStorage.getItem(storageKey)) {
        return;
      }
      
      try {
        // First check if the database already has accounts or categories
        const [catSnap, accSnap] = await Promise.all([
          getDocs(collection(db, `users/${userId}/categories`)),
          getDocs(collection(db, `users/${userId}/accounts_payable`))
        ]);

        // If user already has any categories or accounts in Firestore, NEVER overwrite!
        if (!catSnap.empty || !accSnap.empty) {
          localStorage.setItem(storageKey, 'true');
          setDone(true);
          return;
        }

        setMigrating(true);
        const batch = writeBatch(db);

        // Security check: only restore personal bills/income if the logged-in user matches the backup owner
        const migrationOwnerId = migrationData.accounts?.[0]?.userId || 'ErQFOGjr6YSBEBWX307PuZyQx3B2';
        const isOriginalOwner = userId === migrationOwnerId;

        if (isOriginalOwner) {
          // Migrate Categories
          if (migrationData.categories) {
            migrationData.categories.forEach((cat: any) => {
              const docRef = doc(db, `users/${userId}/categories`, cat.id);
              batch.set(docRef, {
                id: cat.id,
                userId: userId,
                name: cat.name,
                colorHex: cat.color || '#333333',
                icon: cat.icon || 'folder',
                maxLimit: cat.limit || null,
                isRolloverEnabled: cat.rollover || false,
                notes: cat.notes || ''
              });
            });
          }

          // Migrate Accounts
          if (migrationData.accounts) {
            migrationData.accounts.forEach((acc: any) => {
              const docRef = doc(db, `users/${userId}/accounts_payable`, acc.id);
              const data: any = {
                id: acc.id,
                userId: userId,
                title: acc.title,
                amount: acc.amount,
                dueDate: acc.dueDate ? Timestamp.fromMillis(acc.dueDate) : Timestamp.now(),
                categoryId: acc.categoryId,
                status: acc.status || 'PENDING',
                isRecurring: acc.isRecurring || false,
                lastSyncTimestamp: acc.lastSyncTimestamp || Date.now(),
              };

              if (acc.barcode) data.barcode = acc.barcode;
              if (acc.notes) data.notes = acc.notes;
              if (acc.invoiceDate) data.invoiceDate = Timestamp.fromMillis(acc.invoiceDate);
              if (acc.paymentDate) data.paymentDate = Timestamp.fromMillis(acc.paymentDate);
              if (acc.paymentMethod) data.paymentMethod = acc.paymentMethod;
              if (acc.groupId) data.groupId = acc.groupId;
              if (acc.installmentCurrent) data.installmentCurrent = acc.installmentCurrent;
              if (acc.installmentTotal) data.installmentTotal = acc.installmentTotal;

              batch.set(docRef, data);
            });
          }

          // Migrate Incomes
          if (migrationData.incomes) {
            migrationData.incomes.forEach((inc: any) => {
              const docRef = doc(db, `users/${userId}/incomes`, inc.id);
              batch.set(docRef, {
                id: inc.id,
                userId: userId,
                source: inc.source,
                amount: inc.amount,
                date: inc.date ? Timestamp.fromMillis(inc.date) : Timestamp.now(),
                isRecurring: inc.isRecurring || false,
                lastSyncTimestamp: Date.now()
              });
            });
          }
        } else {
          // Generic starting categories for other users
          const defaultCategories = [
            { id: 'cat-moradia', name: 'Moradia', color: '#6366F1', icon: 'Home' },
            { id: 'cat-alimentacao', name: 'Alimentação', color: '#EF4444', icon: 'ShoppingCart' },
            { id: 'cat-transporte', name: 'Transporte', color: '#F59E0B', icon: 'Car' },
            { id: 'cat-lazer', name: 'Lazer', color: '#10B981', icon: 'Plane' },
            { id: 'cat-outros', name: 'Outros', color: '#6B7280', icon: 'Folder' }
          ];

          defaultCategories.forEach((cat) => {
            const docRef = doc(db, `users/${userId}/categories`, cat.id);
            batch.set(docRef, {
              id: cat.id,
              userId: userId,
              name: cat.name,
              colorHex: cat.color,
              icon: cat.icon,
              maxLimit: null,
              isRolloverEnabled: false,
              notes: 'Categoria inicial padrão'
            });
          });
        }

        await batch.commit();
        localStorage.setItem(storageKey, 'true');
        setDone(true);
      } catch (err) {
        console.error("Migration failed:", err);
      } finally {
        setMigrating(false);
      }
    };

    runMigration();
  }, [userId]);

  if (migrating) {
    return (
      <div className="fixed inset-0 z-[100] flex items-center justify-center bg-white/80 backdrop-blur-sm">
        <div className="bg-white p-6 rounded-xl shadow-xl flex flex-col items-center">
          <div className="w-12 h-12 border-4 border-blue-200 border-t-blue-600 rounded-full animate-spin mb-4"></div>
          <h2 className="text-lg font-bold text-slate-800">Sincronizando Dados...</h2>
          <p className="text-sm text-slate-500 mt-2">Atualizando o banco de dados com a estrutura mais recente.</p>
        </div>
      </div>
    );
  }

  return null;
};
