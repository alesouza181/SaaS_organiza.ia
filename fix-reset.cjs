const fs = require('fs');
let code = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const resetFns = `  const resetForm = () => {
    setTitle(''); setAmount(''); setDueDate(''); setInstallments('1');
    setPaymentMethod(''); setReceiptUrl(''); setIsRecurring(false); setCategoryId(''); setIsCustomInstallments(false); setCustomInstallments([]);
    setEditingExpense(null);
    setApplyToAll(false);
  };

  const handleOpenAddModal = () => {
    resetForm();
    setShowAddModal(true);
  };
  
  const handleCloseAddModal = () => {
    setShowAddModal(false);
    resetForm();
  };
`;

code = code.replace(
  "React.useEffect(() => {",
  resetFns + "\n  React.useEffect(() => {"
);

// Update calls
code = code.replace(/setShowAddModal\(true\)/g, "handleOpenAddModal()");
// We need to be careful not to replace it if it's already handleOpenAddModal.

// Instead of global replace for true, let's do:
code = code.replace(/onClick=\{\(\) => setShowAddModal\(true\)\}/g, "onClick={handleOpenAddModal}");
code = code.replace(/onClick=\{\(\) => setShowAddModal\(false\)\}/g, "onClick={handleCloseAddModal}");

// Wait, openEditModal does:
// setApplyToAll(false);
// setShowAddModal(true); 
// If we change it to handleOpenAddModal(), it will reset the form!
code = code.replace(
  /setApplyToAll\(false\);\n\s*handleOpenAddModal\(\);/g, 
  "setApplyToAll(false);\n    setShowAddModal(true);"
);

fs.writeFileSync('src/components/TransactionsScreen.tsx', code);
