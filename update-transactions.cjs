const fs = require('fs');
let content = fs.readFileSync('/app/applet/src/components/TransactionsScreen.tsx', 'utf8');

const oldButton = `                        <button
                          onClick={() => openEditModal(acc)}
                          disabled={isSubmitting}
                          className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-lg transition-colors"
                          title="Editar"
                        >
                          <Edit2 className="w-4 h-4" />
                        </button>`;
const newButton = `                        {acc.status !== 'PAID' && (
                          <button
                            onClick={() => openEditModal(acc)}
                            disabled={isSubmitting}
                            className="p-2 text-slate-500 hover:text-blue-600 hover:bg-slate-200 rounded-lg transition-colors"
                            title="Editar"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                        )}`;

content = content.replace(oldButton, newButton);
fs.writeFileSync('/app/applet/src/components/TransactionsScreen.tsx', content);
