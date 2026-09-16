const fs = require('fs');
let content = fs.readFileSync('src/components/UserProfileModal.tsx', 'utf8');

content = content.replace(
  "const docRef = doc(db, 'users', user.uid);",
  "const docRef = doc(db, `users/${user.uid}/profile`, 'data');"
);

content = content.replace(
  "await setDoc(doc(db, 'users', user.uid), profile, { merge: true });",
  "await setDoc(doc(db, `users/${user.uid}/profile`, 'data'), profile, { merge: true });"
);

fs.writeFileSync('src/components/UserProfileModal.tsx', content);
