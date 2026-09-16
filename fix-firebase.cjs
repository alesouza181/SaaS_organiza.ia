const fs = require('fs');
let content = fs.readFileSync('src/firebaseConfig.ts', 'utf8');

if (!content.includes('getStorage')) {
  content = content.replace("import { getAuth } from 'firebase/auth';", "import { getAuth } from 'firebase/auth';\nimport { getStorage } from 'firebase/storage';");
  content = content.replace("export const auth = getAuth(app);", "export const auth = getAuth(app);\nexport const storage = getStorage(app);");
  fs.writeFileSync('src/firebaseConfig.ts', content);
}
