import { Timestamp } from 'firebase/firestore';

export type AccountStatus = 'PAID' | 'PENDING' | 'OVERDUE' | 'ANTECIPADA';

export interface AccountPayable {
  id?: string;
  userId: string;
  title: string;
  amount: number;
  dueDate: Timestamp;
  categoryId: string;
  status: AccountStatus;
  isRecurring: boolean;
  groupId?: string | null;
  installmentCurrent?: number | null;
  installmentTotal?: number | null;
  barcode?: string | null;
  notes?: string | null;
  invoiceDate?: Timestamp;
  paymentDate?: Timestamp | null;
  paymentMethod?: string | null;
  interest?: number | null;
  discount?: number | null;
  penaltyAmount?: number | null;
  discountAmount?: number | null;
  amountPaid?: number | null;
  receiptUrl?: string | null;
  receiptType?: 'IMAGE' | 'PDF' | null;
  priority?: 'LOW' | 'MEDIUM' | 'HIGH';
  lastSyncTimestamp: number;
}

export type CategoryLimitType = 'MONTHLY' | 'TOTAL' | 'NONE';

export interface Category {
  id?: string;
  userId: string;
  name: string;
  colorHex: string;
  icon: string;
  maxLimit: number | null;
  limitType?: CategoryLimitType;
  parentId?: string | null;
  isRolloverEnabled: boolean;
  notes?: string | null;
}

export interface Income {
  id?: string;
  userId: string;
  source: string;
  amount: number;
  date: Timestamp;
  isRecurring: boolean;
  groupId?: string | null;
  lastSyncTimestamp: number;
}

export interface CategoryBudget {
  category: Category;
  spentAmount: number;
  rolloverAmount: number;
  totalLimit: number;
  subcategories: CategoryBudget[];
}
export type NotificationFrequency = 'DAILY' | 'WEEKDAYS' | 'CUSTOM_DAYS';

export interface SystemPreferences {
  userId: string;
  // Security
  enterDirectly: boolean;
  accessPin: string | null;
  biometricEnabled: boolean;
  allowEditPaidExpenses?: boolean; // Permissão para reabrir e editar despesas já liquidadas
  // AI
  aiModel: 'gemini-1.5-flash' | 'gemini-1.5-pro';
  autoCategoryLearning: boolean;
  // Notifications
  notificationEnabled: boolean;
  notificationTime: string | null; // legacy fallback
  notificationTimes?: string[]; // e.g. ['08:00', '13:00', '19:00']
  notificationRepeatCount: number; // 1 to 5 times per day
  notificationFrequency?: NotificationFrequency; // 'DAILY' | 'WEEKDAYS' | 'CUSTOM_DAYS'
  notificationDays?: number[]; // [0, 1, 2, 3, 4, 5, 6] 0=domingo, 1=segunda...
  // Quando enviar os alertas (Gatilhos / Antecedência)
  notifyOnDueDate?: boolean; // No dia do vencimento
  notifyDaysBefore?: number[]; // [1, 2, 3, 7] dias de antecedência
  notifyOverdue?: boolean; // Alertar contas vencidas
  // Som de Notificação
  notificationSound?: 'classic' | 'chime' | 'bell' | 'modern' | 'zen' | 'cash' | 'custom';
  customNotificationSoundUrl?: string | null;
  customNotificationSoundName?: string | null;
  // WhatsApp
  whatsappEnabled: boolean;
  userPhone: string | null;
  whatsappTemplate?: string;
  // Backup
  backupSchedule: 'OFF' | 'DAILY' | 'WEEKLY' | 'MONTHLY';
}

export interface UserProfile {
  userId: string;
  name: string;
  email: string;
  phone?: string | null;
  financialGoal?: string | null;
  monthlyIncomeTarget?: number | null;
  birthDate?: string | null;
  createdAt: number;
}

export interface WhatsAppLog {
  id?: string;
  userId: string;
  date: Timestamp;
  status: 'sent' | 'pending' | 'error';
  message: string;
  contact: string;
}

export type UserRole = 'admin' | 'user';
export type UserAccountStatus = 'active' | 'pending' | 'blocked';

export interface AuthorizedUser {
  id: string;
  userId?: string | null; // Google UID or Unique Tenant ID
  name: string;
  email: string;
  role: UserRole;
  status: UserAccountStatus;
  passwordHash?: string | null;
  phone?: string | null;
  notes?: string | null;
  createdAt: number;
  updatedAt: number;
  lastLoginAt?: number | null;
  createdBy?: string | null;
}

export interface AuthSession {
  token: string;
  expiresAt?: number;
  user: {
    id: string;
    userId: string;
    name: string;
    email: string;
    role: UserRole;
    status: UserAccountStatus;
    photoURL?: string | null;
    authProvider: 'google' | 'password';
  };
}
