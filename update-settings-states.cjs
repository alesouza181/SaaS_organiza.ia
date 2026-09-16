const fs = require('fs');
let content = fs.readFileSync('src/components/SettingsScreen.tsx', 'utf8');

// Add new states
content = content.replace(
  "  const [linkSuccess, setLinkSuccess] = useState(false);",
  "  const [linkSuccess, setLinkSuccess] = useState(false);\n  const [whatsappLogs, setWhatsappLogs] = useState<WhatsAppLog[]>([]);\n  const [isTestingConnection, setIsTestingConnection] = useState(false);"
);

// Add to default preferences
content = content.replace(
  "userPhone: '',\n    backupSchedule: 'OFF'",
  "userPhone: '',\n    backupSchedule: 'OFF',\n    whatsappTemplate: 'Olá! Sua fatura {categoria} no valor de R$ {valor} vence em {data}.'"
);

// Add logic to fetch whatsapp logs
const fetchPrefsOriginal = `    const fetchPrefs = async () => {
      try {
        const snap = await getDoc(doc(db, \`users/\${userId}/preferences\`, 'system'));
        const profileSnap = await getDoc(doc(db, \`users/\${userId}/profile\`, 'data'));
        
        let prefsData = snap.exists() ? snap.data() : {};
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          if (profileData.phone && !prefsData.userPhone) {
            prefsData.userPhone = profileData.phone;
          }
        }
        
        if (Object.keys(prefsData).length > 0) {
          setPreferences((prev: any) => ({ ...prev, ...prefsData }));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();`;

const fetchPrefsNew = `    const fetchPrefs = async () => {
      try {
        const snap = await getDoc(doc(db, \`users/\${userId}/preferences\`, 'system'));
        const profileSnap = await getDoc(doc(db, \`users/\${userId}/profile\`, 'data'));
        
        let prefsData = snap.exists() ? snap.data() : {};
        if (profileSnap.exists()) {
          const profileData = profileSnap.data();
          if (profileData.phone && !prefsData.userPhone) {
            prefsData.userPhone = profileData.phone;
          }
        }
        
        if (Object.keys(prefsData).length > 0) {
          setPreferences((prev: any) => ({ ...prev, ...prefsData }));
        }

        const logsQuery = query(collection(db, \`users/\${userId}/whatsapp_logs\`), orderBy('date', 'desc'), limit(10));
        const logsSnap = await getDocs(logsQuery);
        setWhatsappLogs(logsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as WhatsAppLog)));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchPrefs();`;

content = content.replace(fetchPrefsOriginal, fetchPrefsNew);

fs.writeFileSync('src/components/SettingsScreen.tsx', content);
