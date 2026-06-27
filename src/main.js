import './style.css';
import { Capacitor } from '@capacitor/core';
import { db, auth } from './firebase.js';
import { doc, getDoc, setDoc, deleteDoc, onSnapshot, collection, query, where, getDocs, addDoc, orderBy, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';

// Detect iOS and apply class for notch safe area styling
if (typeof window !== 'undefined' && Capacitor.getPlatform() === 'ios') {
  if (document.body) {
    document.body.classList.add('platform-ios');
  } else {
    document.addEventListener('DOMContentLoaded', () => {
      document.body.classList.add('platform-ios');
    });
  }
}
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  onAuthStateChanged,
  signOut,
  deleteUser,
  sendPasswordResetEmail
} from 'firebase/auth';

// Mock Golf Courses Database
const MOCK_COURSES = [
  {
    id: "mock_juandefuca",
    name: "Juan de Fuca Golf Course",
    city: "Victoria",
    state: "BC",
    rating: 27.0,
    slope: 113,
    holesCount: 9,
    pars: [3, 3, 3, 3, 3, 3, 3, 3, 3],
    coordinates: { lat: 48.4469, lng: -123.4648 },
    holeCoordinates: [
      { lat: 48.4468, lng: -123.4624 }, // H1: 145 yd
      { lat: 48.4456, lng: -123.4613 }, // H2: 97 yd
      { lat: 48.4447, lng: -123.4620 }, // H3: 116 yd
      { lat: 48.4445, lng: -123.4632 }, // H4: 135 yd
      { lat: 48.4446, lng: -123.4640 }, // H5: 143 yd
      { lat: 48.4452, lng: -123.4633 }, // H6: 79 yd
      { lat: 48.4467, lng: -123.4637 }, // H7: 170 yd
      { lat: 48.4465, lng: -123.4628 }, // H8: 106 yd
      { lat: 48.4456, lng: -123.4643 }  // H9: 145 yd
    ]
  },
  {
    id: "mock_pebble",
    name: "Pebble Beach Golf Links",
    city: "Pebble Beach",
    state: "CA",
    rating: 75.5,
    slope: 145,
    holesCount: 18,
    pars: [4, 5, 4, 4, 3, 5, 3, 4, 4, 4, 4, 3, 4, 5, 4, 4, 3, 5],
    coordinates: { lat: 36.5684, lng: -121.9507 }
  },
  {
    id: "mock_augusta",
    name: "Augusta National Golf Club",
    city: "Augusta",
    state: "GA",
    rating: 76.2,
    slope: 148,
    holesCount: 18,
    pars: [4, 5, 4, 3, 4, 3, 4, 5, 4, 4, 4, 3, 5, 4, 5, 3, 4, 4],
    coordinates: { lat: 33.5021, lng: -82.0220 }
  },
  {
    id: "mock_standrews",
    name: "St Andrews Old Course",
    city: "St Andrews",
    state: "Fife",
    rating: 73.1,
    slope: 129,
    holesCount: 18,
    pars: [4, 4, 4, 4, 5, 4, 4, 3, 4, 4, 3, 4, 4, 5, 4, 4, 4, 4],
    coordinates: { lat: 56.3429, lng: -2.8021 }
  },
  {
    id: "mock_sawgrass",
    name: "TPC Sawgrass (Stadium)",
    city: "Ponte Vedra Beach",
    state: "FL",
    rating: 76.8,
    slope: 155,
    holesCount: 18,
    pars: [4, 5, 4, 4, 4, 4, 4, 3, 5, 4, 5, 4, 3, 4, 4, 5, 3, 4],
    coordinates: { lat: 30.2016, lng: -81.3653 }
  },
  {
    id: "mock_cypress",
    name: "Cypress Point Club",
    city: "Pebble Beach",
    state: "CA",
    rating: 74.9,
    slope: 139,
    holesCount: 18,
    pars: [4, 5, 4, 4, 5, 3, 4, 4, 4, 4, 4, 3, 4, 4, 5, 3, 4, 4],
    coordinates: { lat: 36.5794, lng: -121.9740 }
  }
];

let state = {
  syncId: '',
  username: '',
  numHoles: 9,
  currentHoleIndex: 0,
  apiKey: '',
  golfApiKey: 'JU7TE2S574463W653KOETCNKH4',
  openaiApiKey: '',
  selectedCourse: null,
  useSpeechSynthesis: true,
  isListening: false,
  continuous: false,
  holes: [],
  history: [],
  roundStartTime: null,
  roundElapsedTime: 0,
  isTimerRunning: false,
  customCourseMappings: '{}',
  customCourses: [],
  hasCompletedTutorial: false,
  hiddenRoundIds: [],
  isAdmin: false,
  team1Name: '',
  team2Name: ''
};

// Speech Recognition Variables
let recognition = null;
let speechTimeout = null;
let mediaRecorder = null;
let audioChunks = [];
let whisperIsRecording = false;

// Initialize App
function initApp() {
  loadState();
  initUI();
  initSpeechRecognition();
  applySelectedCourse();
  updateUI();
  updateGPSWidget();
  initRoundTimer(); // Initialize/resume stopwatch timer
  initCourseMapper(); // Bind mapping button events
  initTutorial(); // Bind onboarding tutorial buttons
  initAuth(); // Setup Firebase Authentication listeners
  setupActiveRoundSubscription();

  // Register Service Worker for PWA support
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js')
      .then((reg) => console.log('Service Worker registered:', reg.scope))
      .catch((err) => console.error('Service Worker registration failed:', err));
  }
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initApp);
} else {
  initApp();
}

// Load state from localStorage or set defaults
function loadState() {
  const savedState = localStorage.getItem('golf_caddie_state');
  if (savedState) {
    try {
      state = JSON.parse(savedState);
      state.isListening = false;
      if (!state.syncId) state.syncId = generateSyncId();
      if (state.username === undefined) state.username = '';
      if (!state.history) state.history = [];
      if (!state.golfApiKey) state.golfApiKey = 'JU7TE2S574463W653KOETCNKH4';
      if (state.openaiApiKey === undefined) state.openaiApiKey = '';
      if (!state.selectedCourse || state.selectedCourse.id === 'mock_pebble') {
        state.selectedCourse = MOCK_COURSES[0];
      }
      if (state.roundStartTime === undefined) state.roundStartTime = null;
      if (state.roundElapsedTime === undefined) state.roundElapsedTime = 0;
      if (state.isTimerRunning === undefined) state.isTimerRunning = false;
      if (!state.customCourseMappings) state.customCourseMappings = '{}';
      if (!state.customCourses) state.customCourses = [];
      if (state.hasCompletedTutorial === undefined) state.hasCompletedTutorial = false;
      if (!state.hiddenRoundIds) state.hiddenRoundIds = [];
      if (state.isAdmin === undefined) state.isAdmin = false;
      if (state.team1Name === undefined) state.team1Name = '';
      if (state.team2Name === undefined) state.team2Name = '';
      if (state.mode === undefined) state.mode = 'individual';
      if (state.matchType === undefined) state.matchType = 'leaderboard';
      if (!state.players || !state.players.length) state.players = ['You'];
      if (!state.playerAliases) state.playerAliases = [];
    } catch (e) {
      console.error('Failed to parse saved state, loading defaults', e);
      initDefaultState();
    }
  } else {
    initDefaultState();
  }
}

function initDefaultState() {
  state.syncId = generateSyncId();
  state.username = '';
  state.numHoles = 9;
  state.apiKey = '';
  state.golfApiKey = 'JU7TE2S574463W653KOETCNKH4';
  state.openaiApiKey = '';
  state.selectedCourse = MOCK_COURSES[0];
  state.useSpeechSynthesis = true;
  state.isListening = false;
  state.continuous = false;
  state.history = [];
  state.roundStartTime = null;
  state.roundElapsedTime = 0;
  state.isTimerRunning = false;
  state.customCourseMappings = '{}';
  state.customCourses = [];
  state.hasCompletedTutorial = false;
  state.hiddenRoundIds = [];
  state.isAdmin = false;
  state.team1Name = '';
  state.team2Name = '';
  state.mode = 'individual';
  state.matchType = 'leaderboard';
  state.players = ['You'];
  state.playerAliases = [];
  initActiveRound();
}

function generateSyncId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'caddie-';
  for (let i = 0; i < 16; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

async function syncFromCloud() {
  if (!state.syncId) return;
  try {
    const userDocRef = doc(db, 'users', state.syncId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      
      // Update local keys if they match
      if (userData.username !== undefined) {
        state.username = userData.username;
      } else {
        state.username = auth.currentUser && auth.currentUser.email ? auth.currentUser.email.split('@')[0] : 'Golfer_' + state.syncId.substring(0, 5);
      }
      if (userData.apiKey !== undefined) state.apiKey = userData.apiKey;
      if (userData.openaiApiKey !== undefined) state.openaiApiKey = userData.openaiApiKey;
      if (userData.golfApiKey !== undefined) state.golfApiKey = userData.golfApiKey;
      if (userData.customCourseMappings !== undefined) state.customCourseMappings = userData.customCourseMappings;
      if (userData.customCourses !== undefined) state.customCourses = userData.customCourses;
      if (userData.hasCompletedTutorial !== undefined) state.hasCompletedTutorial = userData.hasCompletedTutorial;
      if (userData.playerAliases !== undefined) state.playerAliases = userData.playerAliases;
      
      const isDeveloperEmail = auth.currentUser && auth.currentUser.email && (
        auth.currentUser.email.toLowerCase().includes('danny') ||
        auth.currentUser.email.toLowerCase().includes('travis') ||
        auth.currentUser.email.toLowerCase() === 'travis.hildreth@hotmail.com'
      );
      if (userData.isAdmin !== undefined) {
        state.isAdmin = !!userData.isAdmin;
      } else if (isDeveloperEmail) {
        state.isAdmin = true;
        try {
          await updateDoc(userDocRef, { isAdmin: true });
        } catch (e) {
          console.warn("Failed to auto-bootstrap isAdmin in cloud:", e);
        }
      }
      
      // Fetch completed rounds from roundIds and query participant match play rounds
      const cloudRounds = [];
      
      // 1. Fetch rounds where user is creator (host)
      if (userData.roundIds && userData.roundIds.length > 0) {
        for (const roundDocId of userData.roundIds) {
          const roundDocRef = doc(db, 'rounds', roundDocId);
          const roundSnap = await getDoc(roundDocRef);
          if (roundSnap.exists()) {
            cloudRounds.push(roundSnap.data());
          }
        }
      }

      // 2. Fetch rounds where user is participant in Match Play
      if (state.username) {
        try {
          const qParticipant = query(
            collection(db, 'rounds'),
            where('mode', '==', 'match'),
            where('playerUsernames', 'array-contains', state.username.toLowerCase())
          );
          const participantSnap = await getDocs(qParticipant);
          participantSnap.forEach(docSnap => {
            const rData = docSnap.data();
            // Avoid duplicate additions
            if (!cloudRounds.some(r => r.id === rData.id)) {
              cloudRounds.push(rData);
            }
          });
        } catch (err) {
          console.warn("Failed to fetch participant rounds:", err);
        }
      }
      
      if (cloudRounds.length > 0) {
        if (!state.history) state.history = [];
        
        let modified = false;
        cloudRounds.forEach(cloudRound => {
          // Check if this round is hidden locally
          if (state.hiddenRoundIds && state.hiddenRoundIds.includes(cloudRound.id)) {
            return;
          }
          
          const exists = state.history.some(r => r.id === cloudRound.id);
          if (!exists) {
            state.history.push(cloudRound);
            modified = true;
          }
        });
        
        if (modified) {
          state.history.sort((a, b) => b.id - a.id);
        }
      }
      
      saveState();
      updateUI();
      // Populate inputs in modal if currently open
      const syncInput = document.getElementById('sync-id-input');
      if (syncInput) syncInput.value = state.syncId;
      const authUidInput = document.getElementById('auth-uid-input');
      if (authUidInput) authUidInput.value = state.syncId;
      const geminiInput = document.getElementById('gemini-api-key');
      if (geminiInput) geminiInput.value = state.apiKey || '';
      const openaiInput = document.getElementById('openai-api-key');
      if (openaiInput) openaiInput.value = state.openaiApiKey || '';
      const golfapiInput = document.getElementById('golfapi-key');
      if (golfapiInput) golfapiInput.value = state.golfApiKey || '';
    } else {
      // First time user registration in Cloud database
      await saveSettingsToCloud();
    }
  } catch (error) {
    console.error("Failed to sync from Cloud Firestore:", error);
    alert("Failed to sync settings from cloud: " + error.message);
  }
}

async function saveSettingsToCloud() {
  if (!state.syncId) return;
  try {
    const userDocRef = doc(db, 'users', state.syncId);
    const userDocSnap = await getDoc(userDocRef);
    const roundIds = userDocSnap.exists() ? (userDocSnap.data().roundIds || []) : [];
    
    await setDoc(userDocRef, {
      syncId: state.syncId,
      username: state.username || '',
      apiKey: state.apiKey || '',
      openaiApiKey: state.openaiApiKey || '',
      golfApiKey: state.golfApiKey || '',
      customCourseMappings: state.customCourseMappings || '{}',
      customCourses: state.customCourses || [],
      hasCompletedTutorial: !!state.hasCompletedTutorial,
      playerAliases: state.playerAliases || [],
      roundIds: roundIds,
      createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : new Date(),
      updatedAt: new Date()
    });
    console.log("Settings successfully synced to Cloud.");
  } catch (error) {
    console.error("Failed to save settings to Cloud:", error);
    alert("Failed to save settings to cloud: " + error.message);
    throw error;
  }
}

async function saveRoundToCloud(archivedRound) {
  if (!state.syncId) return;
  const docId = `${state.syncId}_${archivedRound.id}`;
  try {
    const roundDocRef = doc(db, 'rounds', docId);
    await setDoc(roundDocRef, {
      ...archivedRound,
      playerUsernames: (archivedRound.players || []).map(p => p.toLowerCase()),
      syncId: state.syncId,
      createdAt: new Date()
    });
    
    const userDocRef = doc(db, 'users', state.syncId);
    let roundIds = [];
    const userDocSnap = await getDoc(userDocRef);
    if (userDocSnap.exists()) {
      roundIds = userDocSnap.data().roundIds || [];
    }
    
    if (!roundIds.includes(docId)) {
      roundIds.push(docId);
    }
    
    await setDoc(userDocRef, {
      syncId: state.syncId,
      apiKey: state.apiKey || '',
      openaiApiKey: state.openaiApiKey || '',
      golfApiKey: state.golfApiKey || '',
      customCourseMappings: state.customCourseMappings || '{}',
      roundIds: roundIds,
      createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : new Date(),
      updatedAt: new Date()
    });
    console.log("Round successfully archived in the Cloud database:", docId);
  } catch (error) {
    console.error("Failed to save round to Cloud:", error);
    alert("Failed to save round to cloud: " + error.message);
  }
}

async function connectExistingSyncId(newSyncId) {
  const trimmedId = newSyncId.trim();
  if (!trimmedId || trimmedId.length < 15 || trimmedId.length > 50) {
    alert("Invalid Sync ID. Must be between 15 and 50 characters.");
    return;
  }
  
  try {
    const userDocRef = doc(db, 'users', trimmedId);
    const userDocSnap = await getDoc(userDocRef);
    
    if (userDocSnap.exists()) {
      const userData = userDocSnap.data();
      state.syncId = trimmedId;
      state.apiKey = userData.apiKey || '';
      state.openaiApiKey = userData.openaiApiKey || '';
      state.golfApiKey = userData.golfApiKey || '';
      
      state.history = [];
      if (userData.roundIds && userData.roundIds.length > 0) {
        for (const roundDocId of userData.roundIds) {
          const roundDocRef = doc(db, 'rounds', roundDocId);
          const roundSnap = await getDoc(roundDocRef);
          if (roundSnap.exists()) {
            state.history.push(roundSnap.data());
          }
        }
        state.history.sort((a, b) => b.id - a.id);
      }
      
      saveState();
      setupActiveRoundSubscription();
      updateUI();
      alert(`Connected successfully! Loaded settings and ${state.history.length} round records.`);
    } else {
      if (confirm("Sync ID does not have any active cloud records yet. Would you like to use this ID for your current cloud session?")) {
        state.syncId = trimmedId;
        await saveSettingsToCloud();
        saveState();
        setupActiveRoundSubscription();
        updateUI();
        alert(`Connected successfully. New Cloud profile initialized with ID: ${trimmedId}`);
      }
    }
  } catch (error) {
    console.error("Failed to connect existing Sync ID:", error);
    alert("Failed to connect. Please check your network connection.");
  }
}
// Authentication state tracking and handlers
let currentAuthMode = 'login'; // 'login' or 'signup'
let isMigrating = false;

async function deleteUserAccount() {
  const user = auth.currentUser;
  if (!user) return;

  if (confirm("⚠️ WARNING: Are you sure you want to permanently delete your account? This will delete your profile settings and ALL completed rounds. This action is permanent and cannot be undone.")) {
    try {
      const uid = user.uid;

      // 1. Delete all rounds from Firestore
      const userDocRef = doc(db, 'users', uid);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        if (userData.roundIds && userData.roundIds.length > 0) {
          for (const roundDocId of userData.roundIds) {
            try {
              const roundDocRef = doc(db, 'rounds', roundDocId);
              await deleteDoc(roundDocRef);
            } catch (err) {
              console.error("Failed to delete round doc:", roundDocId, err);
            }
          }
        }
      }

      // 2. Delete the user document in Firestore
      try {
        await deleteDoc(userDocRef);
      } catch (err) {
        console.error("Failed to delete user document:", err);
      }

      // 3. Delete the user from Firebase Auth
      await deleteUser(user);
      
      alert("Your account has been deleted successfully.");
    } catch (error) {
      console.error("Account deletion failed:", error);
      if (error.code === 'auth/requires-recent-login') {
        alert("For security reasons, this operation requires a recent login. Please log out, log back in, and try again immediately.");
      } else {
        alert("Failed to delete account: " + error.message);
      }
    }
  }
}

async function migrateUserData(uid, localHistory, localSettings, username) {
  try {
    const userDocRef = doc(db, 'users', uid);
    let roundIds = [];
    
    // Save/migrate all local rounds to firestore under `${uid}_${round.id}`
    if (localHistory && localHistory.length > 0) {
      for (const round of localHistory) {
        const docId = `${uid}_${round.id}`;
        const roundDocRef = doc(db, 'rounds', docId);
        
        // Save the round document
        await setDoc(roundDocRef, {
          ...round,
          syncId: uid,
          createdAt: new Date()
        });
        
        roundIds.push(docId);
      }
    }

    // Set the user document
    await setDoc(userDocRef, {
      syncId: uid,
      username: username || '',
      apiKey: localSettings.apiKey || '',
      openaiApiKey: localSettings.openaiApiKey || '',
      golfApiKey: localSettings.golfApiKey || 'JU7TE2S574463W653KOETCNKH4',
      customCourseMappings: localSettings.customCourseMappings || '{}',
      roundIds: roundIds,
      createdAt: new Date(),
      updatedAt: new Date()
    });
    
    console.log("Migration complete for user UID:", uid);
  } catch (error) {
    console.error("Failed to migrate user data:", error);
    alert("Failed to migrate user data to cloud: " + error.message);
  }
}

function initAuth() {
  // Gate overlay elements
  const authGateOverlay = document.getElementById('auth-gate-overlay');
  const gateTabLogin = document.getElementById('gate-tab-login');
  const gateTabSignup = document.getElementById('gate-tab-signup');
  const btnGateAuthSubmit = document.getElementById('btn-gate-auth-submit');
  const gateAuthEmail = document.getElementById('gate-auth-email');
  const gateAuthPassword = document.getElementById('gate-auth-password');
  const gateAuthErrorMsg = document.getElementById('gate-auth-error-msg');
  const gateSyncIdInput = document.getElementById('gate-sync-id-input');
  const btnGateConnectSync = document.getElementById('btn-gate-connect-sync');
  
  // Username Elements
  const gateAuthUsernameWrapper = document.getElementById('gate-auth-username-wrapper');
  const gateAuthUsername = document.getElementById('gate-auth-username');

  // New Forgot Password Elements
  const gateAuthTabs = document.getElementById('gate-auth-tabs');
  const gateAuthPasswordWrapper = document.getElementById('gate-auth-password-wrapper');
  const gateAuthForgotHelper = document.getElementById('gate-auth-forgot-helper');
  const btnGateForgotPassword = document.getElementById('btn-gate-forgot-password');
  const btnGateBackToLogin = document.getElementById('btn-gate-back-to-login');
  const gateBackToLoginWrapper = document.getElementById('gate-back-to-login-wrapper');

  // Settings modal active auth elements
  const btnAuthLogout = document.getElementById('btn-auth-logout');
  const btnAuthDeleteAccount = document.getElementById('btn-auth-delete-account');
  const authUserEmail = document.getElementById('auth-user-email');
  const authUidInput = document.getElementById('auth-uid-input');
  const btnCopyUid = document.getElementById('btn-copy-uid');

  // Tab switching on login gate
  gateTabLogin.addEventListener('click', () => {
    currentAuthMode = 'login';
    gateTabLogin.classList.add('active-tab');
    gateTabSignup.classList.remove('active-tab');
    btnGateAuthSubmit.textContent = 'Log In';
    gateAuthErrorMsg.style.display = 'none';
    gateAuthPasswordWrapper.style.display = 'block';
    gateAuthForgotHelper.style.display = 'none';
    gateBackToLoginWrapper.style.display = 'none';
    if (gateAuthUsernameWrapper) gateAuthUsernameWrapper.style.display = 'none';
  });

  gateTabSignup.addEventListener('click', () => {
    currentAuthMode = 'signup';
    gateTabSignup.classList.add('active-tab');
    gateTabLogin.classList.remove('active-tab');
    btnGateAuthSubmit.textContent = 'Create Account';
    gateAuthErrorMsg.style.display = 'none';
    gateAuthPasswordWrapper.style.display = 'block';
    gateAuthForgotHelper.style.display = 'none';
    gateBackToLoginWrapper.style.display = 'none';
    if (gateAuthUsernameWrapper) gateAuthUsernameWrapper.style.display = 'block';
  });

  btnGateForgotPassword.addEventListener('click', () => {
    currentAuthMode = 'forgot';
    gateAuthTabs.style.display = 'none';
    gateAuthPasswordWrapper.style.display = 'none';
    gateAuthForgotHelper.style.display = 'block';
    gateBackToLoginWrapper.style.display = 'block';
    btnGateAuthSubmit.textContent = 'Send Reset Email';
    gateAuthErrorMsg.style.display = 'none';
    if (gateAuthUsernameWrapper) gateAuthUsernameWrapper.style.display = 'none';
  });

  btnGateBackToLogin.addEventListener('click', () => {
    currentAuthMode = 'login';
    gateAuthTabs.style.display = 'flex';
    gateAuthPasswordWrapper.style.display = 'block';
    gateAuthForgotHelper.style.display = 'none';
    gateBackToLoginWrapper.style.display = 'none';
    btnGateAuthSubmit.textContent = 'Log In';
    gateAuthErrorMsg.style.display = 'none';
    gateAuthPassword.value = '';
    if (gateAuthUsernameWrapper) gateAuthUsernameWrapper.style.display = 'none';
  });

  // Submit action on login gate (Log In, Sign Up, or Password Reset)
  btnGateAuthSubmit.addEventListener('click', async () => {
    const email = gateAuthEmail.value.trim();
    const password = gateAuthPassword.value;
    let username = '';

    if (currentAuthMode === 'forgot') {
      if (!email) {
        showGateAuthError("Please enter your email address.");
        return;
      }
    } else {
      if (!email || !password) {
        showGateAuthError("Please fill in both email and password.");
        return;
      }
      if (currentAuthMode === 'signup') {
        username = gateAuthUsername.value.trim();
        if (!username) {
          showGateAuthError("Please choose a username for the community.");
          return;
        }
        if (username.length < 3 || username.length > 20) {
          showGateAuthError("Username must be between 3 and 20 characters.");
          return;
        }
        if (!/^[a-zA-Z0-9_]+$/.test(username)) {
          showGateAuthError("Username can only contain letters, numbers, and underscores.");
          return;
        }
      }
    }

    gateAuthErrorMsg.style.display = 'none';
    btnGateAuthSubmit.disabled = true;
    const originalText = btnGateAuthSubmit.textContent;
    
    if (currentAuthMode === 'login') {
      btnGateAuthSubmit.textContent = 'Logging in...';
    } else if (currentAuthMode === 'signup') {
      btnGateAuthSubmit.textContent = 'Creating account...';
    } else {
      btnGateAuthSubmit.textContent = 'Sending...';
    }

    try {
      if (currentAuthMode === 'forgot') {
        await sendPasswordResetEmail(auth, email);
        gateAuthErrorMsg.style.color = "var(--color-success, #10b981)";
        gateAuthErrorMsg.textContent = "Reset link sent! Please check your email (including spam folder).";
        gateAuthErrorMsg.style.display = "block";
        gateAuthEmail.value = '';
      } else if (currentAuthMode === 'login') {
        await signInWithEmailAndPassword(auth, email, password);
        // Clear forms
        gateAuthEmail.value = '';
        gateAuthPassword.value = '';
      } else {
        // Sign Up
        // Check if username is already taken first in Firestore users collection
        const q = query(collection(db, 'users'), where('username', '==', username));
        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
          showGateAuthError("This username is already taken. Please choose another.");
          btnGateAuthSubmit.disabled = false;
          btnGateAuthSubmit.textContent = originalText;
          return;
        }

        // Capture existing local state before signing up for migration
        const existingLocalHistory = [...(state.history || [])];
        const existingSettings = {
          apiKey: state.apiKey,
          openaiApiKey: state.openaiApiKey,
          golfApiKey: state.golfApiKey,
          customCourseMappings: state.customCourseMappings
        };
        
        isMigrating = true;
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;

        // Perform migration of local rounds and settings to Firestore under new User UID
        state.username = username;
        saveState();
        await migrateUserData(user.uid, existingLocalHistory, existingSettings, username);
        isMigrating = false;
        
        // Refresh local data from newly migrated cloud profile
        await syncFromCloud();
        // Clear forms
        gateAuthEmail.value = '';
        gateAuthPassword.value = '';
        if (gateAuthUsername) gateAuthUsername.value = '';
      }
    } catch (error) {
      console.error("Authentication error:", error);
      let friendlyMessage = error.message;
      if (error.code === 'auth/invalid-credential' || error.code === 'auth/wrong-password' || error.code === 'auth/user-not-found') {
        friendlyMessage = currentAuthMode === 'forgot' ? "No account found with this email." : "Incorrect email address or password. Please try again.";
      } else if (error.code === 'auth/email-already-in-use') {
        friendlyMessage = "This email is already in use. Please log in instead.";
      } else if (error.code === 'auth/weak-password') {
        friendlyMessage = "Password is too weak. Must be at least 6 characters.";
      } else if (error.code === 'auth/invalid-email') {
        friendlyMessage = "Please enter a valid email address.";
      }
      showGateAuthError(friendlyMessage);
      isMigrating = false;
    } finally {
      btnGateAuthSubmit.disabled = false;
      btnGateAuthSubmit.textContent = originalText;
    }
  });

  // Logout action in Settings modal
  btnAuthLogout.addEventListener('click', async () => {
    if (confirm("Are you sure you want to log out? This will lock the app and switch you to a clean guest session.")) {
      try {
        await signOut(auth);
        const settingsDialog = document.getElementById('settings-dialog');
        if (settingsDialog && settingsDialog.open) settingsDialog.close();
      } catch (error) {
        console.error("Sign out error:", error);
      }
    }
  });

  // Delete Account action in Settings modal
  btnAuthDeleteAccount.addEventListener('click', async () => {
    await deleteUserAccount();
    const settingsDialog = document.getElementById('settings-dialog');
    if (settingsDialog && settingsDialog.open) settingsDialog.close();
  });

  // Copy UID button
  if (btnCopyUid) {
    btnCopyUid.addEventListener('click', () => {
      const syncId = state.syncId;
      if (navigator.clipboard) {
        navigator.clipboard.writeText(syncId).then(() => {
          alert("Sync ID copied to clipboard!");
        }).catch(err => {
          console.error("Failed to copy Sync ID:", err);
        });
      } else {
        authUidInput.select();
        document.execCommand('copy');
        alert("Sync ID copied to clipboard!");
      }
    });
  }

  // Connect to legacy Sync ID from gate
  btnGateConnectSync.addEventListener('click', async () => {
    const syncId = gateSyncIdInput.value.trim();
    if (!syncId || syncId.length < 15 || syncId.length > 50) {
      alert("Invalid Sync ID. Must be between 15 and 50 characters.");
      return;
    }
    
    try {
      const userDocRef = doc(db, 'users', syncId);
      const userDocSnap = await getDoc(userDocRef);
      if (userDocSnap.exists()) {
        const userData = userDocSnap.data();
        state.syncId = syncId;
        state.apiKey = userData.apiKey || '';
        state.openaiApiKey = userData.openaiApiKey || '';
        state.golfApiKey = userData.golfApiKey || '';
        state.customCourseMappings = userData.customCourseMappings || '{}';
        
        state.history = [];
        if (userData.roundIds && userData.roundIds.length > 0) {
          for (const roundDocId of userData.roundIds) {
            const roundDocRef = doc(db, 'rounds', roundDocId);
            const roundSnap = await getDoc(roundDocRef);
            if (roundSnap.exists()) {
              state.history.push(roundSnap.data());
            }
          }
          state.history.sort((a, b) => b.id - a.id);
        }
        saveState();
        updateUI();
        alert(`Legacy Sync ID loaded successfully! Loaded settings and ${state.history.length} round records. You can now Create an Account to save them under your permanent email.`);
      } else {
        alert("Legacy Sync ID does not exist in the database.");
      }
    } catch (error) {
      console.error("Failed to load legacy Sync ID:", error);
      alert("Error loading legacy Sync ID. Please check your connection.");
    }
  });

  function showGateAuthError(msg) {
    gateAuthErrorMsg.style.color = "var(--color-danger, #ef4444)";
    gateAuthErrorMsg.textContent = msg;
    gateAuthErrorMsg.style.display = 'block';
  }

  // Set up Firebase Auth State Listener
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // User is logged in
      console.log("Auth State: User is logged in", user.email);
      state.syncId = user.uid;

      // Hide login gate and show app
      authGateOverlay.style.display = 'none';

      // Update UI elements for logged-in view inside settings
      authUserEmail.textContent = `Logged in as: ${user.email}`;
      authUidInput.value = user.uid;

      // Pull settings and history from Cloud Firestore
      if (!isMigrating) {
        await syncFromCloud();
      }
      setupActiveRoundSubscription();
      listenForActiveMatches();

      if (!state.hasCompletedTutorial) {
        setTimeout(() => {
          startOnboardingTutorial();
        }, 500);
      }
    } else {
      // User is logged out / guest mode
      console.log("Auth State: User is logged out");
      
      if (window.activeMatchesUnsubscribe) {
        window.activeMatchesUnsubscribe();
        window.activeMatchesUnsubscribe = null;
      }
      
      // Show login gate and block app
      authGateOverlay.style.display = 'flex';

      authUserEmail.textContent = '';
      authUidInput.value = '';

      // Reset to a clean guest state to prevent leaking previous user details
      state.syncId = generateSyncId();
      state.history = [];
      state.apiKey = '';
      state.openaiApiKey = '';
      state.customCourseMappings = '{}';
      
      saveState();
      updateUI();
      setupActiveRoundSubscription();
      
      gateSyncIdInput.value = '';
    }
  });
}



function initActiveRound() {
  state.currentHoleIndex = 0;
  state.holes = [];
  const course = state.selectedCourse || MOCK_COURSES[0];
  state.numHoles = course.holesCount || 18;

  if (!state.mode) state.mode = 'individual';
  if (!state.players || !state.players.length) state.players = ['You'];
  if (!state.playerAliases) state.playerAliases = [];

  for (let i = 1; i <= state.numHoles; i++) {
    const defaultPar = (course.pars && course.pars[i - 1]) || 4;
    const holeObj = {
      number: i,
      par: defaultPar, // Loaded from course pars
      score: 0,
      putts: 0,
      fairway: 'NA', // NA, HIT, LEFT, RIGHT, OB
      gir: 'NA', // NA, YES, NO
      conceded: false,
      notes: [],
      playerScores: {},
      playerConceded: {}
    };

    // Initialize scores & concessions for all active players
    state.players.forEach(p => {
      holeObj.playerScores[p] = 0;
      holeObj.playerConceded[p] = false;
    });

    state.holes.push(holeObj);
  }
  
  // Reset stopwatch timer state
  state.roundStartTime = null;
  state.roundElapsedTime = 0;
  state.isTimerRunning = false;
  if (timerInterval) {
    clearInterval(timerInterval);
    timerInterval = null;
  }
}

// Spectator Mode Variables
let isSpectating = false;
let spectatingId = '';
let spectatorRole = 'viewer'; // 'viewer' or 'collaborator'
let spectatorUnsubscribe = null;
let activeRoundUnsubscribe = null;

function setupActiveRoundSubscription() {
  if (activeRoundUnsubscribe) {
    activeRoundUnsubscribe();
    activeRoundUnsubscribe = null;
  }

  if (isSpectating) {
    return;
  }

  if (!state.syncId) return;

  const activeRoundRef = doc(db, 'activeRounds', state.syncId);
  activeRoundUnsubscribe = onSnapshot(activeRoundRef, (docSnap) => {
    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      
      const cloudHolesStr = JSON.stringify(cloudData.holes || []);
      const localHolesStr = JSON.stringify(state.holes || []);
      
      if (cloudHolesStr !== localHolesStr || 
          cloudData.mode !== state.mode ||
          cloudData.matchType !== state.matchType ||
          cloudData.team1Name !== state.team1Name ||
          cloudData.team2Name !== state.team2Name ||
          JSON.stringify(cloudData.players) !== JSON.stringify(state.players)) {
        
        console.log("Syncing active round updates from cloud/collaborator...");
        
        state.numHoles = cloudData.numHoles || 9;
        state.selectedCourse = cloudData.selectedCourse || null;
        state.holes = cloudData.holes || [];
        state.mode = cloudData.mode || 'individual';
        state.players = cloudData.players || ['You'];
        state.matchType = cloudData.matchType || 'leaderboard';
        state.team1Name = cloudData.team1Name || '';
        state.team2Name = cloudData.team2Name || '';
        state.roundStartTime = cloudData.roundStartTime || null;
        state.roundElapsedTime = cloudData.roundElapsedTime || 0;
        state.isTimerRunning = cloudData.isTimerRunning || false;

        localStorage.setItem('golf_caddie_state', JSON.stringify(state));
        
        updateUI();
        updateGPSWidget();
      }
    }
  }, (error) => {
    console.warn("Active round subscription error (host):", error);
  });
}

function saveState() {
  if (isSpectating) {
    if (spectatorRole === 'collaborator') {
      publishActiveRoundToCloud();
    }
    return;
  }
  localStorage.setItem('golf_caddie_state', JSON.stringify(state));
  publishActiveRoundToCloud();
}

async function publishActiveRoundToCloud() {
  if (isSpectating && spectatorRole !== 'collaborator') return;
  const targetSyncId = isSpectating ? spectatingId : state.syncId;
  if (!targetSyncId) return;
  try {
    const activeRoundRef = doc(db, 'activeRounds', targetSyncId);
    await setDoc(activeRoundRef, {
      syncId: targetSyncId,
      hostUsername: isSpectating ? (state.hostUsername || 'Host') : (state.username || 'Host'),
      numHoles: state.numHoles || 9,
      currentHoleIndex: state.currentHoleIndex || 0,
      selectedCourse: state.selectedCourse || null,
      holes: state.holes || [],
      mode: state.mode || 'individual',
      players: state.players || ['You'],
      playerUsernames: (state.players || []).map(p => p.toLowerCase()),
      matchType: state.matchType || 'leaderboard',
      team1Name: state.team1Name || '',
      team2Name: state.team2Name || '',
      roundStartTime: state.roundStartTime || null,
      roundElapsedTime: state.roundElapsedTime || 0,
      isTimerRunning: state.isTimerRunning || false,
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("Failed to publish active round to Firestore:", error);
  }
}

async function deleteActiveRoundFromCloud(syncId) {
  if (!syncId) return;
  try {
    const activeRoundRef = doc(db, 'activeRounds', syncId);
    await deleteDoc(activeRoundRef);
  } catch (error) {
    console.error("Failed to delete active round from cloud:", error);
  }
}

function getTeamBestBall(s1, c1, s2, c2) {
  const played1 = s1 > 0 || c1;
  const played2 = s2 > 0 || c2;
  if (!played1 && !played2) {
    return { played: false, score: 0, conceded: false };
  }
  
  let best = Infinity;
  if (s1 > 0 && !c1) best = Math.min(best, s1);
  if (s2 > 0 && !c2) best = Math.min(best, s2);
  
  if (best !== Infinity) {
    return { played: true, score: best, conceded: false };
  }
  
  return { played: true, score: 0, conceded: true };
}


// UI Binding
function initUI() {
  // Navigation elements
  document.getElementById('btn-prev-hole').addEventListener('click', () => {
    navigateHole(state.currentHoleIndex - 1);
  });
  document.getElementById('btn-next-hole').addEventListener('click', () => {
    navigateHole(state.currentHoleIndex + 1);
  });

  // GPS Help Modal listeners
  const gpsHelpDialog = document.getElementById('gps-help-dialog');
  const gpsStatusBadge = document.querySelector('.gps-status-badge');
  const closeGpsHelpBtn = document.getElementById('btn-close-gps-help');

  if (gpsStatusBadge && gpsHelpDialog) {
    gpsStatusBadge.addEventListener('click', () => {
      // Only request/show help if the GPS is actually offline
      if (gpsStatusBadge.classList.contains('offline')) {
        const statusLbl = document.getElementById('gps-status-lbl');
        if (statusLbl) {
          statusLbl.textContent = "Requesting location...";
        }

        if (navigator.geolocation) {
          navigator.geolocation.getCurrentPosition(
            (position) => {
              gpsStatusBadge.classList.remove('offline');
              updateGPSWidget();
            },
            (error) => {
              updateGPSWidget();
              if (error.code === error.PERMISSION_DENIED) {
                gpsHelpDialog.showModal();
              }
            },
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
          );
        } else {
          gpsHelpDialog.showModal();
        }
      }
    });
  }
  if (closeGpsHelpBtn && gpsHelpDialog) {
    closeGpsHelpBtn.addEventListener('click', () => {
      gpsHelpDialog.close();
    });
  }

  // Settings elements
  const settingsDialog = document.getElementById('settings-dialog');
  
  // Game Mode Change Listeners
  const modeIndiv = document.getElementById('mode-individual');
  const modeMatch = document.getElementById('mode-match');
  const matchSetupSec = document.getElementById('match-play-setup-section');
  if (modeIndiv && modeMatch && matchSetupSec) {
    const updateVisibility = () => {
      const teamNamesSetup = document.getElementById('team-names-setup');
      if (modeMatch.checked) {
        matchSetupSec.classList.remove('hidden');
        const selectedMatchType = document.querySelector('input[name="match-type"]:checked');
        if (teamNamesSetup && selectedMatchType && selectedMatchType.value === 'team') {
          teamNamesSetup.classList.remove('hidden');
        } else if (teamNamesSetup) {
          teamNamesSetup.classList.add('hidden');
        }
      } else {
        matchSetupSec.classList.add('hidden');
        if (teamNamesSetup) teamNamesSetup.classList.add('hidden');
      }
    };
    modeIndiv.addEventListener('change', updateVisibility);
    modeMatch.addEventListener('change', updateVisibility);
  }

  // Dynamic Course Length Radio Listeners
  const holes9Radio = document.getElementById('holes-9');
  const holes18Radio = document.getElementById('holes-18');
  if (holes9Radio && holes18Radio) {
    const handleHolesChange = (e) => {
      const numHolesVal = parseInt(e.target.value) || 9;
      state.numHoles = numHolesVal;
      
      // Resize state.holes if necessary, maintaining scores/pars
      const course = state.selectedCourse || MOCK_COURSES[0];
      const newHoles = [];
      for (let i = 1; i <= state.numHoles; i++) {
        if (state.holes && state.holes[i - 1]) {
          newHoles.push(state.holes[i - 1]);
        } else {
          const defaultPar = (course.pars && course.pars[i - 1]) || 4;
          newHoles.push({
            number: i,
            par: defaultPar,
            score: 0,
            putts: 0,
            fairway: 'NA',
            gir: 'NA',
            conceded: false,
            notes: [],
            playerScores: {},
            playerConceded: {}
          });
        }
      }
      state.holes = newHoles;
      if (state.currentHoleIndex >= state.numHoles) {
        state.currentHoleIndex = state.numHoles - 1;
      }
      
      renderParsConfig();
    };
    holes9Radio.addEventListener('change', handleHolesChange);
    holes18Radio.addEventListener('change', handleHolesChange);
  }

  document.getElementById('btn-settings').addEventListener('click', () => {
    renderParsConfig();
    const syncInput = document.getElementById('sync-id-input');
    if (syncInput) syncInput.value = state.syncId || '';
    const authUidInput = document.getElementById('auth-uid-input');
    if (authUidInput) authUidInput.value = state.syncId || '';
    const authUserEmail = document.getElementById('auth-user-email');
    if (authUserEmail && auth.currentUser) {
      authUserEmail.textContent = `Logged in as: ${auth.currentUser.email}`;
    }
    document.getElementById('gemini-api-key').value = state.apiKey || '';
    document.getElementById('openai-api-key').value = state.openaiApiKey || '';
    document.getElementById('golfapi-key').value = state.golfApiKey || '';
    document.getElementById('course-search-input').value = state.selectedCourse ? state.selectedCourse.name : '';
    if (state.numHoles === 9) {
      document.getElementById('holes-9').checked = true;
    } else {
      document.getElementById('holes-18').checked = true;
    }

    // Set game mode radios
    if (state.mode === 'match') {
      if (modeMatch) modeMatch.checked = true;
    } else {
      if (modeIndiv) modeIndiv.checked = true;
    }
    
    // Toggle setup visibility
    if (matchSetupSec) {
      if (state.mode === 'match') {
        matchSetupSec.classList.remove('hidden');
      } else {
        matchSetupSec.classList.add('hidden');
      }
    }

    // Populate custom team names
    const team1Input = document.getElementById('team-1-name');
    const team2Input = document.getElementById('team-2-name');
    if (team1Input) team1Input.value = state.team1Name || '';
    if (team2Input) team2Input.value = state.team2Name || '';

    // Show/hide team-names-setup panel
    const teamNamesSetup = document.getElementById('team-names-setup');
    if (teamNamesSetup) {
      if (state.mode === 'match' && state.matchType === 'team') {
        teamNamesSetup.classList.remove('hidden');
      } else {
        teamNamesSetup.classList.add('hidden');
      }
    }
    
    // Populate players' names
    const p1 = document.getElementById('player-1-name');
    const p2 = document.getElementById('player-2-name');
    const p3 = document.getElementById('player-3-name');
    const p4 = document.getElementById('player-4-name');
    
    if (p1) p1.value = state.players && state.players[0] ? state.players[0] : 'You';
    if (p2) p2.value = state.players && state.players[1] ? state.players[1] : '';
    if (p3) p3.value = state.players && state.players[2] ? state.players[2] : '';
    if (p4) p4.value = state.players && state.players[3] ? state.players[3] : '';
    
    // Set match type radios
    const matchTypeLeaderboard = document.getElementById('match-type-leaderboard');
    const matchTypeTeam = document.getElementById('match-type-team');
    if (state.matchType === 'team') {
      if (matchTypeTeam) matchTypeTeam.checked = true;
      updatePlayerLabels('team');
    } else {
      if (matchTypeLeaderboard) matchTypeLeaderboard.checked = true;
      updatePlayerLabels('leaderboard');
    }

    // Set spectator sync ID input, role and status
    const spectateSyncIdInput = document.getElementById('spectate-sync-id');
    if (spectateSyncIdInput) {
      spectateSyncIdInput.value = spectatingId || '';
    }
    const roleViewer = document.getElementById('spectator-role-viewer');
    const roleCollaborator = document.getElementById('spectator-role-collaborator');
    if (spectatorRole === 'collaborator') {
      if (roleCollaborator) roleCollaborator.checked = true;
    } else {
      if (roleViewer) roleViewer.checked = true;
    }
    const spectateStatusContainer = document.getElementById('spectate-status-container');
    const spectateStatusText = document.getElementById('spectate-status-text');
    if (spectateStatusContainer) {
      if (isSpectating) {
        spectateStatusContainer.classList.remove('hidden');
        if (spectateStatusText) {
          spectateStatusText.textContent = spectatorRole === 'collaborator' 
            ? `👁️ Co-Scoring: ${spectatingId}` 
            : `👁️ Spectating: ${spectatingId}`;
        }
      } else {
        spectateStatusContainer.classList.add('hidden');
      }
    }

    updatePlayerAliasesDatalist();

    settingsDialog.showModal();
  });



  document.getElementById('btn-close-settings').addEventListener('click', () => {
    settingsDialog.close();
  });

  // Close dialog on clicking backdrop
  settingsDialog.addEventListener('click', (e) => {
    const rect = settingsDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      settingsDialog.close();
    }
  });

  document.getElementById('settings-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const saveButton = document.getElementById('btn-save-settings');
    const originalText = saveButton ? saveButton.textContent : 'Save Course Settings';
    if (saveButton) {
      saveButton.disabled = true;
      saveButton.textContent = 'Saving to Cloud...';
    }

    try {
      const numHolesVal = parseInt(document.querySelector('input[name="course-holes"]:checked').value);
      const apiVal = document.getElementById('gemini-api-key').value.trim();
      const openaiApiVal = document.getElementById('openai-api-key').value.trim();
      const golfApiVal = document.getElementById('golfapi-key').value.trim();
      
      // Save settings
      state.apiKey = apiVal;
      state.openaiApiKey = openaiApiVal;
      state.golfApiKey = golfApiVal;

      const modeVal = document.querySelector('input[name="game-mode"]:checked').value;
      state.mode = modeVal;
      
      if (modeVal === 'match') {
        const matchTypeVal = document.querySelector('input[name="match-type"]:checked').value;
        state.matchType = matchTypeVal;

        const team1Val = document.getElementById('team-1-name').value.trim();
        const team2Val = document.getElementById('team-2-name').value.trim();
        state.team1Name = team1Val;
        state.team2Name = team2Val;

        let p1 = state.username || 'You';
        let p2 = document.getElementById('player-2-name').value.trim();
        let p3 = document.getElementById('player-3-name').value.trim();
        let p4 = document.getElementById('player-4-name').value.trim();

        if (matchTypeVal === 'team') {
          p2 = p2 || 'Partner';
          p3 = p3 || 'Opponent 1';
          p4 = p4 || 'Opponent 2';

          if (p2.toLowerCase() === p1.toLowerCase()) p2 = 'Partner';
          if (p3.toLowerCase() === p1.toLowerCase() || p3.toLowerCase() === p2.toLowerCase()) p3 = 'Opponent 1';
          if (p4.toLowerCase() === p1.toLowerCase() || p4.toLowerCase() === p2.toLowerCase() || p4.toLowerCase() === p3.toLowerCase()) p4 = 'Opponent 2';
        }

        const playerNames = [];
        if (p2 && !['partner', 'opponent 1', 'opponent 2'].includes(p2.toLowerCase())) playerNames.push(p2);
        if (p3 && !['partner', 'opponent 1', 'opponent 2'].includes(p3.toLowerCase())) playerNames.push(p3);
        if (p4 && !['partner', 'opponent 1', 'opponent 2'].includes(p4.toLowerCase())) playerNames.push(p4);

        // Check which entered usernames are valid registered users
        const unregisteredUsernames = [];
        for (const pName of playerNames) {
          const qUser = query(collection(db, 'users'), where('username', '==', pName.toLowerCase()));
          const snapUser = await getDocs(qUser);
          if (snapUser.empty) {
            unregisteredUsernames.push(pName);
          }
        }

        if (unregisteredUsernames.length > 0) {
          const proceed = confirm(`The following players are not registered golfers in the system: ${unregisteredUsernames.join(', ')}.\n\nThey won't be able to connect or update scores on their phones in real time. Would you like to proceed anyway?`);
          if (!proceed) {
            if (saveButton) {
              saveButton.disabled = false;
              saveButton.textContent = originalText;
            }
            return;
          }
        }

        const players = [p1];
        if (p2) players.push(p2);
        if (p3) players.push(p3);
        if (p4) players.push(p4);
        
        // Ensure uniqueness and non-empty names
        const uniquePlayers = [];
        players.forEach(p => {
          if (p && !uniquePlayers.some(up => up.toLowerCase() === p.toLowerCase())) {
            uniquePlayers.push(p);
          }
        });
        state.players = uniquePlayers;
        
        // Auto-save aliases (excluding Player 1 or existing ones)
        if (!state.playerAliases) state.playerAliases = [];
        uniquePlayers.forEach(p => {
          const lowerP = p.toLowerCase();
          if (lowerP !== p1.toLowerCase() && lowerP !== 'you' && !state.playerAliases.some(alias => alias.toLowerCase() === lowerP)) {
            state.playerAliases.push(p);
          }
        });
      } else {
        state.mode = 'individual';
        state.players = ['You'];
        state.team1Name = '';
        state.team2Name = '';
      }
      
      if (state.numHoles !== numHolesVal) {
        // Re-initialize holes array, preserving existing scores where possible
        const oldHoles = [...state.holes];
        state.numHoles = numHolesVal;
        state.holes = [];
        for (let i = 1; i <= state.numHoles; i++) {
          const existing = oldHoles.find(h => h.number === i);
          if (existing) {
            state.holes.push(existing);
          } else {
            state.holes.push({
              number: i,
              par: 4,
              score: 0,
              putts: 0,
              fairway: 'NA',
              gir: 'NA',
              conceded: false,
              notes: [],
              playerScores: {},
              playerConceded: {}
            });
          }
        }
        if (state.currentHoleIndex >= state.numHoles) {
          state.currentHoleIndex = state.numHoles - 1;
        }
      }

      // Keep playerScores and playerConceded updated for active round holes
      state.holes.forEach(hole => {
        if (!hole.playerScores) hole.playerScores = {};
        if (!hole.playerConceded) hole.playerConceded = {};
        state.players.forEach(p => {
          if (hole.playerScores[p] === undefined) {
            // For Player 1 (user), default to their individual score
            if (p === 'You' || p === 'you') {
              hole.playerScores[p] = hole.score || 0;
              hole.playerConceded[p] = hole.conceded || false;
            } else {
              hole.playerScores[p] = 0;
              hole.playerConceded[p] = false;
            }
          }
        });
      });
      
      // Save customized pars
      const updatedPars = [];
      for (let i = 1; i <= state.numHoles; i++) {
        const parInput = document.getElementById(`config-par-h${i}`);
        const parVal = parInput ? (parseInt(parInput.value) || 4) : 4;
        if (state.holes[i-1]) {
          state.holes[i-1].par = parVal;
        }
        updatedPars.push(parVal);
      }

      // Also update selectedCourse pars and holesCount
      if (state.selectedCourse) {
        state.selectedCourse.holesCount = state.numHoles;
        state.selectedCourse.pars = updatedPars;

        // If it's a custom course, update it in state.customCourses
        if (state.selectedCourse.id && state.selectedCourse.id.toString().startsWith('custom_')) {
          if (!state.customCourses) state.customCourses = [];
          const idx = state.customCourses.findIndex(c => c.id === state.selectedCourse.id);
          if (idx !== -1) {
            state.customCourses[idx] = { ...state.selectedCourse };
          } else {
            state.customCourses.push({ ...state.selectedCourse });
          }
        }
      }

      saveState();
      await saveSettingsToCloud();
      updateUI();
      updateGPSWidget();
      settingsDialog.close();
    } catch (err) {
      console.error("Failed to save settings:", err);
      alert("Failed to save settings: " + err.message);
    } finally {
      if (saveButton) {
        saveButton.disabled = false;
        saveButton.textContent = originalText;
      }
    }
  });

  // Match Type radio change listeners
  const matchTypeLeaderboardRadio = document.getElementById('match-type-leaderboard');
  const matchTypeTeamRadio = document.getElementById('match-type-team');
  if (matchTypeLeaderboardRadio && matchTypeTeamRadio) {
    const handleMatchTypeChange = () => {
      const selected = document.querySelector('input[name="match-type"]:checked').value;
      updatePlayerLabels(selected);
      
      const teamNamesSetup = document.getElementById('team-names-setup');
      if (teamNamesSetup) {
        if (selected === 'team') {
          teamNamesSetup.classList.remove('hidden');
        } else {
          teamNamesSetup.classList.add('hidden');
        }
      }
    };
    matchTypeLeaderboardRadio.addEventListener('change', handleMatchTypeChange);
    matchTypeTeamRadio.addEventListener('change', handleMatchTypeChange);
  }

  // Spectator elements binding
  const btnSpectateJoin = document.getElementById('btn-spectate-join');
  const btnSpectateStop = document.getElementById('btn-spectate-stop');
  const spectateSyncIdInput = document.getElementById('spectate-sync-id');
  if (btnSpectateJoin && btnSpectateStop && spectateSyncIdInput) {
    btnSpectateJoin.addEventListener('click', () => {
      const enteredId = spectateSyncIdInput.value.trim();
      if (!enteredId) {
        alert('Please enter a valid Sync ID to spectate!');
        return;
      }
      if (enteredId === state.syncId) {
        alert('You cannot spectate your own device!');
        return;
      }
      const selectedRole = document.querySelector('input[name="spectator-role"]:checked').value;
      joinSpectatorMode(enteredId, selectedRole);
    });

    btnSpectateStop.addEventListener('click', () => {
      disconnectSpectatorMode();
    });
  }

  // Reset round
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (isSpectating) return;
    if (confirm('Are you sure you want to reset this round? All scores and notes will be deleted.')) {
      const oldSyncId = state.syncId;
      deleteActiveRoundFromCloud(oldSyncId);
      initActiveRound();
      saveState();
      updateUI();
      // Reset summary screen if open
      document.getElementById('dashboard-view').classList.remove('hidden');
      document.getElementById('report-view').classList.add('hidden');
    }
  });

  // Start New Round triggers
  const startNewRound = () => {
    const scoresLogged = state.holes.some(h => h.score > 0);
    if (scoresLogged) {
      if (!confirm("Starting a new round will clear your current unsaved active scores. Are you sure you want to proceed?")) {
        return;
      }
    }
    initActiveRound();
    
    // Initialize and start the stopwatch timer
    state.roundStartTime = Date.now();
    state.roundElapsedTime = 0;
    state.isTimerRunning = true;
    
    saveState();
    setupActiveRoundSubscription();
    initRoundTimer();
    updateUI();
    updateGPSWidget();

    // Navigate to active round scoring
    document.getElementById('report-view').classList.add('hidden');
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('tab-active-round').click();

    // Auto-open settings dialog so they can load/configure a course
    document.getElementById('btn-settings').click();
  };

  document.getElementById('btn-start-round').addEventListener('click', startNewRound);
  document.getElementById('btn-history-start-new').addEventListener('click', startNewRound);
  document.getElementById('btn-report-start-new').addEventListener('click', startNewRound);

  // Manual Input Steppers
  // Score
  document.getElementById('btn-score-minus').addEventListener('click', () => {
    const input = document.getElementById('hole-score');
    let val = parseInt(input.value) || 0;
    if (val > 0) {
      val--;
      updateHoleMetric('score', val);
    }
  });
  document.getElementById('btn-score-plus').addEventListener('click', () => {
    const input = document.getElementById('hole-score');
    let val = parseInt(input.value) || 0;
    val++;
    updateHoleMetric('score', val);
  });
  document.getElementById('hole-score').addEventListener('change', (e) => {
    let val = parseInt(e.target.value) || 0;
    if (val < 0) val = 0;
    updateHoleMetric('score', val);
  });

  // Putts
  document.getElementById('btn-putts-minus').addEventListener('click', () => {
    const input = document.getElementById('hole-putts');
    let val = parseInt(input.value) || 0;
    if (val > 0) {
      val--;
      updateHoleMetric('putts', val);
    }
  });
  document.getElementById('btn-putts-plus').addEventListener('click', () => {
    const input = document.getElementById('hole-putts');
    let val = parseInt(input.value) || 0;
    val++;
    updateHoleMetric('putts', val);
  });
  document.getElementById('hole-putts').addEventListener('change', (e) => {
    let val = parseInt(e.target.value) || 0;
    if (val < 0) val = 0;
    updateHoleMetric('putts', val);
  });

  // Par Selector
  document.getElementById('hole-par').addEventListener('change', (e) => {
    const parVal = parseInt(e.target.value) || 4;
    updateHoleMetric('par', parVal);
  });

  // Fairway Toggle Buttons
  const fairwayGroup = document.querySelector('[aria-label="Fairway Status"]');
  fairwayGroup.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      fairwayGroup.querySelectorAll('.toggle-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      updateHoleMetric('fairway', btn.dataset.value);
    });
  });

  // GIR Toggle Buttons
  const girGroup = document.querySelector('[aria-label="Green in Regulation"]');
  girGroup.querySelectorAll('.toggle-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      girGroup.querySelectorAll('.toggle-btn').forEach(b => {
        b.classList.remove('active');
        b.setAttribute('aria-checked', 'false');
      });
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
      updateHoleMetric('gir', btn.dataset.value);
    });
  });

  // Conceded Toggle Buttons
  const concededGroup = document.querySelector('[aria-label="Conceded Status"]');
  if (concededGroup) {
    concededGroup.querySelectorAll('.toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        concededGroup.querySelectorAll('.toggle-btn').forEach(b => {
          b.classList.remove('active');
          b.setAttribute('aria-checked', 'false');
        });
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
        
        const isConceded = (btn.dataset.value === 'YES');
        const activeHole = state.holes[state.currentHoleIndex];
        
        updateHoleMetric('conceded', isConceded);
        
        if (isConceded && activeHole && activeHole.score === 0) {
          updateHoleMetric('score', activeHole.par);
        }
      });
    });
  }

  // Add notes manually
  document.getElementById('btn-add-note').addEventListener('click', () => {
    addManualNote();
  });
  document.getElementById('manual-note-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      addManualNote();
    }
  });

  // Toggles for Voice
  document.getElementById('switch-continuous').addEventListener('change', (e) => {
    state.continuous = e.target.checked;
    saveState();
    if (state.isListening) {
      // Restart recognition to apply new setting
      recognition.stop();
    }
  });
  
  document.getElementById('switch-audio-feedback').addEventListener('change', (e) => {
    state.useSpeechSynthesis = e.target.checked;
    saveState();
  });

  // GPS Rangefinder simulation and refresh triggers
  document.getElementById('btn-gps-simulate').addEventListener('click', () => {
    startWalkSimulation();
  });
  document.getElementById('btn-gps-refresh').addEventListener('click', () => {
    updateGPSWidget();
  });

  // Change course button inside GPS widget
  const gpsChangeCourseBtn = document.getElementById('btn-gps-change-course');
  if (gpsChangeCourseBtn) {
    gpsChangeCourseBtn.addEventListener('click', () => {
      // Open settings dialog by clicking the settings button
      const btnSettings = document.getElementById('btn-settings');
      if (btnSettings) {
        btnSettings.click();
      }
      // Focus on the course search input and clear it to trigger recommendations
      const searchInput = document.getElementById('course-search-input');
      if (searchInput) {
        searchInput.value = '';
        searchInput.focus();
        showNearestCoursesSuggestions();
      }
    });
  }

  // Autocomplete Search input handler
  const searchInput = document.getElementById('course-search-input');
  const searchResults = document.getElementById('course-search-results');
  
  let searchTimeoutId = null;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (searchTimeoutId) clearTimeout(searchTimeoutId);

    if (query.length === 0) {
      showNearestCoursesSuggestions();
      return;
    }

    if (query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    searchTimeoutId = setTimeout(async () => {
      const courses = await searchGolfCourses(query);
      renderSearchResults(courses);
    }, 300);
  });

  // Focus and click listeners to trigger nearest courses suggestions when input is empty
  searchInput.addEventListener('focus', () => {
    if (searchInput.value.trim() === '') {
      showNearestCoursesSuggestions();
    }
  });

  searchInput.addEventListener('click', () => {
    if (searchInput.value.trim() === '') {
      showNearestCoursesSuggestions();
    }
  });

  // Hide dropdown on click outside
  document.addEventListener('click', (e) => {
    if (e.target !== searchInput && e.target !== searchResults && !searchResults.contains(e.target)) {
      searchResults.classList.add('hidden');
    }
  });

  // Tab Switching Layout triggers
  const tabActiveRound = document.getElementById('tab-active-round');
  const tabHistory = document.getElementById('tab-history');
  const tabCommunity = document.getElementById('tab-community');
  const activeRoundContent = document.getElementById('active-round-tab-content');
  const historyContent = document.getElementById('history-tab-content');
  const communityContent = document.getElementById('community-tab-content');

  tabActiveRound.addEventListener('click', () => {
    tabActiveRound.classList.add('active');
    tabActiveRound.setAttribute('aria-selected', 'true');
    tabHistory.classList.remove('active');
    tabHistory.setAttribute('aria-selected', 'false');
    if (tabCommunity) {
      tabCommunity.classList.remove('active');
      tabCommunity.setAttribute('aria-selected', 'false');
    }
    const tabContact = document.getElementById('tab-contact');
    if (tabContact) {
      tabContact.classList.remove('active');
      tabContact.setAttribute('aria-selected', 'false');
    }
    
    activeRoundContent.classList.remove('hidden');
    historyContent.classList.add('hidden');
    if (communityContent) communityContent.classList.add('hidden');
    const contactContent = document.getElementById('contact-tab-content');
    if (contactContent) contactContent.classList.add('hidden');
    
    // Reset view to show active scoring dashboard and hide performance report
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('report-view').classList.add('hidden');

    if (window.communityUnsubscribe) {
      window.communityUnsubscribe();
      window.communityUnsubscribe = null;
    }
  });

  tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active');
    tabHistory.setAttribute('aria-selected', 'true');
    tabActiveRound.classList.remove('active');
    tabActiveRound.setAttribute('aria-selected', 'false');
    if (tabCommunity) {
      tabCommunity.classList.remove('active');
      tabCommunity.setAttribute('aria-selected', 'false');
    }
    const tabContact = document.getElementById('tab-contact');
    if (tabContact) {
      tabContact.classList.remove('active');
      tabContact.setAttribute('aria-selected', 'false');
    }
    
    historyContent.classList.remove('hidden');
    activeRoundContent.classList.add('hidden');
    if (communityContent) communityContent.classList.add('hidden');
    const contactContent = document.getElementById('contact-tab-content');
    if (contactContent) contactContent.classList.add('hidden');
    // Ensure the history page contents are rendered
    renderHistoryTab();

    if (window.communityUnsubscribe) {
      window.communityUnsubscribe();
      window.communityUnsubscribe = null;
    }
  });

  if (tabCommunity) {
    tabCommunity.addEventListener('click', () => {
      tabCommunity.classList.add('active');
      tabCommunity.setAttribute('aria-selected', 'true');
      tabActiveRound.classList.remove('active');
      tabActiveRound.setAttribute('aria-selected', 'false');
      tabHistory.classList.remove('active');
      tabHistory.setAttribute('aria-selected', 'false');
      const tabContact = document.getElementById('tab-contact');
      if (tabContact) {
        tabContact.classList.remove('active');
        tabContact.setAttribute('aria-selected', 'false');
      }
      
      if (communityContent) communityContent.classList.remove('hidden');
      activeRoundContent.classList.add('hidden');
      historyContent.classList.add('hidden');
      const contactContent = document.getElementById('contact-tab-content');
      if (contactContent) contactContent.classList.add('hidden');
      
      // Toggle admin options container visibility
      const adminOptions = document.getElementById('community-admin-options');
      if (adminOptions) {
        if (state.isAdmin) {
          adminOptions.classList.remove('hidden');
          const select = document.getElementById('community-post-as-handle');
          if (select && select.options[0]) {
            select.options[0].textContent = `Your Username (@${state.username || 'user'})`;
          }
        } else {
          adminOptions.classList.add('hidden');
        }
      }
      
      // Start community real-time feed subscription
      initCommunityFeedListener();
    });
  }

  // Contact Us Tab Switching Trigger
  const tabContact = document.getElementById('tab-contact');
  const contactContent = document.getElementById('contact-tab-content');
  if (tabContact && contactContent) {
    tabContact.addEventListener('click', () => {
      tabContact.classList.add('active');
      tabContact.setAttribute('aria-selected', 'true');
      tabActiveRound.classList.remove('active');
      tabActiveRound.setAttribute('aria-selected', 'false');
      tabHistory.classList.remove('active');
      tabHistory.setAttribute('aria-selected', 'false');
      if (tabCommunity) {
        tabCommunity.classList.remove('active');
        tabCommunity.setAttribute('aria-selected', 'false');
      }

      contactContent.classList.remove('hidden');
      activeRoundContent.classList.add('hidden');
      historyContent.classList.add('hidden');
      if (communityContent) communityContent.classList.add('hidden');

      if (window.communityUnsubscribe) {
        window.communityUnsubscribe();
        window.communityUnsubscribe = null;
      }
    });
  }

  // Complete round open dialog
  const completeDialog = document.getElementById('complete-round-dialog');
  document.getElementById('btn-complete-round').addEventListener('click', () => {
    if (isSpectating) return;
    // Check if any scores are logged
    const scoresCount = state.holes.filter(h => h.score > 0).length;
    if (scoresCount === 0) {
      alert('Please log a score for at least one hole before completing your round!');
      return;
    }
    // Set current date input default
    document.getElementById('save-round-date').value = new Date().toISOString().split('T')[0];
    document.getElementById('save-course-name').value = '';
    completeDialog.showModal();
  });

  document.getElementById('btn-close-complete').addEventListener('click', () => {
    completeDialog.close();
  });

  // Close complete dialog on clicking backdrop
  completeDialog.addEventListener('click', (e) => {
    const rect = completeDialog.getBoundingClientRect();
    const isInDialog = (rect.top <= e.clientY && e.clientY <= rect.top + rect.height &&
      rect.left <= e.clientX && e.clientX <= rect.left + rect.width);
    if (!isInDialog) {
      completeDialog.close();
    }
  });

  // Complete round form save round
  document.getElementById('complete-round-form').addEventListener('submit', (e) => {
    e.preventDefault();
    if (isSpectating) return;
    const courseName = document.getElementById('save-course-name').value.trim();
    const dateVal = document.getElementById('save-round-date').value;
    
    // Retrieve rating/slope from active selectedCourse, or default to standard values
    const course = state.selectedCourse || MOCK_COURSES[0];
    const ratingVal = course ? (parseFloat(course.rating) || 72.0) : 72.0;
    const slopeVal = course ? (parseInt(course.slope) || 113) : 113;

    // Package the completed round
    const totalScoreVal = calculateTotalScore();
    const totalParVal = calculateTotalPar();
    const totalPuttsVal = calculateTotalPutts();

    // Calculate averages and percentages
    const holesWithPutts = state.holes.filter(h => h.score > 0 && h.putts > 0).length;
    const avgPuttsVal = holesWithPutts > 0 ? parseFloat((totalPuttsVal / holesWithPutts).toFixed(1)) : 0;
    
    let threePutts = 0;
    let onePutts = 0;
    state.holes.forEach(h => {
      if (h.score > 0 && h.putts > 0) {
        if (h.putts >= 3) threePutts++;
        if (h.putts === 1) onePutts++;
      }
    });

    const fStats = calculateFairwayStats();
    const girStats = calculateGIRStats();

    // Calculate elapsed time
    let elapsedSeconds = state.roundElapsedTime || 0;
    if (state.isTimerRunning && state.roundStartTime) {
      elapsedSeconds += Math.floor((Date.now() - state.roundStartTime) / 1000);
    }
    const hours = Math.floor(elapsedSeconds / 3600);
    const minutes = Math.floor((elapsedSeconds % 3600) / 60);
    const seconds = elapsedSeconds % 60;
    const pad = (num) => String(num).padStart(2, '0');
    const durationStr = hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;

    const matchPlayStandingsVal = state.mode === 'match' ? calculateMatchPlayStandings() : null;

    const archivedRound = {
      id: Date.now(),
      courseName: courseName,
      date: dateVal,
      rating: ratingVal,
      slope: slopeVal,
      numHoles: state.numHoles,
      totalScore: totalScoreVal,
      totalPar: totalParVal,
      totalPutts: totalPuttsVal,
      avgPutts: avgPuttsVal,
      threePutts: threePutts,
      onePutts: onePutts,
      fairwayPercent: fStats.totalHolesWithFairway > 0 ? fStats.hitPercent : 0,
      girPercent: girStats.totalHolesWithGIR > 0 ? girStats.girPercent : 0,
      duration: durationStr,
      durationSeconds: elapsedSeconds,
      mode: state.mode || 'individual',
      players: state.players || ['You'],
      team1Name: state.team1Name || '',
      team2Name: state.team2Name || '',
      matchPlayStandings: matchPlayStandingsVal,
      holes: JSON.parse(JSON.stringify(state.holes)) // deep copy
    };

    if (!state.history) state.history = [];
    state.history.push(archivedRound);
    saveRoundToCloud(archivedRound);

    // Track review context: we just finished the round
    state.reviewContext = 'active';

    // Run stats calculations & render details in report view
    calculateAndShowReport(archivedRound);

    // Reset current active round scores
    const oldSyncId = state.syncId;
    deleteActiveRoundFromCloud(oldSyncId);
    initActiveRound();
    saveState();
    updateUI();

    completeDialog.close();

    // Navigate to report view
    document.getElementById('dashboard-view').classList.add('hidden');
    document.getElementById('report-view').classList.remove('hidden');
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  document.getElementById('btn-back-to-round').addEventListener('click', () => {
    document.getElementById('report-view').classList.add('hidden');
    if (state.reviewContext === 'history') {
      // Go to history tab
      document.getElementById('tab-history').click();
    } else {
      // Go to active round scoring
      document.getElementById('dashboard-view').classList.remove('hidden');
      document.getElementById('tab-active-round').click();
    }
    window.scrollTo({ top: 0, behavior: 'smooth' });
  });

  // Sync controls in DOM with state loaded
  document.getElementById('switch-continuous').checked = state.continuous;
  document.getElementById('switch-audio-feedback').checked = state.useSpeechSynthesis;

  // Round Timer Pause/Resume control
  const btnTimerToggle = document.getElementById('btn-timer-toggle');
  if (btnTimerToggle) {
    btnTimerToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRoundTimer();
    });
  }

  const btnManualTimerToggle = document.getElementById('btn-manual-timer-toggle');
  if (btnManualTimerToggle) {
    btnManualTimerToggle.addEventListener('click', (e) => {
      e.stopPropagation();
      toggleRoundTimer();
    });
  }

  // Caddie Assistant Initialization
  initCaddieAssistant();
}

// Caddie AI Assistant Controller
let assistantMicIsRecording = false;
let assistantMediaRecorder = null;
let assistantAudioChunks = [];
let assistantSpeechTimeout = null;
let assistantRecognition = null;

function updateVoiceColumnLayout() {
  const voiceColumn = document.querySelector('.voice-column');
  const voiceCard = document.getElementById('voice-card');
  const assistantCard = document.getElementById('assistant-card');
  if (voiceColumn && voiceCard && assistantCard) {
    const bothCollapsed = voiceCard.classList.contains('collapsed') && assistantCard.classList.contains('collapsed');
    if (bothCollapsed) {
      voiceColumn.classList.add('both-collapsed');
    } else {
      voiceColumn.classList.remove('both-collapsed');
    }
  }
}

function initCaddieAssistant() {
  const askBtn = document.getElementById('btn-assistant-ask');
  const voiceBtn = document.getElementById('btn-assistant-voice');
  const inputEl = document.getElementById('assistant-input');
  const assistantCard = document.getElementById('assistant-card');
  const assistantHeader = document.getElementById('assistant-header');
  
  if (!askBtn || !voiceBtn || !inputEl) return;
  
  askBtn.addEventListener('click', () => {
    askCaddieAssistant(inputEl.value);
  });
  
  voiceBtn.addEventListener('click', () => {
    toggleAssistantVoice();
  });
  
  inputEl.addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      askCaddieAssistant(inputEl.value);
    }
  });

  document.getElementById('btn-assistant-speak').addEventListener('click', () => {
    const answer = document.getElementById('assistant-response-text').textContent;
    if (answer && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  });

  if (assistantHeader && assistantCard) {
    const isCollapsed = localStorage.getItem('assistantCardCollapsed') === 'true';
    if (isCollapsed) {
      assistantCard.classList.add('collapsed');
    }
    updateVoiceColumnLayout();

    assistantCard.addEventListener('click', (e) => {
      const isCardCollapsed = assistantCard.classList.contains('collapsed');
      if (isCardCollapsed) {
        // Expand if clicking anywhere except actual form inputs/buttons
        if (!e.target.closest('button') && !e.target.closest('input')) {
          assistantCard.classList.remove('collapsed');
          localStorage.setItem('assistantCardCollapsed', 'false');
          updateVoiceColumnLayout();
        }
      } else {
        // Collapse if clicking the header or collapse chevron
        if (e.target.closest('#assistant-header') || e.target.closest('#btn-assistant-collapse')) {
          if (!e.target.closest('button') || e.target.closest('#btn-assistant-collapse')) {
            assistantCard.classList.add('collapsed');
            localStorage.setItem('assistantCardCollapsed', 'true');
            updateVoiceColumnLayout();
          }
        }
      }
    });
  }
}

async function askCaddieAssistant(question) {
  const inputVal = question.trim();
  if (!inputVal) return;
  
  const container = document.getElementById('assistant-response-container');
  const responseText = document.getElementById('assistant-response-text');
  const statusLbl = document.getElementById('assistant-status');
  
  container.classList.add('hidden');
  statusLbl.classList.remove('hidden');
  statusLbl.textContent = 'Thinking...';
  
  let answer = "";
  try {
    if (state.apiKey) {
      answer = await queryGeminiAssistant(inputVal, state.apiKey);
    } else if (state.openaiApiKey) {
      answer = await queryOpenAIAssistant(inputVal, state.openaiApiKey);
    } else {
      const lower = inputVal.toLowerCase();
      if (lower.includes("out of bounds") || lower.includes("ob") || lower.includes("stake")) {
        if (lower.includes("red")) {
          answer = "Red stakes indicate a lateral penalty area. You can play the ball as it lies without penalty, or take relief with a 1-stroke penalty: 1) play from the previous spot, 2) drop back-on-the-line, or 3) take lateral relief within 2 club-lengths of where it crossed.";
        } else if (lower.includes("yellow")) {
          answer = "Yellow stakes indicate a regular penalty area. Relief options (1-stroke penalty): 1) play from the previous spot (stroke-and-distance), or 2) take back-on-the-line relief directly behind where the ball crossed.";
        } else if (lower.includes("white") || lower.includes("bounds")) {
          answer = "White stakes define Out of Bounds (OB). You cannot play the ball. You must take a 1-stroke penalty and play another ball from the previous spot (stroke-and-distance relief).";
        } else {
          answer = "Stake rules: Red defines lateral penalty areas (3 relief options), Yellow defines regular penalty areas (2 relief options), and White defines Out of Bounds (stroke-and-distance relief only). All carry a 1-stroke penalty for relief.";
        }
      } else if (lower.includes("uphill") || lower.includes("downhill") || lower.includes("slope") || lower.includes("lie")) {
        if (lower.includes("uphill")) {
          answer = "Uphill lie: Tilt your shoulders parallel to the slope (lean back), play the ball slightly forward, and swing along the slope. The ball will fly higher and shorter—take one extra club.";
        } else if (lower.includes("downhill")) {
          answer = "Downhill lie: Tilt your shoulders parallel to the slope (lean forward), play the ball slightly back in your stance, and swing down the slope. The ball will fly lower and roll more—consider taking less club.";
        } else if (lower.includes("sidehill") || lower.includes("above") || lower.includes("below")) {
          if (lower.includes("above")) {
            answer = "Ball above feet: Grip down on the club, stand slightly taller, and expect the ball to curve to the left. Aim slightly right to compensate.";
          } else {
            answer = "Ball below feet: Bend more at your knees, maintain your spine angle throughout the swing, and expect the ball to curve to the right. Aim slightly left to compensate.";
          }
        } else {
          answer = "Slope lies: Match your shoulders to the angle of the slope, play the ball forward for uphill (flies higher) and back for downhill (flies lower), and swing smoothly along the ground's contour.";
        }
      } else if (lower.includes("bunker") || lower.includes("sand")) {
        answer = "Bunker play: Open your clubface, stand wide, and aim to hit the sand 1-2 inches behind the ball. Swing aggressively through the sand—the sand, not the clubface, should push the ball out.";
      } else if (lower.includes("rough")) {
        answer = "Deep rough: Grip the club tighter to prevent the grass from twisting the face, play the ball slightly back, and make a steeper vertical backswing to strike the ball first.";
      } else {
        answer = "To ask custom rules, rules officials, or shot execution questions, please configure a Gemini API Key in settings! Try asking about 'red stakes' or 'uphill lie' to test local responses.";
      }
    }
    
    responseText.textContent = answer;
    container.classList.remove('hidden');
    
    if (state.useSpeechSynthesis && window.speechSynthesis) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(answer);
      utterance.rate = 1.05;
      window.speechSynthesis.speak(utterance);
    }
  } catch (err) {
    console.error("Assistant query failed:", err);
    responseText.innerHTML = `<span style="color:var(--danger)">Caddie AI error: ${escapeHTML(err.message)}. Please check your internet connection or Gemini Key in Settings.</span>`;
    container.classList.remove('hidden');
  } finally {
    statusLbl.classList.add('hidden');
  }
}

async function queryGeminiAssistant(question, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const promptText = `
You are an expert PGA rules official and master golf caddie. Answer the golfer's question about golf rules, penalty area relief, shot execution techniques, club selection, or etiquette.
Provide a concise, direct, and practical answer (max 3 sentences) suitable for reading or hearing on a mobile device while playing on a golf course.
If the golfer is asking about a rule (e.g. "ball out of bounds red stake"), explain the exact USGA/R&A rule and relief options.
If the golfer is asking for shot advice (e.g. "uphill lie 60 yards"), provide key setup and swing adjustments.

Golfer's Question: "${question}"

Provide your response in plain text without any markdown or formatting.
`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: promptText }]
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error('Gemini API request failed');
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text.trim();
}

async function queryOpenAIAssistant(question, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  const promptText = `
You are an expert PGA rules official and master golf caddie. Answer the golfer's question about golf rules, penalty area relief, shot execution techniques, club selection, or etiquette.
Provide a concise, direct, and practical answer (max 3 sentences) suitable for reading or hearing on a mobile device while playing on a golf course.
If the golfer is asking about a rule (e.g. "ball out of bounds red stake"), explain the exact USGA/R&A rule and relief options.
If the golfer is asking for shot advice (e.g. "uphill lie 60 yards"), provide key setup and swing adjustments.

Golfer's Question: "${question}"

Provide your response in plain text without any markdown or formatting.
`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: promptText }
      ]
    })
  });

  if (!response.ok) {
    throw new Error('OpenAI API request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

async function toggleAssistantVoice() {
  const voiceBtn = document.getElementById('btn-assistant-voice');
  const statusLbl = document.getElementById('assistant-status');
  
  if (assistantMicIsRecording) {
    stopAssistantVoice();
    return;
  }
  
  voiceBtn.classList.add('recording');
  statusLbl.textContent = "Listening... Speak your question";
  statusLbl.classList.remove('hidden');
  
  if (state.openaiApiKey) {
    assistantAudioChunks = [];
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      let options = { mimeType: 'audio/webm' };
      if (!MediaRecorder.isTypeSupported('audio/webm')) {
        options = { mimeType: 'audio/mp4' };
      }
      assistantMediaRecorder = new MediaRecorder(stream, options);
      
      assistantMediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) assistantAudioChunks.push(e.data);
      };
      
      assistantMediaRecorder.onstop = async () => {
        stream.getTracks().forEach(t => t.stop());
        const mimeType = assistantMediaRecorder.mimeType;
        const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
        const audioBlob = new Blob(assistantAudioChunks, { type: mimeType });
        
        statusLbl.textContent = "Transcribing voice...";
        try {
          const transcript = await sendAudioToWhisper(audioBlob, extension);
          if (transcript) {
            document.getElementById('assistant-input').value = transcript;
            askCaddieAssistant(transcript);
          } else {
            statusLbl.textContent = "No speech detected.";
            setTimeout(() => statusLbl.classList.add('hidden'), 2000);
          }
        } catch (err) {
          console.error(err);
          statusLbl.textContent = "Whisper transcription failed.";
          setTimeout(() => statusLbl.classList.add('hidden'), 2000);
        } finally {
          assistantMicIsRecording = false;
          voiceBtn.classList.remove('recording');
        }
      };
      
      assistantMediaRecorder.start();
      assistantMicIsRecording = true;
      
      if (assistantSpeechTimeout) clearTimeout(assistantSpeechTimeout);
      assistantSpeechTimeout = setTimeout(() => {
        if (assistantMicIsRecording && assistantMediaRecorder && assistantMediaRecorder.state === 'recording') {
          assistantMediaRecorder.stop();
        }
      }, 8000);
      
    } catch (err) {
      console.error(err);
      voiceBtn.classList.remove('recording');
      statusLbl.textContent = "Microphone error.";
      setTimeout(() => statusLbl.classList.add('hidden'), 2000);
    }
  } else {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      statusLbl.textContent = "Browser speech recognition unsupported.";
      voiceBtn.classList.remove('recording');
      return;
    }
    
    assistantRecognition = new SpeechRecognition();
    assistantRecognition.lang = 'en-US';
    assistantRecognition.continuous = false;
    assistantRecognition.interimResults = false;
    
    assistantRecognition.onstart = () => {
      assistantMicIsRecording = true;
    };
    
    assistantRecognition.onresult = (e) => {
      const transcript = e.results[0][0].transcript;
      document.getElementById('assistant-input').value = transcript;
      askCaddieAssistant(transcript);
    };
    
    assistantRecognition.onerror = (e) => {
      console.error(e);
      statusLbl.textContent = "Error: " + e.error;
      setTimeout(() => statusLbl.classList.add('hidden'), 2000);
    };
    
    assistantRecognition.onend = () => {
      assistantMicIsRecording = false;
      voiceBtn.classList.remove('recording');
      if (statusLbl.textContent.startsWith("Listening...")) {
        statusLbl.classList.add('hidden');
      }
      assistantRecognition = null;
    };
    
    assistantRecognition.start();
    
    if (assistantSpeechTimeout) clearTimeout(assistantSpeechTimeout);
    assistantSpeechTimeout = setTimeout(() => {
      if (assistantMicIsRecording && assistantRecognition) {
        assistantRecognition.stop();
      }
    }, 8000);
  }
}

function stopAssistantVoice() {
  const voiceBtn = document.getElementById('btn-assistant-voice');
  const statusLbl = document.getElementById('assistant-status');
  if (assistantMediaRecorder && assistantMediaRecorder.state === 'recording') {
    assistantMediaRecorder.stop();
  }
  if (assistantRecognition) {
    try {
      assistantRecognition.stop();
    } catch (e) {
      console.error("Error stopping assistant speech recognition:", e);
    }
    assistantRecognition = null;
  }
  assistantMicIsRecording = false;
  voiceBtn.classList.remove('recording');
  statusLbl.textContent = "Listening stopped.";
  setTimeout(() => {
    if (!assistantMicIsRecording) {
      statusLbl.classList.add('hidden');
    }
  }, 2000);
}

// Generate pars inputs inside Course Settings dialog
function renderParsConfig() {
  const container = document.getElementById('pars-config-grid');
  container.innerHTML = '';
  for (let i = 1; i <= state.numHoles; i++) {
    const holeData = state.holes[i-1] || { par: 4 };
    const div = document.createElement('div');
    div.className = 'par-config-item';
    div.innerHTML = `
      <span>Hole ${i}</span>
      <input type="number" id="config-par-h${i}" min="3" max="5" value="${holeData.par}" aria-label="Hole ${i} Par">
    `;
    container.appendChild(div);
  }
}

// Sync current Active Hole details to dashboard forms
function updateUI() {
  const activeHole = state.holes[state.currentHoleIndex];
  if (!activeHole) return;

  // Header mini stats bar
  document.getElementById('overview-hole').textContent = activeHole.number;
  
  // Calculate relative score for mini stats
  const totalScoreVal = calculateTotalScore();
  const totalParVal = calculateTotalPar();
  const diff = totalScoreVal - totalParVal;
  
  if (totalScoreVal === 0) {
    document.getElementById('overview-score').textContent = '-';
  } else if (diff === 0) {
    document.getElementById('overview-score').textContent = 'E';
  } else {
    document.getElementById('overview-score').textContent = diff > 0 ? `+${diff}` : diff;
  }

  document.getElementById('overview-putts').textContent = calculateTotalPutts();
  
  // Fairways hits % for mini header
  const fStats = calculateFairwayStats();
  document.getElementById('overview-fairways').textContent = fStats.totalHolesWithFairway > 0 ? `${fStats.hitPercent}%` : '-';
  
  // GIR % for mini header
  const girStats = calculateGIRStats();
  document.getElementById('overview-gir').textContent = girStats.totalHolesWithGIR > 0 ? `${girStats.girPercent}%` : '-';

  // Active Hole detail panel
  document.getElementById('active-hole-title').textContent = `HOLE ${activeHole.number}`;
  document.getElementById('hole-par').value = activeHole.par.toString();
  document.getElementById('hole-score').value = activeHole.score;
  document.getElementById('hole-putts').value = activeHole.putts;

  // Fairway toggle button active states
  const fairwayGroup = document.querySelector('[aria-label="Fairway Status"]');
  fairwayGroup.querySelectorAll('.toggle-btn').forEach(btn => {
    if (btn.dataset.value === activeHole.fairway) {
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-checked', 'false');
    }
  });

  // GIR toggle button active states
  const girGroup = document.querySelector('[aria-label="Green in Regulation"]');
  girGroup.querySelectorAll('.toggle-btn').forEach(btn => {
    if (btn.dataset.value === activeHole.gir) {
      btn.classList.add('active');
      btn.setAttribute('aria-checked', 'true');
    } else {
      btn.classList.remove('active');
      btn.setAttribute('aria-checked', 'false');
    }
  });

  // Conceded toggle button active states
  const concededGroup = document.querySelector('[aria-label="Conceded Status"]');
  if (concededGroup) {
    concededGroup.querySelectorAll('.toggle-btn').forEach(btn => {
      const isConcededVal = (btn.dataset.value === 'YES');
      if (isConcededVal === !!activeHole.conceded) {
        btn.classList.add('active');
        btn.setAttribute('aria-checked', 'true');
      } else {
        btn.classList.remove('active');
        btn.setAttribute('aria-checked', 'false');
      }
    });
  }

  // Active hole notes bubbles list
  renderNotesList(activeHole);

  // Scorecard table
  renderScorecard();

  // Standings Widget
  updateMatchPlayStandings();

  if (isSpectating) {
    setControlsReadOnly(true);
  }
}

function calculateMatchPlayStandings() {
  const players = state.players || ['You'];
  const numPlayers = players.length;
  
  if (state.matchType === 'team' && numPlayers === 4) {
    const p1 = players[0]; // You
    const p2 = players[1]; // Partner
    const p3 = players[2]; // Opponent 1
    const p4 = players[3]; // Opponent 2

    let teamAWon = 0;
    let teamBWon = 0;
    let lastPlayedHole = 0;

    state.holes.forEach(hole => {
      const s1 = (hole.playerScores && hole.playerScores[p1]) || 0;
      const c1 = (hole.playerConceded && hole.playerConceded[p1]) || false;
      const s2 = (hole.playerScores && hole.playerScores[p2]) || 0;
      const c2 = (hole.playerConceded && hole.playerConceded[p2]) || false;
      const s3 = (hole.playerScores && hole.playerScores[p3]) || 0;
      const c3 = (hole.playerConceded && hole.playerConceded[p3]) || false;
      const s4 = (hole.playerScores && hole.playerScores[p4]) || 0;
      const c4 = (hole.playerConceded && hole.playerConceded[p4]) || false;

      const teamA = getTeamBestBall(s1, c1, s2, c2);
      const teamB = getTeamBestBall(s3, c3, s4, c4);

      if (teamA.played || teamB.played) {
        lastPlayedHole = Math.max(lastPlayedHole, hole.number);
      }

      if (teamA.played && teamB.played) {
        if (teamA.conceded && teamB.conceded) {
          // halved
        } else if (teamA.conceded) {
          teamBWon++;
        } else if (teamB.conceded) {
          teamAWon++;
        } else {
          if (teamA.score < teamB.score) teamAWon++;
          if (teamB.score < teamA.score) teamBWon++;
        }
      }
    });

    const holesRemaining = state.numHoles - lastPlayedHole;
    const diff = teamAWon - teamBWon;
    let statusText = 'All Square';
    let matchFinished = false;
    let winner = null;
    let margin = '';
    
    const lead = Math.abs(diff);
    
    const t1Name = state.team1Name || 'Team A';
    const t2Name = state.team2Name || 'Team B';
    
    if (lead > holesRemaining) {
      matchFinished = true;
      winner = diff > 0 ? t1Name : t2Name;
      margin = `${lead} & ${holesRemaining}`;
      statusText = `${winner} won ${margin}`;
    } else if (lead === holesRemaining && holesRemaining > 0) {
      statusText = diff > 0 ? `${t1Name} Dormie ${lead}` : `${t2Name} Dormie ${lead}`;
    } else if (diff > 0) {
      statusText = `${t1Name} ${lead} Up`;
    } else if (diff < 0) {
      statusText = `${t2Name} ${lead} Up`;
    }

    return {
      mode: 'team',
      p1, p2, p3, p4,
      teamAWon, teamBWon,
      diff,
      lead,
      statusText,
      matchFinished,
      winner,
      margin,
      holesRemaining
    };
  }

  // Tally of holes won for each player
  const holesWon = {};
  players.forEach(p => {
    holesWon[p] = 0;
  });
  
  let lastPlayedHole = 0;
  
  state.holes.forEach(hole => {
    // Check if anyone played the hole
    const played = {};
    let anyPlayed = false;
    
    players.forEach(p => {
      const score = (hole.playerScores && hole.playerScores[p]) || 0;
      const conceded = (hole.playerConceded && hole.playerConceded[p]) || false;
      if (score > 0 || conceded) {
        played[p] = { score, conceded };
        anyPlayed = true;
      }
    });
    
    if (anyPlayed) {
      lastPlayedHole = Math.max(lastPlayedHole, hole.number);
      
      // Determine the winner of this hole
      let bestScore = Infinity;
      let winners = [];
      
      players.forEach(p => {
        if (played[p]) {
          if (played[p].conceded) {
            // Conceded means lost or didn't finish
          } else {
            const s = played[p].score;
            if (s < bestScore) {
              bestScore = s;
              winners = [p];
            } else if (s === bestScore) {
              winners.push(p);
            }
          }
        }
      });
      
      // If only one player has the lowest score, they win the hole
      if (winners.length === 1) {
        holesWon[winners[0]]++;
      }
    }
  });
  
  const holesRemaining = state.numHoles - lastPlayedHole;
  
  if (numPlayers === 2) {
    const p1 = players[0]; // You
    const p2 = players[1]; // Opponent
    
    // Traditional Match Play calculates holes won relative to each other
    // Let's count holes won by p1 and p2 again specifically using match play rules (tied holes are halved)
    let p1Won = 0;
    let p2Won = 0;
    state.holes.forEach(hole => {
      const s1 = (hole.playerScores && hole.playerScores[p1]) || 0;
      const c1 = (hole.playerConceded && hole.playerConceded[p1]) || false;
      const s2 = (hole.playerScores && hole.playerScores[p2]) || 0;
      const c2 = (hole.playerConceded && hole.playerConceded[p2]) || false;
      
      const p1Played = s1 > 0 || c1;
      const p2Played = s2 > 0 || c2;
      
      if (p1Played && p2Played) {
        if (c1 && c2) {
          // both conceded, halved
        } else if (c1) {
          p2Won++;
        } else if (c2) {
          p1Won++;
        } else {
          if (s1 < s2) p1Won++;
          if (s2 < s1) p2Won++;
        }
      }
    });

    const diff = p1Won - p2Won;
    let statusText = 'All Square';
    let matchFinished = false;
    let winner = null;
    let margin = '';
    
    const lead = Math.abs(diff);
    
    if (lead > holesRemaining) {
      matchFinished = true;
      winner = diff > 0 ? p1 : p2;
      margin = `${lead} & ${holesRemaining}`;
      statusText = `${winner} won ${margin}`;
    } else if (lead === holesRemaining && holesRemaining > 0) {
      statusText = diff > 0 ? `${p1} Dormie ${lead}` : `${p2} Dormie ${lead}`;
    } else if (diff > 0) {
      statusText = `${p1} ${lead} Up`;
    } else if (diff < 0) {
      statusText = `${p2} ${lead} Up`;
    }
    
    return {
      mode: '2player',
      p1, p2,
      p1Won, p2Won,
      diff,
      lead,
      statusText,
      matchFinished,
      winner,
      margin,
      holesRemaining
    };
  }
  
  // 3 or 4 players
  const leaderboard = players.map(p => ({
    name: p,
    won: holesWon[p] || 0
  })).sort((a, b) => b.won - a.won);
  
  return {
    mode: 'multiplayer',
    leaderboard,
    holesRemaining,
    statusText: `${leaderboard[0].name} leads (${leaderboard[0].won} holes)`
  };
}

function updateMatchPlayStandings() {
  const card = document.getElementById('match-play-card');
  if (!card) return;
  
  if (state.mode !== 'match') {
    card.classList.add('hidden');
    return;
  }
  
  card.classList.remove('hidden');
  
  const standings = calculateMatchPlayStandings();
  const statusPill = document.getElementById('match-play-status-pill');
  if (statusPill) {
    statusPill.textContent = standings.statusText;
  }
  
  const body = document.getElementById('match-play-standings-body');
  if (!body) return;
  
  if (standings.mode === 'team') {
    body.innerHTML = `
      <table class="standings-table">
        <thead>
          <tr>
            <th>Team</th>
            <th>Players</th>
            <th style="text-align: right;">Holes Won</th>
            <th style="text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="standings-player-name" style="font-weight: bold; color: var(--emerald-glow);">Team A</td>
            <td style="font-size: 0.8rem; color: var(--color-secondary);">${standings.p1} & ${standings.p2}</td>
            <td style="text-align: right;">${standings.teamAWon}</td>
            <td style="text-align: right;" class="${standings.diff > 0 ? 'standings-status-up' : standings.diff < 0 ? 'standings-status-down' : 'standings-status-square'}">
              ${standings.diff > 0 ? `${standings.diff} Up` : standings.diff < 0 ? `${Math.abs(standings.diff)} Down` : 'AS'}
            </td>
          </tr>
          <tr>
            <td class="standings-player-name" style="font-weight: bold; color: #f43f5e;">Team B</td>
            <td style="font-size: 0.8rem; color: var(--color-secondary);">${standings.p3} & ${standings.p4}</td>
            <td style="text-align: right;">${standings.teamBWon}</td>
            <td style="text-align: right;" class="${standings.diff < 0 ? 'standings-status-up' : standings.diff > 0 ? 'standings-status-down' : 'standings-status-square'}">
              ${standings.diff < 0 ? `${Math.abs(standings.diff)} Up` : standings.diff > 0 ? `${standings.diff} Down` : 'AS'}
            </td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 0.8rem; color: var(--color-secondary); margin-top: 0.5rem; text-align: center;">
        ${standings.holesRemaining} holes remaining
      </p>
    `;
    return;
  }

  if (standings.mode === '2player') {
    body.innerHTML = `
      <table class="standings-table">
        <thead>
          <tr>
            <th>Player</th>
            <th style="text-align: right;">Holes Won</th>
            <th style="text-align: right;">Status</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td class="standings-player-name">${standings.p1} (You)</td>
            <td style="text-align: right;">${standings.p1Won}</td>
            <td style="text-align: right;" class="${standings.diff > 0 ? 'standings-status-up' : standings.diff < 0 ? 'standings-status-down' : 'standings-status-square'}">
              ${standings.diff > 0 ? `${standings.diff} Up` : standings.diff < 0 ? `${Math.abs(standings.diff)} Down` : 'AS'}
            </td>
          </tr>
          <tr>
            <td class="standings-player-name">${standings.p2}</td>
            <td style="text-align: right;">${standings.p2Won}</td>
            <td style="text-align: right;" class="${standings.diff < 0 ? 'standings-status-up' : standings.diff > 0 ? 'standings-status-down' : 'standings-status-square'}">
              ${standings.diff < 0 ? `${Math.abs(standings.diff)} Up` : standings.diff > 0 ? `${standings.diff} Down` : 'AS'}
            </td>
          </tr>
        </tbody>
      </table>
      <p style="font-size: 0.8rem; color: var(--color-secondary); margin-top: 0.5rem; text-align: center;">
        ${standings.holesRemaining} holes remaining
      </p>
    `;
  } else {
    let tbodyRows = '';
    standings.leaderboard.forEach((item, index) => {
      tbodyRows += `
        <tr>
          <td>${index + 1}</td>
          <td class="standings-player-name">${item.name} ${item.name === 'You' ? '(You)' : ''}</td>
          <td style="text-align: right; font-weight: bold; color: var(--emerald-glow);">${item.won}</td>
        </tr>
      `;
    });
    
    body.innerHTML = `
      <table class="standings-table">
        <thead>
          <tr>
            <th style="width: 40px;">Pos</th>
            <th>Player</th>
            <th style="text-align: right;">Holes Won</th>
          </tr>
        </thead>
        <tbody>
          ${tbodyRows}
        </tbody>
      </table>
      <p style="font-size: 0.8rem; color: var(--color-secondary); margin-top: 0.5rem; text-align: center;">
        ${standings.holesRemaining} holes remaining
      </p>
    `;
  }
}

function updatePlayerAliasesDatalist() {
  const datalist = document.getElementById('player-aliases-list');
  if (datalist) {
    datalist.innerHTML = '';
    const aliases = state.playerAliases || [];
    aliases.forEach(alias => {
      const option = document.createElement('option');
      option.value = alias;
      datalist.appendChild(option);
    });
  }
}

function updatePlayerLabels(matchType) {
  const p1Lbl = document.getElementById('player-1-label');
  const p2Lbl = document.getElementById('player-2-label');
  const p3Lbl = document.getElementById('player-3-label');
  const p4Lbl = document.getElementById('player-4-label');
  
  if (matchType === 'team') {
    if (p1Lbl) p1Lbl.textContent = 'Team A (You):';
    if (p2Lbl) p2Lbl.textContent = 'Team A (Partner):';
    if (p3Lbl) p3Lbl.textContent = 'Team B (Opp 1):';
    if (p4Lbl) p4Lbl.textContent = 'Team B (Opp 2):';
  } else {
    if (p1Lbl) p1Lbl.textContent = 'Player 1 (You):';
    if (p2Lbl) p2Lbl.textContent = 'Player 2:';
    if (p3Lbl) p3Lbl.textContent = 'Player 3:';
    if (p4Lbl) p4Lbl.textContent = 'Player 4:';
  }
}

function setControlsReadOnly(readOnly) {
  const isViewer = isSpectating && spectatorRole === 'viewer';
  const isCollab = isSpectating && spectatorRole === 'collaborator';
  
  // 1. Scoring inputs & buttons (disabled for viewer, enabled for collaborator and normal host)
  const scoringElements = [
    'hole-par', 'hole-score', 'hole-putts', 'manual-note-input', 
    'btn-add-note', 'btn-score-minus', 'btn-score-plus', 
    'btn-putts-minus', 'btn-putts-plus'
  ];

  scoringElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = isViewer;
      if (el.tagName === 'BUTTON') {
        if (isViewer) {
          el.classList.add('disabled');
        } else {
          el.classList.remove('disabled');
        }
      }
    }
  });

  const toggleBtns = document.querySelectorAll('.hole-inputs-grid .toggle-btn');
  toggleBtns.forEach(btn => {
    btn.disabled = isViewer;
    if (isViewer) {
      btn.classList.add('disabled');
    } else {
      btn.classList.remove('disabled');
    }
  });

  // 2. Settings, course search, players configuration (disabled for spectator/collaborators)
  const settingsElements = [
    'btn-complete-round', 'btn-reset',
    'course-search-input', 'holes-9', 'holes-18',
    'mode-individual', 'mode-match', 'match-type-leaderboard', 'match-type-team',
    'player-2-name', 'player-3-name', 'player-4-name', 'btn-save-settings'
  ];

  settingsElements.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.disabled = isSpectating;
      if (el.tagName === 'BUTTON') {
        if (isSpectating) {
          el.classList.add('disabled');
        } else {
          el.classList.remove('disabled');
        }
      }
    }
  });

  // 3. Voice Toggle Button
  const btnVoice = document.getElementById('btn-voice-toggle');
  if (btnVoice) {
    btnVoice.disabled = isViewer;
    if (isViewer) {
      btnVoice.classList.add('disabled');
      if (state.isListening) {
        if (recognition) {
          try { recognition.stop(); } catch(e) {}
        }
        state.isListening = false;
        stopListeningUI();
      }
    } else {
      btnVoice.classList.remove('disabled');
    }
  }

  // 4. Update Header Spectator Badge
  const spectatorBadge = document.getElementById('spectator-mode-badge');
  const spectatorText = document.getElementById('spectator-badge-text');
  if (spectatorBadge) {
    if (isSpectating) {
      spectatorBadge.classList.remove('hidden');
      if (spectatorText) {
        if (isCollab) {
          spectatorText.textContent = `Co-Scoring: ${spectatingId}`;
          spectatorBadge.style.background = 'rgba(245, 158, 11, 0.15)';
          spectatorBadge.style.color = '#f59e0b';
        } else {
          spectatorText.textContent = `Spectating Live: ${spectatingId}`;
          spectatorBadge.style.background = 'rgba(59, 130, 246, 0.15)';
          spectatorBadge.style.color = '#60a5fa';
        }
      }
    } else {
      spectatorBadge.classList.add('hidden');
    }
  }
}

function joinSpectatorMode(targetSyncId, role = 'viewer') {
  if (spectatorUnsubscribe) {
    spectatorUnsubscribe();
    spectatorUnsubscribe = null;
  }

  isSpectating = true;
  spectatingId = targetSyncId;
  spectatorRole = role;

  const spectateStatusContainer = document.getElementById('spectate-status-container');
  const spectateStatusText = document.getElementById('spectate-status-text');
  if (spectateStatusContainer) spectateStatusContainer.classList.remove('hidden');
  if (spectateStatusText) {
    spectateStatusText.textContent = role === 'collaborator' 
      ? `👁️ Co-Scoring: ${targetSyncId}` 
      : `👁️ Spectating: ${targetSyncId}`;
  }

  const activeRoundRef = doc(db, 'activeRounds', targetSyncId);
  spectatorUnsubscribe = onSnapshot(activeRoundRef, (docSnap) => {
    if (docSnap.exists()) {
      const cloudData = docSnap.data();
      
      state.hostUsername = cloudData.hostUsername || 'Host';
      state.numHoles = cloudData.numHoles || 9;
      // Keep state.currentHoleIndex local to prevent screen jumping!
      state.selectedCourse = cloudData.selectedCourse || null;
      state.holes = cloudData.holes || [];
      state.mode = cloudData.mode || 'individual';
      state.players = cloudData.players || ['You'];
      state.matchType = cloudData.matchType || 'leaderboard';
      state.team1Name = cloudData.team1Name || '';
      state.team2Name = cloudData.team2Name || '';
      state.roundStartTime = cloudData.roundStartTime || null;
      state.roundElapsedTime = cloudData.roundElapsedTime || 0;
      state.isTimerRunning = cloudData.isTimerRunning || false;

      updateUI();
      updateGPSWidget();
      setControlsReadOnly(isSpectating);
    } else {
      console.warn("Active round does not exist or has been completed.");
      if (isSpectating && spectatorRole === 'collaborator') {
        alert("The host has completed this round! The round is now saved in your history.");
        disconnectSpectatorMode();
        // Sync history from cloud to load the completed round
        syncFromCloud();
        // Switch to history tab
        const tabHistory = document.getElementById('tab-history');
        if (tabHistory) tabHistory.click();
      } else {
        const transcriptBox = document.getElementById('transcript-box');
        if (transcriptBox) {
          transcriptBox.innerHTML = '<p class="transcript-placeholder" style="color:var(--danger)">Waiting for active round data from host...</p>';
        }
      }
    }
  }, (error) => {
    console.error("Firestore onSnapshot error:", error);
    alert("Error connecting to live stream: " + error.message);
    disconnectSpectatorMode();
  });

  setControlsReadOnly(isSpectating);

  const settingsDialog = document.getElementById('settings-dialog');
  if (settingsDialog && settingsDialog.open) {
    settingsDialog.close();
  }
}

function disconnectSpectatorMode() {
  if (spectatorUnsubscribe) {
    spectatorUnsubscribe();
    spectatorUnsubscribe = null;
  }

  isSpectating = false;
  spectatingId = '';
  spectatorRole = 'viewer';

  const spectateStatusContainer = document.getElementById('spectate-status-container');
  const spectateSyncIdInput = document.getElementById('spectate-sync-id');
  if (spectateStatusContainer) spectateStatusContainer.classList.add('hidden');
  if (spectateSyncIdInput) spectateSyncIdInput.value = '';

  loadState();
  setupActiveRoundSubscription();
  setControlsReadOnly(false);
  updateUI();
  updateGPSWidget();

  alert("Disconnected from Live Spectator mode.");
}

function renderNotesList(activeHole) {
  const notesList = document.getElementById('hole-notes-list');
  notesList.innerHTML = '';
  
  if (!activeHole.notes || activeHole.notes.length === 0) {
    notesList.innerHTML = '<p class="empty-notes-text">No notes recorded yet. Say things like "fairway approach shot" or "hit standard iron".</p>';
    return;
  }

  activeHole.notes.forEach((note, index) => {
    const div = document.createElement('div');
    div.className = 'note-bubble';
    div.innerHTML = `
      <span>${escapeHTML(note)}</span>
      <button type="button" class="note-delete-btn" aria-label="Delete note" data-index="${index}">&times;</button>
    `;
    div.querySelector('.note-delete-btn').addEventListener('click', (e) => {
      const idx = parseInt(e.currentTarget.dataset.index);
      activeHole.notes.splice(idx, 1);
      saveState();
      updateUI();
    });
    notesList.appendChild(div);
  });
}

// Generate the table dynamically
function renderScorecard() {
  const headerRow = document.getElementById('scorecard-header-row');
  const parRow = document.getElementById('scorecard-par-row');
  const scoreRow = document.getElementById('scorecard-score-row');
  const puttsRow = document.getElementById('scorecard-putts-row');
  const fairwayRow = document.getElementById('scorecard-fairway-row');
  const girRow = document.getElementById('scorecard-gir-row');
  const tbody = scoreRow.parentElement;

  // Clear previous columns except header row first cell
  headerRow.innerHTML = '<th>Hole</th>';
  parRow.innerHTML = '<td class="row-header">Par</td>';
  scoreRow.innerHTML = '<td class="row-header">Score</td>';
  puttsRow.innerHTML = '<td class="row-header">Putts</td>';
  fairwayRow.innerHTML = '<td class="row-header">Fairway</td>';
  girRow.innerHTML = '<td class="row-header">GIR</td>';

  // Remove existing dynamic player score rows
  if (tbody) {
    tbody.querySelectorAll('.player-score-row').forEach(row => row.remove());
  }

  const isMatchMode = state.mode === 'match';
  const playerRows = {};

  if (isMatchMode) {
    scoreRow.style.display = 'none';
    const players = state.players || ['You'];
    players.forEach((p, idx) => {
      const tr = document.createElement('tr');
      tr.className = 'player-score-row';
      if (state.matchType === 'team' && idx === 2) {
        tr.classList.add('player-score-row-team-divider');
      }
      tr.innerHTML = `<td class="row-header">${p}</td>`;
      tbody.insertBefore(tr, puttsRow);
      playerRows[p] = tr;
    });
  } else {
    scoreRow.style.display = '';
  }

  state.holes.forEach((hole, index) => {
    const isCurrent = index === state.currentHoleIndex;
    const activeClass = isCurrent ? 'class="active-col"' : '';

    // Header (clickable navigation)
    const th = document.createElement('th');
    if (isCurrent) th.className = 'active-col';
    th.innerHTML = `<span class="cell-val" style="display:block; width:100%">${hole.number}</span>`;
    th.addEventListener('click', () => navigateHole(index));
    headerRow.appendChild(th);

    // Par
    const tdPar = document.createElement('td');
    if (isCurrent) tdPar.className = 'active-col';
    tdPar.textContent = hole.par;
    parRow.appendChild(tdPar);

    // If Match Mode, determine the hole winner or team winner
    let holeWinner = null;
    let teamWinner = null; // 'A' or 'B'
    let teamBestScore = null;

    if (isMatchMode) {
      const players = state.players || ['You'];

      if (state.matchType === 'team' && players.length === 4) {
        const p1 = players[0];
        const p2 = players[1];
        const p3 = players[2];
        const p4 = players[3];

        const s1 = (hole.playerScores && hole.playerScores[p1]) || 0;
        const c1 = (hole.playerConceded && hole.playerConceded[p1]) || false;
        const s2 = (hole.playerScores && hole.playerScores[p2]) || 0;
        const c2 = (hole.playerConceded && hole.playerConceded[p2]) || false;
        const s3 = (hole.playerScores && hole.playerScores[p3]) || 0;
        const c3 = (hole.playerConceded && hole.playerConceded[p3]) || false;
        const s4 = (hole.playerScores && hole.playerScores[p4]) || 0;
        const c4 = (hole.playerConceded && hole.playerConceded[p4]) || false;

        const teamA = getTeamBestBall(s1, c1, s2, c2);
        const teamB = getTeamBestBall(s3, c3, s4, c4);

        if (teamA.played && teamB.played) {
          if (teamA.conceded && teamB.conceded) {
            // halved
          } else if (teamA.conceded) {
            teamWinner = 'B';
            teamBestScore = teamB.score;
          } else if (teamB.conceded) {
            teamWinner = 'A';
            teamBestScore = teamA.score;
          } else {
            if (teamA.score < teamB.score) {
              teamWinner = 'A';
              teamBestScore = teamA.score;
            } else if (teamB.score < teamA.score) {
              teamWinner = 'B';
              teamBestScore = teamB.score;
            }
          }
        }
      } else {
        let bestScore = Infinity;
        let winners = [];
        let activeCount = 0;

        players.forEach(p => {
          const score = (hole.playerScores && hole.playerScores[p]) || 0;
          const conceded = (hole.playerConceded && hole.playerConceded[p]) || false;

          if (score > 0 || conceded) {
            activeCount++;
            if (!conceded) {
              if (score < bestScore) {
                bestScore = score;
                winners = [p];
              } else if (score === bestScore) {
                winners.push(p);
              }
            }
          }
        });

        // A hole has a winner only if at least two players recorded a score/concession and one player has the unique best score
        if (activeCount >= 2 && winners.length === 1) {
          holeWinner = winners[0];
        }
      }

      // Populate each player's row cell
      players.forEach((p, idx) => {
        const td = document.createElement('td');
        if (isCurrent) td.className = 'active-col';
        td.className += ' cell-val';

        const score = (hole.playerScores && hole.playerScores[p]) || 0;
        const conceded = (hole.playerConceded && hole.playerConceded[p]) || false;

        if (conceded) {
          td.className += ' cell-conceded';
          td.textContent = 'C';
        } else {
          // Calculate score class relative to par
          if (score > 0) {
            const diff = score - hole.par;
            if (diff === 0) td.className += ' cell-par';
            else if (diff === -1) td.className += ' cell-birdie';
            else if (diff <= -2) td.className += ' cell-eagle';
            else if (diff === 1) td.className += ' cell-bogey';
            else td.className += ' cell-double';
            
            td.textContent = score;
          } else {
            td.textContent = '-';
          }
        }

        let cellWon = false;
        if (state.matchType === 'team' && players.length === 4) {
          if (teamWinner === 'A' && idx < 2) {
            if (!conceded && score === teamBestScore && score > 0) {
              cellWon = true;
            }
          } else if (teamWinner === 'B' && idx >= 2) {
            if (!conceded && score === teamBestScore && score > 0) {
              cellWon = true;
            }
          }
        } else {
          if (p === holeWinner) {
            cellWon = true;
          }
        }

        if (cellWon) {
          td.classList.add('cell-won-hole');
        }

        td.addEventListener('click', () => navigateHole(index));
        playerRows[p].appendChild(td);
      });
    } else {
      // Individual Score
      const tdScore = document.createElement('td');
      if (isCurrent) tdScore.className = 'active-col';
      if (hole.conceded) {
        tdScore.className += ' cell-val cell-conceded';
        tdScore.textContent = 'C';
      } else {
        tdScore.className += ` cell-val ${getScoreClass(hole)}`;
        tdScore.textContent = hole.score > 0 ? hole.score : '-';
      }
      tdScore.addEventListener('click', () => navigateHole(index));
      scoreRow.appendChild(tdScore);
    }

    // Putts
    const tdPutts = document.createElement('td');
    if (isCurrent) tdPutts.className = 'active-col';
    tdPutts.className += ' cell-val';
    tdPutts.textContent = hole.putts > 0 ? hole.putts : '-';
    tdPutts.addEventListener('click', () => navigateHole(index));
    puttsRow.appendChild(tdPutts);

    // Fairway
    const tdFairway = document.createElement('td');
    if (isCurrent) tdFairway.className = 'active-col';
    tdFairway.className += ' cell-val';
    tdFairway.textContent = hole.fairway !== 'NA' ? hole.fairway : '-';
    tdFairway.addEventListener('click', () => navigateHole(index));
    fairwayRow.appendChild(tdFairway);

    // GIR
    const tdGIR = document.createElement('td');
    if (isCurrent) tdGIR.className = 'active-col';
    tdGIR.className += ' cell-val';
    tdGIR.textContent = hole.gir !== 'NA' ? hole.gir : '-';
    tdGIR.addEventListener('click', () => navigateHole(index));
    girRow.appendChild(tdGIR);
  });
}

function getScoreClass(hole) {
  if (hole.score === 0) return '';
  const diff = hole.score - hole.par;
  if (diff === 0) return 'cell-par';
  if (diff === -1) return 'cell-birdie';
  if (diff <= -2) return 'cell-eagle';
  if (diff === 1) return 'cell-bogey';
  return 'cell-double';
}

function navigateHole(index) {
  if (index >= 0 && index < state.numHoles) {
    state.currentHoleIndex = index;
    saveState();
    updateUI();
    updateGPSWidget();
  }
}

function updateHoleMetric(key, val) {
  if (isSpectating) return;
  const activeHole = state.holes[state.currentHoleIndex];
  if (activeHole) {
    activeHole[key] = val;
    
    // Keep playerScores and playerConceded in sync for Player 1 ("You")
    if (!activeHole.playerScores) activeHole.playerScores = {};
    if (!activeHole.playerConceded) activeHole.playerConceded = {};
    
    if (key === 'score') {
      activeHole.playerScores['You'] = val;
    } else if (key === 'conceded') {
      activeHole.playerConceded['You'] = !!val;
    }
    
    saveState();
    updateUI();
  }
}

function addManualNote() {
  if (isSpectating) return;
  const input = document.getElementById('manual-note-input');
  const noteText = input.value.trim();
  if (noteText) {
    const activeHole = state.holes[state.currentHoleIndex];
    if (activeHole) {
      if (!activeHole.notes) activeHole.notes = [];
      activeHole.notes.push(noteText);
      input.value = '';
      saveState();
      updateUI();
    }
  }
}

// Stats Calculation Functions
function calculateTotalScore(holes = state.holes) {
  return holes.reduce((sum, h) => sum + (h.score > 0 ? h.score : 0), 0);
}

function calculateTotalPar(holes = state.holes) {
  // Only sum par for holes that have been scored
  return holes.reduce((sum, h) => sum + (h.score > 0 ? h.par : 0), 0);
}

function calculateTotalPutts(holes = state.holes) {
  return holes.reduce((sum, h) => sum + (h.putts > 0 ? h.putts : 0), 0);
}

function calculateFairwayStats(holes = state.holes) {
  let hit = 0;
  let left = 0;
  let right = 0;
  let ob = 0;
  let totalHolesWithFairway = 0;

  holes.forEach(h => {
    // Only calculate fairways on par 4 and par 5 holes that have scores logged
    if (h.score > 0 && h.par > 3) {
      totalHolesWithFairway++;
      if (h.fairway === 'HIT') hit++;
      else if (h.fairway === 'LEFT') left++;
      else if (h.fairway === 'RIGHT') right++;
      else if (h.fairway === 'OB') ob++;
    }
  });

  const hitPercent = totalHolesWithFairway > 0 ? Math.round((hit / totalHolesWithFairway) * 100) : 0;
  return { hit, left, right, ob, totalHolesWithFairway, hitPercent };
}

function calculateGIRStats(holes = state.holes) {
  let hit = 0;
  let totalHolesWithGIR = 0;

  holes.forEach(h => {
    if (h.score > 0) {
      totalHolesWithGIR++;
      if (h.gir === 'YES') hit++;
    }
  });

  const girPercent = totalHolesWithGIR > 0 ? Math.round((hit / totalHolesWithGIR) * 100) : 0;
  return { hit, totalHolesWithGIR, girPercent };
}

// Speech Recognition Engine
function initSpeechRecognition() {
  const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
  
  if (!SpeechRecognition) {
    const transcriptBox = document.getElementById('transcript-box');
    transcriptBox.innerHTML = '<p class="transcript-placeholder" style="color:var(--danger); font-weight:600;">Voice recognition is not supported in this browser. Please use Google Chrome, Safari, or Microsoft Edge. You can still track your score manually using the dashboard forms!</p>';
    document.getElementById('btn-voice-toggle').disabled = true;
    document.getElementById('btn-voice-toggle').style.opacity = '0.5';
    document.getElementById('mic-status-label').textContent = 'Unsupported Browser';
    return;
  }

  recognition = new SpeechRecognition();
  recognition.lang = 'en-US';
  recognition.interimResults = true;
  
  // Set continuous mode based on settings
  recognition.continuous = state.continuous;

  recognition.onstart = () => {
    state.isListening = true;
    document.querySelector('.voice-column .voice-card').classList.add('listening');
    document.getElementById('mic-status-label').textContent = 'Listening... Speak now';
    
    // Clear transcript preview
    const transcriptBox = document.getElementById('transcript-box');
    transcriptBox.innerHTML = '<p class="transcript-live-txt"><i>Listening for commands...</i></p>';
  };

  recognition.onresult = (event) => {
    let interimTranscript = '';
    let finalTranscript = '';

    for (let i = event.resultIndex; i < event.results.length; ++i) {
      if (event.results[i].isFinal) {
        finalTranscript += event.results[i][0].transcript;
      } else {
        interimTranscript += event.results[i][0].transcript;
      }
    }

    const transcriptBox = document.getElementById('transcript-box');
    
    if (interimTranscript) {
      transcriptBox.innerHTML = `<p class="transcript-live-txt">${escapeHTML(interimTranscript)}</p>`;
    }

    if (finalTranscript) {
      transcriptBox.innerHTML = `<p class="transcript-final-txt">"${escapeHTML(finalTranscript)}"</p>`;
      
      // Cancel previous speech timeout to allow full utterance processing
      if (speechTimeout) clearTimeout(speechTimeout);
      
      speechTimeout = setTimeout(() => {
        processFinalTranscript(finalTranscript);
      }, 500);
    }
  };

  recognition.onerror = (event) => {
    console.error('Speech recognition error:', event.error);
    const transcriptBox = document.getElementById('transcript-box');
    
    if (event.error === 'not-allowed') {
      transcriptBox.innerHTML = '<p class="transcript-placeholder" style="color:var(--danger)">Microphone blocked. Please grant microphone access in browser settings to enable voice logs.</p>';
      state.isListening = false;
      stopListeningUI();
    } else if (event.error === 'no-speech') {
      // Silence detected: do not stop listening, keep session active
      console.log('Silence detected, keeping mic active.');
    } else {
      console.warn('Transient speech error:', event.error);
    }
  };

  recognition.onend = () => {
    // Keep mic listening until user explicitly toggles it off
    if (state.isListening) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to restart speech recognition', e);
      }
    } else {
      stopListeningUI();
    }
  };

  // Bind microphone button click toggle
  document.getElementById('btn-voice-toggle').addEventListener('click', () => {
    // Use Whisper if OpenAI API key is set!
    if (state.openaiApiKey) {
      if (whisperIsRecording) {
        if (speechTimeout) clearTimeout(speechTimeout);
        if (mediaRecorder && mediaRecorder.state === 'recording') {
          mediaRecorder.stop();
        }
      } else {
        startWhisperRecording();
      }
      return;
    }

    // Fall back to native SpeechRecognition if no OpenAI API Key
    if (state.isListening) {
      state.isListening = false;
      recognition.stop();
      stopListeningUI();
    } else {
      // Re-apply continuous setting in case it changed
      recognition.continuous = state.continuous;
      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to start speech recognition', e);
      }
    }
  });

  // Collapsible Voice Card functionality
  const voiceCard = document.getElementById('voice-card');
  const voiceCardHeader = document.getElementById('voice-card-header');
  if (voiceCard && voiceCardHeader) {
    const isCollapsed = localStorage.getItem('voiceCardCollapsed') === 'true';
    if (isCollapsed) {
      voiceCard.classList.add('collapsed');
    }
    updateVoiceColumnLayout();

    voiceCard.addEventListener('click', (e) => {
      const isCardCollapsed = voiceCard.classList.contains('collapsed');
      if (isCardCollapsed) {
        // Expand if clicking anywhere on the card background (except the mic toggle button)
        if (!e.target.closest('#btn-voice-toggle')) {
          voiceCard.classList.remove('collapsed');
          localStorage.setItem('voiceCardCollapsed', 'false');
          updateVoiceColumnLayout();
        }
      } else {
        // Collapse if clicking header or collapse chevron
        if (e.target.closest('#voice-card-header') || e.target.closest('#btn-voice-collapse')) {
          if (!e.target.closest('button') || e.target.closest('#btn-voice-collapse')) {
            voiceCard.classList.add('collapsed');
            localStorage.setItem('voiceCardCollapsed', 'true');
            updateVoiceColumnLayout();
          }
        }
      }
    });
  }
}

function stopListeningUI() {
  document.querySelector('.voice-column .voice-card').classList.remove('listening');
  document.getElementById('mic-status-label').textContent = 'Tap to Speak';
}

// Whisper API audio recording and transcription helpers
async function startWhisperRecording() {
  audioChunks = [];
  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    
    // Choose appropriate mimeType (audio/webm is standard, audio/mp4 on iOS Safari)
    let options = { mimeType: 'audio/webm' };
    if (!MediaRecorder.isTypeSupported('audio/webm')) {
      options = { mimeType: 'audio/mp4' };
    }
    
    mediaRecorder = new MediaRecorder(stream, options);
    
    mediaRecorder.ondataavailable = (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
      }
    };
    
    mediaRecorder.onstop = async () => {
      // Clean up stream tracks
      stream.getTracks().forEach(track => track.stop());
      
      const mimeType = mediaRecorder.mimeType;
      const extension = mimeType.includes('mp4') ? 'mp4' : 'webm';
      const audioBlob = new Blob(audioChunks, { type: mimeType });
      
      // Update UI to transcribing
      const transcriptBox = document.getElementById('transcript-box');
      if (transcriptBox) {
        transcriptBox.innerHTML = '<p class="transcript-live-txt"><i>Whisper is transcribing...</i></p>';
      }
      const label = document.getElementById('mic-status-label');
      if (label) label.textContent = 'Transcribing...';
      
      try {
        const transcript = await sendAudioToWhisper(audioBlob, extension);
        if (transcript) {
          if (transcriptBox) {
            transcriptBox.innerHTML = `<p class="transcript-final-txt">"${escapeHTML(transcript)}"</p>`;
          }
          processFinalTranscript(transcript);
        } else {
          if (transcriptBox) {
            transcriptBox.innerHTML = '<p class="transcript-placeholder" style="color:var(--danger)">No speech recognized. Try again.</p>';
          }
        }
      } catch (err) {
        console.error('Whisper transcription error:', err);
        if (transcriptBox) {
          transcriptBox.innerHTML = `<p class="transcript-placeholder" style="color:var(--danger)">Whisper error: ${escapeHTML(err.message)}</p>`;
        }
      } finally {
        whisperIsRecording = false;
        state.isListening = false;
        stopListeningUI();
      }
    };
    
    mediaRecorder.start();
    whisperIsRecording = true;
    state.isListening = true;
    
    const card = document.querySelector('.voice-column .voice-card');
    if (card) card.classList.add('listening');
    const label = document.getElementById('mic-status-label');
    if (label) label.textContent = 'Listening (Whisper)... Tap to Stop';
    
    const transcriptBox = document.getElementById('transcript-box');
    if (transcriptBox) {
      transcriptBox.innerHTML = '<p class="transcript-live-txt"><i>Recording audio for Whisper...</i></p>';
    }
    
    // Auto stop after 30 seconds to prevent runaway recording
    if (speechTimeout) clearTimeout(speechTimeout);
    speechTimeout = setTimeout(() => {
      if (whisperIsRecording && mediaRecorder && mediaRecorder.state === 'recording') {
        mediaRecorder.stop();
      }
    }, 30000);
    
  } catch (err) {
    console.error('Failed to start media recorder', err);
    const transcriptBox = document.getElementById('transcript-box');
    if (transcriptBox) {
      transcriptBox.innerHTML = `<p class="transcript-placeholder" style="color:var(--danger)">Microphone error: ${escapeHTML(err.message)}</p>`;
    }
    stopListeningUI();
  }
}

async function sendAudioToWhisper(audioBlob, extension) {
  const formData = new FormData();
  const filename = `audio.${extension}`;
  const file = new File([audioBlob], filename, { type: audioBlob.type });
  
  formData.append('file', file);
  formData.append('model', 'whisper-1');
  formData.append('prompt', 'Golf score tracker stats. Terms: hole, score, putts, par, fairway, gir, ob, hit fairway, birdie, bogey, eagle, double bogey, albatross, green in regulation, concede, conceded, conceded hole.');
  formData.append('language', 'en');

  const response = await fetch('https://api.openai.com/v1/audio/transcriptions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${state.openaiApiKey}`
    },
    body: formData
  });

  if (!response.ok) {
    const errData = await response.json().catch(() => ({}));
    const errMsg = (errData.error && errData.error.message) || `HTTP error ${response.status}`;
    throw new Error(errMsg);
  }

  const data = await response.json();
  return data.text ? data.text.trim() : '';
}

// Golf Spoken Text Parser
function normalizeGolfTranscript(text) {
  if (!text) return '';
  let normalized = text.toLowerCase();

  // 1. Punctuation cleaning (dashes to spaces)
  normalized = normalized.replace(/-/g, ' ');

  // 2. Map common golf word homophones and accents
  const homophones = [
    // hole
    { regex: /\b(?:wholes?|holds?|homes?)\b/g, replace: 'hole' },
    // putts / putt / pots
    { regex: /\b(?:pots?|puts?|pats?|poets?|butts?|path?s)\b/g, replace: 'putt' },
    { regex: /\bputted\b/g, replace: 'putt' },
    // par / pars
    { regex: /\b(?:parts|pairs|bars|pers|peers)\b/g, replace: 'pars' },
    { regex: /\b(?:part|pair|bar|per|peer)\b/g, replace: 'par' },
    // fairway
    { regex: /\b(?:fair\s+ways?|pharaohs?|ferries|ferry|fareways?)\b/g, replace: 'fairway' },
    // OB
    { regex: /\b(?:o\.b\.|o b|out of bounds?)\b/g, replace: 'ob' },
    // GIR
    { regex: /\b(?:g\.i\.r\.|g i r|green in regulation|green regulation)\b/g, replace: 'gir' },
    // bogey
    { regex: /\b(?:bogies?|bogys?|boogies?)\b/g, replace: 'bogey' },
    // birdie
    { regex: /\b(?:birdys?|berti?es?)\b/g, replace: 'birdie' },
    // eagle
    { regex: /\b(?:egals?|equals?)\b/g, replace: 'eagle' }
  ];

  homophones.forEach(item => {
    normalized = normalized.replace(item.regex, item.replace);
  });

  // 3. Normalize numbers (handling numbers 1-10 and their homophones contextually)
  const numberMaps = [
    { regex: /\bone\b/g, replace: '1' },
    { regex: /\bwon\b(?=\s*(?:putt|shot|bogey|birdie|eagle|par|ob|gir|hit|miss|\d))/g, replace: '1' },
    
    { regex: /\b(?:two|too)\b/g, replace: '2' },
    { regex: /\bto\b(?=\s*(?:putt|shot|bogey|birdie|eagle|par|ob|gir|hit|miss|\d|hole))/g, replace: '2' },
    
    { regex: /\bthree\b/g, replace: '3' },
    { regex: /\bfree\b(?=\s*(?:putt|shot|bogey|birdie|eagle|par|ob|gir|hit|miss|\d))/g, replace: '3' },
    
    { regex: /\b(?:four|fore)\b/g, replace: '4' },
    { regex: /\bfor\b(?=\s*(?:putt|shot|bogey|birdie|eagle|par|ob|gir|hit|miss|\d))/g, replace: '4' },
    { regex: /(?<=\b(?:score|shot|got|made|took|putt|par|hole)\s+)for\b/g, replace: '4' },
    
    { regex: /\bfive\b/g, replace: '5' },
    
    { regex: /\bsix\b/g, replace: '6' },
    { regex: /\bsex\b(?=\s*(?:putt|shot|bogey|birdie|eagle|par|ob|gir|hit|miss|\d))/g, replace: '6' },
    
    { regex: /\bseven\b/g, replace: '7' },
    
    { regex: /\beight\b/g, replace: '8' },
    { regex: /\bate\b(?=\s*(?:putt|shot|bogey|birdie|eagle|par|ob|gir|hit|miss|\d))/g, replace: '8' },
    
    { regex: /\bnine\b/g, replace: '9' },
    { regex: /\bten\b/g, replace: '10' }
  ];

  numberMaps.forEach(item => {
    normalized = normalized.replace(item.regex, item.replace);
  });

  return normalized;
}

function processFinalTranscript(transcript) {
  if (isSpectating) return;
  if (!transcript || !transcript.trim()) return;

  const normalized = normalizeGolfTranscript(transcript);
  
  // Split transcript into clauses by pauses or connectors
  const clauses = normalized.split(/\b(?:and\s+then|then|and|but)\b|[,.;?!]+/i);
  let notesToAdd = [];
  
  // Track updates for voice confirmation speakback
  let updates = {
    holeChanged: false,
    newHoleNum: null,
    score: null,
    putts: null,
    fairway: null,
    gir: null,
    notesCount: 0
  };

  // Phase 1: Navigation check and strip from clauses
  for (let i = 0; i < clauses.length; i++) {
    let clause = clauses[i].trim();
    if (!clause) continue;

    // Go to hole X
    const holeMatch = clause.match(/\bhole\s*(\d+)\b/);
    if (holeMatch) {
      const holeNum = parseInt(holeMatch[1]);
      if (holeNum >= 1 && holeNum <= state.numHoles) {
        state.currentHoleIndex = holeNum - 1;
        updates.holeChanged = true;
        updates.newHoleNum = holeNum;
        clauses[i] = clause.replace(holeMatch[0], '').trim();
      }
      continue;
    }

    // Go to next hole
    const nextMatch = clause.match(/\b(?:next\s+hole|go\s+to\s+next|go\s+2\s+next)\b/);
    if (nextMatch) {
      if (state.currentHoleIndex < state.numHoles - 1) {
        state.currentHoleIndex++;
        updates.holeChanged = true;
        updates.newHoleNum = state.currentHoleIndex + 1;
        clauses[i] = clause.replace(nextMatch[0], '').trim();
      }
      continue;
    }

    // Go to previous hole
    const prevMatch = clause.match(/\b(?:previous\s+hole|prev\s+hole|go\s+back)\b/);
    if (prevMatch) {
      if (state.currentHoleIndex > 0) {
        state.currentHoleIndex--;
        updates.holeChanged = true;
        updates.newHoleNum = state.currentHoleIndex + 1;
        clauses[i] = clause.replace(prevMatch[0], '').trim();
      }
      continue;
    }
  }

  // Get active hole object
  const activeHole = state.holes[state.currentHoleIndex];
  if (!activeHole) return;

  // Ensure playerScores and playerConceded are initialized
  if (!activeHole.playerScores) activeHole.playerScores = {};
  if (!activeHole.playerConceded) activeHole.playerConceded = {};
  if (activeHole.playerScores['You'] === undefined) activeHole.playerScores['You'] = activeHole.score || 0;
  if (activeHole.playerConceded['You'] === undefined) activeHole.playerConceded['You'] = !!activeHole.conceded;

  updates.playerUpdates = [];

  // Phase 2: Process stats commands and extract custom notes
  for (let i = 0; i < clauses.length; i++) {
    let clause = clauses[i].trim();
    if (!clause) continue;

    let isStat = false;

    // Team match-play result voice commands (e.g. "Team A one-up", "Cougars won the hole")
    if (state.mode === 'match' && state.matchType === 'team' && state.players && state.players.length === 4) {
      const team1Name = (state.team1Name || 'Team A').toLowerCase();
      const team2Name = (state.team2Name || 'Team B').toLowerCase();

      const p1 = state.players[0];
      const p2 = state.players[1];
      const p3 = state.players[2];
      const p4 = state.players[3];

      // Check Team 1 win commands: "Team A one-up", "Team A won", "Team 1 up"
      const t1Regex = new RegExp(`\\b(?:${team1Name}|team\\s+1)\\s+(?:one[- ]up|1[- ]up|won|won\\s+the\\s+hole|up)\\b`, 'i');
      if (t1Regex.test(clause)) {
        activeHole.playerConceded[p1] = false;
        activeHole.playerConceded[p2] = false;
        if (!activeHole.playerScores[p1]) activeHole.playerScores[p1] = activeHole.par;
        if (!activeHole.playerScores[p2]) activeHole.playerScores[p2] = activeHole.par;
        
        activeHole.conceded = false;
        activeHole.score = activeHole.playerScores[p1];

        activeHole.playerConceded[p3] = true;
        activeHole.playerConceded[p4] = true;
        activeHole.playerScores[p3] = activeHole.par;
        activeHole.playerScores[p4] = activeHole.par;

        updates.playerUpdates.push({ name: p1, conceded: false, score: activeHole.playerScores[p1] });
        updates.playerUpdates.push({ name: p2, conceded: false, score: activeHole.playerScores[p2] });
        updates.playerUpdates.push({ name: p3, conceded: true, score: activeHole.par });
        updates.playerUpdates.push({ name: p4, conceded: true, score: activeHole.par });

        isStat = true;
        clause = clause.replace(t1Regex, '').trim();
      }

      // Check Team 2 win commands: "Team B one-up", "Team B won", "Team 2 up"
      const t2Regex = new RegExp(`\\b(?:${team2Name}|team\\s+2)\\s+(?:one[- ]up|1[- ]up|won|won\\s+the\\s+hole|up)\\b`, 'i');
      if (t2Regex.test(clause)) {
        activeHole.playerConceded[p3] = false;
        activeHole.playerConceded[p4] = false;
        if (!activeHole.playerScores[p3]) activeHole.playerScores[p3] = activeHole.par;
        if (!activeHole.playerScores[p4]) activeHole.playerScores[p4] = activeHole.par;

        activeHole.playerConceded[p1] = true;
        activeHole.playerConceded[p2] = true;
        activeHole.playerScores[p1] = activeHole.par;
        activeHole.playerScores[p2] = activeHole.par;

        activeHole.conceded = true;
        activeHole.score = activeHole.playerScores[p1];

        updates.playerUpdates.push({ name: p1, conceded: true, score: activeHole.par });
        updates.playerUpdates.push({ name: p2, conceded: true, score: activeHole.par });
        updates.playerUpdates.push({ name: p3, conceded: false, score: activeHole.playerScores[p3] });
        updates.playerUpdates.push({ name: p4, conceded: false, score: activeHole.playerScores[p4] });

        isStat = true;
        clause = clause.replace(t2Regex, '').trim();
      }
    }

    if (!isStat && !clause) {
      clauses[i] = '';
      continue;
    }

    let matchedPlayer = null;

    if (state.mode === 'match' && state.players) {
      for (const p of state.players) {
        if (p.toLowerCase() === 'you') continue;
        const pRegex = new RegExp(`\\b${p}\\b`, 'i');
        if (pRegex.test(clause)) {
          matchedPlayer = p;
          clause = clause.replace(pRegex, '').trim();
          break;
        }
      }
      
      if (!matchedPlayer) {
        const youRegex = /\b(?:you|me|i|myself)\b/i;
        if (youRegex.test(clause)) {
          matchedPlayer = 'You';
          clause = clause.replace(/\b(?:you)\b/i, '').trim();
        }
      }
    }

    if (matchedPlayer) {
      // Check if matchedPlayer won the hole: "John one-up", "John won the hole"
      const wonMatch = clause.match(/\b(?:one[- ]up|1[- ]up|won|won\s+the\s+hole|up)\b/i);
      if (wonMatch) {
        activeHole.playerConceded[matchedPlayer] = false;
        if (!activeHole.playerScores[matchedPlayer]) {
          activeHole.playerScores[matchedPlayer] = activeHole.par;
        }
        updates.playerUpdates.push({ name: matchedPlayer, conceded: false, score: activeHole.playerScores[matchedPlayer] });
        
        if (matchedPlayer === 'You') {
          activeHole.conceded = false;
          activeHole.score = activeHole.playerScores[matchedPlayer];
        }

        state.players.forEach(p => {
          if (p.toLowerCase() !== matchedPlayer.toLowerCase()) {
            activeHole.playerConceded[p] = true;
            let scoreVal = activeHole.playerScores[p] || 0;
            if (scoreVal === 0) {
              scoreVal = activeHole.par;
              activeHole.playerScores[p] = scoreVal;
            }
            updates.playerUpdates.push({ name: p, conceded: true, score: scoreVal });
            
            if (p === 'You') {
              activeHole.conceded = true;
              activeHole.score = scoreVal;
            }
          }
        });
        isStat = true;
        clause = clause.replace(wonMatch[0], '').trim();
      }

      // Parse stats for matched player
      const concededMatch = clause.match(/\b(?:concede(?:d)?(?:\s+hole)?|hole\s+concede(?:d)?)\b/i);
      if (concededMatch) {
        activeHole.playerConceded[matchedPlayer] = true;
        
        let scoreVal = activeHole.playerScores[matchedPlayer] || 0;
        if (scoreVal === 0) {
          scoreVal = activeHole.par;
          activeHole.playerScores[matchedPlayer] = scoreVal;
        }
        
        updates.playerUpdates.push({ name: matchedPlayer, conceded: true, score: scoreVal });
        
        if (matchedPlayer === 'You') {
          activeHole.conceded = true;
          activeHole.score = scoreVal;
          updates.score = scoreVal;
        }
        
        clause = clause.replace(concededMatch[0], '').trim();
        isStat = true;
      }
      
      if (!isStat) {
        const explicitScoreMatch = clause.match(/\b(?:score(?:\s+of)?|shot(?:\s+a)?|got(?:\s+a)?|made(?:\s+a)?|took)\s*(\d+)\b/i) ||
                                    clause.match(/\b(\d+)\s*(?:shots?|strokes?)\b/i);
        let scoreVal = null;
        let matchedTerm = null;
        
        if (explicitScoreMatch) {
          scoreVal = parseInt(explicitScoreMatch[1]);
          matchedTerm = explicitScoreMatch[0];
        } else {
          const albatrossMatch = clause.match(/\b(?:double\s+eagle|albatross)\b/i);
          if (albatrossMatch) {
            scoreVal = activeHole.par - 3;
            matchedTerm = albatrossMatch[0];
          } else {
            const eagleMatch = clause.match(/\beagle\b/i);
            if (eagleMatch) {
              scoreVal = activeHole.par - 2;
              matchedTerm = eagleMatch[0];
            } else {
              const birdieMatch = clause.match(/\bbirdie\b/i);
              if (birdieMatch) {
                scoreVal = activeHole.par - 1;
                matchedTerm = birdieMatch[0];
              } else {
                const doubleBogeyMatch = clause.match(/\bdouble\s+bogey\b/i);
                if (doubleBogeyMatch) {
                  scoreVal = activeHole.par + 2;
                  matchedTerm = doubleBogeyMatch[0];
                } else {
                  const tripleBogeyMatch = clause.match(/\btriple\s+bogey\b/i);
                  if (tripleBogeyMatch) {
                    scoreVal = activeHole.par + 3;
                    matchedTerm = tripleBogeyMatch[0];
                  } else {
                    const bogeyMatch = clause.match(/\bbogey\b/i);
                    if (bogeyMatch) {
                      scoreVal = activeHole.par + 1;
                      matchedTerm = bogeyMatch[0];
                    } else {
                      const parScoreMatch = clause.match(/\b(?:got|made|shot|had)?\s*a?\s*par(?:red)?\b/i);
                      if (parScoreMatch) {
                        scoreVal = activeHole.par;
                        matchedTerm = parScoreMatch[0];
                      }
                    }
                  }
                }
              }
            }
          }
          
          if (scoreVal === null) {
            const standaloneDigitMatch = clause.match(/\b(\d+)\b/);
            if (standaloneDigitMatch) {
              scoreVal = parseInt(standaloneDigitMatch[1]);
              matchedTerm = standaloneDigitMatch[0];
            }
          }
        }
        
        if (scoreVal !== null) {
          activeHole.playerScores[matchedPlayer] = scoreVal;
          activeHole.playerConceded[matchedPlayer] = false;
          updates.playerUpdates.push({ name: matchedPlayer, score: scoreVal });
          
          if (matchedPlayer === 'You') {
            activeHole.score = scoreVal;
            activeHole.conceded = false;
            updates.score = scoreVal;
          }
          
          clause = clause.replace(matchedTerm, '').trim();
          isStat = true;
        }
      }
    } else {
      // 1. Par setting: "par 4", "par 3", "par 5"
      const parMatch = clause.match(/\bpar\s*([345])\b/i);
      if (parMatch) {
        const parVal = parseInt(parMatch[1]);
        activeHole.par = parVal;
        clause = clause.replace(parMatch[0], '').trim();
        isStat = true;
      }

      // 2. Putts: "2 putt", "putt 2"
      const puttMatch = clause.match(/\b(\d+)\s*putts?\b/i) || clause.match(/\bputts?\s*(\d+)\b/i);
      if (puttMatch) {
        const puttVal = parseInt(puttMatch[1]);
        activeHole.putts = puttVal;
        updates.putts = puttVal;
        clause = clause.replace(puttMatch[0], '').trim();
        isStat = true;
      } else {
        if (clause.includes("putted once") || clause.includes("single putt")) {
          activeHole.putts = 1;
          updates.putts = 1;
          clause = clause.replace(/putted once|single putt/g, '').trim();
          isStat = true;
        } else if (clause.includes("putted twice") || clause.includes("two putt") || clause.includes("two-putt")) {
          activeHole.putts = 2;
          updates.putts = 2;
          clause = clause.replace(/putted twice/g, '').trim();
          isStat = true;
        }
      }

      // 3. Fairway
      const obMatch = clause.match(/\b(?:ob|out\s+of\s+bounds)\b/i);
      if (obMatch) {
        activeHole.fairway = "OB";
        updates.fairway = "OB";
        clause = clause.replace(obMatch[0], '').trim();
        isStat = true;
      } else {
        const hitMatch = clause.match(/\b(?:fairway\s+hit|hit\s+fairway|hit\s+the\s+fairway|in\s+the\s+fairway)\b/i);
        if (hitMatch) {
          activeHole.fairway = "HIT";
          updates.fairway = "HIT";
          clause = clause.replace(hitMatch[0], '').trim();
          isStat = true;
        } else {
          const leftMatch = clause.match(/\b(?:miss(?:ed)?\s+fairway\s+left|miss(?:ed)?\s+left|fairway\s+left|miss\s+left|miss(?:ed)?\s+the\s+fairway\s+left)\b/i);
          if (leftMatch) {
            activeHole.fairway = "LEFT";
            updates.fairway = "LEFT";
            clause = clause.replace(leftMatch[0], '').trim();
            isStat = true;
          } else {
            const rightMatch = clause.match(/\b(?:miss(?:ed)?\s+fairway\s+right|miss(?:ed)?\s+right|fairway\s+right|miss\s+right|miss(?:ed)?\s+the\s+fairway\s+right)\b/i);
            if (rightMatch) {
              activeHole.fairway = "RIGHT";
              updates.fairway = "RIGHT";
              clause = clause.replace(rightMatch[0], '').trim();
              isStat = true;
            } else {
              const missMatch = clause.match(/\b(?:miss(?:ed)?\s+fairway|miss(?:ed)?\s+the\s+fairway|fairway\s+miss)\b/i);
              if (missMatch) {
                activeHole.fairway = "LEFT"; // Default miss direction
                updates.fairway = "LEFT";
                clause = clause.replace(missMatch[0], '').trim();
                isStat = true;
              }
            }
          }
        }
      }

      // 4. GIR
      const girNoMatch = clause.match(/\b(?:miss(?:ed)?\s+the\s+green|miss(?:ed)?\s+green|miss(?:ed)?\s+gir|not\s+on\s+the\s+green|not\s+on\s+green|gir\s+no|no\s+gir)\b/i);
      if (girNoMatch) {
        activeHole.gir = "NO";
        updates.gir = "NO";
        clause = clause.replace(girNoMatch[0], '').trim();
        isStat = true;
      } else {
        const girYesMatch = clause.match(/\b(?:green\s+in\s+regulation|gir|hit\s+the\s+green|hit\s+green|on\s+the\s+green|in\s+regulation|gir\s+yes|yes\s+gir)\b/i);
        if (girYesMatch) {
          activeHole.gir = "YES";
          updates.gir = "YES";
          clause = clause.replace(girYesMatch[0], '').trim();
          isStat = true;
        }
      }

      // 4b. Conceded Hole
      const concededMatch = clause.match(/\b(?:concede(?:d)?(?:\s+hole)?|hole\s+concede(?:d)?)\b/i);
      if (concededMatch) {
        activeHole.conceded = true;
        updates.conceded = true;
        
        let scoreVal = activeHole.score || 0;
        if (scoreVal === 0) {
          scoreVal = activeHole.par;
          activeHole.score = scoreVal;
        }
        updates.score = scoreVal;

        activeHole.playerConceded['You'] = true;
        activeHole.playerScores['You'] = scoreVal;
        updates.playerUpdates.push({ name: 'You', conceded: true, score: scoreVal });
        
        clause = clause.replace(concededMatch[0], '').trim();
        isStat = true;
      }

      // 5. Score
      if (!isStat) {
        const explicitScoreMatch = clause.match(/\b(?:score(?:\s+of)?|shot(?:\s+a)?|got(?:\s+a)?|made(?:\s+a)?|took)\s*(\d+)\b/i) ||
                                    clause.match(/\b(\d+)\s*(?:shots?|strokes?)\b/i);
        let scoreVal = null;
        let matchedTerm = null;

        if (explicitScoreMatch) {
          scoreVal = parseInt(explicitScoreMatch[1]);
          matchedTerm = explicitScoreMatch[0];
        } else {
          const albatrossMatch = clause.match(/\b(?:double\s+eagle|albatross)\b/i);
          if (albatrossMatch) {
            scoreVal = activeHole.par - 3;
            matchedTerm = albatrossMatch[0];
          } else {
            const eagleMatch = clause.match(/\beagle\b/i);
            if (eagleMatch) {
              scoreVal = activeHole.par - 2;
              matchedTerm = eagleMatch[0];
            } else {
              const birdieMatch = clause.match(/\bbirdie\b/i);
              if (birdieMatch) {
                scoreVal = activeHole.par - 1;
                matchedTerm = birdieMatch[0];
              } else {
                const doubleBogeyMatch = clause.match(/\bdouble\s+bogey\b/i);
                if (doubleBogeyMatch) {
                  scoreVal = activeHole.par + 2;
                  matchedTerm = doubleBogeyMatch[0];
                } else {
                  const tripleBogeyMatch = clause.match(/\btriple\s+bogey\b/i);
                  if (tripleBogeyMatch) {
                    scoreVal = activeHole.par + 3;
                    matchedTerm = tripleBogeyMatch[0];
                  } else {
                    const bogeyMatch = clause.match(/\bbogey\b/i);
                    if (bogeyMatch) {
                      scoreVal = activeHole.par + 1;
                      matchedTerm = bogeyMatch[0];
                    } else {
                      const parScoreMatch = clause.match(/\b(?:got|made|shot|had)?\s*a?\s*par(?:red)?\b/i);
                      if (parScoreMatch) {
                        scoreVal = activeHole.par;
                        matchedTerm = parScoreMatch[0];
                      }
                    }
                  }
                }
              }
            }
          }

          if (scoreVal === null) {
            const standaloneDigitMatch = clause.match(/\b(\d+)\b/);
            if (standaloneDigitMatch) {
              scoreVal = parseInt(standaloneDigitMatch[1]);
              matchedTerm = standaloneDigitMatch[0];
            }
          }
        }

        if (scoreVal !== null) {
          activeHole.score = scoreVal;
          activeHole.conceded = false;
          updates.score = scoreVal;

          activeHole.playerScores['You'] = scoreVal;
          activeHole.playerConceded['You'] = false;
          updates.playerUpdates.push({ name: 'You', score: scoreVal });

          clause = clause.replace(matchedTerm, '').trim();
          isStat = true;
        }
      }
    }

    // Clean punctuation from ends of remaining clause
    clause = clause.replace(/^[^a-zA-Z0-9]+|[^a-zA-Z0-9]+$/g, '').trim();

    // 6. Custom Note addition
    if (clause) {
      const cleanNote = cleanNoteText(clause);
      if (cleanNote) {
        const words = cleanNote.toLowerCase().split(/\s+/);
        const stopWords = ['on', 'in', 'at', 'a', 'the', 'i', 'had', 'got', 'made', 'took', 'it', 'for', 'to', 'and', 'then', 'but', 'so', 'of'];
        const onlyStopWords = words.every(word => stopWords.includes(word));

        if (!onlyStopWords && cleanNote.length >= 2) {
          notesToAdd.push(cleanNote);
        }
      }
    }
  }

  // Add notes
  if (notesToAdd.length > 0) {
    if (!activeHole.notes) activeHole.notes = [];
    activeHole.notes.push(...notesToAdd);
    updates.notesCount = notesToAdd.length;
  }

  saveState();
  updateUI();

  // Audio Speech Confirmation Readback
  if (state.useSpeechSynthesis) {
    triggerVoiceConfirmation(updates, activeHole.number);
  }
}

function cleanNoteText(text) {
  let cleaned = text.trim();
  
  // strip out leading voice transition words
  cleaned = cleaned.replace(/^(?:so|then|and|but|i)\s+/i, '');
  cleaned = cleaned.replace(/^(?:hit a|hit the|shot a|shot the)\s+/i, '');
  
  if (cleaned.length > 0) {
    cleaned = cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
    
    // ignore notes that are just empty stats labels
    const lower = cleaned.toLowerCase();
    if (lower === "score" || lower === "putts" || lower === "fairway" || lower === "gir" || lower.match(/^\d+$/)) {
      return null;
    }
    return cleaned;
  }
  return null;
}

// Text-to-speech confirmation speakback
function triggerVoiceConfirmation(updates, activeHoleNum) {
  if (!window.speechSynthesis) return;

  // Cancel any currently queued speak text
  window.speechSynthesis.cancel();

  let message = '';

  if (updates.holeChanged) {
    message += `Hole ${updates.newHoleNum}. `;
  }

  if (updates.playerUpdates && updates.playerUpdates.length > 0) {
    if (!updates.holeChanged && !message.includes('updated')) {
      message += `Hole ${activeHoleNum} updated: `;
    }
    const playerMsgs = [];
    updates.playerUpdates.forEach(pu => {
      if (pu.name === 'You') {
        let youMsg = '';
        if (pu.conceded) {
          youMsg = 'You conceded';
        } else {
          youMsg = `You ${pu.score}`;
        }
        
        let extra = [];
        if (updates.putts !== null) extra.push(`${updates.putts} putt${updates.putts !== 1 ? 's' : ''}`);
        if (updates.fairway !== null) {
          if (updates.fairway === 'HIT') extra.push('fairway hit');
          else if (updates.fairway === 'OB') extra.push('out of bounds');
          else extra.push(`missed fairway ${updates.fairway.toLowerCase()}`);
        }
        if (updates.gir !== null) {
          if (updates.gir === 'YES') extra.push('green hit');
          else extra.push('missed green');
        }
        if (extra.length > 0) {
          youMsg += ` with ${extra.join(', ')}`;
        }
        playerMsgs.push(youMsg);
      } else {
        if (pu.conceded) {
          playerMsgs.push(`${pu.name} conceded`);
        } else {
          playerMsgs.push(`${pu.name} ${pu.score}`);
        }
      }
    });
    message += playerMsgs.join('. ') + '. ';
  } else {
    let statUpdates = [];
    if (updates.score !== null) {
      if (updates.conceded) {
        statUpdates.push('Hole conceded');
      } else {
        statUpdates.push(`Score ${updates.score}`);
      }
    }
    if (updates.putts !== null) statUpdates.push(`${updates.putts} putt${updates.putts !== 1 ? 's' : ''}`);
    
    if (updates.fairway !== null) {
      if (updates.fairway === 'HIT') statUpdates.push('Fairway hit');
      else if (updates.fairway === 'OB') statUpdates.push('Out of bounds off the tee');
      else statUpdates.push(`Missed fairway ${updates.fairway.toLowerCase()}`);
    }
    if (updates.gir !== null) {
      if (updates.gir === 'YES') statUpdates.push('Green hit');
      else statUpdates.push('Missed green');
    }

    if (statUpdates.length > 0) {
      if (!updates.holeChanged) {
        message += `Hole ${activeHoleNum} updated: `;
      }
      message += statUpdates.join(', ') + '. ';
    }
  }

  if (updates.notesCount > 0) {
    message += `Note added.`;
  }

  if (message) {
    const utterance = new SpeechSynthesisUtterance(message);
    utterance.rate = 1.05; // Slightly faster to feel snap
    window.speechSynthesis.speak(utterance);
  }
}

// Summary Report Generation Screen
function calculateAndShowReport(roundData) {
  const holes = roundData ? roundData.holes : state.holes;
  const courseName = roundData ? roundData.courseName : 'Current Active Round';
  const dateStr = roundData ? roundData.date : new Date().toISOString().split('T')[0];

  // Update report header title
  const headerEl = document.querySelector('.report-header h2');
  if (headerEl) {
    headerEl.textContent = roundData 
      ? `REVIEW: ${courseName.toUpperCase()} (${dateStr})` 
      : 'ROUND PERFORMANCE REPORT';
  }

  const totalScoreVal = calculateTotalScore(holes);
  const totalParVal = calculateTotalPar(holes);
  const diff = totalScoreVal - totalParVal;
  
  // Total Score Hero
  document.getElementById('report-total-score').textContent = totalScoreVal;
  const parDiffEl = document.getElementById('report-par-diff');
  
  if (totalScoreVal === 0) {
    parDiffEl.textContent = 'No scores recorded';
    parDiffEl.style.backgroundColor = 'rgba(255,255,255,0.1)';
  } else if (diff === 0) {
    parDiffEl.textContent = 'Even Par';
    parDiffEl.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
  } else {
    parDiffEl.textContent = diff > 0 ? `+${diff} Over Par` : `${diff} Under Par`;
    parDiffEl.style.backgroundColor = diff > 0 ? 'rgba(239, 68, 68, 0.3)' : 'rgba(16, 185, 129, 0.3)';
  }

  // Putts stats card
  const totalPuttsVal = calculateTotalPutts(holes);
  const holesWithPutts = holes.filter(h => h.score > 0 && h.putts > 0).length;
  const avgPuttsVal = holesWithPutts > 0 ? (totalPuttsVal / holesWithPutts).toFixed(1) : '0.0';
  
  document.getElementById('report-total-putts').textContent = totalPuttsVal;
  document.getElementById('report-avg-putts').textContent = avgPuttsVal;

  let threePutts = 0;
  let onePutts = 0;
  holes.forEach(h => {
    if (h.score > 0 && h.putts > 0) {
      if (h.putts >= 3) threePutts++;
      if (h.putts === 1) onePutts++;
    }
  });
  document.getElementById('report-three-putts').textContent = threePutts;
  document.getElementById('report-one-putts').textContent = onePutts;

  // Accuracy stats card
  const fStats = calculateFairwayStats(holes);
  document.getElementById('report-fairways-hit').textContent = fStats.totalHolesWithFairway > 0 ? `${fStats.hitPercent}%` : '-';
  document.getElementById('report-fairway-left').textContent = fStats.left;
  document.getElementById('report-fairway-right').textContent = fStats.right;
  document.getElementById('report-fairway-ob').textContent = fStats.ob;

  const girStats = calculateGIRStats(holes);
  document.getElementById('report-gir-percentage').textContent = girStats.totalHolesWithGIR > 0 ? `${girStats.girPercent}%` : '-';

  // Scoring Distribution chart bars
  let eagles = 0, birdies = 0, pars = 0, bogeys = 0, doubles = 0;
  let playedCount = 0;
  
  holes.forEach(h => {
    if (h.score > 0) {
      playedCount++;
      const scoreDiff = h.score - h.par;
      if (scoreDiff <= -2) eagles++;
      else if (scoreDiff === -1) birdies++;
      else if (scoreDiff === 0) pars++;
      else if (scoreDiff === 1) bogeys++;
      else if (scoreDiff >= 2) doubles++;
    }
  });

  const getWidth = (cnt) => playedCount > 0 ? `${(cnt / playedCount) * 100}%` : '0%';

  document.getElementById('bar-eagles').style.width = getWidth(eagles);
  document.getElementById('count-eagles').textContent = eagles;

  document.getElementById('bar-birdies').style.width = getWidth(birdies);
  document.getElementById('count-birdies').textContent = birdies;

  document.getElementById('bar-pars').style.width = getWidth(pars);
  document.getElementById('count-pars').textContent = pars;

  document.getElementById('bar-bogeys').style.width = getWidth(bogeys);
  document.getElementById('count-bogeys').textContent = bogeys;

  document.getElementById('bar-doubles').style.width = getWidth(doubles);
  document.getElementById('count-doubles').textContent = doubles;

  // Render Hole-by-Hole Review log
  const logContainer = document.getElementById('report-hole-by-hole-log');
  logContainer.innerHTML = '';

  holes.forEach(h => {
    if (h.score > 0) {
      const div = document.createElement('div');
      div.className = 'hole-log-item';
      
      const diffVal = h.score - h.par;
      let scoreLabel = '';
      if (h.conceded) scoreLabel = 'Conceded';
      else if (diffVal === 0) scoreLabel = 'Par';
      else if (diffVal === -1) scoreLabel = 'Birdie';
      else if (diffVal <= -2) scoreLabel = 'Eagle';
      else if (diffVal === 1) scoreLabel = 'Bogey';
      else scoreLabel = 'Double Bogey+';

      const fairwayText = h.fairway !== 'NA' ? `Fairway: ${h.fairway}` : 'Fairway: N/A';
      const girText = h.gir !== 'NA' ? `GIR: ${h.gir}` : 'GIR: N/A';
      const puttsText = h.putts > 0 ? `${h.putts} Putt${h.putts !== 1 ? 's' : ''}` : 'No Putts';
      const notesHTML = h.notes && h.notes.length > 0 
        ? `<div class="hole-log-notes-area"><strong>Notes:</strong> ${h.notes.map(n => escapeHTML(n)).join('; ')}</div>` 
        : '';

      const scoreClass = h.conceded ? 'cell-conceded' : getScoreClass(h);
      const scoreDisplay = h.conceded ? `C (${scoreLabel})` : `${h.score} (${scoreLabel})`;

      div.innerHTML = `
        <div class="hole-log-header">
          <span>Hole ${h.number} (Par ${h.par})</span>
          <span class="${scoreClass}">${scoreDisplay}</span>
        </div>
        <div class="hole-log-stats-row">
          <span>${puttsText}</span>
          <span>&bull;</span>
          <span>${fairwayText}</span>
          <span>&bull;</span>
          <span>${girText}</span>
        </div>
        ${notesHTML}
      `;
      logContainer.appendChild(div);
    }
  });

  if (logContainer.children.length === 0) {
    logContainer.innerHTML = '<p class="empty-notes-text" style="padding:1rem">No holes were scored during this round.</p>';
  }

  // Trigger Coaching Summary
  generateCoachingAssessment(roundData, totalScoreVal, totalParVal, totalPuttsVal, avgPuttsVal, threePutts, fStats, girStats);
}

// Generate Coaching Assessment (Gemini API or local rules engine)
async function generateCoachingAssessment(roundData, totalScore, totalPar, totalPutts, avgPutts, threePutts, fStats, girStats) {
  const coachSpinner = document.getElementById('coach-loading-spinner');
  const coachResponse = document.getElementById('coach-response');

  coachResponse.innerHTML = '';
  
  if (totalScore === 0) {
    coachResponse.innerHTML = '<p>Start recording scores and finish your round to get your golf coach evaluation.</p>';
    return;
  }

  // If Gemini or OpenAI API Key is configured, run AI summary!
  if (state.apiKey || state.openaiApiKey) {
    coachSpinner.classList.remove('hidden');
    
    // package round data structure
    const holes = roundData ? roundData.holes : state.holes;
    const playedHoles = holes.filter(h => h.score > 0).map(h => ({
      hole: h.number,
      par: h.par,
      score: h.score,
      putts: h.putts,
      fairway: h.fairway,
      gir: h.gir,
      conceded: h.conceded || false,
      notes: h.notes
    }));

    const roundSummaryData = {
      courseHolesCount: roundData ? roundData.numHoles : state.numHoles,
      duration: roundData ? (roundData.duration || null) : null,
      summaryStats: {
        totalScore,
        totalPar,
        scoreDiff: totalScore - totalPar,
        totalPutts,
        avgPutts,
        threePuttsCount: threePutts,
        fairwaysHitPercent: fStats.hitPercent,
        fairwayMissLeft: fStats.left,
        fairwayMissRight: fStats.right,
        girPercent: girStats.girPercent
      },
      holeByHole: playedHoles
    };

    try {
      let aiResponse = "";
      if (state.apiKey) {
        aiResponse = await queryGeminiCoach(roundSummaryData, state.apiKey);
      } else {
        aiResponse = await queryOpenAICoach(roundSummaryData, state.openaiApiKey);
      }
      coachResponse.innerHTML = aiResponse;
    } catch (err) {
      console.error(err);
      coachResponse.innerHTML = `
        <p style="color:var(--danger)"><strong>Failed to connect with AI API.</strong> Please check your API Key in Settings.</p>
        <p>Here is your offline Coach Analysis instead:</p>
        <hr style="border:0; border-top:1px solid var(--border-light); margin:1rem 0;">
        ${generateLocalRulesCoachHTML(totalScore, totalPar, avgPutts, threePutts, fStats, girStats, roundData ? roundData.numHoles : state.numHoles)}
      `;
    } finally {
      coachSpinner.classList.add('hidden');
    }
  } else {
    // Show local offline coaching assessment
    coachResponse.innerHTML = generateLocalRulesCoachHTML(totalScore, totalPar, avgPutts, threePutts, fStats, girStats, roundData ? roundData.numHoles : state.numHoles);
  }
}

// Client-Side offline golf coaching engine
function generateLocalRulesCoachHTML(totalScore, totalPar, avgPutts, threePutts, fStats, girStats, numHoles = 9) {
  const scoreDiff = totalScore - totalPar;
  let intro = '';
  let puttingAdvice = '';
  let accuracyAdvice = '';
  let girAdvice = '';
  let practiceRoutine = '';

  const formatText = `${numHoles}-hole round`;

  // 1. Evaluate Overall Score
  if (scoreDiff < 0) {
    intro = `<p><strong>Sensational round!</strong> You finished your ${formatText} at ${Math.abs(scoreDiff)} under par. You are playing high-level golf. Your decisions on the course paid off beautifully.</p>`;
  } else if (scoreDiff === 0) {
    intro = `<p><strong>Superb performance!</strong> Finishing even par over a ${formatText} is a huge milestone. Your consistency kept you focused on making pars and handling course elements well.</p>`;
  } else if (scoreDiff < 10) {
    intro = `<p><strong>Solid effort!</strong> Finishing your ${formatText} at +${scoreDiff} over par means you kept big mistakes off your scorecard. With some minor short-game refinements, you can drop this lower.</p>`;
  } else if (scoreDiff < 20) {
    intro = `<p><strong>Good hustle!</strong> You completed the ${formatText} at +${scoreDiff} over par. You had some great highlights, but a few holes inflated the total. Focus on minimizing damage on par-fours.</p>`;
  } else {
    intro = `<p><strong>Round complete!</strong> You finished the ${formatText} at +${scoreDiff} over par. Golf is a game of recovery. Focus on target alignment and club selection and we will get this down.</p>`;
  }

  // 2. Evaluate Putting (putts/hole, 3-putts)
  const avg = parseFloat(avgPutts);
  if (avg <= 1.7) {
    puttingAdvice = `<li><strong>Putting Masterclass:</strong> Your average of ${avg} putts per hole is excellent. You rolled the ball confidently and minimized distance gaps. Keep up the exact routine!</li>`;
  } else if (avg <= 2.0) {
    puttingAdvice = `<li><strong>Steady Putting:</strong> Averaging ${avg} putts is solid. You managed speed well. ${threePutts > 0 ? `However, you had <strong>${threePutts} three-putt(s)</strong>. Speed control on long lag putts is where we save strokes.` : 'No three-putts today! That is great course management.'}</li>`;
  } else {
    puttingAdvice = `<li><strong>Putting Focus Area:</strong> Averaging ${avg} putts per hole is costing you. With <strong>${threePutts} three-putt(s)</strong>, you are giving away strokes. We need to work on putting alignment and pace.</li>`;
  }

  // 3. Evaluate Driving accuracy
  if (fStats.totalHolesWithFairway > 0) {
    let obWarning = fStats.ob > 0 ? `, but hit <strong>${fStats.ob} shot(s) out of bounds</strong>` : '';
    if (fStats.hitPercent >= 65) {
      accuracyAdvice = `<li><strong>Excellent Off the Tee:</strong> You hit <strong>${fStats.hitPercent}%</strong> of fairways today${obWarning}! Driving was a major strength, putting you in ideal scoring positions.</li>`;
    } else if (fStats.hitPercent >= 45) {
      let missDirection = '';
      if (fStats.left > fStats.right) missDirection = ' (predominantly missing to the left)';
      else if (fStats.right > fStats.left) missDirection = ' (predominantly missing to the right)';
      
      accuracyAdvice = `<li><strong>Decent Driving:</strong> Hitting <strong>${fStats.hitPercent}%</strong> of fairways is respectable${obWarning}. Your misses${missDirection} suggest we check your setup alignment.</li>`;
    } else {
      let missDirection = '';
      if (fStats.left > fStats.right) missDirection = ' (your misses were heavily left)';
      else if (fStats.right > fStats.left) missDirection = ' (your misses were heavily right)';
      
      accuracyAdvice = `<li><strong>Tee Box Struggles:</strong> You hit only <strong>${fStats.hitPercent}%</strong> of fairways${obWarning}${missDirection}. Missing fairways forces tough recovery shots. Focus on hitting a smooth 3-wood or hybrid for safety.</li>`;
    }
  } else {
    accuracyAdvice = '<li><strong>Tee Box:</strong> No fairway data recorded for par 4 or par 5 holes.</li>';
  }

  // 4. Evaluate Greens in Regulation (GIR)
  if (girStats.totalHolesWithGIR > 0) {
    if (girStats.girPercent >= 55) {
      girAdvice = `<li><strong>Strong Iron Play:</strong> Hitting <strong>${girStats.girPercent}%</strong> of greens in regulation is stellar. Your approach yardage was dialed in.</li>`;
    } else if (girStats.girPercent >= 35) {
      girAdvice = `<li><strong>Fair Approach Shots:</strong> Hitting <strong>${girStats.girPercent}%</strong> of greens kept you in play. Practicing approach shots from 100-130 yards will bump this score up.</li>`;
    } else {
      girAdvice = `<li><strong>Green Approach Focus:</strong> Hitting only <strong>${girStats.girPercent}%</strong> of greens means you are relying heavily on chipping to save par. We need to work on iron strike contact.</li>`;
    }
  }

  // 5. Tailored Practice Plan
  if (fStats.ob > 0) {
    practiceRoutine = `
      <p><strong>Practice Plan for Next Session:</strong></p>
      <ul>
        <li><strong>Tee Box Safety Play:</strong> Work on your "fairway finder" shot on the driving range. Practice choking down 1 inch on your driver or hitting a 3-wood, focusing purely on tempo and target visualization rather than maximum distance to prevent lost balls.</li>
        <li><strong>Alignment Discipline:</strong> Always pick an intermediate target 3-5 feet in front of your ball on the tee box and align your clubface directly to it.</li>
      </ul>
    `;
  } else if (avg > 2.0 || threePutts > 1) {
    practiceRoutine = `
      <p><strong>Practice Plan for Next Session:</strong></p>
      <ul>
        <li><strong>30-Minute Lag Putting:</strong> Put 3 golf balls at 30, 40, and 50 feet. Practice rolling them all into a 3-foot circle around the cup. Focus strictly on speed.</li>
        <li><strong>Gate Drills:</strong> Put two tees just wider than your putter head to practice hitting the ball dead-center of the putter face.</li>
      </ul>
    `;
  } else if (fStats.hitPercent < 45 && fStats.totalHolesWithFairway > 0) {
    practiceRoutine = `
      <p><strong>Practice Plan for Next Session:</strong></p>
      <ul>
        <li><strong>Tee Box Target Practice:</strong> On the range, choose two target flags to simulate a fairway width. Practice hitting 15 drives, committing to a specific target line.</li>
        <li><strong>Alignment Check:</strong> Layout an alignment stick on the ground pointing at your target. Ensure your feet, hips, and shoulders are parallel to it.</li>
      </ul>
    `;
  } else {
    practiceRoutine = `
      <p><strong>Practice Plan for Next Session:</strong></p>
      <ul>
        <li><strong>Iron yardage control:</strong> Hit 20 balls with your pitching wedge and 9-iron. Focus on clean contact and repeat tempo rather than max distance.</li>
        <li><strong>Up-and-down drills:</strong> Place 5 balls in various chips around the chipping green. Attempt to chip and putt each one in 2 shots or less.</li>
      </ul>
    `;
  }

  return `
    ${intro}
    <p><strong>Detailed Analysis:</strong></p>
    <ul>
      ${puttingAdvice}
      ${accuracyAdvice}
      ${girAdvice}
    </ul>
    <hr style="border:0; border-top:1px solid var(--border-light); margin:1rem 0;">
    ${practiceRoutine}
  `;
}

// Request content from Gemini API client-side
async function queryGeminiCoach(roundData, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`;
  
  const scoreDiffText = roundData.summaryStats.scoreDiff > 0 
    ? `${roundData.summaryStats.scoreDiff} over par (+${roundData.summaryStats.scoreDiff})` 
    : roundData.summaryStats.scoreDiff < 0 
      ? `${Math.abs(roundData.summaryStats.scoreDiff)} under par (${roundData.summaryStats.scoreDiff})` 
      : 'even par (E)';

  const promptText = `
You are an expert, friendly golf coach. Analyze this golf round performance and provide a professional coaching summary with:
1. Overall summary of the round.
2. Key strengths (what went well based on stats & notes).
3. Areas for improvement (analyzing putts, fairway misses, GIR, and 3-putts).
4. A customized practice plan.

Here is the data for the round:
${JSON.stringify(roundData, null, 2)}

The golfer played a ${roundData.courseHolesCount}-hole round${roundData.duration ? ` which took a duration of ${roundData.duration}` : ''}.
The golfer's total score was ${roundData.summaryStats.totalScore} on a course with a total par of ${roundData.summaryStats.totalPar}. This is ${scoreDiffText}.
Do NOT assume standard course pars (such as par 36 for 9 holes or par 72 for 18 holes). Rely strictly on the actual total par of ${roundData.summaryStats.totalPar} and the score difference of ${scoreDiffText} provided. For example, if a golfer scores 33 on a Par 27 course, they are 6 over par (+6), NOT under par.
Ensure the analysis (especially references to total score, total putts, and pacing/stamina) is contextually appropriate for a ${roundData.courseHolesCount}-hole round.
Provide your response in clean HTML format. Use paragraph tags <p>, list items <li>, bold text <strong>, etc. Do not include a markdown block wrapper (like \`\`\`html) - just output the raw HTML directly. Make the tone encouraging, expert, and constructive.
`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      contents: [{
        parts: [{ text: promptText }]
      }]
    })
  });
  
  if (!response.ok) {
    throw new Error('Gemini API request failed');
  }
  
  const data = await response.json();
  return data.candidates[0].content.parts[0].text;
}

async function queryOpenAICoach(roundData, apiKey) {
  const url = 'https://api.openai.com/v1/chat/completions';
  
  const scoreDiffText = roundData.summaryStats.scoreDiff > 0 
    ? `${roundData.summaryStats.scoreDiff} over par (+${roundData.summaryStats.scoreDiff})` 
    : roundData.summaryStats.scoreDiff < 0 
      ? `${Math.abs(roundData.summaryStats.scoreDiff)} under par (${roundData.summaryStats.scoreDiff})` 
      : 'even par (E)';

  const promptText = `
You are an expert, friendly golf coach. Analyze this golf round performance and provide a professional coaching summary with:
1. Overall summary of the round.
2. Key strengths (what went well based on stats & notes).
3. Areas for improvement (analyzing putts, fairway misses, GIR, and 3-putts).
4. A customized practice plan.

Here is the data for the round:
${JSON.stringify(roundData, null, 2)}

The golfer played a ${roundData.courseHolesCount}-hole round${roundData.duration ? ` which took a duration of ${roundData.duration}` : ''}.
The golfer's total score was ${roundData.summaryStats.totalScore} on a course with a total par of ${roundData.summaryStats.totalPar}. This is ${scoreDiffText}.
Do NOT assume standard course pars (such as par 36 for 9 holes or par 72 for 18 holes). Rely strictly on the actual total par of ${roundData.summaryStats.totalPar} and the score difference of ${scoreDiffText} provided. For example, if a golfer scores 33 on a Par 27 course, they are 6 over par (+6), NOT under par.
Ensure the analysis (especially references to total score, total putts, and pacing/stamina) is contextually appropriate for a ${roundData.courseHolesCount}-hole round.
Provide your response in clean HTML format. Use paragraph tags <p>, list items <li>, bold text <strong>, etc. Do not include a markdown block wrapper (like \`\`\`html) - just output the raw HTML directly. Make the tone encouraging, expert, and constructive.
`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    },
    body: JSON.stringify({
      model: 'gpt-4o-mini',
      messages: [
        { role: 'user', content: promptText }
      ]
    })
  });

  if (!response.ok) {
    throw new Error('OpenAI API request failed');
  }

  const data = await response.json();
  return data.choices[0].message.content.trim();
}

// Helper to escape HTML and prevent XSS injection
function escapeHTML(str) {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Handicap calculation and History Renderer
function calculateHandicapIndex() {
  if (!state.history || state.history.length === 0) {
    return { handicap: 'NH', totalRounds: 0, avgScore: '-', avgPutts: '-' };
  }

  const rounds = state.history;
  const totalRounds = rounds.length;
  
  // Calculate average score and average putts across all rounds
  const totalScoresSum = rounds.reduce((sum, r) => sum + r.totalScore, 0);
  const totalPuttsSum = rounds.reduce((sum, r) => sum + r.totalPutts, 0);
  const avgScore = Math.round(totalScoresSum / totalRounds);
  const avgPutts = (totalPuttsSum / totalRounds).toFixed(1);

  // Calculate WHS differential for each round
  const differentials = rounds.map(r => {
    const rating = r.rating || 72.0;
    const slope = r.slope || 113;
    // Differential = (Score - Rating) * 113 / Slope
    return parseFloat((((r.totalScore - rating) * 113) / slope).toFixed(1));
  });

  // Sort differentials ascending
  differentials.sort((a, b) => a - b);

  // Determine how many differentials to average based on WHS guidelines
  let countToUse = 1;
  let adjustment = 0;

  if (totalRounds === 1) { countToUse = 1; adjustment = -2.0; }
  else if (totalRounds === 2) { countToUse = 2; adjustment = -2.0; }
  else if (totalRounds === 3) { countToUse = 1; adjustment = -2.0; }
  else if (totalRounds === 4) { countToUse = 1; adjustment = -1.0; }
  else if (totalRounds === 5) { countToUse = 1; adjustment = 0; }
  else if (totalRounds === 6) { countToUse = 2; adjustment = -1.0; }
  else if (totalRounds === 7 || totalRounds === 8) { countToUse = 2; }
  else if (totalRounds >= 9 && totalRounds <= 11) { countToUse = 3; }
  else if (totalRounds >= 12 && totalRounds <= 14) { countToUse = 4; }
  else if (totalRounds >= 15 && totalRounds <= 16) { countToUse = 5; }
  else if (totalRounds === 17 || totalRounds === 18) { countToUse = 6; }
  else if (totalRounds === 19) { countToUse = 7; }
  else {
    countToUse = 8;
  }

  // WHS uses the best of the last 20 rounds
  let diffsToSlice = [...differentials];
  if (totalRounds > 20) {
    const last20Rounds = rounds.slice(-20);
    diffsToSlice = last20Rounds.map(r => {
      const rating = r.rating || 72.0;
      const slope = r.slope || 113;
      return parseFloat((((r.totalScore - rating) * 113) / slope).toFixed(1));
    });
    diffsToSlice.sort((a, b) => a - b);
  }

  const chosenDiffs = diffsToSlice.slice(0, countToUse);
  const chosenSum = chosenDiffs.reduce((sum, d) => sum + d, 0);
  let handicapVal = chosenSum / countToUse + adjustment;
  
  handicapVal = parseFloat(handicapVal.toFixed(1));

  const prefix = handicapVal < 0 ? '+' : '';
  const displayHandicap = prefix + Math.abs(handicapVal).toFixed(1);

  return { handicap: displayHandicap, totalRounds, avgScore, avgPutts };
}

function renderHistoryTab() {
  const stats = calculateHandicapIndex();
  document.getElementById('handicap-badge-val').textContent = stats.handicap;
  document.getElementById('handicap-total-rounds').textContent = stats.totalRounds;
  document.getElementById('handicap-avg-score').textContent = stats.avgScore;
  document.getElementById('handicap-avg-putts').textContent = stats.avgPutts;

  const descEl = document.getElementById('handicap-description');
  if (stats.totalRounds === 0) {
    descEl.textContent = 'Play at least 1 round to establish your GolfCaddie handicap.';
  } else if (stats.totalRounds < 3) {
    descEl.textContent = `Handicap index estimated from ${stats.totalRounds} round(s). Play 3+ rounds for a standard index.`;
  } else {
    descEl.textContent = 'Official USGA WHS index calculated based on your historical round differentials.';
  }

  const roundsList = document.getElementById('history-rounds-list');
  roundsList.innerHTML = '';

  if (!state.history || state.history.length === 0) {
    roundsList.innerHTML = '<p class="empty-notes-text" style="padding: 3rem 1rem; text-align: center;">No completed rounds found. Go back to scoring and finish a round to save it here!</p>';
    return;
  }

  const sortedRounds = [...state.history].sort((a, b) => b.id - a.id);

  sortedRounds.forEach(round => {
    const card = document.createElement('div');
    card.className = 'history-card';

    const diffVal = round.totalScore - round.totalPar;
    let scoreClass = 'even-par';
    let diffLabel = 'Even';
    if (diffVal > 0) {
      scoreClass = 'over-par';
      diffLabel = `+${diffVal}`;
    } else if (diffVal < 0) {
      scoreClass = 'under-par';
      diffLabel = diffVal;
    }

    let matchPlaySummaryHtml = '';
    if (round.mode === 'match') {
      const standings = round.matchPlayStandings || calculateMatchPlayStandingsForRound(round);
      if (standings && standings.statusText) {
        matchPlaySummaryHtml = `
          <div class="history-card-matchplay-summary" style="margin-top: 0.4rem; font-size: 0.8rem; color: var(--gold); display: flex; align-items: center; gap: 0.25rem;">
            🏆 <strong>Match Play:</strong> ${escapeHTML(standings.statusText)}
          </div>
        `;
      }
    }

    card.innerHTML = `
      <div class="history-card-main">
        <span class="history-card-course">${escapeHTML(round.courseName)}</span>
        <span class="history-card-date">${escapeHTML(round.date)} &bull; ${round.numHoles} Holes${round.mode === 'match' ? `<span class="badge" style="background: rgba(16, 185, 129, 0.15); color: var(--emerald-glow); font-size: 0.7rem; font-weight: 600; padding: 0.1rem 0.4rem; border-radius: var(--radius-sm); margin-left: 0.5rem;">Match Play</span>` : ''}${round.duration ? ` &bull; ⏱️ ${escapeHTML(round.duration)}` : ''}</span>
        ${matchPlaySummaryHtml}
      </div>
      <div class="history-card-stats">
        <div class="history-card-stat-box">
          <span class="history-card-stat-lbl">Score</span>
          <span class="history-card-stat-val ${scoreClass}">${round.totalScore}</span>
        </div>
        <div class="history-card-stat-box" style="border-left:1px solid var(--border-light); padding-left:1rem;">
          <span class="history-card-stat-lbl">Par Diff</span>
          <span class="history-card-stat-val ${scoreClass}">${diffLabel}</span>
        </div>
        <div class="history-card-stat-box" style="border-left:1px solid var(--border-light); padding-left:1rem;">
          <span class="history-card-stat-lbl">Putts</span>
          <span class="history-card-stat-val">${round.totalPutts}</span>
        </div>
        <div class="history-card-stat-box" style="border-left:1px solid var(--border-light); padding-left:1rem;">
          <span class="history-card-stat-lbl">GIR</span>
          <span class="history-card-stat-val" style="color:var(--emerald-glow);">${round.girPercent}%</span>
        </div>
      </div>
      <div class="history-card-actions">
        <button type="button" class="btn btn-secondary btn-sm btn-review" data-id="${round.id}">Review</button>
        <button type="button" class="btn btn-danger btn-sm btn-delete" data-id="${round.id}">Delete</button>
      </div>
    `;

    card.querySelector('.btn-review').addEventListener('click', (e) => {
      const rId = parseInt(e.currentTarget.dataset.id);
      const foundRound = state.history.find(r => r.id === rId);
      if (foundRound) {
        state.reviewContext = 'history';
        calculateAndShowReport(foundRound);
        
        document.getElementById('active-round-tab-content').classList.remove('hidden');
        document.getElementById('dashboard-view').classList.add('hidden');
        document.getElementById('report-view').classList.remove('hidden');
        document.getElementById('history-tab-content').classList.add('hidden');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    });

    card.querySelector('.btn-delete').addEventListener('click', async (e) => {
      const rId = parseInt(e.currentTarget.dataset.id);
      if (confirm('Are you sure you want to delete this round from your history? This cannot be undone.')) {
        const round = state.history.find(r => r.id === rId);
        if (round) {
          if (round.syncId !== state.syncId) {
            // Participant round: hide locally so it doesn't pull on sync
            if (!state.hiddenRoundIds) state.hiddenRoundIds = [];
            if (!state.hiddenRoundIds.includes(rId)) {
              state.hiddenRoundIds.push(rId);
            }
          } else {
            // Host round: delete from cloud database
            try {
              const docId = `${state.syncId}_${round.id}`;
              const roundDocRef = doc(db, 'rounds', docId);
              await deleteDoc(roundDocRef);
              
              // Remove from user's roundIds list in Firestore
              const userDocRef = doc(db, 'users', state.syncId);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const rIds = userDocSnap.data().roundIds || [];
                const updatedRIds = rIds.filter(id => id !== docId);
                await updateDoc(userDocRef, { roundIds: updatedRIds });
              }
            } catch (err) {
              console.warn("Failed to delete round from cloud database:", err);
            }
          }
        }
        
        state.history = state.history.filter(r => r.id !== rId);
        saveState();
        renderHistoryTab();
      }
    });

    roundsList.appendChild(card);
  });
}

// Sync course configuration to inputs & labels
function applySelectedCourse() {
  const course = state.selectedCourse || MOCK_COURSES[0];
  state.numHoles = course.holesCount || 18;
  
  const newHoles = [];
  for (let i = 1; i <= course.holesCount; i++) {
    const defaultPar = (course.pars && course.pars[i - 1]) || 4;
    if (state.holes && state.holes[i - 1]) {
      const existing = state.holes[i - 1];
      existing.par = defaultPar;
      newHoles.push(existing);
    } else {
      newHoles.push({
        number: i,
        par: defaultPar,
        score: 0,
        putts: 0,
        fairway: 'NA',
        gir: 'NA',
        conceded: false,
        notes: []
      });
    }
  }
  state.holes = newHoles;
  
  const apiInput = document.getElementById('golfapi-key');
  if (apiInput) apiInput.value = state.golfApiKey || '';
  
  const searchInput = document.getElementById('course-search-input');
  if (searchInput) searchInput.value = course.name || '';

  // Pre-fill complete round saving fields
  document.getElementById('save-course-name').value = course.name;
}

// Search endpoint client (GolfCourseAPI.com REST API with mock fallback)
async function searchGolfCourses(query) {
  const lowerQuery = query.toLowerCase();
  
  // Read key dynamically from input field if settings is open, otherwise fall back to state
  const keyInput = document.getElementById('golfapi-key');
  const activeKey = (keyInput && keyInput.value.trim()) || state.golfApiKey;

  // Search custom courses first
  const customCourses = (state.customCourses || []).filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    c.city.toLowerCase().includes(lowerQuery) ||
    c.state.toLowerCase().includes(lowerQuery)
  );

  let results = [...customCourses];

  if (activeKey) {
    try {
      const isNative = Capacitor.isNativePlatform();
      const baseUrl = isNative ? 'https://api.golfcourseapi.com' : '/api-golf';
      const url = `${baseUrl}/v1/search?search_query=${encodeURIComponent(query)}`;
      const authHeader = activeKey.startsWith('Key ') ? activeKey : `Key ${activeKey}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        if (data && data.courses) {
          const remoteResults = data.courses.map(c => {
            return {
              id: c.id,
              name: c.course_name || c.club_name,
              city: (c.location && c.location.city) || '',
              state: (c.location && c.location.state) || '',
              isRemote: true
            };
          });
          results = [...results, ...remoteResults];
          return results;
        }
      } else {
        console.error(`GolfCourseAPI returned status ${response.status}, falling back to local mocks`);
      }
    } catch (e) {
      console.error('Remote GolfCourseAPI search failed, falling back to local mocks', e);
    }
  }

  // Fallback to local mock database matching name, city, or state
  const localMocks = MOCK_COURSES.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    c.city.toLowerCase().includes(lowerQuery) ||
    c.state.toLowerCase().includes(lowerQuery)
  );
  
  results = [...results, ...localMocks];
  return results;
}

// Render search results dropdown items
function renderSearchResults(courses) {
  const dropdown = document.getElementById('course-search-results');
  dropdown.innerHTML = '';
  
  const searchInput = document.getElementById('course-search-input');
  const query = searchInput ? searchInput.value.trim() : '';
  
  if (courses.length === 1 && courses[0].isError) {
    const err = courses[0];
    let msg = 'API Search failed.';
    if (err.status === 401 || err.status === 403) {
      msg = 'Invalid API Key. Check Settings.';
    } else if (err.status) {
      msg = `API Error (Status ${err.status}). Using local courses.`;
    } else {
      msg = 'Connection error. Using local courses.';
    }
    
    dropdown.innerHTML = `
      <div style="padding:0.75rem 1rem; color:var(--danger); font-size:0.85rem; font-weight:600">${msg}</div>
      <div style="border-top:1px solid var(--border-light); padding:0.5rem 1.15rem 0.25rem; font-size:0.75rem; font-weight:700; text-transform:uppercase; color:var(--emerald-glow)">Local Courses</div>
    `;
    
    // Append all mock courses as fallback
    MOCK_COURSES.forEach(course => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      item.innerHTML = `
        <span class="search-result-name">${escapeHTML(course.name)}</span>
        <span class="search-result-details">${escapeHTML(course.city)}, ${escapeHTML(course.state)} &bull; ${course.holesCount} Holes &bull; Rating ${course.rating}</span>
      `;
      item.addEventListener('click', () => {
        handleCourseSelection(course);
      });
      dropdown.appendChild(item);
    });
  } else if (courses.length === 0) {
    dropdown.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--color-secondary); font-size:0.85rem">No courses found.</div>';
  } else {
    courses.forEach(course => {
      const item = document.createElement('div');
      item.className = 'search-result-item';
      
      let detailsText = '';
      if (course.isRemote) {
        detailsText = `${escapeHTML(course.city)}, ${escapeHTML(course.state)} (Remote Course)`;
      } else {
        detailsText = `${escapeHTML(course.city)}, ${escapeHTML(course.state)} &bull; ${course.holesCount} Holes &bull; Rating ${course.rating}`;
      }

      item.innerHTML = `
        <span class="search-result-name">${escapeHTML(course.name)}</span>
        <span class="search-result-details">${detailsText}</span>
      `;
      item.addEventListener('click', () => {
        handleCourseSelection(course);
      });
      dropdown.appendChild(item);
    });
  }
  
  // Append Create Custom Course option if query is at least 2 chars
  if (query.length >= 2) {
    const divider = document.createElement('div');
    divider.style.borderTop = '1px solid var(--border-light)';
    divider.style.margin = '0.25rem 0';
    dropdown.appendChild(divider);

    const customItem = document.createElement('div');
    customItem.className = 'search-result-item';
    customItem.style.color = 'var(--emerald-glow)';
    customItem.style.fontWeight = '600';
    customItem.innerHTML = `
      <span class="search-result-name">➕ Create Custom Course "${escapeHTML(query)}"</span>
      <span class="search-result-details">Add manually and configure holes</span>
    `;
    customItem.addEventListener('click', () => {
      createNewCustomCourse(query);
    });
    dropdown.appendChild(customItem);
  }

  dropdown.classList.remove('hidden');
}

function createNewCustomCourse(name) {
  const customId = "custom_" + Date.now();
  
  let lat = 48.4469; // Default Juan de Fuca area BC
  let lng = -123.4648;
  
  const searchInput = document.getElementById('course-search-input');
  if (searchInput) searchInput.value = name;
  
  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition((pos) => {
      lat = pos.coords.latitude;
      lng = pos.coords.longitude;
      createCourseSync(lat, lng);
    }, (err) => {
      createCourseSync(lat, lng);
    }, { timeout: 1000 });
  } else {
    createCourseSync(lat, lng);
  }

  function createCourseSync(dLat, dLng) {
    const newCourse = {
      id: customId,
      name: name,
      city: "Local",
      state: "Custom",
      rating: 72.0,
      slope: 113,
      holesCount: 9,
      pars: Array(9).fill(4),
      coordinates: { lat: dLat, lng: dLng }
    };
    
    if (!state.customCourses) state.customCourses = [];
    state.customCourses.push(newCourse);
    
    handleCourseSelection(newCourse);
  }
}

// Unified course selection handler (fetches remote details if needed)
async function handleCourseSelection(course) {
  const dropdown = document.getElementById('course-search-results');
  if (dropdown) dropdown.classList.add('hidden');

  if (course.isRemote) {
    try {
      const isNative = Capacitor.isNativePlatform();
      const baseUrl = isNative ? 'https://api.golfcourseapi.com' : '/api-golf';
      const detailUrl = `${baseUrl}/v1/courses/${course.id}`;
      // Read key dynamically from input if open
      const keyInput = document.getElementById('golfapi-key');
      const activeKey = (keyInput && keyInput.value.trim()) || state.golfApiKey;
      const authHeader = activeKey.startsWith('Key ') ? activeKey : `Key ${activeKey}`;
      const response = await fetch(detailUrl, {
        method: 'GET',
        headers: {
          'Authorization': authHeader,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const details = await response.json();
        
        let rating = 72.0;
        let slope = 113;
        let holesCount = 18;
        let pars = [];
        
        const tees = details.tees || {};
        const teeList = tees.male || tees.female || [];
        if (teeList.length > 0) {
          const tee = teeList[0];
          rating = tee.course_rating || 72.0;
          slope = tee.slope_rating || 113;
          holesCount = tee.number_of_holes || 18;
          
          if (tee.holes && tee.holes.length > 0) {
            pars = tee.holes.map(h => h.par || 4);
          } else {
            pars = Array(holesCount).fill(4);
          }
        } else {
          pars = Array(holesCount).fill(4);
        }
        
        let coordinates = { lat: 36.5684, lng: -121.9507 };
        if (details.location && details.location.latitude && details.location.longitude) {
          coordinates = {
            lat: parseFloat(details.location.latitude),
            lng: parseFloat(details.location.longitude)
          };
        }
        
        state.selectedCourse = {
          id: details.id,
          name: details.course_name || details.club_name,
          city: (details.location && details.location.city) || '',
          state: (details.location && details.location.state) || '',
          rating: rating,
          slope: slope,
          holesCount: holesCount,
          pars: pars,
          coordinates: coordinates
        };
      } else {
        throw new Error('Failed to fetch details response');
      }
    } catch (e) {
      console.error('Failed to fetch remote course details, using basic info', e);
      state.selectedCourse = {
        id: course.id,
        name: course.name,
        city: course.city || '',
        state: course.state || '',
        rating: 72.0,
        slope: 113,
        holesCount: 18,
        pars: Array(18).fill(4),
        coordinates: { lat: 36.5684, lng: -121.9507 }
      };
    }
  } else {
    state.selectedCourse = course;
  }
  
  applySelectedCourse();
  initActiveRound();
  saveState();
  updateUI();
  updateGPSWidget();
  renderParsConfig(); // re-draw Settings par inputs
  
  const searchInput = document.getElementById('course-search-input');
  if (searchInput) searchInput.value = state.selectedCourse.name;
}

// Show suggested nearest courses using geolocation
async function showNearestCoursesSuggestions() {
  const dropdown = document.getElementById('course-search-results');
  if (!dropdown) return;

  dropdown.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--color-secondary); font-size:0.85rem">Detecting nearest courses via GPS...</div>';
  dropdown.classList.remove('hidden');

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        
        // Calculate distance for all mock courses
        const coursesWithDistance = MOCK_COURSES.map(course => {
          const dist = calculateHaversineDistanceYards(
            uLat, 
            uLng, 
            course.coordinates.lat, 
            course.coordinates.lng
          );
          return { ...course, distance: dist };
        });

        // Sort ascending by distance
        coursesWithDistance.sort((a, b) => a.distance - b.distance);

        // Render suggested nearest courses
        renderNearestCourses(coursesWithDistance);
      },
      (error) => {
        console.warn('Geolocation failed for nearest courses, showing default list', error);
        // Fallback: show mock courses without distance
        renderNearestCourses(MOCK_COURSES.map(c => ({ ...c, distance: null })));
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  } else {
    // Geolocation not supported, show mock courses without distance
    renderNearestCourses(MOCK_COURSES.map(c => ({ ...c, distance: null })));
  }
}

// Render the suggested nearest courses in search dropdown
function renderNearestCourses(courses) {
  const dropdown = document.getElementById('course-search-results');
  if (!dropdown) return;
  dropdown.innerHTML = '';

  if (courses.length === 0) {
    dropdown.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--color-secondary); font-size:0.85rem">No courses available.</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  // Header for suggestions list
  const header = document.createElement('div');
  header.style.padding = '0.5rem 1.15rem 0.25rem';
  header.style.fontSize = '0.75rem';
  header.style.fontWeight = '700';
  header.style.textTransform = 'uppercase';
  header.style.letterSpacing = '0.05em';
  header.style.color = 'var(--emerald-glow)';
  header.style.borderBottom = '1px solid var(--border-light)';
  header.textContent = '📍 Nearest Courses (GPS)';
  dropdown.appendChild(header);

  courses.forEach(course => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    
    let distanceText = '';
    if (course.distance !== null && course.distance !== undefined) {
      if (course.distance < 1760) {
        distanceText = ` &bull; 📍 ${course.distance} Yds`;
      } else {
        const miles = (course.distance / 1760).toFixed(1);
        distanceText = ` &bull; 📍 ${miles} miles`;
      }
    }

    item.innerHTML = `
      <span class="search-result-name">${escapeHTML(course.name)}</span>
      <span class="search-result-details">${escapeHTML(course.city)}, ${escapeHTML(course.state)} &bull; ${course.holesCount} Holes &bull; Rating ${course.rating}${distanceText}</span>
    `;
    item.addEventListener('click', () => {
      handleCourseSelection(course);
    });
    dropdown.appendChild(item);
  });

  dropdown.classList.remove('hidden');
}

// GPS coordinates helper offset
function getHoleGreenCoordinates(holeNumber) {
  const course = state.selectedCourse || MOCK_COURSES[0];
  const courseId = course.id;
  
  // 1. Check custom pinned green center
  try {
    const mappings = JSON.parse(state.customCourseMappings || '{}');
    if (mappings[courseId] && mappings[courseId][holeNumber] && mappings[courseId][holeNumber].greenCenter) {
      return mappings[courseId][holeNumber].greenCenter;
    }
  } catch (e) {
    console.error("Error reading customCourseMappings", e);
  }

  // 2. Check course-defined coordinates
  if (course.holeCoordinates && course.holeCoordinates[holeNumber - 1]) {
    return course.holeCoordinates[holeNumber - 1];
  }
  if (course.coordinates) {
    const latOffset = 0.0012 * Math.sin(holeNumber * 0.75);
    const lngOffset = 0.0012 * Math.cos(holeNumber * 0.75);
    return {
      lat: course.coordinates.lat + latOffset,
      lng: course.coordinates.lng + lngOffset
    };
  }
  return { lat: 36.5684, lng: -121.9507 };
}

// Haversine formula calculation
function calculateHaversineDistanceYards(lat1, lon1, lat2, lon2) {
  const R = 6371e3; // Earth radius in meters
  const phi1 = (lat1 * Math.PI) / 180;
  const phi2 = (lat2 * Math.PI) / 180;
  const deltaPhi = ((lat2 - lat1) * Math.PI) / 180;
  const deltaLambda = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(deltaPhi / 2) * Math.sin(deltaPhi / 2) +
    Math.cos(phi1) *
      Math.cos(phi2) *
      Math.sin(deltaLambda / 2) *
      Math.sin(deltaLambda / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  const meters = R * c;
  const yards = meters * 1.09361;
  return Math.round(yards);
}

// GPS Rangefinder UI Updater
let isWalkSimulating = false;
let walkDistanceRemaining = 150;

function updateGPSWidget() {
  const course = state.selectedCourse || MOCK_COURSES[0];
  const holeNum = state.currentHoleIndex + 1;
  
  const nameEl = document.getElementById('gps-course-name');
  const detailsEl = document.getElementById('gps-course-details');
  const statusLbl = document.getElementById('gps-status-lbl');
  
  if (!nameEl || !detailsEl) return; // guard against index pages loading script in other views

  nameEl.textContent = course.name;
  
  const currentHole = state.holes[state.currentHoleIndex];
  const parVal = currentHole ? currentHole.par : 4;
  detailsEl.innerHTML = `Hole ${holeNum} &bull; Par ${parVal} &bull; Rating: ${course.rating} &bull; Slope: ${course.slope}`;
  
  const badge = statusLbl ? statusLbl.parentElement : null;

  if (isWalkSimulating) {
    if (badge) badge.classList.remove('offline');
    statusLbl.textContent = "Walk Simulating";
    document.getElementById('gps-dist-val').textContent = walkDistanceRemaining;
    document.getElementById('gps-dist-center').textContent = walkDistanceRemaining;
    document.getElementById('gps-dist-front').textContent = Math.max(0, walkDistanceRemaining - 15);
    document.getElementById('gps-dist-back').textContent = walkDistanceRemaining + 15;
    return;
  }

  if (navigator.geolocation) {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (badge) badge.classList.remove('offline');
        const uLat = position.coords.latitude;
        const uLng = position.coords.longitude;
        const targetCoords = getHoleGreenCoordinates(holeNum);
        const yards = calculateHaversineDistanceYards(uLat, uLng, targetCoords.lat, targetCoords.lng);
        
        statusLbl.textContent = "GPS Sync Active";
        
        document.getElementById('gps-dist-val').textContent = yards;
        document.getElementById('gps-dist-center').textContent = yards;
        document.getElementById('gps-dist-front').textContent = Math.max(0, yards - 15);
        document.getElementById('gps-dist-back').textContent = yards + 15;
      },
      (error) => {
        if (badge) badge.classList.add('offline');
        let msg = "GPS Offline (Unavailable)";
        if (error.code === error.PERMISSION_DENIED) {
          msg = "GPS Offline (Blocked by User)";
        } else if (error.code === error.TIMEOUT) {
          msg = "GPS Offline (Timeout)";
        }
        statusLbl.textContent = msg;
        
        let standardDist = 380;
        if (parVal === 3) {
          standardDist = 145 + ((holeNum * 7) % 40);
        } else if (parVal === 5) {
          standardDist = 490 + ((holeNum * 13) % 80);
        } else {
          standardDist = 360 + ((holeNum * 11) % 90);
        }
        
        document.getElementById('gps-dist-val').textContent = standardDist;
        document.getElementById('gps-dist-center').textContent = standardDist;
        document.getElementById('gps-dist-front').textContent = Math.max(0, standardDist - 15);
        document.getElementById('gps-dist-back').textContent = standardDist + 15;
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  } else {
    if (badge) badge.classList.add('offline');
    statusLbl.textContent = "No GPS support";
    let standardDist = 380;
    if (parVal === 3) {
      standardDist = 145 + ((holeNum * 7) % 40);
    } else if (parVal === 5) {
      standardDist = 490 + ((holeNum * 13) % 80);
    } else {
      standardDist = 360 + ((holeNum * 11) % 90);
    }
    
    document.getElementById('gps-dist-val').textContent = standardDist;
    document.getElementById('gps-dist-center').textContent = standardDist;
    document.getElementById('gps-dist-front').textContent = Math.max(0, standardDist - 15);
    document.getElementById('gps-dist-back').textContent = standardDist + 15;
  }

  // Update Course Mapper UI elements for current hole
  const courseId = course.id;
  let teeCoordsText = 'Not Pinned';
  let greenCoordsText = 'Not Pinned';
  let hasTee = false;
  let hasGreen = false;
  let tLat, tLng, gLat, gLng;
  
  try {
    const mappings = JSON.parse(state.customCourseMappings || '{}');
    if (mappings[courseId] && mappings[courseId][holeNum]) {
      const holeMap = mappings[courseId][holeNum];
      if (holeMap.teeBox) {
        tLat = holeMap.teeBox.lat;
        tLng = holeMap.teeBox.lng;
        teeCoordsText = `${tLat.toFixed(5)}, ${tLng.toFixed(5)}`;
        hasTee = true;
      }
      if (holeMap.greenCenter) {
        gLat = holeMap.greenCenter.lat;
        gLng = holeMap.greenCenter.lng;
        greenCoordsText = `${gLat.toFixed(5)}, ${gLng.toFixed(5)}`;
        hasGreen = true;
      }
    }
  } catch (e) {
    console.error("Error reading custom mappings for UI", e);
  }
  
  const teeEl = document.getElementById('map-tee-coords');
  const greenEl = document.getElementById('map-green-coords');
  if (teeEl) {
    teeEl.textContent = teeCoordsText;
    if (hasTee) {
      teeEl.classList.remove('text-muted');
      teeEl.classList.add('text-emerald');
    } else {
      teeEl.classList.remove('text-emerald');
      teeEl.classList.add('text-muted');
    }
  }
  if (greenEl) {
    greenEl.textContent = greenCoordsText;
    if (hasGreen) {
      greenEl.classList.remove('text-muted');
      greenEl.classList.add('text-emerald');
    } else {
      greenEl.classList.remove('text-emerald');
      greenEl.classList.add('text-muted');
    }
  }
  
  const distInfo = document.getElementById('mapper-distance-info');
  const pinnedDistEl = document.getElementById('map-pinned-dist');
  if (hasTee && hasGreen) {
    const pinnedYards = calculateHaversineDistanceYards(tLat, tLng, gLat, gLng);
    if (pinnedDistEl) pinnedDistEl.textContent = pinnedYards;
    if (distInfo) distInfo.style.display = 'block';
  } else {
    if (distInfo) distInfo.style.display = 'none';
  }
}

// Dynamic walk approach simulator
let walkTimer = null;
function startWalkSimulation() {
  if (walkTimer) clearInterval(walkTimer);
  
  isWalkSimulating = true;
  walkDistanceRemaining = 150;
  updateGPSWidget();

  walkTimer = setInterval(() => {
    if (walkDistanceRemaining > 8) {
      walkDistanceRemaining -= Math.floor(Math.random() * 8) + 6;
      if (walkDistanceRemaining < 8) walkDistanceRemaining = 0;
      updateGPSWidget();
    } else {
      clearInterval(walkTimer);
      walkTimer = null;
      isWalkSimulating = false;
      document.getElementById('gps-dist-val').textContent = "GREEN";
      document.getElementById('gps-dist-center').textContent = "0";
      document.getElementById('gps-dist-front').textContent = "0";
      document.getElementById('gps-dist-back').textContent = "0";
      document.getElementById('gps-status-lbl').textContent = "On Green";
      
      if (state.useSpeechSynthesis && window.speechSynthesis) {
        const utterance = new SpeechSynthesisUtterance("You have arrived on the green.");
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
      }
    }
  }, 1000);
}

// Active Round Timer / Stopwatch Logic
let timerInterval = null;

function initRoundTimer() {
  if (timerInterval) clearInterval(timerInterval);
  if (state.isTimerRunning && state.roundStartTime) {
    timerInterval = setInterval(updateTimerDisplay, 1000);
    updateTimerDisplay();
  } else {
    updateTimerDisplay();
  }
}

function updateTimerDisplay() {
  let elapsedSeconds = state.roundElapsedTime || 0;
  if (state.isTimerRunning && state.roundStartTime) {
    elapsedSeconds += Math.floor((Date.now() - state.roundStartTime) / 1000);
  }
  
  const hours = Math.floor(elapsedSeconds / 3600);
  const minutes = Math.floor((elapsedSeconds % 3600) / 60);
  const seconds = elapsedSeconds % 60;
  
  const pad = (num) => String(num).padStart(2, '0');
  let displayStr = `${pad(minutes)}:${pad(seconds)}`;
  if (hours > 0) {
    displayStr = `${hours}:${pad(minutes)}:${pad(seconds)}`;
  }
  
  const timerEl = document.getElementById('gps-timer-val');
  if (timerEl) timerEl.textContent = displayStr;
  
  const toggleSvg = document.getElementById('timer-toggle-svg');
  if (toggleSvg) {
    if (state.isTimerRunning) {
      // Show Pause Icon
      toggleSvg.innerHTML = `<rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect>`;
    } else {
      // Show Play Icon
      toggleSvg.innerHTML = `<polygon points="8 5 19 12 8 19 8 5"></polygon>`;
    }
  }

  const manualToggleBtn = document.getElementById('btn-manual-timer-toggle');
  if (manualToggleBtn) {
    if (state.isTimerRunning) {
      manualToggleBtn.textContent = '⏸️ Pause';
    } else {
      if (state.roundElapsedTime > 0) {
        manualToggleBtn.textContent = '▶️ Resume';
      } else {
        manualToggleBtn.textContent = '⏱️ Start';
      }
    }
  }
}

function toggleRoundTimer() {
  if (state.isTimerRunning) {
    // Pause
    state.roundElapsedTime += Math.floor((Date.now() - state.roundStartTime) / 1000);
    state.roundStartTime = null;
    state.isTimerRunning = false;
  } else {
    // Resume
    state.roundStartTime = Date.now();
    state.isTimerRunning = true;
  }
  saveState();
  initRoundTimer();
}

// Course Mapping & Pinning Logic
function initCourseMapper() {
  const btnPinTee = document.getElementById('btn-map-pin-tee');
  const btnPinGreen = document.getElementById('btn-map-pin-green');
  
  if (btnPinTee) {
    btnPinTee.addEventListener('click', (e) => {
      e.stopPropagation();
      pinLocation('teeBox');
    });
  }
  if (btnPinGreen) {
    btnPinGreen.addEventListener('click', (e) => {
      e.stopPropagation();
      pinLocation('greenCenter');
    });
  }
}

async function pinLocation(type) {
  const course = state.selectedCourse || MOCK_COURSES[0];
  const holeNum = state.currentHoleIndex + 1;
  const courseId = course.id;
  
  if (!navigator.geolocation) {
    alert("Geolocation is not supported by your browser.");
    return;
  }
  
  const statusLbl = document.getElementById('gps-status-lbl');
  const badge = statusLbl ? statusLbl.parentElement : null;
  
  if (badge) badge.classList.remove('offline');
  if (statusLbl) statusLbl.textContent = "Pinning Location...";
  
  navigator.geolocation.getCurrentPosition(
    async (position) => {
      const uLat = position.coords.latitude;
      const uLng = position.coords.longitude;
      
      let mappings = {};
      try {
        mappings = JSON.parse(state.customCourseMappings || '{}');
      } catch (e) {
        console.error("Failed to parse customCourseMappings", e);
      }
      
      if (!mappings[courseId]) {
        mappings[courseId] = {};
      }
      if (!mappings[courseId][holeNum]) {
        mappings[courseId][holeNum] = {};
      }
      
      mappings[courseId][holeNum][type] = { lat: uLat, lng: uLng };
      state.customCourseMappings = JSON.stringify(mappings);
      
      saveState();
      await saveSettingsToCloud();
      
      if (statusLbl) statusLbl.textContent = "Pinned Successfully!";
      setTimeout(updateGPSWidget, 1500);
    },
    (error) => {
      if (statusLbl) statusLbl.textContent = "Pinning Failed";
      alert("Failed to pin location: " + error.message);
      updateGPSWidget();
    },
    { enableHighAccuracy: true, timeout: 8000, maximumAge: 0 }
  );
}

// Onboarding Guided Tutorial Logic
const ONBOARDING_STEPS = [
  {
    title: "Welcome to GolfCaddie AI! ⛳",
    text: "Let’s take a quick 1-minute tour of your new AI-powered golf caddie. We’ll show you how to log scores, get GPS coordinates, and speak commands to the AI.",
    target: null
  },
  {
    title: "Voice Caddie Assistant 🎙️",
    text: "This is the microphone button. Tap it and speak naturally to command the caddie: e.g. <em>\"Hole 1, score 4, 2 putts\"</em> or <em>\"put me down for a par on hole 2\"</em>. You can also ask <em>\"how far is it?\"</em>.",
    target: "#btn-voice-toggle"
  },
  {
    title: "GPS Rangefinder 🗺️",
    text: "This card shows active GPS distances (Front, Center, Back of green) in real-time. You can also open the 'Course Mapper' details here to manually pin green locations.",
    target: "#gps-rangefinder-card"
  },
  {
    title: "Hole Inputs ✍️",
    text: "You can also manually track scores, putts, fairway hits, and green-in-regulation (GIR) for the active hole here. Tap the notes field to type observations for the AI caddie.",
    target: ".active-hole-section"
  },
  {
    title: "Detailed Scorecard 📊",
    text: "Here is your running scorecard grid. You can tap on any cell (like a specific hole number) to jump straight to that hole and make quick edits.",
    target: ".scorecard-section"
  },
  {
    title: "Settings & Options ⚙️",
    text: "Tap Settings to search/load courses from our database, change game mode to Match Play, configure custom pars, or enable the continuous microphone listening feature.",
    target: "#btn-settings"
  },
  {
    title: "Finish Round 🏆",
    text: "When you finish your round, tap here to save it. The AI caddie will analyze your game and generate a complete performance report with coaching insights!",
    target: ".finish-round-card"
  }
];

let currentTutorialStep = 0;

function startOnboardingTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  if (!overlay) return;
  
  // Close settings dialog if open
  const settingsDialog = document.getElementById('settings-dialog');
  if (settingsDialog && settingsDialog.open) {
    settingsDialog.close();
  }

  currentTutorialStep = 0;
  overlay.classList.remove('hidden');
  showTutorialStep(currentTutorialStep);
}

function showTutorialStep(stepIndex) {
  // Clear any existing highlighted element
  document.querySelectorAll('.tutorial-highlight').forEach(el => {
    el.classList.remove('tutorial-highlight');
  });

  const step = ONBOARDING_STEPS[stepIndex];
  if (!step) {
    stopOnboardingTutorial();
    return;
  }

  const titleEl = document.getElementById('tutorial-step-title');
  const textEl = document.getElementById('tutorial-step-text');
  const prevBtn = document.getElementById('btn-tutorial-prev');
  const nextBtn = document.getElementById('btn-tutorial-next');
  const card = document.getElementById('tutorial-card');

  if (titleEl) titleEl.innerHTML = step.title;
  if (textEl) textEl.innerHTML = step.text;

  // Toggle prev button visibility
  if (stepIndex === 0) {
    if (prevBtn) prevBtn.classList.add('hidden');
  } else {
    if (prevBtn) prevBtn.classList.remove('hidden');
  }

  // Update next button text
  if (nextBtn) {
    if (stepIndex === ONBOARDING_STEPS.length - 1) {
      nextBtn.textContent = "Finish";
    } else {
      nextBtn.textContent = "Next";
    }
  }

  // Draw stepper dots
  const stepper = document.getElementById('tutorial-stepper');
  if (stepper) {
    stepper.innerHTML = '';
    ONBOARDING_STEPS.forEach((_, idx) => {
      const dot = document.createElement('span');
      dot.className = `stepper-dot ${idx === stepIndex ? 'active' : ''}`;
      stepper.appendChild(dot);
    });
  }

  if (step.target) {
    const targetEl = document.querySelector(step.target);
    if (targetEl) {
      targetEl.classList.add('tutorial-highlight');
      
      // Scroll target element into view smoothly
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'center' });

      // Wait for scroll to complete, then position card
      setTimeout(() => {
        positionTutorialCard(targetEl, card);
      }, 350);
    } else {
      centerTutorialCard(card);
    }
  } else {
    centerTutorialCard(card);
  }
}

function centerTutorialCard(card) {
  if (!card) return;
  card.style.top = '50%';
  card.style.left = '50%';
  card.style.transform = 'translate(-50%, -50%)';
  card.style.bottom = 'auto';
  card.className = 'tutorial-card glass-card';
}

function positionTutorialCard(targetEl, card) {
  if (!card || !targetEl) return;
  const rect = targetEl.getBoundingClientRect();
  const viewportHeight = window.innerHeight;
  
  card.style.left = '50%';
  card.style.transform = 'translateX(-50%)';
  card.style.width = '90%';
  card.className = 'tutorial-card glass-card';
  
  if (rect.top + rect.height / 2 < viewportHeight / 2) {
    let topPos = rect.bottom + 16;
    if (topPos + 180 > viewportHeight) {
      topPos = viewportHeight - 190;
    }
    card.style.top = `${topPos}px`;
    card.style.bottom = 'auto';
    card.classList.add('tip-bottom');
  } else {
    let bottomPos = viewportHeight - rect.top + 16;
    if (bottomPos + 180 > viewportHeight) {
      bottomPos = viewportHeight - 190;
    }
    card.style.bottom = `${bottomPos}px`;
    card.style.top = 'auto';
    card.classList.add('tip-top');
  }
}

function stopOnboardingTutorial() {
  const overlay = document.getElementById('tutorial-overlay');
  if (overlay) {
    overlay.classList.add('hidden');
  }

  document.querySelectorAll('.tutorial-highlight').forEach(el => {
    el.classList.remove('tutorial-highlight');
  });

  state.hasCompletedTutorial = true;
  saveState();
  saveSettingsToCloud().catch(err => console.error("Failed to sync tutorial state to Cloud:", err));
}

function initTutorial() {
  const btnNext = document.getElementById('btn-tutorial-next');
  const btnPrev = document.getElementById('btn-tutorial-prev');
  const btnSkip = document.getElementById('btn-tutorial-skip');
  const btnReplay = document.getElementById('btn-replay-tutorial');

  if (btnNext) {
    btnNext.addEventListener('click', () => {
      currentTutorialStep++;
      if (currentTutorialStep >= ONBOARDING_STEPS.length) {
        stopOnboardingTutorial();
      } else {
        showTutorialStep(currentTutorialStep);
      }
    });
  }

  if (btnPrev) {
    btnPrev.addEventListener('click', () => {
      if (currentTutorialStep > 0) {
        currentTutorialStep--;
        showTutorialStep(currentTutorialStep);
      }
    });
  }

  if (btnSkip) {
    btnSkip.addEventListener('click', () => {
      stopOnboardingTutorial();
    });
  }

  if (btnReplay) {
    btnReplay.addEventListener('click', () => {
      startOnboardingTutorial();
    });
  }

  window.addEventListener('resize', () => {
    const overlay = document.getElementById('tutorial-overlay');
    if (overlay && !overlay.classList.contains('hidden')) {
      const step = ONBOARDING_STEPS[currentTutorialStep];
      if (step && step.target) {
        const targetEl = document.querySelector(step.target);
        const card = document.getElementById('tutorial-card');
        if (targetEl && card) {
          positionTutorialCard(targetEl, card);
        }
      }
    }
  });
}

// =========================================================================
// Golf Community Feed Business Logic
// =========================================================================

window.communityUnsubscribe = null;
let activePostCommentsSubscriptions = {};
let postImageBase64 = '';

// Helper to escape HTML to prevent XSS in community
function escapeHtml(str) {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

// Helper to format timestamps nicely
function formatTimeAgo(timestamp) {
  if (!timestamp) return 'Just now';
  let date;
  if (timestamp && typeof timestamp.toDate === 'function') {
    date = timestamp.toDate();
  } else if (timestamp instanceof Date) {
    date = timestamp;
  } else if (timestamp && timestamp.seconds) {
    date = new Date(timestamp.seconds * 1000);
  } else {
    date = new Date(timestamp);
  }
  
  const seconds = Math.floor((new Date() - date) / 1000);
  if (seconds < 60) return 'Just now';
  
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

// Initialize community event listeners (file uploads, posting)
function initCommunityUI() {
  const postImageInput = document.getElementById('community-post-image-input');
  const imagePreviewContainer = document.getElementById('community-post-image-preview-container');
  const imagePreview = document.getElementById('community-post-image-preview');
  const btnClearImage = document.getElementById('btn-clear-post-image');
  const btnSubmitPost = document.getElementById('btn-submit-post');
  const postTextarea = document.getElementById('community-post-text');

  if (postImageInput) {
    postImageInput.addEventListener('change', (e) => {
      const file = e.target.files[0];
      if (!file) return;

      // Validate size (< 800KB for base64 safety in Firestore)
      if (file.size > 800 * 1024) {
        alert("Image is too large. Please select a photo smaller than 800 KB.");
        postImageInput.value = '';
        return;
      }

      const reader = new FileReader();
      reader.onload = (event) => {
        postImageBase64 = event.target.result;
        if (imagePreview) imagePreview.src = postImageBase64;
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'block';
      };
      reader.readAsDataURL(file);
    });
  }

  if (btnClearImage) {
    btnClearImage.addEventListener('click', () => {
      postImageBase64 = '';
      if (postImageInput) postImageInput.value = '';
      if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
      if (imagePreview) imagePreview.src = '';
    });
  }

  if (btnSubmitPost) {
    btnSubmitPost.addEventListener('click', async () => {
      const text = postTextarea.value.trim();
      if (!text && !postImageBase64) {
        alert("Please write a message or attach a photo before posting.");
        return;
      }

      btnSubmitPost.disabled = true;
      btnSubmitPost.textContent = 'Posting...';

      try {
        await createPost(text, postImageBase64);
        
        // Clear input form
        postTextarea.value = '';
        postImageBase64 = '';
        if (postImageInput) postImageInput.value = '';
        if (imagePreviewContainer) imagePreviewContainer.style.display = 'none';
        if (imagePreview) imagePreview.src = '';
      } catch (error) {
        console.error("Failed to share post:", error);
        alert("Failed to share post: " + error.message);
      } finally {
        btnSubmitPost.disabled = false;
        btnSubmitPost.textContent = 'Post';
      }
    });
  }

  // Register tag autocomplete suggestions handler
  const suggestionsBox = document.getElementById('community-tag-suggestions');
  if (postTextarea && suggestionsBox) {
    initTagAutocomplete(postTextarea, suggestionsBox);
  }

  // Register feed filter button click listeners
  const btnFilterAll = document.getElementById('btn-feed-filter-all');
  const btnFilterTagged = document.getElementById('btn-feed-filter-tagged');
  if (btnFilterAll && btnFilterTagged) {
    btnFilterAll.addEventListener('click', () => {
      btnFilterAll.className = 'btn btn-sm btn-primary';
      btnFilterAll.style.flex = '1';
      btnFilterAll.style.padding = '0.45rem 0.75rem';
      btnFilterAll.style.fontWeight = '600';
      
      btnFilterTagged.className = 'btn btn-sm btn-secondary';
      btnFilterTagged.style.flex = '1';
      btnFilterTagged.style.padding = '0.45rem 0.75rem';
      btnFilterTagged.style.fontWeight = '600';
      
      initCommunityFeedListener('all');
    });

    btnFilterTagged.addEventListener('click', () => {
      btnFilterAll.className = 'btn btn-sm btn-secondary';
      btnFilterAll.style.flex = '1';
      btnFilterAll.style.padding = '0.45rem 0.75rem';
      btnFilterAll.style.fontWeight = '600';
      
      btnFilterTagged.className = 'btn btn-sm btn-primary';
      btnFilterTagged.style.flex = '1';
      btnFilterTagged.style.padding = '0.45rem 0.75rem';
      btnFilterTagged.style.fontWeight = '600';
      
      initCommunityFeedListener('tagged');
    });
  }
}

// Add a community listener execution during app initialization
document.addEventListener('DOMContentLoaded', () => {
  initCommunityUI();
});
// Fallback if DOMContentLoaded already fired
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initCommunityUI();
}

// Start real-time snapshot subscription to recent community activity
function initCommunityFeedListener(filterMode = 'all') {
  // If we change filter mode, unsubscribe from the previous one
  if (window.communityUnsubscribe) {
    window.communityUnsubscribe();
    window.communityUnsubscribe = null;
  }

  const feedList = document.getElementById('community-feed-list');
  if (!feedList) return;

  const activeUserLower = (state.username || (auth.currentUser && auth.currentUser.email ? auth.currentUser.email.split('@')[0] : '')).toLowerCase();

  const postsRef = collection(db, 'posts');
  let q = query(postsRef, orderBy('createdAt', 'desc'), limit(50));

  if (filterMode === 'tagged' && activeUserLower) {
    q = query(
      postsRef,
      where('taggedUsernames', 'array-contains', activeUserLower),
      limit(50)
    );
  }

  window.communityUnsubscribe = onSnapshot(q, (snapshot) => {
    feedList.innerHTML = '';
    
    if (snapshot.empty) {
      if (filterMode === 'tagged') {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--color-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">🏷️</div>
            <p>You haven't been tagged in any community posts yet!</p>
          </div>
        `;
      } else {
        feedList.innerHTML = `
          <div style="text-align: center; padding: 3rem 1rem; color: var(--color-secondary);">
            <div style="font-size: 2.5rem; margin-bottom: 0.5rem;">⛳</div>
            <p>No activity yet. Be the first to share something with the community!</p>
          </div>
        `;
      }
      return;
    }

    const posts = [];
    snapshot.forEach((postDoc) => {
      posts.push({
        id: postDoc.id,
        ...postDoc.data()
      });
    });

    // Sort in memory: Pinned posts first, otherwise chronological (newest first)
    posts.sort((a, b) => {
      const dateA = a.createdAt ? (a.createdAt.toDate ? a.createdAt.toDate().getTime() : new Date(a.createdAt).getTime()) : 0;
      const dateB = b.createdAt ? (b.createdAt.toDate ? b.createdAt.toDate().getTime() : new Date(b.createdAt).getTime()) : 0;
      
      const pinA = a.isPinned ? 1 : 0;
      const pinB = b.isPinned ? 1 : 0;

      if (pinA !== pinB) {
        return pinB - pinA;
      }
      return dateB - dateA;
    });

    posts.forEach((post) => {
      const postId = post.id;
      const hasLiked = post.likes && Array.isArray(post.likes) && post.likes.includes(state.syncId);
      const likesCount = post.likes ? post.likes.length : 0;
      const commentsCount = post.commentsCount || 0;
      
      const avatarLetters = (post.username || 'Golfer').substring(0, 2).toUpperCase();

      const youtubeId = extractYouTubeId(post.text);
      const youtubeEmbed = youtubeId ? `
        <div class="youtube-embed-container" style="position: relative; padding-bottom: 56.25%; height: 0; overflow: hidden; border-radius: 8px; margin-top: 0.75rem; border: 1px solid var(--border-light); background: #000; box-shadow: var(--shadow-glow);">
          <iframe src="https://www.youtube.com/embed/${youtubeId}" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; border: 0;" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
        </div>
      ` : '';

      const postCard = document.createElement('div');
      postCard.className = 'glass-card community-post-card' + (post.isPinned ? ' pinned-post' : '');
      postCard.dataset.postId = postId;

      const pinActionBtn = state.isAdmin ? `
        <button class="mod-action-btn pin-toggle" onclick="window.togglePinPost('${postId}', ${!!post.isPinned})" title="${post.isPinned ? 'Unpin Post' : 'Pin Post'}">
          📌
        </button>
      ` : '';

      const deleteActionBtn = state.isAdmin ? `
        <button class="mod-action-btn delete" onclick="window.deletePost('${postId}')" title="Delete Post">
          🗑️
        </button>
      ` : '';

      const pinnedBadge = post.isPinned ? `
        <div style="background: rgba(245, 158, 11, 0.15); color: var(--gold); font-size: 0.7rem; font-weight: 700; padding: 0.2rem 0.5rem; border-radius: 4px; display: inline-flex; align-items: center; gap: 0.25rem; margin-bottom: 0.75rem; width: fit-content; border: 1px solid rgba(245, 158, 11, 0.3);">
          📌 FEATURED
        </div>
      ` : '';

      postCard.innerHTML = `
        <!-- Header -->
        <div class="post-header" style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem;">
          <div style="display: flex; align-items: center; gap: 0.5rem;">
            <div class="post-avatar">${avatarLetters}</div>
            <div class="post-meta">
              <span class="post-author-name">${escapeHtml(post.username || 'Anonymous Golfer')}</span>
              <span class="post-timestamp">${formatTimeAgo(post.createdAt)}</span>
            </div>
          </div>
          <div style="display: flex; gap: 0.25rem;">
            ${pinActionBtn}
            ${deleteActionBtn}
          </div>
        </div>
        
        <!-- Content -->
        <div class="post-body" style="display: flex; flex-direction: column;">
          ${pinnedBadge}
          ${post.text ? `<p class="post-text">${formatTextWithTags(escapeHtml(post.text))}</p>` : ''}
          ${youtubeEmbed}
          ${post.image ? `<img src="${post.image}" class="post-image" alt="Golf Community Post Upload">` : ''}
        </div>
        
        <!-- Actions -->
        <div class="post-actions">
          <button class="post-action-btn like-btn ${hasLiked ? 'liked' : ''}" onclick="window.toggleLikePost('${postId}')">
            <svg class="heart-icon" width="16" height="16" viewBox="0 0 24 24" fill="${hasLiked ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
            <span>${likesCount} Likes</span>
          </button>
          
          <button class="post-action-btn comment-toggle-btn" onclick="window.toggleCommentsView('${postId}')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 11.5a8.38 8.38 0 0 1-.9 3.8 8.5 8.5 0 0 1-7.6 4.7 8.38 8.38 0 0 1-3.8-.9L3 21l1.9-5.7a8.38 8.38 0 0 1-.9-3.8 8.5 8.5 0 0 1 4.7-7.6 8.38 8.38 0 0 1 3.8-.9h.5a8.48 8.48 0 0 1 8 8v.5z"></path></svg>
            <span class="comment-count-text-${postId}">${commentsCount} Comments</span>
          </button>
        </div>
        
        <!-- Comments Drawer -->
        <div class="post-comments-container hidden" id="comments-container-${postId}">
          <div class="comments-list" id="comments-list-${postId}">
            <p style="font-size: 0.8rem; color: var(--color-secondary); padding: 0.5rem 0;">Loading comments...</p>
          </div>
          
          <div class="comment-input-row">
            <input type="text" id="comment-input-${postId}" placeholder="Write a reply..." class="form-input comment-input" maxlength="250">
            <button class="btn btn-primary btn-sm comment-submit-btn" onclick="window.submitComment('${postId}')">Reply</button>
          </div>
        </div>
      `;
      feedList.appendChild(postCard);
    });
  }, (error) => {
    console.error("Community Feed snapshot failed:", error);
    feedList.innerHTML = `<p class="empty-notes-text" style="color: var(--danger); text-align: center;">Unable to load community feed: ${error.message}</p>`;
  });
}

// Create a new post document
async function createPost(text, base64Image) {
  if (!auth.currentUser) {
    alert("You must be logged in to share a post.");
    return;
  }

  let activeUsername = state.username || auth.currentUser.email.split('@')[0] || 'Anonymous';
  let isPinned = false;

  if (state.isAdmin) {
    const handleSelect = document.getElementById('community-post-as-handle');
    if (handleSelect && handleSelect.value !== 'current') {
      activeUsername = handleSelect.value;
    }
    const pinCheck = document.getElementById('community-post-pin');
    if (pinCheck && pinCheck.checked) {
      isPinned = true;
    }
  }

  const taggedList = extractMentions(text || '');

  const postsRef = collection(db, 'posts');
  await addDoc(postsRef, {
    uid: state.syncId,
    username: activeUsername,
    text: text || '',
    image: base64Image || '',
    likes: [],
    commentsCount: 0,
    isPinned: isPinned,
    taggedUsernames: taggedList,
    createdAt: new Date()
  });

  // Reset pin checkbox
  if (state.isAdmin) {
    const pinCheck = document.getElementById('community-post-pin');
    if (pinCheck) pinCheck.checked = false;
  }
}

// Toggle liking a post (adds or removes user's syncId from likes array)
window.toggleLikePost = async function(postId) {
  if (!state.syncId) return;

  const postDocRef = doc(db, 'posts', postId);
  try {
    const postSnap = await getDoc(postDocRef);
    if (!postSnap.exists()) return;

    const postData = postSnap.data();
    const likesList = postData.likes || [];
    const isLiked = likesList.includes(state.syncId);

    await updateDoc(postDocRef, {
      likes: isLiked ? arrayRemove(state.syncId) : arrayUnion(state.syncId)
    });
  } catch (error) {
    console.error("Failed to toggle like:", error);
  }
};

// Toggle comments visibility drawer and setup real-time comment collection subscription
window.toggleCommentsView = function(postId) {
  const container = document.getElementById(`comments-container-${postId}`);
  if (!container) return;

  const isHidden = container.classList.contains('hidden');
  if (isHidden) {
    container.classList.remove('hidden');
    subscribeToComments(postId);
  } else {
    container.classList.add('hidden');
    unsubscribeFromComments(postId);
  }
};

// Start listener for comments subcollection under a specific post doc
function subscribeToComments(postId) {
  if (activePostCommentsSubscriptions[postId]) return; // already listening

  const commentsList = document.getElementById(`comments-list-${postId}`);
  if (!commentsList) return;

  const commentsRef = collection(db, 'posts', postId, 'comments');
  const q = query(commentsRef, orderBy('createdAt', 'asc'));

  activePostCommentsSubscriptions[postId] = onSnapshot(q, (snapshot) => {
    commentsList.innerHTML = '';
    
    if (snapshot.empty) {
      commentsList.innerHTML = `<p style="font-size: 0.8rem; color: var(--color-secondary); padding: 0.5rem 0;">No comments yet. Start the conversation!</p>`;
      updateCommentsCountLabel(postId, 0);
      return;
    }

    let count = 0;
    snapshot.forEach((commentDoc) => {
      count++;
      const comment = commentDoc.data();
      const avatarLetters = (comment.username || 'Golfer').substring(0, 2).toUpperCase();

      const commentItem = document.createElement('div');
      commentItem.className = 'comment-item';
      commentItem.style.display = 'flex';
      commentItem.style.alignItems = 'flex-start';
      commentItem.style.gap = '0.5rem';

      const commentId = commentDoc.id;
      const deleteCommentBtn = state.isAdmin ? `
        <button class="mod-action-btn delete" onclick="window.deleteComment('${postId}', '${commentId}')" title="Delete Comment" style="margin-top: 0.25rem; align-self: center;">
          🗑️
        </button>
      ` : '';

      commentItem.innerHTML = `
        <div class="comment-avatar">${avatarLetters}</div>
        <div class="comment-content-bubble" style="flex: 1;">
          <span class="comment-author-name">${escapeHtml(comment.username)}</span>
          <p class="comment-text">${formatTextWithTags(escapeHtml(comment.text))}</p>
        </div>
        ${deleteCommentBtn}
      `;
      commentsList.appendChild(commentItem);
    });

    // Auto-scroll comment list to bottom
    commentsList.scrollTop = commentsList.scrollHeight;

    // Sync comments count in parent post
    updateCommentsCountLabel(postId, count);
    
    const postDocRef = doc(db, 'posts', postId);
    updateDoc(postDocRef, { commentsCount: count }).catch(err => {
      console.warn("Failed to update parent comment count in cloud document:", err);
    });
  }, (err) => {
    console.error("Comments listener failed:", err);
  });
}

// Unsubscribe helper from comments
function unsubscribeFromComments(postId) {
  if (activePostCommentsSubscriptions[postId]) {
    activePostCommentsSubscriptions[postId]();
    delete activePostCommentsSubscriptions[postId];
  }
}

// Local UI count helper
function updateCommentsCountLabel(postId, count) {
  const label = document.querySelector(`.comment-count-text-${postId}`);
  if (label) {
    label.textContent = `${count} Comments`;
  }
}

// Submit a reply comment
window.submitComment = async function(postId) {
  const input = document.getElementById(`comment-input-${postId}`);
  if (!input) return;

  const text = input.value.trim();
  if (!text) return;

  if (!auth.currentUser) {
    alert("You must be logged in to comment.");
    return;
  }

  const activeUsername = state.username || auth.currentUser.email.split('@')[0] || 'Anonymous';
  const commentSubmitBtn = document.querySelector(`#comments-container-${postId} .comment-submit-btn`);

  if (commentSubmitBtn) commentSubmitBtn.disabled = true;

  try {
    const commentsRef = collection(db, 'posts', postId, 'comments');
    await addDoc(commentsRef, {
      uid: state.syncId,
      username: activeUsername,
      text: text,
      createdAt: new Date()
    });
    input.value = '';
  } catch (error) {
    console.error("Failed to add comment:", error);
    alert("Failed to submit comment: " + error.message);
  } finally {
    if (commentSubmitBtn) commentSubmitBtn.disabled = false;
  }
};

// =========================================================================
// Multi-User Match Play & Stats Discovery Engine
// =========================================================================

window.activeMatchesUnsubscribe = null;
window.dismissedActiveMatchId = null;

// Dynamic active match detection listener
function listenForActiveMatches() {
  if (window.activeMatchesUnsubscribe) {
    window.activeMatchesUnsubscribe();
    window.activeMatchesUnsubscribe = null;
  }

  const activeUsername = state.username || (auth.currentUser && auth.currentUser.email ? auth.currentUser.email.split('@')[0] : '');
  if (!activeUsername) return;

  const activeRoundsRef = collection(db, 'activeRounds');
  const q = query(activeRoundsRef, where('playerUsernames', 'array-contains', activeUsername.toLowerCase()));

  window.activeMatchesUnsubscribe = onSnapshot(q, (snapshot) => {
    if (snapshot.empty) return;
    
    // Skip if user is currently spectating/co-scoring
    if (isSpectating) return;

    snapshot.forEach((docSnap) => {
      const hostSyncId = docSnap.id;
      
      // Skip if user is the host
      if (hostSyncId === state.syncId) return;
      
      // Skip if match has been dismissed previously in this session
      if (window.dismissedActiveMatchId === hostSyncId) return;

      const matchData = docSnap.data();
      // Ensure it is match play
      if (matchData.mode !== 'match') return;

      const hostUsername = matchData.hostUsername || 'Host';
      const courseName = matchData.selectedCourse ? matchData.selectedCourse.name : 'a golf course';

      showActiveMatchNotification(hostSyncId, hostUsername, courseName);
    });
  }, (error) => {
    console.warn("Active matches subscription warning:", error);
  });
}

// Display custom glassmorphic modal offering to join live co-scoring session
function showActiveMatchNotification(hostSyncId, hostUsername, courseName) {
  if (document.getElementById('active-match-popup')) return;

  const popup = document.createElement('div');
  popup.id = 'active-match-popup';
  popup.className = 'glass-card active-match-popup';
  popup.style.position = 'fixed';
  popup.style.top = '50%';
  popup.style.left = '50%';
  popup.style.transform = 'translate(-50%, -50%)';
  popup.style.zIndex = '99999';
  popup.style.padding = '1.5rem';
  popup.style.width = '90%';
  popup.style.maxWidth = '400px';
  popup.style.border = '1px solid var(--border-focus)';
  popup.style.boxShadow = 'var(--shadow-glow)';

  popup.innerHTML = `
    <h3 style="margin-bottom: 0.5rem; color: var(--gold); display: flex; align-items: center; gap: 0.5rem;">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
      <span>Live Match Play</span>
    </h3>
    <p style="font-size: 0.9rem; line-height: 1.45; color: var(--color-primary); margin-bottom: 1.25rem;">
      You have been added to a match play round at <strong>${escapeHtml(courseName)}</strong> by <strong>${escapeHtml(hostUsername)}</strong>. Would you like to connect and co-score in real-time?
    </p>
    <div style="display: flex; gap: 0.75rem; justify-content: flex-end;">
      <button type="button" id="btn-active-match-decline" class="btn btn-secondary btn-sm" style="padding: 0.5rem 1rem;">Dismiss</button>
      <button type="button" id="btn-active-match-accept" class="btn btn-primary btn-sm" style="padding: 0.5rem 1rem; font-weight: 600;">Join Session</button>
    </div>
  `;

  const backdrop = document.createElement('div');
  backdrop.id = 'active-match-backdrop';
  backdrop.style.position = 'fixed';
  backdrop.style.top = '0';
  backdrop.style.left = '0';
  backdrop.style.width = '100vw';
  backdrop.style.height = '100vh';
  backdrop.style.background = 'rgba(0, 0, 0, 0.65)';
  backdrop.style.backdropFilter = 'blur(4px)';
  backdrop.style.zIndex = '99998';

  document.body.appendChild(backdrop);
  document.body.appendChild(popup);

  document.getElementById('btn-active-match-decline').addEventListener('click', () => {
    cleanup();
    window.dismissedActiveMatchId = hostSyncId;
  });

  document.getElementById('btn-active-match-accept').addEventListener('click', () => {
    cleanup();
    const tabActiveRound = document.getElementById('tab-active-round');
    if (tabActiveRound) tabActiveRound.click();
    joinSpectatorMode(hostSyncId, 'collaborator');
  });

  function cleanup() {
    if (popup.parentNode) popup.parentNode.removeChild(popup);
    if (backdrop.parentNode) backdrop.parentNode.removeChild(backdrop);
  }
}

// Calculate match play standings for any historical round object
function calculateMatchPlayStandingsForRound(round) {
  const players = round.players || ['You'];
  const numPlayers = players.length;
  const numHoles = round.numHoles || 9;

  if (round.matchType === 'team' && numPlayers === 4) {
    const p1 = players[0];
    const p2 = players[1];
    const p3 = players[2];
    const p4 = players[3];

    let teamAWon = 0;
    let teamBWon = 0;
    let lastPlayedHole = 0;

    round.holes.forEach(hole => {
      const s1 = (hole.playerScores && hole.playerScores[p1]) || 0;
      const c1 = (hole.playerConceded && hole.playerConceded[p1]) || false;
      const s2 = (hole.playerScores && hole.playerScores[p2]) || 0;
      const c2 = (hole.playerConceded && hole.playerConceded[p2]) || false;
      const s3 = (hole.playerScores && hole.playerScores[p3]) || 0;
      const c3 = (hole.playerConceded && hole.playerConceded[p3]) || false;
      const s4 = (hole.playerScores && hole.playerScores[p4]) || 0;
      const c4 = (hole.playerConceded && hole.playerConceded[p4]) || false;

      const teamA = getTeamBestBall(s1, c1, s2, c2);
      const teamB = getTeamBestBall(s3, c3, s4, c4);

      if (teamA.played || teamB.played) {
        lastPlayedHole = Math.max(lastPlayedHole, hole.number);
      }

      if (teamA.played && teamB.played) {
        if (teamA.conceded && teamB.conceded) {
          // halved
        } else if (teamA.conceded) {
          teamBWon++;
        } else if (teamB.conceded) {
          teamAWon++;
        } else {
          if (teamA.score < teamB.score) teamAWon++;
          if (teamB.score < teamA.score) teamBWon++;
        }
      }
    });

    const holesRemaining = numHoles - lastPlayedHole;
    const diff = teamAWon - teamBWon;
    let statusText = 'All Square';
    const lead = Math.abs(diff);
    let winner = null;
    
    const t1Name = round.team1Name || 'Team A';
    const t2Name = round.team2Name || 'Team B';

    if (lead > holesRemaining) {
      winner = diff > 0 ? t1Name : t2Name;
      statusText = `${winner} won ${lead} & ${holesRemaining}`;
    } else if (lead === holesRemaining && holesRemaining > 0) {
      statusText = diff > 0 ? `${t1Name} Dormie ${lead}` : `${t2Name} Dormie ${lead}`;
    } else if (diff > 0) {
      statusText = `${t1Name} ${lead} Up`;
    } else if (diff < 0) {
      statusText = `${t2Name} ${lead} Up`;
    }

    return { statusText, winner };
  }

  if (numPlayers === 2) {
    const p1 = players[0];
    const p2 = players[1];
    
    let p1Won = 0;
    let p2Won = 0;
    let lastPlayedHole = 0;

    round.holes.forEach(hole => {
      const s1 = (hole.playerScores && hole.playerScores[p1]) || 0;
      const c1 = (hole.playerConceded && hole.playerConceded[p1]) || false;
      const s2 = (hole.playerScores && hole.playerScores[p2]) || 0;
      const c2 = (hole.playerConceded && hole.playerConceded[p2]) || false;
      
      const p1Played = s1 > 0 || c1;
      const p2Played = s2 > 0 || c2;
      
      if (p1Played || p2Played) {
        lastPlayedHole = Math.max(lastPlayedHole, hole.number);
      }

      if (p1Played && p2Played) {
        if (c1 && c2) {
          // halved
        } else if (c1) {
          p2Won++;
        } else if (c2) {
          p1Won++;
        } else {
          if (s1 < s2) p1Won++;
          if (s2 < s1) p2Won++;
        }
      }
    });

    const holesRemaining = numHoles - lastPlayedHole;
    const diff = p1Won - p2Won;
    let statusText = 'All Square';
    const lead = Math.abs(diff);
    let winner = null;
    
    if (lead > holesRemaining) {
      winner = diff > 0 ? p1 : p2;
      statusText = `${winner} won ${lead} & ${holesRemaining}`;
    } else if (lead === holesRemaining && holesRemaining > 0) {
      statusText = diff > 0 ? `${p1} Dormie ${lead}` : `${p2} Dormie ${lead}`;
    } else if (diff > 0) {
      statusText = `${p1} ${lead} Up`;
    } else if (diff < 0) {
      statusText = `${p2} ${lead} Up`;
    }
    
    return { statusText, winner };
  }

  // 3 or 4 players
  const holesWon = {};
  players.forEach(p => { holesWon[p] = 0; });
  let lastPlayedHole = 0;
  
  round.holes.forEach(hole => {
    const played = {};
    let anyPlayed = false;
    players.forEach(p => {
      const score = (hole.playerScores && hole.playerScores[p]) || 0;
      const conceded = (hole.playerConceded && hole.playerConceded[p]) || false;
      if (score > 0 || conceded) {
        played[p] = { score, conceded };
        anyPlayed = true;
      }
    });
    if (anyPlayed) {
      lastPlayedHole = Math.max(lastPlayedHole, hole.number);
      let bestScore = Infinity;
      let winners = [];
      players.forEach(p => {
        if (played[p] && !played[p].conceded) {
          const s = played[p].score;
          if (s < bestScore) {
            bestScore = s;
            winners = [p];
          } else if (s === bestScore) {
            winners.push(p);
          }
        }
      });
      if (winners.length === 1) {
        holesWon[winners[0]]++;
      }
    }
  });

  const leaderboard = players.map(p => ({
    name: p,
    won: holesWon[p] || 0
  })).sort((a, b) => b.won - a.won);

  return {
    statusText: `${leaderboard[0].name} leads (${leaderboard[0].won} holes)`,
    winner: leaderboard[0].name
  };
}

// Search and compute head-to-head match stats between logged-in user and opponent
function analyzeMatchPlayHistory(opponentUsername) {
  const oppNameClean = opponentUsername.trim().toLowerCase();
  const resultsContainer = document.getElementById('matchplay-lookup-results');
  if (!resultsContainer) return;

  if (!oppNameClean) {
    alert("Please enter an opponent's username to analyze.");
    return;
  }

  const myUsername = (state.username || 'You').toLowerCase();

  // Filter history rounds for match play rounds containing both players
  const matches = (state.history || []).filter(round => {
    if (round.mode !== 'match') return false;
    const playerNamesLower = (round.players || []).map(p => p.toLowerCase());
    
    // User can be listed as 'you' or their actual username
    const containsMe = playerNamesLower.includes(myUsername) || playerNamesLower.includes('you');
    const containsOpponent = playerNamesLower.includes(oppNameClean);
    
    return containsMe && containsOpponent;
  });

  resultsContainer.classList.remove('hidden');

  if (matches.length === 0) {
    resultsContainer.innerHTML = `
      <p style="text-align: center; color: var(--color-secondary); font-size: 0.85rem; padding: 0.5rem 0;">
        No match play rounds found with opponent: <strong>${escapeHtml(opponentUsername)}</strong>.
      </p>
    `;
    return;
  }

  let wins = 0;
  let losses = 0;
  let ties = 0;
  let itemsHtml = '';

  matches.forEach(round => {
    const standings = round.matchPlayStandings || calculateMatchPlayStandingsForRound(round);
    const dateStr = round.date;
    const courseName = round.courseName || 'Golf Course';
    
    let outcomeClass = 'draw';
    let outcomeText = 'All Square';

    if (standings.winner) {
      const winnerLower = standings.winner.toLowerCase();
      if (winnerLower === myUsername || winnerLower === 'you' || winnerLower === 'team a') {
        wins++;
        outcomeClass = 'win';
        outcomeText = 'Won';
      } else {
        losses++;
        outcomeClass = 'loss';
        outcomeText = 'Lost';
      }
    } else {
      ties++;
    }

    const marginText = standings.statusText || 'Halved';

    itemsHtml += `
      <div class="lookup-history-item">
        <div style="display: flex; flex-direction: column; gap: 2px;">
          <span class="lookup-history-course">${escapeHtml(courseName)}</span>
          <span class="lookup-history-date">${escapeHtml(dateStr)} &bull; ${escapeHtml(marginText)}</span>
        </div>
        <span class="lookup-history-outcome ${outcomeClass}">${outcomeText}</span>
      </div>
    `;
  });

  const winRate = ((wins / matches.length) * 100).toFixed(0);

  resultsContainer.innerHTML = `
    <div style="margin-bottom: 0.75rem; font-size: 0.9rem;">
      Analyze: <strong>${escapeHtml(state.username || 'You')}</strong> vs <strong>${escapeHtml(opponentUsername)}</strong>
    </div>
    <div class="lookup-stats-grid">
      <div class="lookup-stat-bubble">
        <span class="lookup-stat-lbl">Played</span>
        <span class="lookup-stat-val">${matches.length}</span>
      </div>
      <div class="lookup-stat-bubble">
        <span class="lookup-stat-lbl">Record</span>
        <span class="lookup-stat-val win">${wins}W - ${losses}L</span>
      </div>
      <div class="lookup-stat-bubble">
        <span class="lookup-stat-lbl">Win %</span>
        <span class="lookup-stat-val draw">${winRate}%</span>
      </div>
    </div>
    <div style="font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--color-secondary); margin-bottom: 0.5rem; letter-spacing: 0.05em;">Match History</div>
    <div class="lookup-history-list">
      ${itemsHtml}
    </div>
  `;
}

// Bind lookup stats listeners during initialization
function initMatchPlayLookupUI() {
  const btnLookup = document.getElementById('btn-matchplay-lookup');
  const inputLookup = document.getElementById('matchplay-lookup-username');
  if (btnLookup && inputLookup) {
    btnLookup.addEventListener('click', () => {
      analyzeMatchPlayHistory(inputLookup.value);
    });

    inputLookup.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        analyzeMatchPlayHistory(inputLookup.value);
      }
    });
  }
}

// Execute UI hooks
document.addEventListener('DOMContentLoaded', () => {
  initMatchPlayLookupUI();
});
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initMatchPlayLookupUI();
}

// Admin Moderation Global Functions
window.togglePinPost = async function(postId, currentPinnedState) {
  if (!state.isAdmin) return;
  try {
    const postRef = doc(db, 'posts', postId);
    await updateDoc(postRef, { isPinned: !currentPinnedState });
  } catch (error) {
    console.error("Failed to pin/unpin post:", error);
    alert("Moderation error: " + error.message);
  }
};

window.deletePost = async function(postId) {
  if (!state.isAdmin) return;
  if (confirm("Are you sure you want to delete this post? This will remove it from the community feed permanently.")) {
    try {
      const postRef = doc(db, 'posts', postId);
      await deleteDoc(postRef);
    } catch (error) {
      console.error("Failed to delete post:", error);
      alert("Moderation error: " + error.message);
    }
  }
};

window.deleteComment = async function(postId, commentId) {
  if (!state.isAdmin) return;
  if (confirm("Are you sure you want to delete this comment?")) {
    try {
      const commentRef = doc(db, 'posts', postId, 'comments', commentId);
      await deleteDoc(commentRef);
    } catch (error) {
      console.error("Failed to delete comment:", error);
      alert("Moderation error: " + error.message);
    }
  }
};

// =========================================================================
// Interactive User Tagging & Autocomplete Suggestion Handlers
// =========================================================================

// Regex to match user tags (alphanumeric and underscores, 3-20 characters)
const TAG_REGEX = /@([a-zA-Z0-9_]{3,20})/g;

// Extract tags from post/comment text and normalize them to lowercase
function extractMentions(text) {
  if (!text) return [];
  const matches = [...text.matchAll(TAG_REGEX)];
  const uniqueTags = new Set(matches.map(m => m[1].toLowerCase()));
  return Array.from(uniqueTags);
}

// Convert user tags to clickable span buttons in HTML
function formatTextWithTags(text) {
  if (!text) return '';
  return text.replace(TAG_REGEX, (match, username) => {
    return `<span class="tag-badge" onclick="window.viewTaggedUserStats('${escapeHtml(username)}')">${match}</span>`;
  });
}

// Global click function to view tagged user stats in history page
window.viewTaggedUserStats = function(username) {
  const tabHistory = document.getElementById('tab-history');
  if (tabHistory) tabHistory.click();
  const inputLookup = document.getElementById('matchplay-lookup-username');
  if (inputLookup) {
    inputLookup.value = username;
    analyzeMatchPlayHistory(username);
  }
};

// Initialise autocomplete suggestions listener on input text area
function initTagAutocomplete(textarea, suggestionsBox) {
  textarea.addEventListener('input', async () => {
    const val = textarea.value.substring(0, textarea.selectionStart);
    const atIndex = val.lastIndexOf('@');

    // Check if user is typing a tag token (starts with @ and has no spaces)
    if (atIndex !== -1 && !val.substring(atIndex).includes(' ')) {
      const queryText = val.substring(atIndex + 1).toLowerCase();
      if (queryText.length >= 1) {
        try {
          const usersRef = collection(db, 'users');
          // Standard lexicographical range prefix search
          const q = query(
            usersRef,
            where('username', '>=', queryText),
            where('username', '<=', queryText + '\uf8ff'),
            limit(5)
          );
          const snap = await getDocs(q);

          if (snap.empty) {
            suggestionsBox.classList.add('hidden');
            return;
          }

          suggestionsBox.innerHTML = '';
          suggestionsBox.classList.remove('hidden');

          snap.forEach(userDoc => {
            const uData = userDoc.data();
            const username = uData.username || '';
            const avatarLetters = username.substring(0, 2).toUpperCase();

            const item = document.createElement('div');
            item.className = 'tag-suggestion-item';
            item.innerHTML = `
              <div class="tag-suggestion-avatar">${avatarLetters}</div>
              <span class="tag-suggestion-username">@${escapeHtml(username)}</span>
            `;

            // When selected, replace typing query with chosen tag and close dropdown
            item.addEventListener('click', () => {
              const fullText = textarea.value;
              const before = fullText.substring(0, atIndex);
              const after = fullText.substring(textarea.selectionStart);
              textarea.value = before + '@' + username + ' ' + after;
              suggestionsBox.classList.add('hidden');
              textarea.focus();
            });

            suggestionsBox.appendChild(item);
          });
        } catch (err) {
          console.warn("Tag suggestions query error:", err);
          suggestionsBox.classList.add('hidden');
        }
      } else {
        suggestionsBox.classList.add('hidden');
      }
    } else {
      suggestionsBox.classList.add('hidden');
    }
  });

  // Hide suggestions overlay when clicking outside
  document.addEventListener('click', (e) => {
    if (e.target !== textarea && !suggestionsBox.contains(e.target)) {
      suggestionsBox.classList.add('hidden');
    }
  });
}

// =========================================================================
// Contact Us & Feedback Submission Handler
// =========================================================================
function initContactUsUI() {
  const form = document.getElementById('contact-feedback-form');
  const successMsg = document.getElementById('contact-success-msg');
  if (!form) return;

  const contactNameInput = document.getElementById('contact-name');
  const contactEmailInput = document.getElementById('contact-email');
  
  if (contactNameInput && state.username) {
    contactNameInput.value = state.username;
  }
  if (contactEmailInput && auth.currentUser && auth.currentUser.email) {
    contactEmailInput.value = auth.currentUser.email;
  }

  // Handle auth state changes to update prefill values dynamically
  auth.onAuthStateChanged((user) => {
    if (contactNameInput && state.username) contactNameInput.value = state.username;
    if (contactEmailInput && user && user.email) contactEmailInput.value = user.email;
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const submitBtn = document.getElementById('btn-submit-feedback');
    const nameVal = document.getElementById('contact-name').value.trim();
    const emailVal = document.getElementById('contact-email').value.trim();
    const typeVal = document.getElementById('contact-type').value;
    const messageVal = document.getElementById('contact-message').value.trim();

    if (!nameVal || !emailVal || !messageVal) {
      alert("Please fill out all required fields.");
      return;
    }

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
    }

    try {
      const feedbackRef = collection(db, 'feedback');
      await addDoc(feedbackRef, {
        name: nameVal,
        email: emailVal,
        type: typeVal,
        message: messageVal,
        uid: state.syncId || null,
        createdAt: new Date()
      });

      // Clear message field and show success
      document.getElementById('contact-message').value = '';
      form.classList.add('hidden');
      if (successMsg) successMsg.classList.remove('hidden');

      // Auto-hide success message and show form again after 5 seconds
      setTimeout(() => {
        if (successMsg) successMsg.classList.add('hidden');
        form.classList.remove('hidden');
      }, 5000);
    } catch (err) {
      console.error("Failed to submit feedback:", err);
      alert("Failed to submit feedback: " + err.message);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = 'Submit Feedback';
      }
    }
  });
}

// Hook Contact Us UI initialization globally
document.addEventListener('DOMContentLoaded', () => {
  initContactUsUI();
});
if (document.readyState === 'interactive' || document.readyState === 'complete') {
  initContactUsUI();
}

// Helper to extract YouTube video ID from post/comment body texts
function extractYouTubeId(text) {
  if (!text) return null;
  const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
  const words = text.split(/\s+/);
  for (const word of words) {
    const match = word.match(regExp);
    if (match && match[2].length === 11) {
      return match[2];
    }
  }
  return null;
}
