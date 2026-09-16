const fs = require('fs');

function replaceFile(path, regex, replacer) {
  let content = fs.readFileSync(path, 'utf8');
  let newContent = content.replace(regex, replacer);
  fs.writeFileSync(path, newContent, 'utf8');
}

replaceFile('src/components/Dashboard.tsx', /b\.dueDate\.seconds - a\.dueDate\.seconds/g, '(b.dueDate as any)?.seconds - (a.dueDate as any)?.seconds');
replaceFile('src/components/Dashboard.tsx', /account\.dueDate\.seconds \* 1000/g, '(account.dueDate as any)?.seconds * 1000');
replaceFile('src/components/TransactionsScreen.tsx', /a\.dueDate\.seconds - b\.dueDate\.seconds/g, '(a.dueDate as any)?.seconds - (b.dueDate as any)?.seconds');

console.log('Fixed');
