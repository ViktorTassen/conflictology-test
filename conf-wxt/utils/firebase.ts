import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAnHyYS-zdzfiTe97jJDfEaf1HxqmvLzmc",
  authDomain: "conflictology-conflict.firebaseapp.com",
  projectId: "conflictology-conflict",
  storageBucket: "conflictology-conflict.firebasestorage.app",
  messagingSenderId: "205495071119",
  appId: "1:205495071119:web:c9077530939d71160c1bfa"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };