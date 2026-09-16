const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

content = content.replace(
  "import { doc, getDoc, setDoc } from 'firebase/firestore';",
  "import { doc, getDoc, setDoc, collection, query, orderBy, limit, getDocs, addDoc, Timestamp } from 'firebase/firestore';"
);

content = content.replace(
  "import { SystemPreferences } from '../types';",
  "import { SystemPreferences, WhatsAppLog } from '../types';"
);

content = content.replace(
  "import { Save, Lock, Brain, Bell, MessageCircle, Cloud, Download, Upload, Trash2, User, LogOut, Wallet, UserCog } from 'lucide-react';",
  "import { Save, Lock, Brain, Bell, MessageCircle, Cloud, Download, Upload, Trash2, User, LogOut, Wallet, UserCog, CheckCircle2, Clock, XCircle, Send } from 'lucide-react';"
);

fs.writeFileSync('src/components/SettingsScreen.tsx', content);
