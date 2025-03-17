import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

// Firebase configuration
// This uses environment variables that should be set during build
// For local development, these can be set in a .env file
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAnHyYS-zdzfiTe97jJDfEaf1HxqmvLzmc",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "conflictology-conflict.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "conflictology-conflict",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "conflictology-conflict.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "205495071119",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:205495071119:web:c9077530939d71160c1bfa"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

export { db };
