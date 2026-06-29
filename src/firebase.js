import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { initializeAuth, browserLocalPersistence } from "firebase/auth";

const firebaseConfig = {
  projectId: "golfcaddie-e3e0e",
  appId: "1:435593255008:web:008c6aa28530bf87d50b05",
  storageBucket: "golfcaddie-e3e0e.firebasestorage.app",
  apiKey: "AIzaSyAi6abBD50TRmpeDaTWHK3ggaS5zlSxXl4",
  authDomain: "golfcaddie-e3e0e.firebaseapp.com",
  messagingSenderId: "435593255008",
  measurementId: "G-T0MF9RYC92"
};

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Use stable browserLocalPersistence (localStorage) exclusively to avoid indexedDB hangs on iOS WebView
const auth = initializeAuth(app, {
  persistence: browserLocalPersistence
});

export { db, auth };

