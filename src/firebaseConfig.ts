import { initializeApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: "AIzaSyBMrYLCkSmjzmQA8F5m5-s9aN-9w0SisbQ",
  authDomain: "agendaex-de3b3.firebaseapp.com",
  projectId: "agendaex-de3b3",
  storageBucket: "agendaex-de3b3.firebasestorage.app",
  messagingSenderId: "521379396382",
  appId: "1:521379396382:web:34cf554ff03d4f6398270f"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Cloud Firestore and get a reference to the service
export const db = initializeFirestore(app, {
  localCache: persistentLocalCache(),
  experimentalForceLongPolling: true
});
export const auth = getAuth(app);
export const storage = getStorage(app);

