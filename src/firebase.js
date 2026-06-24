import { initializeApp } from "firebase/app";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";
import { initializeAuth, indexedDBLocalPersistence, browserLocalPersistence } from "firebase/auth";

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
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({
    tabManager: persistentMultipleTabManager()
  })
});

// Use stable browserLocalPersistence (localStorage) and indexedDB to avoid hangs on iOS
const auth = initializeAuth(app, {
  persistence: [indexedDBLocalPersistence, browserLocalPersistence]
});

export { db, auth };

