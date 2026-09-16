const fs = require('fs');
let content = fs.readFileSync('src/components/CategoryScreen.tsx', 'utf8');

// Replace handleSaveCategory
const oldSave = `  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !colorHex) return;
    setIsSubmitting(true);
    try {
      await upsertData('categories', null, {`;

const newSave = `  const handleSaveCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name || !colorHex) return;
    setIsSubmitting(true);
    try {
      await upsertData('categories', editingCategoryId, {`;

content = content.replace(oldSave, newSave);

// Add action buttons in the drill-down
const drillDownBtnsStr = `                  <div className="flex gap-2 justify-end mt-4 pt-4 border-t border-slate-200">
                    <button onClick={(e) => { e.stopPropagation(); handleEditCategory(category.id!); }} className="px-3 py-1.5 text-xs font-medium text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-lg flex items-center gap-1 transition-colors">
                      <Edit2 className="w-3.5 h-3.5" /> Editar
                    </button>
                    <button onClick={(e) => { e.stopPropagation(); handleDeleteCategory(category.id!); }} className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-lg flex items-center gap-1 transition-colors">
                      <Trash2 className="w-3.5 h-3.5" /> Excluir
                    </button>
                  </div>
                </div>
              )}`;

content = content.replace(
  /                <\/div>\s*<\/div>\s*\)\}\s*<\/div>\s*\);\s*\}\)\}/,
  drillDownBtnsStr + "\n            </div>\n          );\n        })}"
);

// Add action buttons to the modal text
content = content.replace(
  "{isSubmitting ? 'Salvando...' : 'Criar Categoria'}",
  "{isSubmitting ? 'Salvando...' : (editingCategoryId ? 'Salvar Alterações' : 'Criar Categoria')}"
);

content = content.replace(
  /<PieChart className="w-5 h-5 text-blue-600" \/> Nova Categoria/,
  '<PieChart className="w-5 h-5 text-blue-600" /> {editingCategoryId ? "Editar Categoria" : "Nova Categoria"}'
);

fs.writeFileSync('src/components/CategoryScreen.tsx', content);

