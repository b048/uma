import { RaceEngine } from './race.js';
import { Leaderboard } from './leaderboard.js';
import { ROSTER_TYPES } from './horses.js'; // Import needed for Glossary
import Chart from 'chart.js/auto';

// State
let currentUser = Leaderboard.getUserState();
let raceEngine = null;
let selectedHorseIndex = null;
let betAmount = 0;
let raceInterval = null;

// DOM Elements (Cached)
const dom = {
  usernameInput: document.getElementById('username'),
  startBtn: document.getElementById('btn-start'), // Not strictly needed with delegation but good for ref
  track: document.getElementById('track'),
  commentary: document.getElementById('commentary'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  leaderboardBody: document.getElementById('leaderboard-body'),
  landingLeaderboardBody: document.getElementById('landing-leaderboard-body'),
  userDisplay: document.getElementById('display-user'),
  balanceDisplay: document.getElementById('display-balance'),
  horseList: document.getElementById('horse-list'),
  selectedHorseName: document.getElementById('selected-horse-name'), // Likely deprecated by new UI but keeping for safety
  selectedHorseOdds: document.getElementById('selected-horse-odds'),
  betInput: document.getElementById('bet-amount')
};

// --- Navigation ---
const pages = {
  landing: document.getElementById('page-landing'),
  selection: document.getElementById('page-selection'),
  race: document.getElementById('page-race'),
  result: document.getElementById('page-result')
};

function showPage(pageName) {
  Object.values(pages).forEach(p => p.classList.remove('active'));
  pages[pageName].classList.add('active');
}

// --- Global Bet UI State ---
const domBet = {
  slider: document.getElementById('global-bet-slider'),
  display: document.getElementById('global-bet-display')
};

// --- Initialization & Event Delegation ---
function init() {
  if (currentUser.hasAccount) {
    dom.usernameInput.value = currentUser.username;
  }

  // --- Betting Slider Logic ---
  if (domBet.slider) {
    domBet.slider.addEventListener('input', () => {
      // Snap to 100 increments
      let val = parseInt(domBet.slider.value);
      if (val < 100) val = 100;
      domBet.display.textContent = `¥${val}`;
      betAmount = val;
    });
  }

  // --- GLOBAL CLICK LISTENER (Event Delegation) ---
  document.addEventListener('click', async (e) => {
    // Traverse up to find button or clickable card
    const target = e.target.closest('button, .horse-card, #btn-show-ranking, #btn-close-ranking');
    if (!target) return;

    // 1. ENTRY / START
    if (target.id === 'btn-start') {
      const name = dom.usernameInput.value.trim();
      const pass = document.getElementById('password').value.trim();

      if (!name) {
        alert("名前を入力してください");
        return;
      }

      target.disabled = true;
      target.textContent = "確認中...";

      // Check Login
      const login = await Leaderboard.checkLogin(name, pass || null);

      if (login.status === 'auth_failed') {
        alert("エラー：パスワードが違います。\nこの名前は保護されています。");
        target.disabled = false;
        target.textContent = "初夢エントリー";
        return;
      }

      // Logic for OK/NEW/CLAIMABLE
      if (login.status === 'ok' || login.status === 'claimable') {
        // Sync from Server
        currentUser = {
          username: login.user.username,
          balance: login.user.total_winnings,
          bankruptcyCount: login.user.bankruptcy_count || 0,
          hasAccount: true
        };
        if (pass) currentUser.password = pass; // Keep for session

        // If claimable and pass provided, it will be saved on next submit
      } else if (login.status === 'new') {
        // New User
        currentUser = {
          username: name,
          balance: 1000,
          bankruptcyCount: 0,
          hasAccount: true,
          password: pass // Set if provided
        };
      }
      // Offline fallback
      else if (login.status === 'offline') {
        currentUser.username = name;
        currentUser.hasAccount = true;
      }

      // Save & Proceed
      Leaderboard.saveUserState(currentUser);
      // Initial Sync (to claim pass or create user)
      await Leaderboard.submitScore(currentUser.username, currentUser.balance, currentUser.bankruptcyCount, currentUser.password);

      updateHUD();
      prepareRace();
      showPage('selection');
      target.disabled = false;
      target.textContent = "初夢エントリー";
    }

    // 2. BANKRUPTCY
    if (target.id === 'btn-bankruptcy') {
      if (confirm("本当に破産宣告しますか？所持金が ¥1000 にリセットされます。")) {
        currentUser.balance = 1000;
        currentUser.bankruptcyCount = (currentUser.bankruptcyCount || 0) + 1;
        Leaderboard.saveUserState(currentUser);
        updateHUD();
        // Reset Slider
        if (domBet.slider) {
          domBet.slider.max = currentUser.balance;
          domBet.slider.value = 100;
          domBet.display.textContent = `¥100`;
          betAmount = 100;
        }
      }
    }

    // 3. GLOSSARY
    if (target.id === 'btn-glossary') {
      const m = document.getElementById('glossary-modal');
      m.style.display = 'flex';
      const c = document.getElementById('glossary-content');
      if (c && c.children.length === 0) populateGlossary(c);
    }
    if (target.id === 'btn-close-glossary') {
      document.getElementById('glossary-modal').style.display = 'none';
    }

    // 4. RANKING
    if (target.id === 'btn-show-ranking') {
      document.getElementById('ranking-modal').style.display = 'flex';
      loadLandingRanking();
    }
    if (target.id === 'btn-close-ranking') {
      document.getElementById('ranking-modal').style.display = 'none';
    }

    // 5. RETRY (Results)
    if (target.id === 'btn-retry') {
      prepareRace();
      showPage('selection');
    }

    // 6. HORSE CARD (Select 1st, 2nd, 3rd)
    if (target.classList && target.classList.contains('horse-card')) {
      const index = parseInt(target.dataset.index);
      if (!isNaN(index)) {
        handleCardClick(index);
      }
    }

    // 7. RACE START (Trifecta)
    if (target.id === 'btn-race-start') {
      startRaceTrifecta();
    }
  });

  // Enter Key for Input
  dom.usernameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('btn-start').click();
  });
}

// --- Helper Functions ---

function updateHUD() {
  dom.userDisplay.textContent = `Jockey: ${currentUser.username}`;
  dom.balanceDisplay.textContent = `Balance: $${currentUser.balance.toFixed(0)}`;

  const btn = document.getElementById('btn-bankruptcy');
  if (btn) {
    if (currentUser.balance < 100) {
      btn.classList.add('btn-bankruptcy-alert');
      btn.textContent = "破産する！";
    } else {
      btn.classList.remove('btn-bankruptcy-alert');
      btn.textContent = "破産...";
    }
  }
}

function populateGlossary(container) {
  const explanations = {
    "アドマイヤノーマル": "正規分布 (Normal): 自然界で最も一般的な分布。平均値付近が出る確率が高く、極めて安定的。",
    "カレンダイス": "一様分布 (Uniform): サイコロのように、範囲内の全て値が等確率で出る。完全に運。",
    "スエアシキング": "べき乗則 (Power Law): 小さな値が多いが、稀に巨大な値が出る...のを逆に利用し、後半に伸びるように設計。",
    "ツインターボ": "混合正規分布 (Bimodal): 2つの山を持つ。調子が良い時と悪い時がはっきり分かれる。",
    "ワイルドパラドックス": "コーシー分布 (Cauchy): 平均も分散も定義できない「数学的カオス」。理論上、無限の速度すら出しうる。",
    "ブラックボックス": "対数正規分布 (Log-Normal): 値が常にプラスで、右に裾が長い。株価のように、爆発的な高騰（加速）を見せることがある。",
    "シンボリルール": "三角分布 (Triangular): 上限・下限・最頻値が決まっている。最も「計算通り」に動く工業的な分布。",
    "ラッキーカウント": "ポアソン分布 (Poisson): 「単位時間あたりに何回起きるか」を表す。離散的（トビトビ）な動きをするのが特徴。"
  };

  ROSTER_TYPES.forEach(ClassRef => {
    const h = new ClassRef();
    const div = document.createElement('div');
    div.style.cssText = `background:rgba(255,255,255,0.05); padding:1rem; border-radius:0.5rem; border-left:4px solid ${h.color}; display:flex; gap:1rem; align-items:flex-start;`;
    div.innerHTML = `
            <div style="width:64px; height:64px; border-radius:50%; overflow:hidden; border:2px solid ${h.color}; flex-shrink:0;">
                <img src="${h.image}" style="width:100%; height:100%; object-fit:cover;">
            </div>
            <div style="flex:1;">
                <div style="font-weight:bold; color:${h.color}; display:flex; justify-content:space-between; align-items:center;">
                    <span>${h.name}</span>
                    <span style="font-size:0.8rem; opacity:0.7;">${h.type}</span>
                </div>
                <div style="font-family:monospace; margin:0.5rem 0; background:rgba(0,0,0,0.5); padding:0.2rem;">${h.formula}</div>
                <div style="font-size:0.85rem; color:#cbd5e1;">${explanations[h.name] || h.description}</div>
            </div>
        `;
    container.appendChild(div);
  });
}

async function loadLandingRanking() {
  dom.landingLeaderboardBody.innerHTML = '<tr><td colspan="4">読み込み中...</td></tr>';
  const scores = await Leaderboard.getTopScores();
  dom.landingLeaderboardBody.innerHTML = scores.map((s, i) => `
      <tr>
        <td>#${i + 1}</td>
        <td>${s.username}</td>
        <td>¥${s.total_winnings}</td>
        <td>${s.bankruptcy_count > 0 ? '💀' + s.bankruptcy_count : '-'}</td>
      </tr>
    `).join('');
}

// --- Selection & Race Logic ---

let selectedPredictions = []; // Array of indices [1st, 2nd, 3rd]

function prepareRace() {
  raceEngine = new RaceEngine();
  selectedPredictions = [];

  // Slider Params
  const maxParams = currentUser.balance >= 100 ? currentUser.balance : 100;
  domBet.slider.max = maxParams;
  domBet.slider.value = Math.min(100, maxParams);
  domBet.display.textContent = `¥${domBet.slider.value}`;
  betAmount = parseInt(domBet.slider.value);

  // Reset Start Button if exists
  const startBtn = document.getElementById('btn-race-start');
  if (startBtn) {
    startBtn.style.display = 'none';
    startBtn.disabled = true;
  }

  // Render Horses
  dom.horseList.innerHTML = '';
  const horses = raceEngine.getHorses();

  horses.forEach((horse, index) => {
    const card = document.createElement('div');
    card.className = 'horse-card';
    card.dataset.index = index;
    card.innerHTML = `
            <div class="selection-badge" id="badge-${index}" style="display:none;"></div>
            <div class="horse-odds">${raceEngine.getOdds(horse.name)}倍</div>
            <div class="horse-name" style="color:${horse.color}">${horse.name}</div>
            <div class="horse-formula">${horse.formula}</div>
            <div class="horse-type">${horse.type}</div>
            <div class="horse-stats">${horse.description}</div>
            <div style="margin-top:auto; height:50px; position:relative;">
                <canvas id="chart-${index}"></canvas>
            </div>
        `;
    dom.horseList.appendChild(card);
    setTimeout(() => renderMiniChart(index, horse), 0);
  });

  // Create/Update Start Button in Header if not present
  let raceStartBtn = document.getElementById('btn-race-start');
  if (!raceStartBtn) {
    const header = document.querySelector('.bet-control-bar');
    raceStartBtn = document.createElement('button');
    raceStartBtn.id = 'btn-race-start';
    raceStartBtn.className = 'btn-accent';
    raceStartBtn.style.marginLeft = '1rem';
    raceStartBtn.style.padding = '0.5rem 1.5rem';
    raceStartBtn.style.fontSize = '1.2rem';
    raceStartBtn.textContent = '3頭選んでください';
    raceStartBtn.disabled = true;
    header.appendChild(raceStartBtn);
  } else {
    raceStartBtn.textContent = '3頭選んでください';
    raceStartBtn.style.display = 'block';
  }
  updateSelectionUI(); // Initial UI update for the button
}

function handleCardClick(index) {
  const existingIdx = selectedPredictions.indexOf(index);

  if (existingIdx !== -1) {
    // Deselect
    selectedPredictions.splice(existingIdx, 1);
  } else {
    // Select (Max 3)
    if (selectedPredictions.length < 3) {
      selectedPredictions.push(index);
    } else {
      // Strict 3 limit
      alert("3頭までです！\n選び直す場合は、選択済みの馬をクリックして解除してください。");
      return;
    }
  }
  updateSelectionUI();
}

function updateSelectionUI() {
  // Update Badges
  document.querySelectorAll('.selection-badge').forEach(el => el.style.display = 'none');
  document.querySelectorAll('.horse-card').forEach(el => el.style.border = '1px solid rgba(255,255,255,0.1)');

  selectedPredictions.forEach((horseIdx, rank) => {
    const badge = document.getElementById(`badge-${horseIdx}`);
    const card = document.querySelector(`.horse-card[data-index="${horseIdx}"]`);
    if (badge && card) {
      badge.style.display = 'flex';
      badge.textContent = `${rank + 1}着予想`;
      badge.style.background = rank === 0 ? '#facc15' : (rank === 1 ? '#94a3b8' : '#b45309'); // Gold, Silver, Bronze color logic
      badge.style.color = 'black';
      card.style.border = '2px solid var(--primary)';
    }
  });

  // Update Start Button
  const btn = document.getElementById('btn-race-start');
  if (btn) {
    if (selectedPredictions.length === 3) {
      btn.disabled = false;
      btn.textContent = "出走 (3連単)！";
      btn.style.background = "#ef4444";
      btn.style.color = "white";
    } else {
      btn.disabled = true;
      btn.innerHTML = `残り ${3 - selectedPredictions.length}頭 選んでね`;
      btn.style.background = "#334155";
    }
  }
}

function renderMiniChart(index, horse) {
  const ctx = document.getElementById(`chart-${index}`);
  if (!ctx || !ctx.getContext) return;

  const dataPoints = [];
  const labels = [];
  for (let i = 0; i < 20; i++) {
    dataPoints.push(horse.move());
    labels.push(i);
  }

  new Chart(ctx.getContext('2d'), {
    type: 'line',
    data: {
      labels: labels,
      datasets: [{
        data: dataPoints,
        borderColor: horse.color,
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.4,
        fill: false
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: { x: { display: false }, y: { display: false } },
      events: [] // Disable hover events for performance/touch passthrough
    }
  });
}

function startRaceTrifecta() {
  if (selectedPredictions.length !== 3) return;

  // Final Validation
  let wager = parseInt(domBet.slider.value);
  if (isNaN(wager) || wager <= 0) wager = 100;
  if (wager > currentUser.balance) {
    alert("資金不足です！");
    return;
  }

  betAmount = wager;
  currentUser.balance -= betAmount;
  updateHUD();
  Leaderboard.saveUserState(currentUser);

  // Setup Track
  setupTrackUI();

  // Show betting info
  const raceInfo = document.getElementById('race-horse-name');
  if (raceInfo) {
    // Show 1-2-3
    const horses = raceEngine.getHorses();
    const pNames = selectedPredictions.map(i => horses[i].name).join(' → ');
    raceInfo.innerHTML = `3連単: <span style="color:#facc15">${pNames}</span>`;
  }

  showPage('race');
  dom.commentary.textContent = "運命の3連単、スタート！";

  // Main Loop
  let finished = false;
  raceInterval = setInterval(() => {
    if (finished) return;
    finished = raceEngine.tick();
    updateTrackUI();

    if (finished) {
      clearInterval(raceInterval);
      setTimeout(finishRace, 1500);
    }
  }, 500);
}

function setupTrackUI() {
  dom.track.innerHTML = '';
  const horses = raceEngine.getHorses();
  horses.forEach((h, i) => {
    const lane = document.createElement('div');
    lane.className = 'lane';
    lane.innerHTML = `
            <div class="finish-line"></div>
            <div class="horse-runner" id="runner-${i}" style="left:0%;">
                <div class="runner-visual" style="color:${h.color}">
                    <div class="avatar-box" style="border-color:${h.color}">
                        <img class="avatar-img" src="${h.image}" alt="${h.name}">
                    </div>
                    <div class="runner-badge" style="border-color:${h.color}">
                        <span class="runner-name">${h.name}</span>
                        <span class="runner-formula">${h.formula}</span>
                    </div>
                </div>
            </div>
        `;
    dom.track.appendChild(lane);
  });
}

function updateTrackUI() {
  const horses = raceEngine.getHorses();
  horses.forEach((h, i) => {
    const el = document.getElementById(`runner-${i}`);
    // 0m -> 0%, 100m -> 90% (Goal)
    const pct = Math.min(95, (h.position / 100) * 90);
    el.style.left = `${pct}%`;
  });

  if (Math.random() > 0.7) {
    const leaders = [...horses].sort((a, b) => b.position - a.position);
    dom.commentary.textContent = `${leaders[0].name} がリード！`;
  }
}

async function finishRace() {
  const allHorses = raceEngine.getHorses();
  const sortedResults = [...allHorses].sort((a, b) => a.finishTime - b.finishTime);

  const actualTop3 = sortedResults.slice(0, 3);
  const predictedTop3 = selectedPredictions.map(i => allHorses[i]);

  // Check Exact Match (Trifecta)
  const isWin =
    actualTop3[0] === predictedTop3[0] &&
    actualTop3[1] === predictedTop3[1] &&
    actualTop3[2] === predictedTop3[2];

  let message = "";
  let color = "";

  if (isWin) {
    // Trifecta Payout
    const odds1 = parseFloat(raceEngine.getOdds(predictedTop3[0].name));
    const odds2 = parseFloat(raceEngine.getOdds(predictedTop3[1].name));
    const odds3 = parseFloat(raceEngine.getOdds(predictedTop3[2].name));

    // Payout Formula: Bet * (Odds1 * Odds2 * Odds3)
    // Capping at sane max if needed, but let's let it ride.
    const multiplier = Math.floor(odds1 * odds2 * odds3);
    const winnings = betAmount * multiplier;

    currentUser.balance += winnings;
    message = `大・大・大勝利！！ 3連単的中！\n${multiplier}倍！ 獲得: ¥${winnings.toLocaleString()}`;
    color = "#facc15"; // Gold
    dom.resultTitle.textContent = "JACKPOT!!";
    dom.resultTitle.style.color = "#facc15";
    dom.resultTitle.classList.add('glitch');
  } else {
    // Create detailed Lose message
    message = `ハズレ...\n正解: 1着${actualTop3[0].name}, 2着${actualTop3[1].name}, 3着${actualTop3[2].name}`;
    color = "#94a3b8";
    dom.resultTitle.textContent = "LOSE...";
    dom.resultTitle.style.color = "#ef4444";
    dom.resultTitle.classList.remove('glitch');
  }

  await Leaderboard.submitScore(currentUser.username, currentUser.balance, currentUser.bankruptcyCount, currentUser.password);
  Leaderboard.saveUserState(currentUser);
  updateHUD();

  dom.resultMessage.innerHTML = message.replace(/\n/g, '<br>'); // Allow multiline
  dom.resultMessage.style.color = color;

  showPage('result');
  loadResultLeaderboard();
}

async function loadResultLeaderboard() {
  dom.leaderboardBody.innerHTML = '<tr><td colspan="4">Loading...</td></tr>';
  const scores = await Leaderboard.getTopScores();

  dom.leaderboardBody.innerHTML = scores.map((s, i) => `
        <tr style="${s.username === currentUser.username ? 'background:rgba(250, 204, 21, 0.2);' : ''}">
            <td>#${i + 1}</td>
            <td>${s.username}</td>
            <td>¥${s.total_winnings}</td>
            <td style="text-align:center;">${s.bankruptcy_count > 0 ? '💀x' + s.bankruptcy_count : '-'}</td>
        </tr>
    `).join('');
}

// Start
init();
