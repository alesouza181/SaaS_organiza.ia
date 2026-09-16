const fs = require('fs');

const files = ['src/components/AnalyticsScreen.tsx', 'src/components/Dashboard.tsx'];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  if (!content.includes("import { CategoryIcon }")) {
    content = content.replace(
      "import { useFirestoreSync } from '../contexts/FinanceContext';",
      "import { useFirestoreSync } from '../contexts/FinanceContext';\nimport { CategoryIcon } from './CategoryIcon';"
    );
    fs.writeFileSync(file, content);
  }
});
