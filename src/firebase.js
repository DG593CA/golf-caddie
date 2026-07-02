import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";
import { getAuth, initializeAuth, browserLocalPersistence } from "firebase/auth";

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

// Conditionally initialize Auth to avoid WKWebView sandbox crashes on native platforms
let auth;
const isNative = typeof window !== 'undefined' && window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();

if (isNative) {
  // Use stable local persistence for webviews, avoiding popup dependencies
  auth = initializeAuth(app, {
    persistence: browserLocalPersistence
  });
} else {
  // Standard getAuth on web/PWA automatically bundles popup resolver support
  auth = getAuth(app);
}

export { db, auth };

