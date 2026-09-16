const fs = require('fs');
const path = require('path');

function walk(dir) {
  let results = [];
  const list = fs.readdirSync(dir);
  list.forEach((file) => {
    file = path.join(dir, file);
    const stat = fs.statSync(file);
    if (stat && stat.isDirectory()) {
      results = results.concat(walk(file));
    } else {
      if (file.endsWith('.tsx') || file.endsWith('.ts')) {
        results.push(file);
      }
    }
  });
  return results;
}

const files = walk('./src');

const replacements = [
  { from: /bg-\[\#0F172A\]/g, to: 'bg-slate-50' },
  { from: /bg-\[\#1E293B\]/g, to: 'bg-white' },
  { from: /text-white/g, to: 'text-slate-900' },
  { from: /border-slate-700/g, to: 'border-slate-200' },
  { from: /bg-slate-900/g, to: 'bg-slate-50' },
  { from: /bg-slate-800\/50/g, to: 'bg-slate-100' },
  { from: /bg-slate-800\/30/g, to: 'bg-slate-50' },
  { from: /bg-slate-800/g, to: 'bg-slate-100' },
  { from: /bg-slate-700\/50/g, to: 'bg-slate-200' },
  { from: /bg-slate-700/g, to: 'bg-slate-200' },
  { from: /divide-slate-700/g, to: 'divide-slate-200' },
  { from: /text-slate-400/g, to: 'text-slate-500' },
  { from: /text-slate-300/g, to: 'text-slate-600' },
  { from: /text-slate-200/g, to: 'text-slate-700' },
  { from: /hover:text-white/g, to: 'hover:text-slate-900' },
  { from: /text-blue-400/g, to: 'text-blue-600' },
  { from: /text-emerald-400/g, to: 'text-emerald-600' },
  { from: /text-red-400/g, to: 'text-red-600' },
  { from: /text-amber-400/g, to: 'text-amber-600' },
  { from: /bg-emerald-400\/10/g, to: 'bg-emerald-50' },
  { from: /bg-amber-400\/10/g, to: 'bg-amber-50' },
  { from: /bg-emerald-500\/20/g, to: 'bg-emerald-100' },
  { from: /bg-red-500\/20/g, to: 'bg-red-100' },
  { from: /border-blue-600\/30/g, to: 'border-blue-200' },
  { from: /bg-blue-600\/20/g, to: 'bg-blue-50' },
  { from: /bg-blue-500\/20/g, to: 'bg-blue-100' },
  { from: /bg-blue-500\/10/g, to: 'bg-blue-50' },
  { from: /border-blue-500\/20/g, to: 'border-blue-200' },
  { from: /bg-slate-500\/10/g, to: 'bg-slate-100' },
  { from: /border-slate-500\/20/g, to: 'border-slate-200' },
  { from: /shadow-2xl/g, to: 'shadow-md' },
  { from: /shadow-xl/g, to: 'shadow-sm' },
  { from: /shadow-\[0_0_20px_rgba\(239,68,68,0\.25\)\]/g, to: 'shadow-sm' }
];

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  replacements.forEach(r => {
    content = content.replace(r.from, r.to);
  });
  fs.writeFileSync(file, content);
});

console.log('Theme converted to light mode.');
