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

files.forEach(file => {
  let content = fs.readFileSync(file, 'utf8');
  content = content.replace(/bg-blue-600(.*?)text-slate-900/g, 'bg-blue-600$1text-white');
  content = content.replace(/bg-emerald-600(.*?)text-slate-900/g, 'bg-emerald-600$1text-white');
  content = content.replace(/bg-red-600(.*?)text-slate-900/g, 'bg-red-600$1text-white');
  fs.writeFileSync(file, content);
});

console.log('Fixed button text colors.');
