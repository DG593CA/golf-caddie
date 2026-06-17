import './style.css';
import { db } from './firebase.js';
import { doc, getDoc, setDoc } from 'firebase/firestore';

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
    coordinates: { lat: 48.4469, lng: -123.4648 }
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
  history: []
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
  syncFromCloud();
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
      if (!state.history) state.history = [];
      if (!state.golfApiKey) state.golfApiKey = 'JU7TE2S574463W653KOETCNKH4';
      if (state.openaiApiKey === undefined) state.openaiApiKey = '';
      if (!state.selectedCourse || state.selectedCourse.id === 'mock_pebble') {
        state.selectedCourse = MOCK_COURSES[0];
      }
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
  state.numHoles = 9;
  state.apiKey = '';
  state.golfApiKey = 'JU7TE2S574463W653KOETCNKH4';
  state.openaiApiKey = '';
  state.selectedCourse = MOCK_COURSES[0];
  state.useSpeechSynthesis = true;
  state.isListening = false;
  state.continuous = false;
  state.history = [];
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
      if (userData.apiKey) state.apiKey = userData.apiKey;
      if (userData.openaiApiKey) state.openaiApiKey = userData.openaiApiKey;
      if (userData.golfApiKey) state.golfApiKey = userData.golfApiKey;
      
      // Fetch completed rounds from roundIds
      if (userData.roundIds && userData.roundIds.length > 0) {
        const cloudRounds = [];
        for (const roundDocId of userData.roundIds) {
          const roundDocRef = doc(db, 'rounds', roundDocId);
          const roundSnap = await getDoc(roundDocRef);
          if (roundSnap.exists()) {
            cloudRounds.push(roundSnap.data());
          }
        }
        
        if (cloudRounds.length > 0) {
          if (!state.history) state.history = [];
          
          let modified = false;
          cloudRounds.forEach(cloudRound => {
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
      }
      
      saveState();
      updateUI();
      // Populate inputs in modal if currently open
      const syncInput = document.getElementById('sync-id-input');
      if (syncInput) syncInput.value = state.syncId;
    } else {
      // First time user registration in Cloud database
      await saveSettingsToCloud();
    }
  } catch (error) {
    console.error("Failed to sync from Cloud Firestore:", error);
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
      apiKey: state.apiKey || '',
      openaiApiKey: state.openaiApiKey || '',
      golfApiKey: state.golfApiKey || '',
      roundIds: roundIds,
      createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : new Date(),
      updatedAt: new Date()
    });
    console.log("Settings successfully synced to Cloud.");
  } catch (error) {
    console.error("Failed to save settings to Cloud:", error);
  }
}

async function saveRoundToCloud(archivedRound) {
  if (!state.syncId) return;
  const docId = `${state.syncId}_${archivedRound.id}`;
  try {
    const roundDocRef = doc(db, 'rounds', docId);
    await setDoc(roundDocRef, {
      ...archivedRound,
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
      roundIds: roundIds,
      createdAt: userDocSnap.exists() ? userDocSnap.data().createdAt : new Date(),
      updatedAt: new Date()
    });
    console.log("Round successfully archived in the Cloud database:", docId);
  } catch (error) {
    console.error("Failed to save round to Cloud:", error);
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
      updateUI();
      alert(`Connected successfully! Loaded settings and ${state.history.length} round records.`);
    } else {
      if (confirm("Sync ID does not have any active cloud records yet. Would you like to use this ID for your current cloud session?")) {
        state.syncId = trimmedId;
        await saveSettingsToCloud();
        saveState();
        updateUI();
        alert(`Connected successfully. New Cloud profile initialized with ID: ${trimmedId}`);
      }
    }
  } catch (error) {
    console.error("Failed to connect existing Sync ID:", error);
    alert("Failed to connect. Please check your network connection.");
  }
}

function initActiveRound() {
  state.currentHoleIndex = 0;
  state.holes = [];
  const course = state.selectedCourse || MOCK_COURSES[0];
  state.numHoles = course.holesCount || 18;
  for (let i = 1; i <= state.numHoles; i++) {
    const defaultPar = (course.pars && course.pars[i - 1]) || 4;
    state.holes.push({
      number: i,
      par: defaultPar, // Loaded from course pars
      score: 0,
      putts: 0,
      fairway: 'NA', // NA, HIT, LEFT, RIGHT, OB
      gir: 'NA', // NA, YES, NO
      notes: []
    });
  }
}

function saveState() {
  localStorage.setItem('golf_caddie_state', JSON.stringify(state));
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

  // Settings elements
  const settingsDialog = document.getElementById('settings-dialog');
  document.getElementById('btn-settings').addEventListener('click', () => {
    renderParsConfig();
    document.getElementById('sync-id-input').value = state.syncId || '';
    document.getElementById('gemini-api-key').value = state.apiKey || '';
    document.getElementById('openai-api-key').value = state.openaiApiKey || '';
    document.getElementById('golfapi-key').value = state.golfApiKey || '';
    document.getElementById('course-search-input').value = state.selectedCourse ? state.selectedCourse.name : '';
    if (state.numHoles === 9) {
      document.getElementById('holes-9').checked = true;
    } else {
      document.getElementById('holes-18').checked = true;
    }
    settingsDialog.showModal();
  });

  // Copy sync ID button
  document.getElementById('btn-copy-sync-id').addEventListener('click', () => {
    const syncId = document.getElementById('sync-id-input').value;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(syncId).then(() => {
        alert("Sync ID copied to clipboard!");
      }).catch(err => {
        console.error("Failed to copy Sync ID:", err);
      });
    } else {
      const syncInput = document.getElementById('sync-id-input');
      syncInput.select();
      document.execCommand('copy');
      alert("Sync ID copied to clipboard!");
    }
  });

  // Connect to existing sync ID
  document.getElementById('btn-connect-sync').addEventListener('click', () => {
    const syncId = document.getElementById('sync-id-input').value.trim();
    if (syncId === state.syncId) {
      alert("Already syncing with this ID.");
      return;
    }
    if (confirm("Connecting to another Sync ID will overwrite your current settings and history. Are you sure you want to proceed?")) {
      connectExistingSyncId(syncId);
    }
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

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const numHolesVal = parseInt(document.querySelector('input[name="course-holes"]:checked').value);
    const apiVal = document.getElementById('gemini-api-key').value.trim();
    const openaiApiVal = document.getElementById('openai-api-key').value.trim();
    const golfApiVal = document.getElementById('golfapi-key').value.trim();
    
    // Save settings
    state.apiKey = apiVal;
    state.openaiApiKey = openaiApiVal;
    state.golfApiKey = golfApiVal;
    
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
            notes: []
          });
        }
      }
      if (state.currentHoleIndex >= state.numHoles) {
        state.currentHoleIndex = state.numHoles - 1;
      }
    }
    
    // Save customized pars
    for (let i = 1; i <= state.numHoles; i++) {
      const parInput = document.getElementById(`config-par-h${i}`);
      if (parInput) {
        state.holes[i-1].par = parseInt(parInput.value) || 4;
      }
    }

    saveState();
    saveSettingsToCloud();
    updateUI();
    updateGPSWidget();
    settingsDialog.close();
  });

  // Reset round
  document.getElementById('btn-reset').addEventListener('click', () => {
    if (confirm('Are you sure you want to reset this round? All scores and notes will be deleted.')) {
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
    saveState();
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
  const activeRoundContent = document.getElementById('active-round-tab-content');
  const historyContent = document.getElementById('history-tab-content');

  tabActiveRound.addEventListener('click', () => {
    tabActiveRound.classList.add('active');
    tabActiveRound.setAttribute('aria-selected', 'true');
    tabHistory.classList.remove('active');
    tabHistory.setAttribute('aria-selected', 'false');
    activeRoundContent.classList.remove('hidden');
    historyContent.classList.add('hidden');
    
    // Reset view to show active scoring dashboard and hide performance report
    document.getElementById('dashboard-view').classList.remove('hidden');
    document.getElementById('report-view').classList.add('hidden');
  });

  tabHistory.addEventListener('click', () => {
    tabHistory.classList.add('active');
    tabHistory.setAttribute('aria-selected', 'true');
    tabActiveRound.classList.remove('active');
    tabActiveRound.setAttribute('aria-selected', 'false');
    historyContent.classList.remove('hidden');
    activeRoundContent.classList.add('hidden');
    // Ensure the history page contents are rendered
    renderHistoryTab();
  });

  // Complete round open dialog
  const completeDialog = document.getElementById('complete-round-dialog');
  document.getElementById('btn-complete-round').addEventListener('click', () => {
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
    const courseName = document.getElementById('save-course-name').value.trim();
    const dateVal = document.getElementById('save-round-date').value;
    const ratingVal = parseFloat(document.getElementById('save-course-rating').value) || 72.0;
    const slopeVal = parseInt(document.getElementById('save-course-slope').value) || 113;

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

  // Caddie Assistant Initialization
  initCaddieAssistant();
}

// Caddie AI Assistant Controller
let assistantMicIsRecording = false;
let assistantMediaRecorder = null;
let assistantAudioChunks = [];
let assistantSpeechTimeout = null;
let assistantRecognition = null;

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

    assistantHeader.addEventListener('click', (e) => {
      if (e.target.closest('#btn-assistant-collapse') || !e.target.closest('button')) {
        assistantCard.classList.toggle('collapsed');
        const nowCollapsed = assistantCard.classList.contains('collapsed');
        localStorage.setItem('assistantCardCollapsed', nowCollapsed ? 'true' : 'false');
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

  // Active hole notes bubbles list
  renderNotesList(activeHole);

  // Scorecard table
  renderScorecard();
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

  // Clear previous columns except header row first cell
  headerRow.innerHTML = '<th>Hole</th>';
  parRow.innerHTML = '<td class="row-header">Par</td>';
  scoreRow.innerHTML = '<td class="row-header">Score</td>';
  puttsRow.innerHTML = '<td class="row-header">Putts</td>';
  fairwayRow.innerHTML = '<td class="row-header">Fairway</td>';
  girRow.innerHTML = '<td class="row-header">GIR</td>';

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

    // Score
    const tdScore = document.createElement('td');
    if (isCurrent) tdScore.className = 'active-col';
    tdScore.className += ` cell-val ${getScoreClass(hole)}`;
    tdScore.textContent = hole.score > 0 ? hole.score : '-';
    tdScore.addEventListener('click', () => navigateHole(index));
    scoreRow.appendChild(tdScore);

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
  const activeHole = state.holes[state.currentHoleIndex];
  if (activeHole) {
    activeHole[key] = val;
    saveState();
    updateUI();
  }
}

function addManualNote() {
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
  formData.append('prompt', 'Golf score tracker stats. Terms: hole, score, putts, par, fairway, gir, ob, hit fairway, birdie, bogey, eagle, double bogey, albatross, green in regulation.');
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

  // Phase 2: Process stats commands and extract custom notes
  for (let i = 0; i < clauses.length; i++) {
    let clause = clauses[i].trim();
    if (!clause) continue;

    let isStat = false;

    // 1. Par setting: "par 4", "par 3", "par 5"
    const parMatch = clause.match(/\bpar\s*([345])\b/);
    if (parMatch) {
      const parVal = parseInt(parMatch[1]);
      activeHole.par = parVal;
      clause = clause.replace(parMatch[0], '').trim();
      isStat = true;
    }

    // 2. Putts: "2 putt", "putt 2"
    const puttMatch = clause.match(/\b(\d+)\s*putts?\b/) || clause.match(/\bputts?\s*(\d+)\b/);
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
    const obMatch = clause.match(/\b(?:ob|out\s+of\s+bounds)\b/);
    if (obMatch) {
      activeHole.fairway = "OB";
      updates.fairway = "OB";
      clause = clause.replace(obMatch[0], '').trim();
      isStat = true;
    } else {
      const hitMatch = clause.match(/\b(?:fairway\s+hit|hit\s+fairway|hit\s+the\s+fairway|in\s+the\s+fairway)\b/);
      if (hitMatch) {
        activeHole.fairway = "HIT";
        updates.fairway = "HIT";
        clause = clause.replace(hitMatch[0], '').trim();
        isStat = true;
      } else {
        const leftMatch = clause.match(/\b(?:miss(?:ed)?\s+fairway\s+left|miss(?:ed)?\s+left|fairway\s+left|miss\s+left|miss(?:ed)?\s+the\s+fairway\s+left)\b/);
        if (leftMatch) {
          activeHole.fairway = "LEFT";
          updates.fairway = "LEFT";
          clause = clause.replace(leftMatch[0], '').trim();
          isStat = true;
        } else {
          const rightMatch = clause.match(/\b(?:miss(?:ed)?\s+fairway\s+right|miss(?:ed)?\s+right|fairway\s+right|miss\s+right|miss(?:ed)?\s+the\s+fairway\s+right)\b/);
          if (rightMatch) {
            activeHole.fairway = "RIGHT";
            updates.fairway = "RIGHT";
            clause = clause.replace(rightMatch[0], '').trim();
            isStat = true;
          } else {
            const missMatch = clause.match(/\b(?:miss(?:ed)?\s+fairway|miss(?:ed)?\s+the\s+fairway|fairway\s+miss)\b/);
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
    const girNoMatch = clause.match(/\b(?:miss(?:ed)?\s+the\s+green|miss(?:ed)?\s+green|miss(?:ed)?\s+gir|not\s+on\s+the\s+green|not\s+on\s+green|gir\s+no|no\s+gir)\b/);
    if (girNoMatch) {
      activeHole.gir = "NO";
      updates.gir = "NO";
      clause = clause.replace(girNoMatch[0], '').trim();
      isStat = true;
    } else {
      const girYesMatch = clause.match(/\b(?:green\s+in\s+regulation|gir|hit\s+the\s+green|hit\s+green|on\s+the\s+green|in\s+regulation|gir\s+yes|yes\s+gir)\b/);
      if (girYesMatch) {
        activeHole.gir = "YES";
        updates.gir = "YES";
        clause = clause.replace(girYesMatch[0], '').trim();
        isStat = true;
      }
    }

    // 5. Score
    const explicitScoreMatch = clause.match(/\b(?:score(?:\s+of)?|shot(?:\s+a)?|got(?:\s+a)?|made(?:\s+a)?|took)\s*(\d+)\b/) ||
                                clause.match(/\b(\d+)\s*(?:shots?|strokes?)\b/);
    if (explicitScoreMatch) {
      const scoreVal = parseInt(explicitScoreMatch[1]);
      activeHole.score = scoreVal;
      updates.score = scoreVal;
      clause = clause.replace(explicitScoreMatch[0], '').trim();
      isStat = true;
    } else {
      let scoreVal = null;
      let matchedTerm = null;

      const albatrossMatch = clause.match(/\b(?:double\s+eagle|albatross)\b/);
      if (albatrossMatch) {
        scoreVal = activeHole.par - 3;
        matchedTerm = albatrossMatch[0];
      } else {
        const eagleMatch = clause.match(/\beagle\b/);
        if (eagleMatch) {
          scoreVal = activeHole.par - 2;
          matchedTerm = eagleMatch[0];
        } else {
          const birdieMatch = clause.match(/\bbirdie\b/);
          if (birdieMatch) {
            scoreVal = activeHole.par - 1;
            matchedTerm = birdieMatch[0];
          } else {
            const doubleBogeyMatch = clause.match(/\bdouble\s+bogey\b/);
            if (doubleBogeyMatch) {
              scoreVal = activeHole.par + 2;
              matchedTerm = doubleBogeyMatch[0];
            } else {
              const tripleBogeyMatch = clause.match(/\btriple\s+bogey\b/);
              if (tripleBogeyMatch) {
                scoreVal = activeHole.par + 3;
                matchedTerm = tripleBogeyMatch[0];
              } else {
                const bogeyMatch = clause.match(/\bbogey\b/);
                if (bogeyMatch) {
                  scoreVal = activeHole.par + 1;
                  matchedTerm = bogeyMatch[0];
                } else {
                  const parScoreMatch = clause.match(/\b(?:got|made|shot|had)?\s*a?\s*par(?:red)?\b/);
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

      if (scoreVal !== null) {
        activeHole.score = scoreVal;
        updates.score = scoreVal;
        clause = clause.replace(matchedTerm, '').trim();
        isStat = true;
      } else {
        // Fallback: standalone remaining digit
        const standaloneDigitMatch = clause.match(/\b(\d+)\b/);
        if (standaloneDigitMatch) {
          const scoreVal = parseInt(standaloneDigitMatch[1]);
          activeHole.score = scoreVal;
          updates.score = scoreVal;
          clause = clause.replace(standaloneDigitMatch[0], '').trim();
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

  let statUpdates = [];
  if (updates.score !== null) statUpdates.push(`Score ${updates.score}`);
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
      if (diffVal === 0) scoreLabel = 'Par';
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

      div.innerHTML = `
        <div class="hole-log-header">
          <span>Hole ${h.number} (Par ${h.par})</span>
          <span class="${getScoreClass(h)}">${h.score} (${scoreLabel})</span>
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

  // If Gemini API Key is configured, run AI summary!
  if (state.apiKey) {
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
      notes: h.notes
    }));

    const roundSummaryData = {
      courseHolesCount: roundData ? roundData.numHoles : state.numHoles,
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
      const aiResponse = await queryGeminiCoach(roundSummaryData, state.apiKey);
      coachResponse.innerHTML = aiResponse;
    } catch (err) {
      console.error(err);
      coachResponse.innerHTML = `
        <p style="color:var(--danger)"><strong>Failed to connect with Gemini API.</strong> Please check your API Key in Settings.</p>
        <p>Here is your offline Coach Analysis instead:</p>
        <hr style="border:0; border-top:1px solid var(--border-light); margin:1rem 0;">
        ${generateLocalRulesCoachHTML(totalScore, totalPar, avgPutts, threePutts, fStats, girStats)}
      `;
    } finally {
      coachSpinner.classList.add('hidden');
    }
  } else {
    // Show local offline coaching assessment
    coachResponse.innerHTML = generateLocalRulesCoachHTML(totalScore, totalPar, avgPutts, threePutts, fStats, girStats);
  }
}

// Client-Side offline golf coaching engine
function generateLocalRulesCoachHTML(totalScore, totalPar, avgPutts, threePutts, fStats, girStats) {
  const scoreDiff = totalScore - totalPar;
  let intro = '';
  let puttingAdvice = '';
  let accuracyAdvice = '';
  let girAdvice = '';
  let practiceRoutine = '';

  // 1. Evaluate Overall Score
  if (scoreDiff < 0) {
    intro = `<p><strong>Sensational round!</strong> You finished at ${scoreDiff} under par. You are playing high-level golf. Your decisions on the course paid off beautifully.</p>`;
  } else if (scoreDiff === 0) {
    intro = '<p><strong>Superb performance!</strong> Finishing even par is a huge milestone. Your consistency kept you focused on making pars and handling course elements well.</p>';
  } else if (scoreDiff < 10) {
    intro = `<p><strong>Solid effort!</strong> Finishing +${scoreDiff} over par means you kept big mistakes off your scorecard. With some minor short-game refinements, you can drop this lower.</p>`;
  } else if (scoreDiff < 20) {
    intro = `<p><strong>Good hustle!</strong> You completed the round at +${scoreDiff} over par. You had some great highlights, but a few holes inflated the total. Focus on minimizing damage on par-fours.</p>`;
  } else {
    intro = `<p><strong>Round complete!</strong> You finished at +${scoreDiff} over par. Golf is a game of recovery. Focus on target alignment and club select and we will get this down.</p>`;
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
  
  const promptText = `
You are an expert, friendly golf coach. Analyze this golf round performance and provide a professional coaching summary with:
1. Overall summary of the round.
2. Key strengths (what went well based on stats & notes).
3. Areas for improvement (analyzing putts, fairway misses, GIR, and 3-putts).
4. A customized practice plan.

Here is the data for the round:
${JSON.stringify(roundData, null, 2)}

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

    card.innerHTML = `
      <div class="history-card-main">
        <span class="history-card-course">${escapeHTML(round.courseName)}</span>
        <span class="history-card-date">${escapeHTML(round.date)} &bull; ${round.numHoles} Holes</span>
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

    card.querySelector('.btn-delete').addEventListener('click', (e) => {
      const rId = parseInt(e.currentTarget.dataset.id);
      if (confirm('Are you sure you want to delete this round from your history? This cannot be undone.')) {
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
  document.getElementById('save-course-rating').value = course.rating;
  document.getElementById('save-course-slope').value = course.slope;
}

// Search endpoint client (GolfCourseAPI.com REST API with mock fallback)
async function searchGolfCourses(query) {
  const lowerQuery = query.toLowerCase();
  
  // Read key dynamically from input field if settings is open, otherwise fall back to state
  const keyInput = document.getElementById('golfapi-key');
  const activeKey = (keyInput && keyInput.value.trim()) || state.golfApiKey;

  if (activeKey) {
    try {
      const url = `/api-golf/v1/search?search_query=${encodeURIComponent(query)}`;
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
        // Parse and return structured clubs list
        if (data && data.courses) {
          // Map response fields to standard structure
          return data.courses.map(c => {
            return {
              id: c.id,
              name: c.course_name || c.club_name,
              city: (c.location && c.location.city) || '',
              state: (c.location && c.location.state) || '',
              isRemote: true
            };
          });
        }
      } else {
        console.error(`GolfCourseAPI returned status ${response.status}`);
        return [{ isError: true, status: response.status }];
      }
    } catch (e) {
      console.error('Remote GolfCourseAPI search failed, falling back to local mocks', e);
      return [{ isError: true, message: e.message }];
    }
  }

  // Fallback to local mock database matching name, city, or state
  return MOCK_COURSES.filter(c => 
    c.name.toLowerCase().includes(lowerQuery) ||
    c.city.toLowerCase().includes(lowerQuery) ||
    c.state.toLowerCase().includes(lowerQuery)
  );
}

// Render search results dropdown items
function renderSearchResults(courses) {
  const dropdown = document.getElementById('course-search-results');
  dropdown.innerHTML = '';
  
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
    dropdown.classList.remove('hidden');
    return;
  }

  if (courses.length === 0) {
    dropdown.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--color-secondary); font-size:0.85rem">No courses found.</div>';
    dropdown.classList.remove('hidden');
    return;
  }

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
  
  dropdown.classList.remove('hidden');
}

// Unified course selection handler (fetches remote details if needed)
async function handleCourseSelection(course) {
  const dropdown = document.getElementById('course-search-results');
  if (dropdown) dropdown.classList.add('hidden');

  if (course.isRemote) {
    try {
      const detailUrl = `/api-golf/v1/courses/${course.id}`;
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
        
        const tees = details.tees || {};
        const teeList = tees.male || tees.female || [];
        if (teeList.length > 0) {
          const tee = teeList[0];
          rating = tee.course_rating || 72.0;
          slope = tee.slope_rating || 113;
          holesCount = tee.number_of_holes || 18;
        }
        
        let coordinates = { lat: 36.5684, lng: -121.9507 };
        if (details.location && details.location.latitude && details.location.longitude) {
          coordinates = {
            lat: parseFloat(details.location.latitude),
            lng: parseFloat(details.location.longitude)
          };
        }
        
        const pars = Array(holesCount).fill(4);
        
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
  
  if (isWalkSimulating) {
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
        statusLbl.textContent = "GPS Offline (Blocked)";
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
