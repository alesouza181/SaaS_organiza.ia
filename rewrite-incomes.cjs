const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');
content = content.replace("import { formatCurrency } from '../utils/formatters';", "");
content = content.replace("const [deleteIncome, setDeleteIncome] = useState<Income | null>(null);", 
`const [deleteIncome, setDeleteIncome] = useState<Income | null>(null);

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
  };
`);
fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
