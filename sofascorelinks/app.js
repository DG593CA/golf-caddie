// SofaScore Link Builder - Core Logic & UI Interactions

// 1. Dataset of all countries with their deep link templates, payouts, currencies, and statuses
const countriesData = [
  { name: 'Argentina', code: 'AR', flag: '🇦🇷', deepLink: 'https://app.sofascore.com/nixz/wc26_arg', payoutIOS: 0.85, payoutAOS: 0.25, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'United Kingdom', code: 'UK', flag: '🇬🇧', deepLink: 'https://app.sofascore.com/nixz/wc26_uk', payoutIOS: 1.40, payoutAOS: 0.80, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'France', code: 'FR', flag: '🇫🇷', deepLink: 'https://app.sofascore.com/nixz/wc26_fra', payoutIOS: 0.30, payoutAOS: 0.30, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Spain', code: 'ES', flag: '🇪🇸', deepLink: 'https://app.sofascore.com/nixz/wc26_spa', payoutIOS: 0.80, payoutAOS: 0.40, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Canada', code: 'CA', flag: '🇨🇦', deepLink: 'https://app.sofascore.com/nixz/wc26_can', payoutIOS: 2.40, payoutAOS: 0.50, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Portugal', code: 'PT', flag: '🇵🇹', deepLink: 'https://app.sofascore.com/nixz/wc26_por', payoutIOS: 0.30, payoutAOS: 0.30, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Ghana', code: 'GH', flag: '🇬🇭', deepLink: 'https://app.sofascore.com/nixz/main_b', payoutIOS: 0.11, payoutAOS: 0.11, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: "Cote d'Ivoire", code: 'CIV', campaignCode: 'CIV', flag: '🇨🇮', deepLink: 'https://app.sofascore.com/nixz/wc26_civ', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Indonesia', code: 'ID', flag: '🇮🇩', deepLink: 'https://app.sofascore.com/nixz/wc26_main', payoutIOS: 0.45, payoutAOS: 0.45, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Mexico', code: 'MX', flag: '🇲🇽', deepLink: 'https://app.sofascore.com/nixz/wc26_mex', payoutIOS: 0.45, payoutAOS: 0.45, currency: 'EUR', lookback: '7d', status: 'launch', sensitive: false },
  { name: 'Austria', code: 'AT', campaignCode: 'AUS', flag: '🇦🇹', deepLink: 'https://app.sofascore.com/nixz/wc26_aus', payoutIOS: 0.45, payoutAOS: 0.45, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Croatia', code: 'HR', campaignCode: 'CRO', flag: '🇭🇷', deepLink: 'https://app.sofascore.com/nixz/wc26_cro', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Egypt', code: 'EG', campaignCode: 'EGY', flag: '🇪🇬', deepLink: 'https://app.sofascore.com/nixz/wc26_egy', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Germany', code: 'DE', campaignCode: 'GER', flag: '🇩🇪', deepLink: 'https://app.sofascore.com/nixz/wc26_ger', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Japan', code: 'JP', campaignCode: 'JAP', flag: '🇯🇵', deepLink: 'https://app.sofascore.com/nixz/wc26_jap', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Morocco', code: 'MA', campaignCode: 'MOR', flag: '🇲🇦', deepLink: 'https://app.sofascore.com/nixz/wc26_mor', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Netherlands', code: 'NL', campaignCode: 'NED', flag: '🇳🇱', deepLink: 'https://app.sofascore.com/nixz/wc26_ned', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Norway', code: 'NO', campaignCode: 'NOR', flag: '🇳🇴', deepLink: 'https://app.sofascore.com/nixz/wc26_nor', payoutIOS: 0.70, payoutAOS: 0.70, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Senegal', code: 'SN', campaignCode: 'SEN', flag: '🇸🇳', deepLink: 'https://app.sofascore.com/nixz/wc26_sen', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Democratic Republic of Congo', code: 'CD', campaignCode: 'CD', flag: '🇨🇩', deepLink: 'https://app.sofascore.com/nixz/main_b', payoutIOS: 0.20, payoutAOS: 0.20, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Poland', code: 'PL', campaignCode: 'PL', flag: '🇵🇱', deepLink: 'https://app.sofascore.com/nixz/wc26_main', payoutIOS: 0.35, payoutAOS: 0.35, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Cyprus', code: 'CY', campaignCode: 'CY', flag: '🇨🇾', deepLink: 'https://app.sofascore.com/nixz/wc26_main', payoutIOS: 0.35, payoutAOS: 0.35, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'Ireland', code: 'IE', campaignCode: 'IE', flag: '🇮🇪', deepLink: 'https://app.sofascore.com/nixz/wc26_main', payoutIOS: 0.70, payoutAOS: 0.70, currency: 'EUR', lookback: '7d', status: 'standard', sensitive: false },
  { name: 'USA', code: 'US', campaignCode: 'USA', flag: '🇺🇸', deepLink: 'https://app.sofascore.com/nixz/wc26_usa', payoutIOS: 0.80, payoutAOS: 0.80, currency: 'EUR', lookback: '7d', status: 'sensitive', sensitive: true },
  { name: 'Brazil', code: 'BR', campaignCode: 'BRA', flag: '🇧🇷', deepLink: 'https://app.sofascore.com/nixz/wc26_bra', payoutIOS: 0.35, payoutAOS: 0.35, currency: 'EUR', lookback: '7d', status: 'sensitive', sensitive: true }
];

// 2. State management
const state = {
  pubId: '',
  mediaSource: 'qinyueblivz_int',
  campaignTemplate: 'CP_GWM_[MARKET]_15odds_impressions',
  targetOS: new Set(['android', 'ios']), // Multi-select Set (both active by default)
  selectedMarkets: new Set(),
  activeTab: 'table',
  searchQuery: '',
  showSensitive: false,
  customPayouts: {}, // Maps countryCode-os -> payout
  customLookbacks: {}, // Maps countryCode-os -> lookback
  customCampaignCodes: {}, // Maps countryCode-os -> campaignCode
  deletedLinks: new Set() // Maps countryCode-os for deleted rows
};

// 3. Initialize the application
document.addEventListener('DOMContentLoaded', () => {
  setupAccordion();
  initFormInputs();
  renderMarketSelector();
  selectPreset('launch'); // Default selection on load
  setupTabs();
  setupActionButtons();
  setupSearch();
  updateUI();
});

// Accordion utility
function setupAccordion() {
  const accordion = document.querySelector('.accordion');
  const header = accordion.querySelector('.accordion-header');
  header.addEventListener('click', () => {
    accordion.classList.toggle('active');
  });
}

// Bind form inputs to state
function initFormInputs() {
  const pubIdInput = document.getElementById('pubId');
  const mediaSourceInput = document.getElementById('mediaSource');
  const sensitiveSwitch = document.getElementById('sensitiveSwitch');

  pubIdInput.addEventListener('input', (e) => {
    state.pubId = e.target.value.trim();
    updateUI();
  });

  mediaSourceInput.addEventListener('input', (e) => {
    state.mediaSource = e.target.value.trim();
    updateUI();
  });

  sensitiveSwitch.addEventListener('change', (e) => {
    state.showSensitive = e.target.checked;
    renderMarketSelector();
    updateUI();
  });

  // Target OS platform bindings
  const btnOsAndroid = document.getElementById('btnOsAndroid');
  const btnOsiOS = document.getElementById('btnOsiOS');

  // Both active by default on load, align UI
  btnOsAndroid.classList.add('active');
  btnOsiOS.classList.add('active');

  btnOsAndroid.addEventListener('click', () => {
    const isActive = state.targetOS.has('android');
    if (isActive && state.targetOS.size === 1) {
      showToast('At least one Target OS must be selected!', 'warning');
      return;
    }
    if (isActive) {
      state.targetOS.delete('android');
      btnOsAndroid.classList.remove('active');
    } else {
      state.targetOS.add('android');
      btnOsAndroid.classList.add('active');
    }
    state.deletedLinks.clear();
    updateUI();
  });

  btnOsiOS.addEventListener('click', () => {
    const isActive = state.targetOS.has('ios');
    if (isActive && state.targetOS.size === 1) {
      showToast('At least one Target OS must be selected!', 'warning');
      return;
    }
    if (isActive) {
      state.targetOS.delete('ios');
      btnOsiOS.classList.remove('active');
    } else {
      state.targetOS.add('ios');
      btnOsiOS.classList.add('active');
    }
    state.deletedLinks.clear();
    updateUI();
  });
}

// Render the grid of checkable countries
function renderMarketSelector() {
  const grid = document.getElementById('marketSelectorGrid');
  grid.innerHTML = '';

  const filteredCountries = countriesData.filter(c => {
    if (c.sensitive && !state.showSensitive) return false;
    return true;
  });

  filteredCountries.forEach(country => {
    const isSelected = state.selectedMarkets.has(country.code);
    
    const card = document.createElement('div');
    card.className = `market-checkbox-card ${isSelected ? 'selected' : ''} ${country.sensitive ? 'sensitive' : ''}`;
    card.setAttribute('data-code', country.code);

    card.innerHTML = `
      <input type="checkbox" id="chk-${country.code}" ${isSelected ? 'checked' : ''}>
      <span class="flag">${country.flag}</span>
      <span class="label" title="${country.name}">${country.name}</span>
      <span class="code">${country.code}</span>
    `;

    // Toggle logic on click
    card.addEventListener('click', (e) => {
      // Prevent double trigger if checkbox was clicked
      if (e.target.tagName !== 'INPUT') {
        const checkbox = card.querySelector('input');
        checkbox.checked = !checkbox.checked;
      }
      
      const checkbox = card.querySelector('input');
      if (checkbox.checked) {
        state.selectedMarkets.add(country.code);
        card.classList.add('selected');
        state.deletedLinks.delete(`${country.code}-ios`);
        state.deletedLinks.delete(`${country.code}-android`);
      } else {
        state.selectedMarkets.delete(country.code);
        card.classList.remove('selected');
      }
      updateUI();
    });

    grid.appendChild(card);
  });
}

// Select market presets
function selectPreset(presetName) {
  state.selectedMarkets.clear();
  state.deletedLinks.clear();
  
  // Update UI preset active class
  document.querySelectorAll('.btn-preset').forEach(btn => {
    if (btn.getAttribute('data-preset') === presetName) {
      btn.classList.add('active');
    } else {
      btn.classList.remove('active');
    }
  });

  if (presetName === 'launch') {
    // Launch Markets: AR, UK, FR, ES, CA, PT, GH, CIV, ID, MX
    const launchCodes = ['AR', 'UK', 'FR', 'ES', 'CA', 'PT', 'GH', 'CIV', 'ID', 'MX'];
    launchCodes.forEach(code => state.selectedMarkets.add(code));
    
    // Ensure sensitive switch is off (or leave as is, but don't select US/BR)
  } else if (presetName === 'all') {
    countriesData.forEach(country => {
      if (!country.sensitive || state.showSensitive) {
        state.selectedMarkets.add(country.code);
      }
    });
  } else if (presetName === 'sensitive') {
    // Force show sensitive
    state.showSensitive = true;
    document.getElementById('sensitiveSwitch').checked = true;
    renderMarketSelector();
    
    state.selectedMarkets.add('US');
    state.selectedMarkets.add('BR');
  }

  // Update checkmark UI
  document.querySelectorAll('.market-checkbox-card').forEach(card => {
    const code = card.getAttribute('data-code');
    const checkbox = card.querySelector('input');
    if (state.selectedMarkets.has(code)) {
      card.classList.add('selected');
      if (checkbox) checkbox.checked = true;
    } else {
      card.classList.remove('selected');
      if (checkbox) checkbox.checked = false;
    }
  });

  updateUI();
}

// Setup tabs for views
function setupTabs() {
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => {
      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      document.querySelectorAll('.view-content').forEach(v => v.classList.remove('active'));
      
      tab.classList.add('active');
      const viewId = tab.getAttribute('data-tab') + 'View';
      document.getElementById(viewId).classList.add('active');
      
      state.activeTab = tab.getAttribute('data-tab');
      updateUI();
    });
  });
}

// Action button handlers (Copy All, Reset, Export CSV)
function setupActionButtons() {
  document.getElementById('btnCopyAll').addEventListener('click', () => {
    const links = getSelectedLinks();
    if (links.length === 0) {
      showToast('No markets selected to copy!', 'warning');
      return;
    }
    const textToCopy = links.map(l => l.url).join('\n');
    navigator.clipboard.writeText(textToCopy)
      .then(() => showToast(`Successfully copied ${links.length} links to clipboard!`))
      .catch(() => showToast('Failed to copy links.', 'warning'));
  });

  document.getElementById('btnReset').addEventListener('click', () => {
    state.pubId = '';
    state.mediaSource = 'qinyueblivz_int';
    state.campaignTemplate = 'CP_GWM_[MARKET]_15odds_impressions';
    state.targetOS = new Set(['android', 'ios']);
    state.customPayouts = {};
    state.customLookbacks = {};
    state.customCampaignCodes = {};
    state.deletedLinks.clear();
    
    document.getElementById('pubId').value = '';
    document.getElementById('mediaSource').value = 'qinyueblivz_int';
    
    // Reset OS UI
    document.getElementById('btnOsAndroid').classList.add('active');
    document.getElementById('btnOsiOS').classList.add('active');
    
    selectPreset('launch');
    showToast('Dashboard configuration reset.');
  });

  document.getElementById('btnExport').addEventListener('click', () => {
    exportToCSV();
  });

  // Setup presets trigger
  document.querySelectorAll('.btn-preset').forEach(btn => {
    btn.addEventListener('click', () => {
      selectPreset(btn.getAttribute('data-preset'));
    });
  });
}

// Search filter
function setupSearch() {
  const searchInput = document.getElementById('searchInput');
  searchInput.addEventListener('input', (e) => {
    state.searchQuery = e.target.value.toLowerCase().trim();
    updateUI();
  });
}

// Core Link Generation Logic
function buildLink(country, os) {
  const base = country.deepLink;
  const pidParam = 'pid';
  const pidVal = encodeURIComponent(state.mediaSource || 'qinyueblivz_int');
  
  // Resolve key for custom settings
  const customKey = `${country.code}-${os}`;
  
  // Resolve campaign code
  const marketCode = state.customCampaignCodes[customKey] || country.campaignCode || country.code;
  const campaign = state.campaignTemplate.replace('[MARKET]', marketCode);
  
  // Payout and lookback values
  const defaultPayout = os === 'ios' ? (country.payoutIOS !== undefined ? country.payoutIOS : country.payoutAOS) : (country.payoutAOS !== undefined ? country.payoutAOS : country.payoutIOS);
  const payout = state.customPayouts[customKey] !== undefined ? state.customPayouts[customKey] : defaultPayout;
  const lookback = state.customLookbacks[customKey] || country.lookback;
  
  // Format payout
  const formattedPayout = parseFloat(payout).toFixed(2);
  const currency = country.currency;
  
  // Build query parameter string
  const pubIdVal = encodeURIComponent(state.pubId || 'PUBID');
  
  const queryParts = [
    `${pidParam}=${pidVal}`,
    `af_siteid={pid}_{sub2}`,
    `c=${encodeURIComponent(campaign)}`,
    `af_sub_siteid={sub2}`,
    `af_c_id={offer_id}`,
    `af_channel=${pubIdVal}`,
    `af_cost_value=${formattedPayout}`,
    `af_cost_currency=${currency}`,
    `af_cost_model=CPI`,
    `af_click_lookback=${lookback}`,
    `af_ip={ip}`,
    `af_lang={language}`,
    `af_ua={device_ua}`,
    `af_geo={geo}`,
    `clickid={clickid}`,
    `advertising_id={sub3}`,
    `idfa={sub3}`,
    `af_model={device_model}`,
    `af_os_version={os_version}`,
    `af_prt=GlobalWideMedia`
  ];
  
  return `${base}?${queryParts.join('&')}`;
}

// Get the links for currently selected & filtered markets
function getSelectedLinks() {
  const links = [];
  countriesData.forEach(country => {
    // Must be selected
    if (!state.selectedMarkets.has(country.code)) return;
    
    // Must pass search filter
    if (state.searchQuery) {
      const matchesName = country.name.toLowerCase().includes(state.searchQuery);
      const matchesCode = country.code.toLowerCase().includes(state.searchQuery);
      if (!matchesName && !matchesCode) return;
    }
    
    // Generate a link for each active target OS
    state.targetOS.forEach(os => {
      const customKey = `${country.code}-${os}`;
      // Skip if this specific link was deleted
      if (state.deletedLinks.has(customKey)) return;
      
      links.push({
        country,
        os,
        url: buildLink(country, os)
      });
    });
  });
  return links;
}

// Triggered when inputs or selections update
function updateUI() {
  const selectedLinks = getSelectedLinks();
  
  // Update stats
  document.getElementById('statTotalSelected').innerText = state.selectedMarkets.size;
  const launchCount = Array.from(state.selectedMarkets).filter(code => {
    const c = countriesData.find(x => x.code === code);
    return c && c.status === 'launch';
  }).length;
  document.getElementById('statLaunchSelected').innerText = launchCount;
  
  // Render views
  renderTableView(selectedLinks);
  renderCardView(selectedLinks);
  renderRawView(selectedLinks);

  // If Publisher ID is missing, display alert
  const warningContainer = document.getElementById('warningPubId');
  if (!state.pubId) {
    warningContainer.style.display = 'block';
  } else {
    warningContainer.style.display = 'none';
  }
}

// 1. Render Table View
function renderTableView(selectedLinks) {
  const container = document.getElementById('tableView');
  
  if (selectedLinks.length === 0) {
    container.innerHTML = getEmptyStateHTML();
    return;
  }

  let html = `
    <div class="table-container">
      <table>
        <thead>
          <tr>
            <th>Market</th>
            <th>Type</th>
            <th style="width: 80px;">OS</th>
            <th>Campaign Name</th>
            <th style="width: 100px;">Payout</th>
            <th style="width: 100px;">Lookback</th>
            <th>Generated Link</th>
            <th style="width: 60px; text-align: center;">Action</th>
          </tr>
        </thead>
        <tbody>
  `;

  selectedLinks.forEach(({ country, os, url }) => {
    const customKey = `${country.code}-${os}`;
    const defaultPayout = os === 'ios' ? (country.payoutIOS !== undefined ? country.payoutIOS : country.payoutAOS) : (country.payoutAOS !== undefined ? country.payoutAOS : country.payoutIOS);
    const payout = state.customPayouts[customKey] !== undefined ? state.customPayouts[customKey] : defaultPayout;
    const lookback = state.customLookbacks[customKey] || country.lookback;
    const campaignCode = state.customCampaignCodes[customKey] || country.campaignCode || country.code;
    
    // Status pill
    let statusClass = 'status-standard';
    let statusText = 'Standard';
    if (country.status === 'launch') {
      statusClass = 'status-launch';
      statusText = 'Launch';
    } else if (country.status === 'sensitive') {
      statusClass = 'status-sensitive';
      statusText = 'Sensitive';
    }

    const typePill = `
      <span class="status-pill ${statusClass}">
        <span class="status-indicator-dot"></span>
        ${statusText}
      </span>
    `;

    // Static OS badge
    const osBadgeHtml = `<span class="os-badge ${os === 'ios' ? 'ios' : 'android'}">${os === 'ios' ? 'iOS' : 'AOS'}</span>`;

    html += `
      <tr data-key="${customKey}">
        <td>
          <div class="country-cell">
            <span style="font-size: 1.25rem;">${country.flag}</span>
            <div>
              <strong>${country.name}</strong>
              <div style="font-size: 0.7rem; color: var(--text-muted);">${country.code}</div>
            </div>
            ${country.sensitive ? '<span class="sensitive-badge">Sensitive</span>' : ''}
          </div>
        </td>
        <td>${typePill}</td>
        <td>${osBadgeHtml}</td>
        <td>
          <input type="text" class="value-input campaign-code-input" style="width: 80px; text-align: left; font-family: monospace;" 
                 value="${campaignCode}" data-key="${customKey}" title="Customize campaign market code">
        </td>
        <td>
          <div style="display: flex; align-items: center; gap: 0.25rem;">
            <input type="number" class="value-input payout-input" step="0.01" min="0" 
                   value="${payout}" data-key="${customKey}">
            <span style="font-size: 0.8rem; font-weight: 600;">${country.currency === 'USD' ? '$' : '€'}</span>
          </div>
        </td>
        <td>
          <select class="value-input lookback-select" data-key="${customKey}" style="width: 70px;">
            <option value="7d" ${lookback === '7d' ? 'selected' : ''}>7d</option>
            <option value="100d" ${lookback === '100d' ? 'selected' : ''}>100d</option>
            <option value="30d" ${lookback === '30d' ? 'selected' : ''}>30d</option>
          </select>
        </td>
        <td>
          <div class="link-cell">
            <div class="link-input-display" onclick="copyIndividualLink('${url}', '${country.name} (${os.toUpperCase()})')" title="Click to copy link">${url}</div>
            <button class="copy-icon-btn" onclick="copyIndividualLink('${url}', '${country.name} (${os.toUpperCase()})')" title="Copy to clipboard">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
            </button>
            <a href="${url}" target="_blank" class="open-link-btn" title="Open and test link">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
            </a>
          </div>
        </td>
        <td style="text-align: center;">
          <button type="button" class="delete-row-btn" data-key="${customKey}" title="Remove this link">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </td>
      </tr>
    `;
  });

  html += `
        </tbody>
      </table>
    </div>
  `;

  container.innerHTML = html;

  // Add event listeners to delete buttons
  container.querySelectorAll('.delete-row-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = btn.getAttribute('data-key');
      state.deletedLinks.add(key);
      updateUI();
      showToast('Attribution link removed from list.');
    });
  });

  // Add event listeners to custom inputs in the table
  container.querySelectorAll('.payout-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-key');
      const val = parseFloat(e.target.value);
      if (!isNaN(val)) {
        state.customPayouts[key] = val;
        updateUI();
      }
    });
  });

  container.querySelectorAll('.lookback-select').forEach(select => {
    select.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-key');
      state.customLookbacks[key] = e.target.value;
      updateUI();
    });
  });

  container.querySelectorAll('.campaign-code-input').forEach(input => {
    input.addEventListener('change', (e) => {
      const key = e.target.getAttribute('data-key');
      state.customCampaignCodes[key] = e.target.value.trim().toUpperCase();
      updateUI();
    });
  });
}

// 2. Render Card View
function renderCardView(selectedLinks) {
  const container = document.getElementById('cardView');
  
  if (selectedLinks.length === 0) {
    container.innerHTML = getEmptyStateHTML();
    return;
  }

  let html = '<div class="card-view-grid">';
  
  selectedLinks.forEach(({ country, os, url }) => {
    const customKey = `${country.code}-${os}`;
    const defaultPayout = os === 'ios' ? (country.payoutIOS !== undefined ? country.payoutIOS : country.payoutAOS) : (country.payoutAOS !== undefined ? country.payoutAOS : country.payoutIOS);
    const payout = state.customPayouts[customKey] !== undefined ? state.customPayouts[customKey] : defaultPayout;
    const lookback = state.customLookbacks[customKey] || country.lookback;
    const campaignCode = state.customCampaignCodes[customKey] || country.campaignCode || country.code;
    const campaign = state.campaignTemplate.replace('[MARKET]', campaignCode);
    
    let badgeClass = 'standard';
    let badgeText = 'Standard Market';
    if (country.status === 'launch') {
      badgeClass = 'launch';
      badgeText = 'Launch Market';
    } else if (country.status === 'sensitive') {
      badgeClass = 'sensitive';
      badgeText = 'Sensitive Market';
    }

    const osBadgeHtml = `<span class="os-badge ${os === 'ios' ? 'ios' : 'android'}" style="font-size: 0.7rem; margin-left: 0.5rem; text-transform: uppercase;">${os === 'ios' ? 'iOS' : 'AOS'}</span>`;

    html += `
      <div class="link-card ${country.sensitive ? 'sensitive-card' : ''}" data-key="${customKey}">
        <div class="card-header">
          <div class="card-title">
            <span>${country.flag}</span>
            <div style="display: flex; align-items: center;">
              ${country.name} (${country.code})
              ${osBadgeHtml}
            </div>
          </div>
          <span class="card-badge ${badgeClass}">${badgeText}</span>
        </div>
        
        <div class="card-details-grid">
          <div class="detail-item">
            <span class="detail-label">OS Platform</span>
            <span class="detail-value" style="text-transform: uppercase; font-weight: 600;">${os === 'ios' ? 'iOS' : 'Android'}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Payout rate</span>
            <span class="detail-value">${country.currency === 'USD' ? '$' : '€'}${parseFloat(payout).toFixed(2)} (CPI)</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Campaign Code</span>
            <span class="detail-value" style="font-family: monospace;">${campaign}</span>
          </div>
          <div class="detail-item">
            <span class="detail-label">Lookback window</span>
            <span class="detail-value">${lookback}</span>
          </div>
          <div class="detail-item" style="grid-column: span 2;">
            <span class="detail-label">Deep link base</span>
            <span class="detail-value" style="font-size: 0.65rem; word-break: break-all;">${country.deepLink}</span>
          </div>
        </div>

        <div class="card-link-container">
          <div class="link-input-display" onclick="copyIndividualLink('${url}', '${country.name} (${os.toUpperCase()})')" title="Click to copy link">${url}</div>
          <button class="btn btn-primary" onclick="copyIndividualLink('${url}', '${country.name} (${os.toUpperCase()})')" style="padding: 0.4rem 0.75rem;" title="Copy">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" ry="2"></rect><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"></path></svg>
          </button>
          <a href="${url}" target="_blank" class="btn btn-accent" style="padding: 0.4rem 0.75rem;" title="Test">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>
          </a>
          <button type="button" class="btn delete-card-btn" data-key="${customKey}" style="padding: 0.4rem 0.75rem; border-color: rgba(255, 82, 82, 0.3); color: var(--warning);" title="Remove">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path><line x1="10" y1="11" x2="10" y2="17"></line><line x1="14" y1="11" x2="14" y2="17"></line></svg>
          </button>
        </div>
      </div>
    `;
  });

  html += '</div>';
  container.innerHTML = html;

  // Add event listeners to delete card buttons
  container.querySelectorAll('.delete-card-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      const key = btn.getAttribute('data-key');
      state.deletedLinks.add(key);
      updateUI();
      showToast('Attribution link removed from list.');
    });
  });
}

// 3. Render Raw Text View
function renderRawView(selectedLinks) {
  const container = document.getElementById('rawView');
  
  if (selectedLinks.length === 0) {
    container.innerHTML = getEmptyStateHTML();
    return;
  }

  const textToCopy = selectedLinks.map(l => l.url).join('\n');
  container.innerHTML = `
    <div class="raw-textarea-wrapper">
      <textarea class="raw-textarea" readonly onclick="this.select()" title="Click to select all text">${textToCopy}</textarea>
      <div style="margin-top: 1rem; color: var(--text-muted); font-size: 0.8rem; display: flex; align-items: center; gap: 0.5rem;">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg>
        Click anywhere inside the text area to select all generated links for copying.
      </div>
    </div>
  `;
}

// Empty state HTML Helper
function getEmptyStateHTML() {
  return `
    <div class="empty-state">
      <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect><line x1="9" y1="3" x2="9" y2="21"></line><line x1="15" y1="3" x2="15" y2="21"></line><line x1="3" y1="9" x2="21" y2="9"></line><line x1="3" y1="15" x2="21" y2="15"></line></svg>
      <h3>No Markets Selected</h3>
      <p>Select one or more countries from the selection grid, or apply a preset to generate link results.</p>
    </div>
  `;
}

// Individual copy action
function copyIndividualLink(url, countryName) {
  navigator.clipboard.writeText(url)
    .then(() => showToast(`Copied attribution link for ${countryName}!`))
    .catch(() => showToast('Failed to copy link.', 'warning'));
}

// Global Custom Toast Notification
function showToast(message, type = 'success') {
  const container = document.getElementById('toastContainer');
  
  const toast = document.createElement('div');
  toast.className = `toast ${type === 'warning' ? 'toast-warning' : ''}`;
  
  const icon = type === 'warning' 
    ? `<svg class="toast-warning-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"></path><line x1="12" y1="9" x2="12" y2="13"></line><line x1="12" y1="17" x2="12.01" y2="17"></line></svg>`
    : `<svg class="toast-success-icon" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>`;
    
  toast.innerHTML = `
    ${icon}
    <span>${message}</span>
  `;
  
  container.appendChild(toast);
  
  // Animate out and remove
  setTimeout(() => {
    toast.classList.add('fade-out');
    toast.addEventListener('animationend', () => {
      toast.remove();
    });
  }, 3000);
}

// Export selected links to CSV
function exportToCSV() {
  const selectedLinks = getSelectedLinks();
  if (selectedLinks.length === 0) {
    showToast('No markets selected to export!', 'warning');
    return;
  }

  let csvContent = 'data:text/csv;charset=utf-8,';
  // Headers
  csvContent += 'Country Name,Country Code,Campaign Name,Payout Value,Payout Currency,Payout Model,Click Lookback,Attribution URL,Target OS\n';
  
  selectedLinks.forEach(({ country, os, url }) => {
    const customKey = `${country.code}-${os}`;
    const defaultPayout = os === 'ios' ? (country.payoutIOS !== undefined ? country.payoutIOS : country.payoutAOS) : (country.payoutAOS !== undefined ? country.payoutAOS : country.payoutIOS);
    const payout = state.customPayouts[customKey] !== undefined ? state.customPayouts[customKey] : defaultPayout;
    const lookback = state.customLookbacks[customKey] || country.lookback;
    const campaignCode = state.customCampaignCodes[customKey] || country.campaignCode || country.code;
    const campaign = state.campaignTemplate.replace('[MARKET]', campaignCode);
    const escapedUrl = url.replace(/"/g, '""');
    
    csvContent += `"${country.name}","${country.code}","${campaign}",${parseFloat(payout).toFixed(2)},"${country.currency}","CPI","${lookback}","${escapedUrl}","${os.toUpperCase()}"\n`;
  });
  
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement('a');
  
  // Format current date for file name
  const dateStr = new Date().toISOString().slice(0, 10);
  const pubName = state.pubId ? `_pub_${state.pubId}` : '';
  
  link.setAttribute('href', encodedUri);
  link.setAttribute('download', `sofascore_links${pubName}_${dateStr}.csv`);
  document.body.appendChild(link); // Required for FF
  
  link.click();
  document.body.removeChild(link);
  showToast('Downloaded links spreadsheet CSV!');
}

// 4. Automated Sanity Checker
// Runs validation checks on the links to check for structural consistency
window.runSanityCheck = function() {
  const selectedLinks = getSelectedLinks();
  if (selectedLinks.length === 0) {
    return { ok: false, message: "No links selected to run sanity checks." };
  }

  let errors = [];
  selectedLinks.forEach(({ country, os, url }) => {
    const customKey = `${country.code}-${os}`;
    // 1. Deep link validation
    if (!url.startsWith(country.deepLink)) {
      errors.push(`[${country.code}-${os}] URL does not start with correct deep link base: ${country.deepLink}`);
    }
    
    // 2. Pub ID / af_channel validation
    const channelParam = `af_channel=${state.pubId || 'PUBID'}`;
    if (!url.includes(channelParam)) {
      errors.push(`[${country.code}-${os}] URL missing correct Publisher ID (af_channel).`);
    }

    // 3. Campaign validation
    const marketCode = state.customCampaignCodes[customKey] || country.campaignCode || country.code;
    const expectedCampaign = state.campaignTemplate.replace('[MARKET]', marketCode);
    const campaignParam = `c=${encodeURIComponent(expectedCampaign)}`;
    if (!url.includes(campaignParam)) {
      errors.push(`[${country.code}-${os}] URL campaign string mismatch. Expected: ${expectedCampaign}`);
    }

    // 4. Payout validation
    const defaultPayout = os === 'ios' ? (country.payoutIOS !== undefined ? country.payoutIOS : country.payoutAOS) : (country.payoutAOS !== undefined ? country.payoutAOS : country.payoutIOS);
    const payout = state.customPayouts[customKey] !== undefined ? state.customPayouts[customKey] : defaultPayout;
    const payoutParam = `af_cost_value=${parseFloat(payout).toFixed(2)}`;
    if (!url.includes(payoutParam)) {
      errors.push(`[${country.code}-${os}] URL payout value mismatch. Expected: ${payoutParam}`);
    }

    // 5. Lookback validation
    const lookback = state.customLookbacks[customKey] || country.lookback;
    const lookbackParam = `af_click_lookback=${lookback}`;
    if (!url.includes(lookbackParam)) {
      errors.push(`[${country.code}-${os}] URL lookback window mismatch. Expected: ${lookbackParam}`);
    }
  });

  if (errors.length > 0) {
    return { ok: false, errors: errors };
  }
  return { ok: true, message: `All ${selectedLinks.length} links passed the validation tests successfully.` };
};
