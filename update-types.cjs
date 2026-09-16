const fs = require('fs');
let content = fs.readFileSync('src/types.ts', 'utf8');

if (!content.includes('whatsappTemplate')) {
  content = content.replace(
    "  userPhone: string | null;",
    "  userPhone: string | null;\n  whatsappTemplate?: string;"
  );
}

if (!content.includes('WhatsAppLog')) {
  content += `\nexport interface WhatsAppLog {\n  id?: string;\n  userId: string;\n  date: Timestamp;\n  status: 'sent' | 'pending' | 'error';\n  message: string;\n  contact: string;\n}\n`;
}

fs.writeFileSync('src/types.ts', content);
