const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

code = code.replace(
  "setPaymentAccount(null);\n                    handleOpenAddModal();\n                  }}",
  "setPaymentAccount(null);\n                    setShowAddModal(true);\n                  }}"
);

fs.writeFileSync('src/components/TransactionsScreen.tsx', code);
