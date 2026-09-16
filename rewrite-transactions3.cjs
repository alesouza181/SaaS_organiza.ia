const fs = require('fs');
let content = fs.readFileSync('src/components/TransactionsScreen.tsx', 'utf8');

const oldBtns = `              <div className="pt-4 flex justify-end">
                <button disabled={isSubmitting} type="submit" className="bg-red-600 hover:bg-red-500 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2">
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Salvando...' : 'Registrar Despesa'}
                </button>
              </div>`;

const newBtns = `              <div className="pt-4 flex justify-end gap-3">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-lg text-sm font-medium text-slate-600 hover:bg-slate-100 transition-colors">
                  Cancelar
                </button>
                <button disabled={isSubmitting} type="submit" className="bg-red-600 hover:bg-red-700 text-white px-6 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-2 shadow-sm">
                  <Plus className="w-4 h-4" />
                  {isSubmitting ? 'Salvando...' : 'Registrar Despesa'}
                </button>
              </div>`;

content = content.replace(oldBtns, newBtns);

fs.writeFileSync('src/components/TransactionsScreen.tsx', content);

