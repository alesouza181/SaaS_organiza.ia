const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

// I will just checkout the original or fix the strings directly
// Let's use regex to fix the mangled state declarations

content = content.replace(
  /const \[paymentMethod,[\s\S]*?setPaymentMethod\] = useState\(''\);/,
  "const [paymentMethod, setPaymentMethod] = useState('');"
);

content = content.replace(
  /const \[priority,[\s\S]*?setPriority\] = useState<'LOW' \| 'MEDIUM' \| 'HIGH'>\('MEDIUM'\);/,
  "const [priority, setPriority] = useState<'LOW' | 'MEDIUM' | 'HIGH'>('MEDIUM');"
);

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);
