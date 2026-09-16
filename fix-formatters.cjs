const fs = require('fs');
let content = fs.readFileSync('src/components/AIInsightPanel.tsx', 'utf8');
content = content.replace("import { formatCurrency } from '../utils/formatters';", 
`const formatCurrency = (value: number) => {
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
};`);
fs.writeFileSync('src/components/AIInsightPanel.tsx', content);
