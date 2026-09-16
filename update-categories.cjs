const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

// Imports
content = content.replace(
  "import { ChevronDown, ChevronRight, PieChart, AlertCircle, Plus, X, Utensils, Home, Car, Star, HeartPulse, Landmark, LayoutGrid, Folder, ShoppingCart, Zap, Smartphone } from 'lucide-react';",
  "import { ChevronDown, ChevronRight, PieChart, AlertCircle, Plus, X, Utensils, Home, Car, Star, HeartPulse, Landmark, LayoutGrid, Folder, ShoppingCart, Zap, Smartphone, Edit2, Trash2 } from 'lucide-react';"
);

// Destructure deleteData
content = content.replace(
  "const { upsertData } = useFirestoreSync();",
  "const { upsertData, deleteData } = useFirestoreSync();"
);

// Add editing state and handlers
const stateHookStr = `  // New Category State
  const [name, setName] = useState('');`;

const handlersStr = `  const [editingCategoryId, setEditingCategoryId] = useState<string | null>(null);

  const handleEditCategory = (categoryId: string) => {
    const cat = categories.find(c => c.id === categoryId);
    if (cat) {
      setName(cat.name);
      setColorHex(cat.colorHex);
      setIcon(cat.icon);
      setMaxLimit(cat.maxLimit ? cat.maxLimit.toString() : '');
      setParentId(cat.parentId || '');
      setIsRolloverEnabled(cat.isRolloverEnabled || false);
      setNotes(cat.notes || '');
      setEditingCategoryId(categoryId);
      setShowModal(true);
    }
  };

  const handleDeleteCategory = async (categoryId: string) => {
    if (!confirm('Deseja realmente excluir esta categoria? As despesas associadas perderão a categoria.')) return;
    try {
      await deleteData('categories', categoryId);
    } catch (error) {
      console.error(error);
      alert('Erro ao excluir categoria.');
    }
  };

  const handleOpenNewModal = () => {
    setName('');
    setColorHex('#10B981');
    setIcon('folder');
    setMaxLimit('');
    setParentId('');
    setIsRolloverEnabled(false);
    setNotes('');
    setEditingCategoryId(null);
    setShowModal(true);
  };

  // New Category State
  const [name, setName] = useState('');`;

if (!content.includes('editingCategoryId')) {
  content = content.replace(stateHookStr, handlersStr);
}

// Change the 'Nova Categoria' button click
content = content.replace(
  "onClick={() => setShowModal(true)}",
  "onClick={handleOpenNewModal}"
);

// In handleSaveCategory, change from upsertData to include editingCategoryId
// we need to see how handleSaveCategory is implemented.
fs.writeFileSync('src/components/CategoryScreen.tsx', content);
