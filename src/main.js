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
  document.addEventListener('click', (e) => {
    // Traverse up to find button or clickable card
    const target = e.target.closest('button, .horse-card, #btn-show-ranking, #btn-close-ranking');
    if (!target) return;

    // 1. ENTRY / START
    if (target.id === 'btn-start') {
      const name = dom.usernameInput.value.trim() || "Player";

      // New User / Name Change Reset
      if (currentUser.username !== name) {
        console.log("New User Detected. Resetting.");
        currentUser = {
          username: name,
          balance: 1000,
          bankruptcyCount: 0,
          hasAccount: true
        };
      } else {
        currentUser.hasAccount = true;
      }

      Leaderboard.saveUserState(currentUser);
      updateHUD();
      prepareRace();
      showPage('selection');
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

    // 6. HORSE CARD (Start Race)
    if (target.classList && target.classList.contains('horse-card')) {
      const index = parseInt(target.dataset.index);
      if (!isNaN(index)) {
        if (currentUser.balance < 100) {
          alert("資金が足りません！破産申請してください。");
          return;
        }
        startRaceInstant(index);
      }
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

function prepareRace() {
  raceEngine = new RaceEngine();
  selectedHorseIndex = null;

  // Slider Params
  const maxParams = currentUser.balance >= 100 ? currentUser.balance : 100;
  domBet.slider.max = maxParams;
  domBet.slider.value = Math.min(100, maxParams);
  domBet.display.textContent = `¥${domBet.slider.value}`;
  betAmount = parseInt(domBet.slider.value);

  // Render Horses
  dom.horseList.innerHTML = '';
  const horses = raceEngine.getHorses();

  horses.forEach((horse, index) => {
    const card = document.createElement('div');
    card.className = 'horse-card';
    card.dataset.index = index; // For event delegation
    card.innerHTML = `
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

function startRaceInstant(index) {
  // Final Validation
  let wager = parseInt(domBet.slider.value);
  if (isNaN(wager) || wager <= 0) wager = 100;
  if (wager > currentUser.balance) {
    alert("資金不足です！スライダーを修正します。");
    domBet.slider.value = currentUser.balance;
    domBet.display.textContent = `¥${currentUser.balance}`;
    return;
  }

  selectedHorseIndex = index;
  betAmount = wager;

  currentUser.balance -= betAmount;
  updateHUD();
  Leaderboard.saveUserState(currentUser);

  // Setup Track
  setupTrackUI();

  // Show betting info
  const raceInfo = document.getElementById('race-horse-name');
  if (raceInfo) {
    raceInfo.textContent = raceEngine.getHorses()[index].name;
    raceInfo.style.color = raceEngine.getHorses()[index].color;
  }

  showPage('race');
  dom.commentary.textContent = "And they're off!";

  // Main Loop
  let finished = false;
  raceInterval = setInterval(() => {
    if (finished) return;
    finished = raceEngine.tick();
    updateTrackUI();

    if (finished) {
      clearInterval(raceInterval);
      setTimeout(finishRace, 1500); // 1.5s delay to see finish
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
  const winner = raceEngine.getWinner();
  const userHorse = raceEngine.getHorses()[selectedHorseIndex];

  let message = "";
  let color = "";

  if (winner === userHorse) {
    const odds = parseFloat(raceEngine.getOdds(userHorse.name));
    const winnings = Math.floor(betAmount * odds);
    currentUser.balance += winnings;
    message = `的中！ ${userHorse.name} が勝利しました！ 獲得: ¥${winnings}`;
    color = "var(--primary)";
    dom.resultTitle.textContent = "WINNER!";
    dom.resultTitle.style.color = "var(--primary)";
  } else {
    message = `残念... 勝者は ${winner.name} でした。 -¥${betAmount}`;
    color = "#ef4444";
    dom.resultTitle.textContent = "LOSE...";
    dom.resultTitle.style.color = "#ef4444";
  }

  await Leaderboard.submitScore(currentUser.username, currentUser.balance, currentUser.bankruptcyCount);
  Leaderboard.saveUserState(currentUser);
  updateHUD();

  dom.resultMessage.textContent = message;
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
