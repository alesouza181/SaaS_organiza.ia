const fs = require('fs');
let content = fs.readFileSync('src/components/IncomeManagementScreen.tsx', 'utf8');

content = content.replace("import { formatCurrency } from '../utils/formatters';\n", "");

fs.writeFileSync('src/components/IncomeManagementScreen.tsx', content);
