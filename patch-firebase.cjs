const fs = require('fs');
let content = fs.readFileSync('src/firebaseConfig.ts', 'utf8');

if (!content.includes('enableIndexedDbPersistence')) {
  content = content.replace("import { getFirestore } from 'firebase/firestore';", "import { getFirestore, enableIndexedDbPersistence } from 'firebase/firestore';");
  
  content += `\n
enableIndexedDbPersistence(db).catch((err) => {
  if (err.code == 'failed-precondition') {
    // Multiple tabs open, persistence can only be enabled in one tab at a a time.
    console.warn('Firebase persistence failed: multiple tabs open');
  } else if (err.code == 'unimplemented') {
    // The current browser does not support all of the features required to enable persistence
    console.warn('Firebase persistence not supported by browser');
  }
});
`;
  fs.writeFileSync('src/firebaseConfig.ts', content);
}
