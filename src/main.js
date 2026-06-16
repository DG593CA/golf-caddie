import './style.css';

// Mock Golf Courses Database
const MOCK_COURSES = [
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

// Core State Definition
let state = {
  numHoles: 18,
  currentHoleIndex: 0,
  apiKey: '',
  golfApiKey: '',
  selectedCourse: null,
  useSpeechSynthesis: true,
  isListening: false,
  continuous: false,
  holes: []
};

// Speech Recognition Variables
let recognition = null;
let speechTimeout = null;

// Initialize App
function initApp() {
  loadState();
  initUI();
  initSpeechRecognition();
  applySelectedCourse();
  updateUI();
  updateGPSWidget();
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
      if (!state.history) state.history = [];
      if (state.golfApiKey === undefined) state.golfApiKey = '';
      if (!state.selectedCourse) state.selectedCourse = MOCK_COURSES[0];
    } catch (e) {
      console.error('Failed to parse saved state, loading defaults', e);
      initDefaultState();
    }
  } else {
    initDefaultState();
  }
}

function initDefaultState() {
  state.numHoles = 18;
  state.apiKey = '';
  state.golfApiKey = '';
  state.selectedCourse = MOCK_COURSES[0];
  state.useSpeechSynthesis = true;
  state.isListening = false;
  state.continuous = false;
  state.history = [];
  initActiveRound();
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
    document.getElementById('gemini-api-key').value = state.apiKey || '';
    document.getElementById('golfapi-key').value = state.golfApiKey || '';
    document.getElementById('course-search-input').value = state.selectedCourse ? state.selectedCourse.name : '';
    if (state.numHoles === 9) {
      document.getElementById('holes-9').checked = true;
    } else {
      document.getElementById('holes-18').checked = true;
    }
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

  document.getElementById('settings-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const numHolesVal = parseInt(document.querySelector('input[name="course-holes"]:checked').value);
    const apiVal = document.getElementById('gemini-api-key').value.trim();
    const golfApiVal = document.getElementById('golfapi-key').value.trim();
    
    // Save settings
    state.apiKey = apiVal;
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

  // Autocomplete Search input handler
  const searchInput = document.getElementById('course-search-input');
  const searchResults = document.getElementById('course-search-results');
  
  let searchTimeoutId = null;
  searchInput.addEventListener('input', (e) => {
    const query = e.target.value.trim();
    if (searchTimeoutId) clearTimeout(searchTimeoutId);

    if (query.length < 2) {
      searchResults.classList.add('hidden');
      return;
    }

    searchTimeoutId = setTimeout(async () => {
      const courses = await searchGolfCourses(query);
      renderSearchResults(courses);
    }, 300);
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
      // Don't show scary error for just silence
      if (!state.continuous) {
        state.isListening = false;
        stopListeningUI();
        transcriptBox.innerHTML = '<p class="transcript-placeholder">Silence detected. Tap mic to try again.</p>';
      }
    } else {
      transcriptBox.innerHTML = `<p class="transcript-placeholder" style="color:var(--danger)">Error: ${event.error}</p>`;
      if (!state.continuous) {
        state.isListening = false;
        stopListeningUI();
      }
    }
  };

  recognition.onend = () => {
    // If continuous mode is enabled and state still listening, restart it!
    if (state.continuous && state.isListening) {
      try {
        recognition.start();
      } catch (e) {
        console.error('Failed to restart speech recognition', e);
      }
    } else {
      state.isListening = false;
      stopListeningUI();
    }
  };

  // Bind microphone button click toggle
  document.getElementById('btn-voice-toggle').addEventListener('click', () => {
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

// Golf Spoken Text Parser
function processFinalTranscript(transcript) {
  if (!transcript || !transcript.trim()) return;

  // Split the transcript into clauses by pauses or connectors
  const clauses = transcript.split(/\b(?:and|then|but)\b|[,.;?!]+/i);
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

  // Phase 1: Check for navigation in any of the clauses first, so we record stats on the correct hole
  for (let clause of clauses) {
    clause = clause.trim().toLowerCase();
    if (!clause) continue;

    // Check navigation Match
    const navigateHoleMatch = clause.match(/(?:go to|select)?\s*hole\s*(\d+)/);
    if (navigateHoleMatch) {
      const holeNum = parseInt(navigateHoleMatch[1]);
      if (holeNum >= 1 && holeNum <= state.numHoles) {
        state.currentHoleIndex = holeNum - 1;
        updates.holeChanged = true;
        updates.newHoleNum = holeNum;
      }
    } else if (clause.includes("next hole") || clause.includes("go to next")) {
      if (state.currentHoleIndex < state.numHoles - 1) {
        state.currentHoleIndex++;
        updates.holeChanged = true;
        updates.newHoleNum = state.currentHoleIndex + 1;
      }
    } else if (clause.includes("previous hole") || clause.includes("go back") || clause.includes("prev hole")) {
      if (state.currentHoleIndex > 0) {
        state.currentHoleIndex--;
        updates.holeChanged = true;
        updates.newHoleNum = state.currentHoleIndex + 1;
      }
    }
  }

  // Get active hole object (might be newly navigated to)
  const activeHole = state.holes[state.currentHoleIndex];
  if (!activeHole) return;

  // Phase 2: Process stats commands and extract custom notes
  for (let clause of clauses) {
    clause = clause.trim();
    if (!clause) continue;

    const lowerClause = clause.toLowerCase();

    // Skip pure navigation statements already handled
    if (isPureNavigation(lowerClause)) {
      continue;
    }

    let isStat = false;

    // 1. Check Par settings: "par 4", "par 3"
    const parMatch = lowerClause.match(/\bpar\s*(3|4|5)\b/);
    if (parMatch) {
      const parVal = parseInt(parMatch[1]);
      activeHole.par = parVal;
      isStat = true;
    }

    // 2. Check Score
    const scoreVal = parseScore(lowerClause, activeHole.par);
    if (scoreVal !== null) {
      activeHole.score = scoreVal;
      updates.score = scoreVal;
      isStat = true;
    }

    // 3. Check Putts
    const puttsVal = parsePutts(lowerClause);
    if (puttsVal !== null) {
      activeHole.putts = puttsVal;
      updates.putts = puttsVal;
      isStat = true;
    }

    // 4. Check Fairway
    const fairwayVal = parseFairway(lowerClause);
    if (fairwayVal !== null) {
      activeHole.fairway = fairwayVal;
      updates.fairway = fairwayVal;
      isStat = true;
    }

    // 5. Check GIR
    const girVal = parseGIR(lowerClause);
    if (girVal !== null) {
      activeHole.gir = girVal;
      updates.gir = girVal;
      isStat = true;
    }

    // If no stats matched, it's a general description
    if (!isStat) {
      const cleanNote = cleanNoteText(clause);
      if (cleanNote) {
        notesToAdd.push(cleanNote);
      }
    }
  }

  // Add notes if any
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

// Navigation pattern detector
function isPureNavigation(clause) {
  if (clause.match(/^\s*(?:go to|select)?\s*hole\s*\d+\s*$/)) return true;
  if (clause.trim() === "next hole" || clause.trim() === "go to next") return true;
  if (clause.trim() === "previous hole" || clause.trim() === "go back" || clause.trim() === "prev hole") return true;
  return false;
}

// Regex extraction functions
function parseScore(text, currentPar) {
  // numeric score match: "score 4", "shot a 5"
  const numMatch = text.match(/(?:score(?:\s+of)?|shot(?:\s+a)?|got(?:\s+a)?|made(?:\s+a)?|took)\s*(\d+)/);
  if (numMatch) return parseInt(numMatch[1]);

  // word numbers matching score: "score five", "shot four"
  const wordScoreMatch = text.match(/(?:score|shot|got|made|took)\s*(one|two|three|four|five|six|seven|eight|nine|ten)/);
  if (wordScoreMatch) {
    return wordToNumber(wordScoreMatch[1]);
  }

  // Standalone numbers: if the clause is literally just a single number, e.g. "4" or "five"
  if (text.match(/^\s*\d+\s*$/)) {
    return parseInt(text.trim());
  }
  const wordVal = wordToNumber(text.trim());
  if (wordVal !== null && text.trim().split(/\s+/).length === 1) {
    return wordVal;
  }

  // Golf terms
  if (text.includes("double eagle") || text.includes("albatross")) return currentPar - 3;
  if (text.includes("eagle")) return currentPar - 2;
  if (text.includes("birdie")) return currentPar - 1;
  if (text.includes("double bogey")) return currentPar + 2;
  if (text.includes("triple bogey")) return currentPar + 3;
  if (text.includes("bogey")) return currentPar + 1;
  
  // Standalone par (avoiding "par 4")
  if (text.includes("par") && !text.match(/par\s*[345]/)) {
    if (text.includes("parred") || text.includes("got a par") || text.includes("made a par") || text.trim() === "par") {
      return currentPar;
    }
  }

  return null;
}

function parsePutts(text) {
  // numeric putt match: "2 putts", "1 putt"
  const numMatch = text.match(/(\d+)\s*putt/);
  if (numMatch) return parseInt(numMatch[1]);

  // word numbers matching putt: "two putts", "one putt"
  const wordPuttMatch = text.match(/(one|two|three|four|five|six)\s*putt/);
  if (wordPuttMatch) {
    return wordToNumber(wordPuttMatch[1]);
  }

  // "putted twice" or "putted once"
  if (text.includes("putted once") || text.includes("single putt")) return 1;
  if (text.includes("putted twice") || text.includes("two putt") || text.includes("two-putt")) return 2;
  if (text.includes("three putted") || text.includes("three putt") || text.includes("three-putt")) return 3;

  return null;
}

function parseFairway(text) {
  if (text.includes("out of bounds") || text.includes("o.b.") || text.includes("ob") || text.includes("o b") || text.includes("hit it ob") || text.includes("shot out of bounds")) {
    return "OB";
  }
  if (text.includes("fairway hit") || text.includes("hit fairway") || text.includes("hit the fairway") || text.includes("in the fairway")) {
    return "HIT";
  }
  if (text.includes("missed fairway left") || text.includes("missed left") || text.includes("fairway left") || text.includes("miss left") || text.includes("missed the fairway left")) {
    return "LEFT";
  }
  if (text.includes("missed fairway right") || text.includes("missed right") || text.includes("fairway right") || text.includes("miss right") || text.includes("missed the fairway right")) {
    return "RIGHT";
  }
  if (text.includes("missed fairway") || text.includes("missed the fairway") || text.includes("fairway miss")) {
    return "LEFT"; // Default miss direction
  }
  return null;
}

function parseGIR(text) {
  if (text.includes("green in regulation") || text.includes("gir") || text.includes("hit the green") || text.includes("hit green") || text.includes("on the green") || text.includes("in regulation")) {
    return "YES";
  }
  if (text.includes("missed the green") || text.includes("missed green") || text.includes("missed gir") || text.includes("not on the green")) {
    return "NO";
  }
  return null;
}

function wordToNumber(word) {
  const map = {
    one: 1, two: 2, three: 3, four: 4, five: 5,
    six: 6, seven: 7, eight: 8, nine: 9, ten: 10
  };
  return map[word.trim().toLowerCase()] || null;
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

// Search endpoint client (GolfAPI.io REST API with mock fallback)
async function searchGolfCourses(query) {
  const lowerQuery = query.toLowerCase();
  
  // If user configured GolfAPI.io key, fetch from remote database!
  if (state.golfApiKey) {
    try {
      const url = `https://golfapi.io/api/v1/clubs?name=${encodeURIComponent(query)}`;
      const response = await fetch(url, {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${state.golfApiKey}`,
          'Accept': 'application/json'
        }
      });
      if (response.ok) {
        const data = await response.json();
        // Parse and return structured clubs list
        if (data && data.clubs) {
          // Map response fields to standard structure
          return data.clubs.map(c => {
            const primaryCourse = c.courses && c.courses[0] ? c.courses[0] : {};
            return {
              id: c.id,
              name: c.name,
              city: c.city || '',
              state: c.state || '',
              rating: primaryCourse.rating || 72.0,
              slope: primaryCourse.slope || 113,
              holesCount: primaryCourse.holesCount || 18,
              pars: primaryCourse.pars || [4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4,4],
              coordinates: c.coordinates || { lat: 36.5684, lng: -121.9507 }
            };
          });
        }
      }
    } catch (e) {
      console.error('Remote GolfAPI search failed, falling back to local mocks', e);
    }
  }

  // Fallback to local mock database matching query
  return MOCK_COURSES.filter(c => c.name.toLowerCase().includes(lowerQuery));
}

// Render search results dropdown items
function renderSearchResults(courses) {
  const dropdown = document.getElementById('course-search-results');
  dropdown.innerHTML = '';
  
  if (courses.length === 0) {
    dropdown.innerHTML = '<div style="padding:0.75rem 1rem; color:var(--color-secondary); font-size:0.85rem">No courses found.</div>';
    dropdown.classList.remove('hidden');
    return;
  }

  courses.forEach(course => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <span class="search-result-name">${escapeHTML(course.name)}</span>
      <span class="search-result-details">${escapeHTML(course.city)}, ${escapeHTML(course.state)} &bull; ${course.holesCount} Holes &bull; Rating ${course.rating}</span>
    `;
    item.addEventListener('click', () => {
      state.selectedCourse = course;
      applySelectedCourse();
      saveState();
      updateUI();
      updateGPSWidget();
      renderParsConfig(); // re-draw Settings par inputs
      dropdown.classList.add('hidden');
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
        const baseYardages = [382, 502, 395, 325, 185, 495, 106, 420, 460, 430, 370, 202, 403, 570, 396, 401, 208, 540];
        const standardDist = baseYardages[(holeNum - 1) % baseYardages.length];
        
        document.getElementById('gps-dist-val').textContent = standardDist;
        document.getElementById('gps-dist-center').textContent = standardDist;
        document.getElementById('gps-dist-front').textContent = standardDist - 15;
        document.getElementById('gps-dist-back').textContent = standardDist + 15;
      },
      { enableHighAccuracy: true, timeout: 5000, maximumAge: 0 }
    );
  } else {
    statusLbl.textContent = "No GPS support";
    const baseYardages = [382, 502, 395, 325, 185, 495, 106, 420, 460, 430, 370, 202, 403, 570, 396, 401, 208, 540];
    const standardDist = baseYardages[(holeNum - 1) % baseYardages.length];
    
    document.getElementById('gps-dist-val').textContent = standardDist;
    document.getElementById('gps-dist-center').textContent = standardDist;
    document.getElementById('gps-dist-front').textContent = standardDist - 15;
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
