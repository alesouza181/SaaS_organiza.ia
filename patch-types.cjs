const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

if (!content.includes('SystemPreferences')) {
  content += `
export interface SystemPreferences {
  userId: string;
  // Security
  enterDirectly: boolean;
  accessPin: string | null;
  biometricEnabled: boolean;
  // AI
  aiModel: 'gemini-1.5-flash' | 'gemini-1.5-pro';
  autoCategoryLearning: boolean;
  // Notifications
  notificationEnabled: boolean;
  notificationTime: string | null;
  notificationRepeatCount: number;
  // WhatsApp
  whatsappEnabled: boolean;
  userPhone: string | null;
}
`;
  fs.writeFileSync('src/types.ts', content);
}
