const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');

if (content.includes("import { collection, addDoc, Timestamp } from 'firebase/firestore';")) {
  content = content.replace(
    "import { collection, addDoc, Timestamp } from 'firebase/firestore';",
    "import { collection, addDoc, Timestamp, writeBatch, doc } from 'firebase/firestore';"
  );
  fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
}
