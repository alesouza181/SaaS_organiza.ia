const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

code = code.replace(
  "  const handleOpenAddModal = () => {\n    resetForm();\n    handleOpenAddModal();\n  };",
  "  const handleOpenAddModal = () => {\n    resetForm();\n    setShowAddModal(true);\n  };"
);

fs.writeFileSync('src/components/TransactionsScreen.tsx', code);
