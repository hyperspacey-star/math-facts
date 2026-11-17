(() => {
  'use strict';

  // ==================== GAME STATE ====================
  const state = {
    mode: 'mixed', // 'mixed' | 'tens' | 'ones'
    minuend: 500,
    subtrahend: 320,
    difference: 180,
    solvedCurrent: false,
    activeTab: 'number-line',

    // Score & Persistence
    score: 0,
    streak: 0,
    solvedCount: 0,

    // Tab 1: Number Line State
    nl: {
      currentPos: 320,
      hops: [], // [{ from, to, amount }]
    },

    // Tab 2: Decomposition State
    decomp: {
      steps: [], // [{ label, badgeClass, startVal, subtractVal, expectedVal, userVal, completed }]
    },

    // Tab 3: Base-10 Blocks State
    b10: {
      hundredsTotal: 5,
      hundredsCrossed: 0,
      tensTotal: 0,
      tensCrossed: 0,
      onesTotal: 0,
      onesCrossed: 0,
      targetH: 3,
      targetT: 2,
      targetO: 0,
    },
  };

  // Load saved stats from localStorage
  try {
    const saved = JSON.parse(localStorage.getItem('abigail_subtraction_stats') || '{}');
    if (typeof saved.score === 'number') state.score = saved.score;
    if (typeof saved.streak === 'number') state.streak = saved.streak;
    if (typeof saved.solvedCount === 'number') state.solvedCount = saved.solvedCount;
  } catch (_) {
    // Ignore storage errors
  }

  function saveStats() {
    try {
      localStorage.setItem(
        'abigail_subtraction_stats',
        JSON.stringify({
          score: state.score,
          streak: state.streak,
          solvedCount: state.solvedCount,
        })
      );
    } catch (_) {}
  }

  // ==================== DOM ELEMENTS ====================
  const el = {
    difficultySelect: document.getElementById('difficulty-select'),
    scoreValue: document.getElementById('score-value'),
    streakValue: document.getElementById('streak-value'),
    solvedValue: document.getElementById('solved-value'),

    problemTag: document.getElementById('problem-tag'),
    minuendDisplay: document.getElementById('minuend-display'),
    subtrahendDisplay: document.getElementById('subtrahend-display'),
    finalAnswerInput: document.getElementById('final-answer-input'),
    checkAnswerBtn: document.getElementById('check-answer-btn'),
    useHelperAnswerBtn: document.getElementById('use-helper-answer-btn'),
    newProblemBtn: document.getElementById('new-problem-btn'),

    feedbackBanner: document.getElementById('feedback-banner'),
    feedbackIcon: document.getElementById('feedback-icon'),
    feedbackTitle: document.getElementById('feedback-title'),
    feedbackMessage: document.getElementById('feedback-message'),
    nextAfterWinBtn: document.getElementById('next-after-win-btn'),

    tabButtons: document.querySelectorAll('.strategy-tab'),
    panels: {
      'number-line': document.getElementById('panel-number-line'),
      decomposition: document.getElementById('panel-decomposition'),
      base10: document.getElementById('panel-base10'),
    },

    // Number Line Elements
    nlStartNum: document.getElementById('nl-start-num'),
    nlTargetNum: document.getElementById('nl-target-num'),
    nlStatStart: document.getElementById('nl-stat-start'),
    nlStatCurrent: document.getElementById('nl-stat-current'),
    nlStatGoal: document.getElementById('nl-stat-goal'),
    nlStatDistance: document.getElementById('nl-stat-distance'),
    nlSvg: document.getElementById('number-line-svg'),
    nlJumpsEquation: document.getElementById('nl-jumps-equation'),
    nlGuidePrompt: document.getElementById('nl-guide-prompt'),
    nlSmartButtons: document.getElementById('nl-smart-buttons'),
    nlOnesGroup: document.getElementById('nl-ones-group'),
    nlOnesButtons: document.getElementById('nl-ones-buttons'),
    nlTensButtons: document.getElementById('nl-tens-buttons'),
    nlHundredsButtons: document.getElementById('nl-hundreds-buttons'),
    nlAutoGuideBtn: document.getElementById('nl-auto-guide-btn'),
    nlUndoBtn: document.getElementById('nl-undo-btn'),
    nlResetBtn: document.getElementById('nl-reset-btn'),

    // Decomposition Elements
    decompSubLabel: document.getElementById('decomp-sub-label'),
    bondTotalNode: document.getElementById('bond-total-node'),
    bondLineMid: document.getElementById('bond-line-mid'),
    bondLineRight: document.getElementById('bond-line-right'),
    bondPartsRow: document.getElementById('bond-parts-row'),
    decompBarWhole: document.getElementById('decomp-bar-whole'),
    decompBarSegments: document.getElementById('decomp-bar-segments'),
    decompStepsList: document.getElementById('decomp-steps-list'),
    decompRevealBtn: document.getElementById('decomp-reveal-btn'),
    decompResetBtn: document.getElementById('decomp-reset-btn'),

    // Base-10 Elements
    b10StartLabel: document.getElementById('b10-start-label'),
    b10SubLabel: document.getElementById('b10-sub-label'),
    b10AutoRegroupBtn: document.getElementById('b10-auto-regroup-btn'),
    b10ResetBtn: document.getElementById('b10-reset-btn'),
    tradeHundredBtn: document.getElementById('trade-hundred-btn'),
    tradeTenBtn: document.getElementById('trade-ten-btn'),
    b10Checklist: document.getElementById('b10-checklist'),
    b10RemainingValue: document.getElementById('b10-remaining-value'),
    b10NeedH: document.getElementById('b10-need-h'),
    b10NeedT: document.getElementById('b10-need-t'),
    b10NeedO: document.getElementById('b10-need-o'),
    b10CountH: document.getElementById('b10-count-h'),
    b10CountT: document.getElementById('b10-count-t'),
    b10CountO: document.getElementById('b10-count-o'),
    b10HundredsTray: document.getElementById('b10-hundreds-tray'),
    b10TensTray: document.getElementById('b10-tens-tray'),
    b10OnesTray: document.getElementById('b10-ones-tray'),
    b10OnesCol: document.getElementById('b10-ones-col'),

    confettiCanvas: document.getElementById('confetti-canvas'),
  };

  // ==================== SOUND SYNTHESIZER (WEB AUDIO API) ====================
  let audioCtx = null;
  function playTone(freq, duration = 0.12, type = 'sine', delay = 0) {
    try {
      if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) return;
        audioCtx = new AudioContextClass();
      }
      if (audioCtx.state === 'suspended') audioCtx.resume();
      const osc = audioCtx.createOscillator();
      const gain = audioCtx.createGain();
      osc.type = type;
      osc.frequency.setValueAtTime(freq, audioCtx.currentTime + delay);
      gain.gain.setValueAtTime(0.12, audioCtx.currentTime + delay);
      gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + delay + duration);
      osc.connect(gain);
      gain.connect(audioCtx.destination);
      osc.start(audioCtx.currentTime + delay);
      osc.stop(audioCtx.currentTime + delay + duration);
    } catch (_) {}
  }

  function playSuccessSound() {
    playTone(523.25, 0.12, 'triangle', 0);
    playTone(659.25, 0.12, 'triangle', 0.1);
    playTone(783.99, 0.14, 'triangle', 0.2);
    playTone(1046.5, 0.28, 'triangle', 0.3);
  }

  function playPopSound() {
    playTone(440, 0.08, 'sine', 0);
  }

  // ==================== PROBLEM GENERATOR ====================
  let isFirstBoot = true;

  function generateProblem() {
    state.solvedCurrent = false;
    el.finalAnswerInput.value = '';
    el.finalAnswerInput.classList.remove('correct-flash', 'wrong-shake');
    el.feedbackBanner.classList.add('hidden');
    el.nextAfterWinBtn.classList.add('hidden');
    el.useHelperAnswerBtn.classList.add('hidden');

    if (isFirstBoot) {
      // Start with the classic prompt example: 500 - 320
      isFirstBoot = false;
      state.minuend = 500;
      state.subtrahend = 320;
    } else {
      const hundredsChoices = [300, 400, 500, 600, 700, 800, 900];
      const minuend = hundredsChoices[Math.floor(Math.random() * hundredsChoices.length)];
      const maxSubHundreds = minuend / 100 - 1;
      const subHundreds = Math.floor(Math.random() * maxSubHundreds) + 1; // 1 .. maxSubHundreds
      const subTens = Math.floor(Math.random() * 8) + 1; // 1 .. 8 (never 0 so regrouping across zero is always required)

      let useOnes = false;
      if (state.mode === 'ones') {
        useOnes = true;
      } else if (state.mode === 'tens') {
        useOnes = false;
      } else {
        // 'mixed': 60% friendly multiples of 10 (like 600 - 180), 40% with ones (like 400 - 275)
        useOnes = Math.random() < 0.45;
      }

      const subOnes = useOnes ? Math.floor(Math.random() * 9) + 1 : 0;
      const candidateSub = subHundreds * 100 + subTens * 10 + subOnes;

      // Avoid repeating exact same problem back-to-back
      if (minuend === state.minuend && candidateSub === state.subtrahend) {
        state.minuend = minuend === 600 ? 400 : 600;
        state.subtrahend = state.minuend === 600 ? 180 : 275;
      } else {
        state.minuend = minuend;
        state.subtrahend = candidateSub;
      }
    }

    state.difference = state.minuend - state.subtrahend;

    // Update Main Equation UI
    el.minuendDisplay.textContent = state.minuend;
    el.subtrahendDisplay.textContent = state.subtrahend;
    const hasOnes = state.subtrahend % 10 !== 0;
    el.problemTag.textContent = hasOnes
      ? 'Regroup Across Two Zeros (100s → 10s → 1s)'
      : 'Regroup Across Zeros (Friendly Tens)';

    // Initialize all 3 strategy workspaces for the new problem
    initNumberLine();
    initDecomposition();
    initBase10();
    updateScoreboardUI();
  }

  function updateScoreboardUI() {
    el.scoreValue.textContent = state.score;
    el.streakValue.textContent = state.streak;
    el.solvedValue.textContent = state.solvedCount;
  }

  // ==================== STRATEGY 1: THE NUMBER LINE ====================
  function initNumberLine() {
    state.nl.currentPos = state.subtrahend;
    state.nl.hops = [];

    el.nlStartNum.textContent = state.subtrahend;
    el.nlTargetNum.textContent = state.minuend;
    el.nlStatStart.textContent = state.subtrahend;
    el.nlStatGoal.textContent = state.minuend;

    buildCustomHopButtons();
    renderNumberLine();
  }

  function buildCustomHopButtons() {
    const hasOnes = state.subtrahend % 10 !== 0;
    el.nlOnesGroup.style.display = hasOnes ? 'flex' : 'none';

    // Ones buttons (+1 to +9)
    el.nlOnesButtons.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const btn = document.createElement('button');
      btn.className = 'hop-btn hop-btn-ones';
      btn.textContent = `+${i}`;
      btn.addEventListener('click', () => addNumberLineHop(i));
      el.nlOnesButtons.appendChild(btn);
    }

    // Tens buttons (+10 to +90)
    el.nlTensButtons.innerHTML = '';
    for (let t = 10; t <= 90; t += 10) {
      const btn = document.createElement('button');
      btn.className = 'hop-btn hop-btn-tens';
      btn.textContent = `+${t}`;
      btn.addEventListener('click', () => addNumberLineHop(t));
      el.nlTensButtons.appendChild(btn);
    }

    // Hundreds buttons (+100 to +700)
    el.nlHundredsButtons.innerHTML = '';
    for (let h = 100; h <= 700; h += 100) {
      const btn = document.createElement('button');
      btn.className = 'hop-btn hop-btn-hundreds';
      btn.textContent = `+${h}`;
      btn.addEventListener('click', () => addNumberLineHop(h));
      el.nlHundredsButtons.appendChild(btn);
    }
  }

  function getNextFriendlyHop(pos, target) {
    const remaining = target - pos;
    if (remaining <= 0) return null;

    // 1. If not on a multiple of 10, hop to the next ten
    if (pos % 10 !== 0) {
      const toNextTen = 10 - (pos % 10);
      if (toNextTen <= remaining) {
        return {
          amount: toNextTen,
          to: pos + toNextTen,
          reason: `Make the next friendly ten (${pos + toNextTen})!`,
        };
      }
    }

    // 2. If on a multiple of 10 but not a multiple of 100, hop to the next hundred
    if (pos % 100 !== 0) {
      const toNextHundred = 100 - (pos % 100);
      if (toNextHundred <= remaining) {
        return {
          amount: toNextHundred,
          to: pos + toNextHundred,
          reason: `Hop to the next friendly hundred (${pos + toNextHundred})!`,
        };
      }
    }

    // 3. Hop the remaining hundreds straight to the target!
    return {
      amount: remaining,
      to: target,
      reason: `Big century jump straight to ${target}!`,
    };
  }

  function addNumberLineHop(amount) {
    const remaining = state.minuend - state.nl.currentPos;
    if (amount <= 0 || amount > remaining) return;

    const from = state.nl.currentPos;
    const to = from + amount;
    state.nl.hops.push({ from, to, amount });
    state.nl.currentPos = to;
    playPopSound();
    renderNumberLine();
  }

  function renderNumberLine() {
    const start = state.subtrahend;
    const end = state.minuend;
    const current = state.nl.currentPos;
    const totalJumped = current - start;

    el.nlStatCurrent.textContent = current;
    el.nlStatDistance.textContent = totalJumped;
    el.nlUndoBtn.disabled = state.nl.hops.length === 0;

    // Update Jumps Equation Summary
    if (state.nl.hops.length === 0) {
      el.nlJumpsEquation.textContent = 'Click a hop button below to start jumping!';
    } else {
      const parts = state.nl.hops.map((h) => `+${h.amount}`);
      const sumStr = state.nl.hops.map((h) => h.amount).join(' + ');
      if (current === end) {
        el.nlJumpsEquation.innerHTML = `${sumStr} = <strong>${totalJumped}</strong> 🎉 (You reached ${end}!)`;
        offerHelperAnswer(totalJumped);
      } else {
        el.nlJumpsEquation.textContent = `${parts.join('  ')}  ➜  Total so far: ${totalJumped}`;
      }
    }

    // Update Guided Smart Button
    el.nlSmartButtons.innerHTML = '';
    const nextSmart = getNextFriendlyHop(current, end);
    if (!nextSmart) {
      el.nlGuidePrompt.innerHTML = `🎉 You reached <strong>${end}</strong>! Total distance = <strong>${totalJumped}</strong>.`;
      const copyBtn = document.createElement('button');
      copyBtn.className = 'hop-btn hop-btn-smart';
      copyBtn.textContent = `✨ Put ${totalJumped} in Answer Box`;
      copyBtn.addEventListener('click', () => {
        el.finalAnswerInput.value = totalJumped;
        checkAnswer();
      });
      el.nlSmartButtons.appendChild(copyBtn);
    } else {
      el.nlGuidePrompt.textContent = nextSmart.reason;
      const smartBtn = document.createElement('button');
      smartBtn.className = 'hop-btn hop-btn-smart';
      smartBtn.textContent = `🐸 Hop +${nextSmart.amount} (to ${nextSmart.to})`;
      smartBtn.addEventListener('click', () => addNumberLineHop(nextSmart.amount));
      el.nlSmartButtons.appendChild(smartBtn);
    }

    // Enable/Disable Custom Hop Buttons based on remaining distance
    const remaining = end - current;
    document.querySelectorAll('#panel-number-line .hop-btn-row .hop-btn').forEach((btn) => {
      const val = parseInt(btn.textContent.replace('+', ''), 10);
      btn.disabled = val > remaining;
    });

    // Draw SVG Number Line
    drawNumberLineSVG();
  }

  function drawNumberLineSVG() {
    const svg = el.nlSvg;
    svg.innerHTML = '';

    const W = 900;
    const H = 230;
    const padX = 65;
    const lineY = 165;
    const usableW = W - padX * 2;
    const span = Math.max(1, state.minuend - state.subtrahend);

    const valToX = (val) => padX + ((val - state.subtrahend) / span) * usableW;

    // 1. Base horizontal track line
    const baseLine = createSVG('line', {
      x1: padX - 15,
      y1: lineY,
      x2: W - padX + 15,
      y2: lineY,
      stroke: '#94a3b8',
      'stroke-width': 5,
      'stroke-linecap': 'round',
    });
    svg.appendChild(baseLine);

    // Progress colored line up to current position
    if (state.nl.currentPos > state.subtrahend) {
      const progLine = createSVG('line', {
        x1: valToX(state.subtrahend),
        y1: lineY,
        x2: valToX(state.nl.currentPos),
        y2: lineY,
        stroke: '#10b981',
        'stroke-width': 6,
        'stroke-linecap': 'round',
      });
      svg.appendChild(progLine);
    }

    // 2. Collect important tick marks: start, end, intermediate hundreds, and hop landings
    const ticks = new Map();
    ticks.set(state.subtrahend, { type: 'endpoint', label: state.subtrahend });
    ticks.set(state.minuend, { type: 'endpoint', label: state.minuend });

    const firstHundred = Math.ceil(state.subtrahend / 100) * 100;
    for (let h = firstHundred; h < state.minuend; h += 100) {
      if (h > state.subtrahend) {
        ticks.set(h, { type: 'hundred', label: h });
      }
    }

    state.nl.hops.forEach((hop) => {
      ticks.set(hop.to, { type: 'landing', label: hop.to });
    });

    // Draw Ticks
    ticks.forEach((info, val) => {
      const x = valToX(val);
      const isEnd = info.type === 'endpoint';
      const isLanding = info.type === 'landing';

      const tickLine = createSVG('line', {
        x1: x,
        y1: lineY - (isEnd ? 14 : 10),
        x2: x,
        y2: lineY + (isEnd ? 14 : 10),
        stroke: isEnd ? '#1e293b' : isLanding ? '#0284c7' : '#64748b',
        'stroke-width': isEnd ? 4 : 3,
        'stroke-linecap': 'round',
      });
      svg.appendChild(tickLine);

      const text = createSVG('text', {
        x,
        y: lineY + 36,
        'text-anchor': 'middle',
        fill: isEnd ? '#0f172a' : isLanding ? '#0369a1' : '#475569',
        'font-family': 'Fredoka, sans-serif',
        'font-size': isEnd ? '20' : '16',
        'font-weight': '700',
      });
      text.textContent = info.label;
      svg.appendChild(text);
    });

    // 3. Draw Hop Arcs
    state.nl.hops.forEach((hop, idx) => {
      const x1 = valToX(hop.from);
      const x2 = valToX(hop.to);
      const midX = (x1 + x2) / 2;
      const distPx = x2 - x1;
      const arcHeight = Math.min(115, Math.max(48, distPx * 0.36));
      const ctrlY = lineY - arcHeight * 1.45;

      const palette = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b'];
      const color = palette[idx % palette.length];

      const path = createSVG('path', {
        d: `M ${x1} ${lineY - 6} Q ${midX} ${ctrlY} ${x2} ${lineY - 6}`,
        fill: 'none',
        stroke: color,
        'stroke-width': 4,
        'stroke-dasharray': 'none',
        'stroke-linecap': 'round',
      });
      svg.appendChild(path);

      // Badge at peak of quadratic curve (peak Y is at 0.5 * lineY + 0.5 * ctrlY)
      const peakY = 0.5 * (lineY - 6) + 0.5 * ctrlY - 10;
      const badgeW = 62;
      const badgeH = 28;

      const rect = createSVG('rect', {
        x: midX - badgeW / 2,
        y: peakY - badgeH / 2,
        width: badgeW,
        height: badgeH,
        rx: 10,
        fill: color,
      });
      svg.appendChild(rect);

      const label = createSVG('text', {
        x: midX,
        y: peakY + 6,
        'text-anchor': 'middle',
        fill: '#ffffff',
        'font-family': 'Fredoka, sans-serif',
        'font-size': '16',
        'font-weight': '700',
      });
      label.textContent = `+${hop.amount}`;
      svg.appendChild(label);
    });

    // 4. Draw Frog Marker at Current Position
    const frogX = valToX(state.nl.currentPos);
    const frogCircle = createSVG('circle', {
      cx: frogX,
      cy: lineY,
      r: 14,
      fill: '#fef08a',
      stroke: '#ca8a04',
      'stroke-width': 3,
    });
    svg.appendChild(frogCircle);

    const frogEmoji = createSVG('text', {
      x: frogX,
      y: lineY + 6,
      'text-anchor': 'middle',
      'font-size': '18',
    });
    frogEmoji.textContent = '🐸';
    svg.appendChild(frogEmoji);
  }

  function createSVG(tag, attrs) {
    const node = document.createElementNS('http://www.w3.org/2000/svg', tag);
    for (const [k, v] of Object.entries(attrs)) {
      node.setAttribute(k, String(v));
    }
    return node;
  }

  // ==================== STRATEGY 2: DECOMPOSITION ====================
  function initDecomposition() {
    const sub = state.subtrahend;
    const hVal = Math.floor(sub / 100) * 100;
    const tVal = Math.floor((sub % 100) / 10) * 10;
    const oVal = sub % 10;

    el.decompSubLabel.textContent = sub;
    el.bondTotalNode.textContent = sub;

    // Render Number Bond Parts
    el.bondPartsRow.innerHTML = '';
    const parts = [];
    if (hVal > 0) parts.push({ val: hVal, name: 'Hundreds', cls: 'part-hundreds', color: '#6366f1' });
    if (tVal > 0) parts.push({ val: tVal, name: 'Tens', cls: 'part-tens', color: '#0ea5e9' });
    if (oVal > 0) parts.push({ val: oVal, name: 'Ones', cls: 'part-ones', color: '#10b981' });

    // Adjust SVG connector lines based on 2 vs 3 parts
    if (parts.length === 2) {
      el.bondLineMid.style.display = 'none';
      el.bondLineRight.setAttribute('stroke', '#0ea5e9');
    } else {
      el.bondLineMid.style.display = 'block';
      el.bondLineRight.setAttribute('stroke', '#10b981');
    }

    parts.forEach((p) => {
      const pill = document.createElement('div');
      pill.className = `bond-part-pill ${p.cls}`;
      pill.innerHTML = `${p.val}<span>${p.name}</span>`;
      el.bondPartsRow.appendChild(pill);
    });

    // Build Step-by-Step Interactive List
    state.decomp.steps = [];
    let runningVal = state.minuend;
    parts.forEach((p, idx) => {
      const nextVal = runningVal - p.val;
      state.decomp.steps.push({
        stepNum: idx + 1,
        label: `Step ${idx + 1}: Subtract ${p.name}`,
        color: p.color,
        cls: p.cls,
        startVal: runningVal,
        subtractVal: p.val,
        expectedVal: nextVal,
        userVal: '',
        completed: false,
      });
      runningVal = nextVal;
    });

    renderDecompositionSteps();
    renderDecompBar();
  }

  function renderDecompBar() {
    el.decompBarWhole.textContent = `Starting Total: ${state.minuend}`;
    el.decompBarSegments.innerHTML = '';

    const steps = state.decomp.steps;
    let remaining = state.minuend;

    steps.forEach((st) => {
      if (st.completed) {
        remaining -= st.subtractVal;
        const pct = (st.subtractVal / state.minuend) * 100;
        const seg = document.createElement('div');
        seg.className = 'bar-seg';
        seg.style.width = `${pct}%`;
        seg.style.background = st.color;
        seg.textContent = `−${st.subtractVal}`;
        el.decompBarSegments.appendChild(seg);
      }
    });

    const remPct = (remaining / state.minuend) * 100;
    const remSeg = document.createElement('div');
    remSeg.className = 'bar-seg';
    remSeg.style.width = `${remPct}%`;
    remSeg.style.background = '#f59e0b';
    remSeg.textContent = `${remaining} left`;
    el.decompBarSegments.appendChild(remSeg);
  }

  function renderDecompositionSteps() {
    el.decompStepsList.innerHTML = '';

    state.decomp.steps.forEach((step, idx) => {
      const isUnlocked = idx === 0 || state.decomp.steps[idx - 1].completed;
      const card = document.createElement('div');
      card.className = `decomp-step-card ${!isUnlocked ? 'step-locked' : ''} ${
        step.completed ? 'step-done' : ''
      }`;

      const badge = document.createElement('span');
      badge.className = `step-badge ${step.cls}`;
      badge.textContent = step.label;

      const eqRow = document.createElement('div');
      eqRow.className = 'step-eq-row';
      eqRow.innerHTML = `
        <span>${step.startVal}</span>
        <span>−</span>
        <span style="color:${step.color}">${step.subtractVal}</span>
        <span>=</span>
      `;

      const input = document.createElement('input');
      input.type = 'number';
      input.className = `step-input ${step.completed ? 'input-correct' : ''}`;
      input.placeholder = '?';
      input.value = step.userVal;
      input.disabled = !isUnlocked || step.completed;

      input.addEventListener('input', () => {
        step.userVal = input.value;
        const parsed = parseInt(input.value, 10);
        if (parsed === step.expectedVal) {
          step.completed = true;
          playPopSound();
          renderDecompositionSteps();
          renderDecompBar();
          if (idx === state.decomp.steps.length - 1) {
            offerHelperAnswer(step.expectedVal);
          }
        }
      });

      eqRow.appendChild(input);

      const rightWrap = document.createElement('div');
      if (step.completed) {
        rightWrap.innerHTML = '<span style="font-size:1.3rem;">✅</span>';
      } else if (isUnlocked) {
        const quickBtn = document.createElement('button');
        quickBtn.className = 'step-quick-btn';
        quickBtn.textContent = `Show (${step.expectedVal})`;
        quickBtn.addEventListener('click', () => {
          step.userVal = String(step.expectedVal);
          step.completed = true;
          playPopSound();
          renderDecompositionSteps();
          renderDecompBar();
          if (idx === state.decomp.steps.length - 1) {
            offerHelperAnswer(step.expectedVal);
          }
        });
        rightWrap.appendChild(quickBtn);
      }

      card.appendChild(badge);
      card.appendChild(eqRow);
      card.appendChild(rightWrap);
      el.decompStepsList.appendChild(card);
    });
  }

  // ==================== STRATEGY 3: BASE-10 BLOCKS ====================
  function initBase10() {
    const sub = state.subtrahend;
    state.b10.hundredsTotal = state.minuend / 100;
    state.b10.hundredsCrossed = 0;
    state.b10.tensTotal = 0;
    state.b10.tensCrossed = 0;
    state.b10.onesTotal = 0;
    state.b10.onesCrossed = 0;

    state.b10.targetH = Math.floor(sub / 100);
    state.b10.targetT = Math.floor((sub % 100) / 10);
    state.b10.targetO = sub % 10;

    el.b10StartLabel.textContent = state.minuend;
    el.b10SubLabel.textContent = state.subtrahend;
    el.b10NeedH.textContent = state.b10.targetH;
    el.b10NeedT.textContent = state.b10.targetT;
    el.b10NeedO.textContent = state.b10.targetO;

    // Show or dim the Trade Ten -> 10 Ones button based on whether problem has ones
    el.tradeTenBtn.style.display = state.b10.targetO > 0 ? 'inline-flex' : 'none';

    renderBase10();
  }

  function tradeHundredForTens() {
    const uncrossedHundreds = state.b10.hundredsTotal - state.b10.hundredsCrossed;
    if (uncrossedHundreds <= 0) return;
    state.b10.hundredsTotal -= 1;
    state.b10.tensTotal += 10;
    playPopSound();
    renderBase10();
  }

  function tradeTenForOnes() {
    const uncrossedTens = state.b10.tensTotal - state.b10.tensCrossed;
    if (uncrossedTens <= 0) return;
    state.b10.tensTotal -= 1;
    state.b10.onesTotal += 10;
    playPopSound();
    renderBase10();
  }

  function autoRegroupAndCrossOut() {
    // Reset to initial blocks first
    initBase10();

    // 1. Trade 1 hundred for 10 tens
    state.b10.hundredsTotal -= 1;
    state.b10.tensTotal += 10;

    // 2. If ones are needed, trade 1 ten for 10 ones
    if (state.b10.targetO > 0) {
      state.b10.tensTotal -= 1;
      state.b10.onesTotal += 10;
    }

    // 3. Cross out target H, T, O
    state.b10.hundredsCrossed = state.b10.targetH;
    state.b10.tensCrossed = state.b10.targetT;
    state.b10.onesCrossed = state.b10.targetO;

    playPopSound();
    renderBase10();
  }

  function renderBase10() {
    const b = state.b10;
    const remH = b.hundredsTotal - b.hundredsCrossed;
    const remT = b.tensTotal - b.tensCrossed;
    const remO = b.onesTotal - b.onesCrossed;
    const currentRemainingVal = remH * 100 + remT * 10 + remO;

    el.b10CountH.textContent = `${remH} left`;
    el.b10CountT.textContent = `${remT} left`;
    el.b10CountO.textContent = `${remO} left`;
    el.b10RemainingValue.textContent = currentRemainingVal;

    // Enable/disable trade buttons
    el.tradeHundredBtn.disabled = remH <= 0;
    el.tradeTenBtn.disabled = remT <= 0;

    // Render Subtraction Checklist Pills
    el.b10Checklist.innerHTML = '';
    const checks = [
      { label: 'Hundreds Crossed', cur: b.hundredsCrossed, target: b.targetH },
      { label: 'Tens Crossed', cur: b.tensCrossed, target: b.targetT },
    ];
    if (b.targetO > 0 || b.onesTotal > 0) {
      checks.push({ label: 'Ones Crossed', cur: b.onesCrossed, target: b.targetO });
    }

    checks.forEach((c) => {
      const pill = document.createElement('div');
      const statusCls = c.cur === c.target ? 'done' : c.cur > c.target ? 'over' : '';
      pill.className = `check-pill ${statusCls}`;
      const icon = c.cur === c.target ? '✅' : c.cur > c.target ? '⚠️' : '⬜';
      pill.innerHTML = `${icon} ${c.label}: <strong>${c.cur} / ${c.target}</strong>`;
      el.b10Checklist.appendChild(pill);
    });

    // Check if exact subtraction achieved
    if (
      b.hundredsCrossed === b.targetH &&
      b.tensCrossed === b.targetT &&
      b.onesCrossed === b.targetO &&
      currentRemainingVal === state.difference
    ) {
      offerHelperAnswer(currentRemainingVal);
    }

    // 1. Render Hundreds Tray
    el.b10HundredsTray.innerHTML = '';
    for (let i = 0; i < b.hundredsTotal; i++) {
      const isCrossed = i >= b.hundredsTotal - b.hundredsCrossed;
      const block = document.createElement('div');
      block.className = `b10-block block-hundred ${isCrossed ? 'crossed-out' : ''}`;
      block.title = isCrossed ? 'Click to un-cross this 100 flat' : 'Click to cross out 100';
      block.innerHTML = '<span class="block-label">100</span>';
      block.addEventListener('click', () => {
        if (isCrossed) {
          b.hundredsCrossed = Math.max(0, b.hundredsCrossed - 1);
        } else {
          b.hundredsCrossed = Math.min(b.hundredsTotal, b.hundredsCrossed + 1);
        }
        playPopSound();
        renderBase10();
      });
      el.b10HundredsTray.appendChild(block);
    }

    // 2. Render Tens Tray
    el.b10TensTray.innerHTML = '';
    if (b.tensTotal === 0) {
      const msg = document.createElement('div');
      msg.className = 'empty-tray-msg';
      msg.textContent = '0 tens right now! Click "🔨 Trade 1 Hundred ➜ 10 Tens" above to unpack a hundred flat!';
      el.b10TensTray.appendChild(msg);
    } else {
      for (let i = 0; i < b.tensTotal; i++) {
        const isCrossed = i >= b.tensTotal - b.tensCrossed;
        const block = document.createElement('div');
        block.className = `b10-block block-ten ${isCrossed ? 'crossed-out' : ''}`;
        block.title = isCrossed ? 'Click to un-cross this 10 rod' : 'Click to cross out 10';
        block.innerHTML = '<span class="block-label">10</span>';
        block.addEventListener('click', () => {
          if (isCrossed) {
            b.tensCrossed = Math.max(0, b.tensCrossed - 1);
          } else {
            b.tensCrossed = Math.min(b.tensTotal, b.tensCrossed + 1);
          }
          playPopSound();
          renderBase10();
        });
        el.b10TensTray.appendChild(block);
      }
    }

    // 3. Render Ones Tray
    el.b10OnesTray.innerHTML = '';
    if (b.onesTotal === 0) {
      const msg = document.createElement('div');
      msg.className = 'empty-tray-msg';
      msg.textContent =
        b.targetO > 0
          ? '0 ones right now! Trade 1 Hundred ➜ 10 Tens, then Trade 1 Ten ➜ 10 Ones!'
          : 'No ones needed for this problem!';
      el.b10OnesTray.appendChild(msg);
    } else {
      for (let i = 0; i < b.onesTotal; i++) {
        const isCrossed = i >= b.onesTotal - b.onesCrossed;
        const block = document.createElement('div');
        block.className = `b10-block block-one ${isCrossed ? 'crossed-out' : ''}`;
        block.textContent = '1';
        block.addEventListener('click', () => {
          if (isCrossed) {
            b.onesCrossed = Math.max(0, b.onesCrossed - 1);
          } else {
            b.onesCrossed = Math.min(b.onesTotal, b.onesCrossed + 1);
          }
          playPopSound();
          renderBase10();
        });
        el.b10OnesTray.appendChild(block);
      }
    }
  }

  // ==================== ANSWER CHECKING & FEEDBACK ====================
  function offerHelperAnswer(val) {
    el.useHelperAnswerBtn.classList.remove('hidden');
    el.useHelperAnswerBtn.onclick = () => {
      el.finalAnswerInput.value = val;
      checkAnswer();
    };
  }

  const praiseTitles = [
    'Spectacular job, Abigail! 🌟',
    'You nailed it, Abigail! 🎉',
    'Superstar Math Wizard Abigail! 🚀',
    'Brilliant thinking, Abigail! 🏆',
    'Boom! Right on target, Abigail! ✨',
  ];

  function checkAnswer() {
    const raw = el.finalAnswerInput.value.trim();
    if (raw === '') {
      showFeedback(
        'hint',
        '✏️',
        'Type your answer first, Abigail!',
        `Use the Number Line, Decomposition, or Base-10 Blocks below to find ${state.minuend} − ${state.subtrahend}.`
      );
      el.finalAnswerInput.focus();
      return;
    }

    const userAns = parseInt(raw, 10);
    if (userAns === state.difference) {
      // Correct!
      el.finalAnswerInput.classList.remove('wrong-shake');
      el.finalAnswerInput.classList.add('correct-flash');

      if (!state.solvedCurrent) {
        state.solvedCurrent = true;
        state.streak += 1;
        state.solvedCount += 1;
        const bonus = state.streak >= 3 ? 15 : 10;
        state.score += bonus;
        saveStats();
        updateScoreboardUI();
      }

      playSuccessSound();
      launchConfetti();

      const title = praiseTitles[Math.floor(Math.random() * praiseTitles.length)];
      showFeedback(
        'success',
        '🎉',
        title,
        `${state.minuend} − ${state.subtrahend} = ${state.difference}! Because ${state.subtrahend} + ${state.difference} = ${state.minuend}.`
      );
      el.nextAfterWinBtn.classList.remove('hidden');
    } else {
      // Incorrect — give a smart, encouraging diagnostic hint!
      state.streak = 0;
      saveStats();
      updateScoreboardUI();

      el.finalAnswerInput.classList.remove('correct-flash');
      void el.finalAnswerInput.offsetWidth; // trigger reflow
      el.finalAnswerInput.classList.add('wrong-shake');

      let hintMsg = `Not quite ${userAns}! Try using one of the 3 visual tabs below to check each step.`;
      if (userAns === state.difference + 100) {
        hintMsg = `So close, Abigail! Your answer (${userAns}) is 100 too high. Remember: when we trade 1 Hundred for 10 Tens, we have 1 fewer Hundred left!`;
      } else if (userAns === state.difference + 10) {
        hintMsg = `Almost there, Abigail! Your answer (${userAns}) is just 10 too high. Remember to trade 1 Ten when regrouping for the Ones!`;
      } else if (Math.abs(userAns - state.difference) <= 20) {
        hintMsg = `You're super close, Abigail! Double-check your tens or ones step below.`;
      }

      showFeedback('hint', '💡', 'Almost there, Abigail! Keep going!', hintMsg);
    }
  }

  function showFeedback(type, icon, title, message) {
    el.feedbackBanner.className = `feedback-banner ${type}`;
    el.feedbackIcon.textContent = icon;
    el.feedbackTitle.textContent = title;
    el.feedbackMessage.textContent = message;
  }

  // ==================== CONFETTI ENGINE ====================
  let confettiParticles = [];
  let confettiAnimId = null;

  function launchConfetti() {
    const canvas = el.confettiCanvas;
    const ctx = canvas.getContext('2d');
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const colors = ['#6366f1', '#f59e0b', '#10b981', '#ec4899', '#0ea5e9', '#a855f7'];
    confettiParticles = Array.from({ length: 85 }, () => ({
      x: canvas.width * 0.5 + (Math.random() - 0.5) * 260,
      y: canvas.height * 0.28,
      vx: (Math.random() - 0.5) * 14,
      vy: -(Math.random() * 10 + 4),
      size: Math.random() * 8 + 5,
      color: colors[Math.floor(Math.random() * colors.length)],
      rot: Math.random() * Math.PI * 2,
      vRot: (Math.random() - 0.5) * 0.2,
      life: 0,
      maxLife: 75 + Math.random() * 25,
    }));

    if (confettiAnimId) cancelAnimationFrame(confettiAnimId);

    function step() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      let alive = false;
      confettiParticles.forEach((p) => {
        p.life++;
        if (p.life < p.maxLife) {
          alive = true;
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.35; // gravity
          p.rot += p.vRot;

          ctx.save();
          ctx.translate(p.x, p.y);
          ctx.rotate(p.rot);
          ctx.fillStyle = p.color;
          ctx.fillRect(-p.size / 2, -p.size / 2, p.size, p.size * 0.65);
          ctx.restore();
        }
      });

      if (alive) {
        confettiAnimId = requestAnimationFrame(step);
      } else {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
    }

    confettiAnimId = requestAnimationFrame(step);
  }

  // ==================== EVENT LISTENERS ====================
  function bindEvents() {
    // Strategy Tabs
    el.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        const targetTab = btn.dataset.tab;
        state.activeTab = targetTab;
        el.tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        Object.entries(el.panels).forEach(([key, panel]) => {
          panel.classList.toggle('active', key === targetTab);
        });
      });
    });

    // Difficulty Mode Change
    el.difficultySelect.addEventListener('change', (e) => {
      state.mode = e.target.value;
      generateProblem();
    });

    // Main Equation Controls
    el.checkAnswerBtn.addEventListener('click', checkAnswer);
    el.newProblemBtn.addEventListener('click', generateProblem);
    el.nextAfterWinBtn.addEventListener('click', generateProblem);
    el.finalAnswerInput.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') checkAnswer();
    });

    // Number Line Controls
    el.nlAutoGuideBtn.addEventListener('click', () => {
      const next = getNextFriendlyHop(state.nl.currentPos, state.minuend);
      if (next) addNumberLineHop(next.amount);
    });

    el.nlUndoBtn.addEventListener('click', () => {
      if (state.nl.hops.length === 0) return;
      const popped = state.nl.hops.pop();
      state.nl.currentPos = popped.from;
      renderNumberLine();
    });

    el.nlResetBtn.addEventListener('click', initNumberLine);

    // Decomposition Controls
    el.decompRevealBtn.addEventListener('click', () => {
      const nextStep = state.decomp.steps.find((s) => !s.completed);
      if (nextStep) {
        nextStep.userVal = String(nextStep.expectedVal);
        nextStep.completed = true;
        playPopSound();
        renderDecompositionSteps();
        renderDecompBar();
        if (state.decomp.steps.every((s) => s.completed)) {
          offerHelperAnswer(state.difference);
        }
      }
    });

    el.decompResetBtn.addEventListener('click', initDecomposition);

    // Base-10 Controls
    el.tradeHundredBtn.addEventListener('click', tradeHundredForTens);
    el.tradeTenBtn.addEventListener('click', tradeTenForOnes);
    el.b10AutoRegroupBtn.addEventListener('click', autoRegroupAndCrossOut);
    el.b10ResetBtn.addEventListener('click', initBase10);
  }

  // Boot the game
  bindEvents();
  generateProblem();
})();
