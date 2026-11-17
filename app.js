(() => {
  'use strict';

  const STORAGE_KEY = 'abigail_subtraction_stats_v2';
  const IDLE_TIMEOUT_MS = 45000; // Pause TV timer after 45s without interaction
  const SECONDS_PER_TV_HOUR = 3600;
  const TEST_QUESTION_COUNT = 5;
  const TEST_TIME_PER_QUESTION = 45; // 45 seconds per test problem

  // ==================== GAME STATE ====================
  const state = {
    mode: 'level2', // 'level1' | 'level2' | 'level3'
    minuend: 500,
    subtrahend: 320,
    difference: 180,
    solvedCurrent: false,
    activeTab: 'number-line',

    // Score & Mastery Progression
    score: 0,
    streak: 0,
    solvedCount: 0,
    levelProgress: 0, // 0..5 toward Mastery Test

    // Active Playtime & TV Reward System
    activeSeconds: 0, // 0..3599 towards next 1-hr pass
    tvPasses: 0,
    lastActivityTs: Date.now(),
    isActivelyPlaying: true,

    // Timed Mastery Test State
    testMode: {
      active: false,
      questionIndex: 0, // 0..4
      correctCount: 0,
      results: [], // ('pass' | 'fail')[]
      secondsLeft: TEST_TIME_PER_QUESTION,
      timerId: null,
    },

    // Tab 1: Number Line State
    nl: {
      currentPos: 320,
      hops: [],
    },

    // Tab 2: Decomposition State
    decomp: {
      steps: [],
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
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
    if (typeof saved.score === 'number') state.score = saved.score;
    if (typeof saved.streak === 'number') state.streak = saved.streak;
    if (typeof saved.solvedCount === 'number') state.solvedCount = saved.solvedCount;
    if (typeof saved.levelProgress === 'number') state.levelProgress = saved.levelProgress;
    if (typeof saved.activeSeconds === 'number') state.activeSeconds = saved.activeSeconds;
    if (typeof saved.tvPasses === 'number') state.tvPasses = saved.tvPasses;
    if (saved.mode && ['level1', 'level2', 'level3'].includes(saved.mode)) {
      state.mode = saved.mode;
    }
  } catch (_) {}

  function saveStats() {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          score: state.score,
          streak: state.streak,
          solvedCount: state.solvedCount,
          levelProgress: state.levelProgress,
          activeSeconds: state.activeSeconds,
          tvPasses: state.tvPasses,
          mode: state.mode,
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

    // TV Reward Elements
    activityStatusDot: document.getElementById('activity-status-dot'),
    activityStatusLabel: document.getElementById('activity-status-label'),
    tvTimeReadout: document.getElementById('tv-time-readout'),
    tvProgressFill: document.getElementById('tv-progress-fill'),
    tvEarnedSummary: document.getElementById('tv-earned-summary'),
    tvTicketsCount: document.getElementById('tv-tickets-count'),
    redeemTvBtn: document.getElementById('redeem-tv-btn'),

    // Mastery Elements
    currentLevelBadge: document.getElementById('current-level-badge'),
    masteryProgressText: document.getElementById('mastery-progress-text'),
    masteryDots: document.getElementById('mastery-dots'),
    masteryDesc: document.getElementById('mastery-desc'),
    startTestBtn: document.getElementById('start-test-btn'),

    // Timed Test Mode Elements
    testModeBanner: document.getElementById('test-mode-banner'),
    testBannerTitle: document.getElementById('test-banner-title'),
    testBannerSubtitle: document.getElementById('test-banner-subtitle'),
    testTimerSeconds: document.getElementById('test-timer-seconds'),
    testTimerBarFill: document.getElementById('test-timer-bar-fill'),
    testScoreDisplay: document.getElementById('test-score-display'),
    cancelTestBtn: document.getElementById('cancel-test-btn'),
    testLockedWorkspace: document.getElementById('test-locked-workspace'),
    testQuestionPills: document.getElementById('test-question-pills'),

    strategyTabsNav: document.getElementById('strategy-tabs-nav'),
    workspaceMain: document.getElementById('workspace-main'),

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
    b10Instruction: document.getElementById('b10-instruction'),
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

  function playLevelUpSound() {
    playTone(440, 0.12, 'triangle', 0);
    playTone(554.37, 0.12, 'triangle', 0.1);
    playTone(659.25, 0.12, 'triangle', 0.2);
    playTone(880, 0.18, 'triangle', 0.3);
    playTone(1108.73, 0.35, 'triangle', 0.45);
  }

  function playPopSound() {
    playTone(440, 0.08, 'sine', 0);
  }

  // ==================== ACTIVE PLAYTIME & TV REWARD TRACKER ====================
  function recordUserActivity() {
    state.lastActivityTs = Date.now();
    if (!state.isActivelyPlaying) {
      state.isActivelyPlaying = true;
      renderTvRewardUI();
    }
  }

  function formatMinutesSeconds(totalSec) {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  }

  function tickActivePlayTimer() {
    const now = Date.now();
    const isVisible = document.visibilityState === 'visible';
    const isRecent = now - state.lastActivityTs < IDLE_TIMEOUT_MS;
    const activeNow = isVisible && isRecent;

    if (activeNow) {
      state.isActivelyPlaying = true;
      state.activeSeconds += 1;

      if (state.activeSeconds >= SECONDS_PER_TV_HOUR) {
        state.activeSeconds -= SECONDS_PER_TV_HOUR;
        state.tvPasses += 1;
        playLevelUpSound();
        launchConfetti();
        showFeedback(
          'success',
          '📺🎟️',
          '1-Hour TV Pass Unlocked, Abigail!',
          'You completed a full hour of active math practice and earned 1 Hour of TV Time!'
        );
      }

      if (state.activeSeconds % 5 === 0) {
        saveStats();
      }
    } else {
      state.isActivelyPlaying = false;
    }

    renderTvRewardUI();
  }

  function renderTvRewardUI() {
    const pct = Math.min(100, (state.activeSeconds / SECONDS_PER_TV_HOUR) * 100);
    const earnedMinutes = Math.floor(state.activeSeconds / 60);

    el.tvTimeReadout.textContent = `${formatMinutesSeconds(state.activeSeconds)} / 60:00`;
    el.tvProgressFill.style.width = `${pct.toFixed(1)}%`;
    el.tvTicketsCount.textContent = state.tvPasses;
    el.redeemTvBtn.disabled = state.tvPasses <= 0;

    const totalTvMinutesBanked = state.tvPasses * 60 + earnedMinutes;
    el.tvEarnedSummary.innerHTML = `Earned so far: <strong>${totalTvMinutesBanked} min</strong> of TV time (1 hr active play = 1 hr TV!)`;

    if (state.isActivelyPlaying) {
      el.activityStatusDot.className = 'activity-dot active';
      el.activityStatusLabel.className = 'activity-badge active';
      el.activityStatusLabel.textContent = '⚡ Active Play Counting';
    } else {
      el.activityStatusDot.className = 'activity-dot paused';
      el.activityStatusLabel.className = 'activity-badge paused';
      el.activityStatusLabel.textContent = '⏸️ Paused (Click or Type to Resume)';
    }
  }

  // ==================== MASTERY & LEVEL PROGRESSION ====================
  const LEVEL_NAMES = {
    level1: 'Level 1: Friendly Tens',
    level2: 'Level 2: Across Zeros Mix',
    level3: 'Level 3: Full 3-Digit Regrouping',
  };

  function renderMasteryUI() {
    el.difficultySelect.value = state.mode;
    el.currentLevelBadge.textContent = LEVEL_NAMES[state.mode] || 'Level 2';

    const capped = Math.min(5, state.levelProgress);
    el.masteryProgressText.textContent = `${capped} / 5 to Mastery Test`;

    const dots = el.masteryDots.querySelectorAll('.m-dot');
    dots.forEach((dot, idx) => {
      dot.classList.toggle('filled', idx < capped);
    });

    if (capped >= 5) {
      el.startTestBtn.classList.add('pulse-ready');
      el.startTestBtn.textContent = '⚡ Take Mastery Test Now!';
      el.masteryDesc.textContent =
        "You've solved 5 in this level! Pass the timed test (no hints) to unlock harder problems!";
    } else {
      el.startTestBtn.classList.remove('pulse-ready');
      el.startTestBtn.textContent = '⚡ Prove It! Test';
      el.masteryDesc.textContent =
        state.mode === 'level3'
          ? 'Master Level! Practice 3-digit regrouping like 542 − 388 or take a speed challenge!'
          : 'Solve 5 problems or take the timed test now to unlock harder math!';
    }
  }

  // ==================== TIMED MASTERY TEST ENGINE ====================
  let forceClassic542Next = false;

  function startMasteryTest() {
    recordUserActivity();
    state.testMode.active = true;
    state.testMode.questionIndex = 0;
    state.testMode.correctCount = 0;
    state.testMode.results = [];

    // Hide visual workspaces & tabs; show test banner & locked card
    el.testModeBanner.classList.remove('hidden');
    el.testLockedWorkspace.classList.remove('hidden');
    el.strategyTabsNav.classList.add('hidden');
    el.workspaceMain.classList.add('hidden');
    el.useHelperAnswerBtn.classList.add('hidden');
    el.newProblemBtn.classList.add('hidden');

    loadNextTestQuestion();
  }

  function stopMasteryTest(cancelled = false) {
    if (state.testMode.timerId) {
      clearInterval(state.testMode.timerId);
      state.testMode.timerId = null;
    }
    state.testMode.active = false;

    el.testModeBanner.classList.add('hidden');
    el.testLockedWorkspace.classList.add('hidden');
    el.strategyTabsNav.classList.remove('hidden');
    el.workspaceMain.classList.remove('hidden');
    el.newProblemBtn.classList.remove('hidden');

    if (cancelled) {
      generateProblem();
    }
  }

  function loadNextTestQuestion() {
    if (state.testMode.timerId) clearInterval(state.testMode.timerId);

    if (state.testMode.questionIndex >= TEST_QUESTION_COUNT) {
      finishMasteryTest();
      return;
    }

    state.testMode.secondsLeft = TEST_TIME_PER_QUESTION;
    updateTestBannerUI();
    generateProblem(true);
    el.finalAnswerInput.focus();

    state.testMode.timerId = setInterval(() => {
      state.testMode.secondsLeft -= 1;
      updateTestBannerUI();

      if (state.testMode.secondsLeft <= 0) {
        clearInterval(state.testMode.timerId);
        handleTestQuestionResult(false, true);
      }
    }, 1000);
  }

  function updateTestBannerUI() {
    const qNum = state.testMode.questionIndex + 1;
    el.testBannerTitle.textContent = `Mastery Test — Question ${qNum} of ${TEST_QUESTION_COUNT}`;
    el.testScoreDisplay.textContent = `${state.testMode.correctCount} / ${state.testMode.questionIndex}`;

    const sec = Math.max(0, state.testMode.secondsLeft);
    el.testTimerSeconds.textContent = `${sec}s`;
    const pct = (sec / TEST_TIME_PER_QUESTION) * 100;
    el.testTimerBarFill.style.width = `${pct}%`;
    el.testTimerBarFill.classList.toggle('urgent', sec <= 12);

    // Render 5 question pills
    el.testQuestionPills.innerHTML = '';
    for (let i = 0; i < TEST_QUESTION_COUNT; i++) {
      const pill = document.createElement('div');
      const res = state.testMode.results[i];
      let cls = 'q-pill';
      let label = String(i + 1);
      if (res === 'pass') {
        cls += ' pass';
        label = '✓';
      } else if (res === 'fail') {
        cls += ' fail';
        label = '✗';
      } else if (i === state.testMode.questionIndex) {
        cls += ' current';
      }
      pill.className = cls;
      pill.textContent = label;
      el.testQuestionPills.appendChild(pill);
    }
  }

  function handleTestQuestionResult(isCorrect, timedOut = false) {
    if (state.testMode.timerId) {
      clearInterval(state.testMode.timerId);
      state.testMode.timerId = null;
    }

    state.testMode.results.push(isCorrect ? 'pass' : 'fail');
    if (isCorrect) {
      state.testMode.correctCount += 1;
      state.score += 15;
      state.solvedCount += 1;
      state.streak += 1;
      playSuccessSound();
    } else {
      state.streak = 0;
      playPopSound();
    }

    saveStats();
    updateScoreboardUI();

    const feedbackMsg = isCorrect
      ? `Correct! ${state.minuend} − ${state.subtrahend} = ${state.difference}.`
      : timedOut
      ? `Time's up! ${state.minuend} − ${state.subtrahend} = ${state.difference}. Next question coming right up!`
      : `Not quite! ${state.minuend} − ${state.subtrahend} = ${state.difference}. Keep going!`;

    showFeedback(
      isCorrect ? 'success' : 'hint',
      isCorrect ? '✅' : '⏱️',
      isCorrect ? 'Spot on, Abigail!' : 'Moving to next test question...',
      feedbackMsg
    );

    state.testMode.questionIndex += 1;
    updateTestBannerUI();

    setTimeout(() => {
      if (state.testMode.active) {
        loadNextTestQuestion();
      }
    }, 1200);
  }

  function finishMasteryTest() {
    const passed = state.testMode.correctCount >= 4; // 4/5 or 5/5 passes!
    const scoreStr = `${state.testMode.correctCount} out of ${TEST_QUESTION_COUNT}`;
    stopMasteryTest(false);

    if (passed) {
      const oldMode = state.mode;
      if (state.mode === 'level1') {
        state.mode = 'level2';
      } else if (state.mode === 'level2') {
        state.mode = 'level3';
        forceClassic542Next = true; // Introduce 542 - 388 immediately on advancing to Level 3!
      } else {
        forceClassic542Next = true;
      }

      state.levelProgress = 0;
      state.score += 30;
      saveStats();
      updateScoreboardUI();
      renderMasteryUI();
      playLevelUpSound();
      launchConfetti();

      generateProblem();

      const levelUpMsg =
        oldMode !== state.mode
          ? `You scored ${scoreStr} with no hints and unlocked ${LEVEL_NAMES[state.mode]}! Try solving ${state.minuend} − ${state.subtrahend} using the visual tools below!`
          : `You scored ${scoreStr} on the Level 3 Master Challenge and earned +30 Bonus Stars!`;

      showFeedback('success', '🏆🌟', 'Mastery Test Passed! Level Up, Abigail!', levelUpMsg);
    } else {
      state.levelProgress = 3; // Keep her close to re-testing after 2 more practice problems
      saveStats();
      renderMasteryUI();
      generateProblem();

      showFeedback(
        'hint',
        '💪',
        `Good effort on the test (${scoreStr}), Abigail!`,
        `Score 4 out of 5 to level up! Practice a couple more with the visual tools below, then click "⚡ Prove It! Test" whenever you're ready.`
      );
    }
  }

  // ==================== PROBLEM GENERATOR ====================
  let isFirstBoot = true;

  function generateProblem(fromTest = false) {
    state.solvedCurrent = false;
    el.finalAnswerInput.value = '';
    el.finalAnswerInput.classList.remove('correct-flash', 'wrong-shake');
    if (!fromTest) {
      el.feedbackBanner.classList.add('hidden');
    } else {
      el.feedbackBanner.classList.add('hidden');
    }
    el.nextAfterWinBtn.classList.add('hidden');
    el.useHelperAnswerBtn.classList.add('hidden');

    if (forceClassic542Next) {
      forceClassic542Next = false;
      state.minuend = 542;
      state.subtrahend = 388;
    } else if (isFirstBoot && state.mode !== 'level3') {
      isFirstBoot = false;
      state.minuend = 500;
      state.subtrahend = 320;
    } else if (state.mode === 'level3') {
      isFirstBoot = false;
      // Generate harder 3-digit subtraction with regrouping across non-zero digits (like 542 - 388)
      // Ensure ones require regrouping (minuend ones < subtrahend ones) AND tens require regrouping!
      const minH = Math.floor(Math.random() * 6) + 4; // 4..9
      const minT = Math.floor(Math.random() * 6) + 1; // 1..6
      const minO = Math.floor(Math.random() * 7) + 1; // 1..7

      const subH = Math.floor(Math.random() * (minH - 1)) + 1; // 1..(minH - 1)
      const subT = Math.floor(Math.random() * (9 - minT)) + minT + 1; // > minT (7..9)
      const subO = Math.floor(Math.random() * (9 - minO)) + minO + 1; // > minO (8..9)

      state.minuend = minH * 100 + minT * 10 + minO;
      state.subtrahend = subH * 100 + Math.min(9, subT) * 10 + Math.min(9, subO);
    } else {
      isFirstBoot = false;
      const hundredsChoices = [300, 400, 500, 600, 700, 800, 900];
      const minuend = hundredsChoices[Math.floor(Math.random() * hundredsChoices.length)];
      const maxSubHundreds = minuend / 100 - 1;
      const subHundreds = Math.floor(Math.random() * maxSubHundreds) + 1;
      const subTens = Math.floor(Math.random() * 8) + 1;

      const useOnes = state.mode === 'level1' ? false : Math.random() < 0.65;
      const subOnes = useOnes ? Math.floor(Math.random() * 9) + 1 : 0;

      state.minuend = minuend;
      state.subtrahend = subHundreds * 100 + subTens * 10 + subOnes;
    }

    state.difference = state.minuend - state.subtrahend;

    // Update Main Equation UI
    el.minuendDisplay.textContent = state.minuend;
    el.subtrahendDisplay.textContent = state.subtrahend;

    if (state.testMode.active) {
      el.problemTag.textContent = `⏱️ Timed Mastery Test (${LEVEL_NAMES[state.mode]})`;
    } else if (state.mode === 'level3') {
      el.problemTag.textContent = 'Level 3: Full 3-Digit Regrouping (Hundreds, Tens & Ones)';
    } else if (state.subtrahend % 10 !== 0) {
      el.problemTag.textContent = 'Regroup Across Two Zeros (100s → 10s → 1s)';
    } else {
      el.problemTag.textContent = 'Regroup Across Zeros (Friendly Tens)';
    }

    if (!state.testMode.active) {
      initNumberLine();
      initDecomposition();
      initBase10();
    }
    updateScoreboardUI();
    renderMasteryUI();
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
    const hasOnes = state.subtrahend % 10 !== 0 || state.minuend % 10 !== 0;
    el.nlOnesGroup.style.display = hasOnes ? 'flex' : 'none';

    el.nlOnesButtons.innerHTML = '';
    for (let i = 1; i <= 9; i++) {
      const btn = document.createElement('button');
      btn.className = 'hop-btn hop-btn-ones';
      btn.textContent = `+${i}`;
      btn.addEventListener('click', () => addNumberLineHop(i));
      el.nlOnesButtons.appendChild(btn);
    }

    el.nlTensButtons.innerHTML = '';
    for (let t = 10; t <= 90; t += 10) {
      const btn = document.createElement('button');
      btn.className = 'hop-btn hop-btn-tens';
      btn.textContent = `+${t}`;
      btn.addEventListener('click', () => addNumberLineHop(t));
      el.nlTensButtons.appendChild(btn);
    }

    el.nlHundredsButtons.innerHTML = '';
    for (let h = 100; h <= 700; h += 100) {
      const btn = document.createElement('button');
      btn.className = 'hop-btn hop-btn-hundreds';
      btn.textContent = `+${h}`;
      btn.addEventListener('click', () => addNumberLineHop(h));
      el.nlHundredsButtons.appendChild(btn);
    }
  }

  // Supports both multiples of 100 (like 500) and arbitrary 3-digit targets (like 542)!
  function getNextFriendlyHop(pos, target) {
    const remaining = target - pos;
    if (remaining <= 0) return null;

    // 1. If not on a multiple of 10, hop to the next ten (or straight to target if < 10 away)
    if (pos % 10 !== 0) {
      const toNextTen = 10 - (pos % 10);
      if (toNextTen <= remaining) {
        return {
          amount: toNextTen,
          to: pos + toNextTen,
          reason: `Step: Hop +${toNextTen} to reach the friendly ten (${pos + toNextTen})!`,
        };
      }
      return {
        amount: remaining,
        to: target,
        reason: `Final hop +${remaining} to reach ${target}!`,
      };
    }

    // 2. Now pos is a multiple of 10. If next hundred is <= target, hop to next hundred!
    if (pos % 100 !== 0) {
      const nextHundred = Math.ceil(pos / 100) * 100;
      if (nextHundred <= target) {
        const amt = nextHundred - pos;
        return {
          amount: amt,
          to: nextHundred,
          reason: `Step: Hop +${amt} to reach the friendly hundred (${nextHundred})!`,
        };
      }
    }

    // 3. Now either pos is a multiple of 100, or target is within the same hundred
    const targetHundredFloor = Math.floor(target / 100) * 100;
    if (pos < targetHundredFloor) {
      const amt = targetHundredFloor - pos;
      return {
        amount: amt,
        to: targetHundredFloor,
        reason: `Step: Big century hop +${amt} to reach ${targetHundredFloor}!`,
      };
    }

    // 4. Now pos is in the same hundred as target (e.g. pos=500, target=542)
    const targetTenFloor = Math.floor(target / 10) * 10;
    if (pos < targetTenFloor) {
      const amt = targetTenFloor - pos;
      return {
        amount: amt,
        to: targetTenFloor,
        reason: `Step: Hop +${amt} tens to reach ${targetTenFloor}!`,
      };
    }

    // 5. Hop remaining ones (e.g. 540 -> 542)
    return {
      amount: remaining,
      to: target,
      reason: `Final hop +${remaining} ones to land on ${target}!`,
    };
  }

  function addNumberLineHop(amount) {
    recordUserActivity();
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

    const remaining = end - current;
    document.querySelectorAll('#panel-number-line .hop-btn-row .hop-btn').forEach((btn) => {
      const val = parseInt(btn.textContent.replace('+', ''), 10);
      btn.disabled = val > remaining;
    });

    drawNumberLineSVG();
  }

  function drawNumberLineSVG() {
    const svg = el.nlSvg;
    svg.innerHTML = '';

    const W = 900;
    const lineY = 165;
    const padX = 65;
    const usableW = W - padX * 2;
    const span = Math.max(1, state.minuend - state.subtrahend);

    const valToX = (val) => padX + ((val - state.subtrahend) / span) * usableW;

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

    // Sort ticks by x position and stagger label Y if two ticks are very close (e.g. 388 and 390)
    const sortedTicks = Array.from(ticks.entries()).sort((a, b) => a[0] - b[0]);
    let lastX = -999;
    let stagger = false;

    sortedTicks.forEach(([val, info]) => {
      const x = valToX(val);
      const isEnd = info.type === 'endpoint';
      const isLanding = info.type === 'landing';

      if (x - lastX < 38) {
        stagger = !stagger;
      } else {
        stagger = false;
      }
      lastX = x;

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
        y: lineY + (stagger ? 54 : 35),
        'text-anchor': 'middle',
        fill: isEnd ? '#0f172a' : isLanding ? '#0369a1' : '#475569',
        'font-family': 'Fredoka, sans-serif',
        'font-size': isEnd ? '19' : '15',
        'font-weight': '700',
      });
      text.textContent = info.label;
      svg.appendChild(text);
    });

    state.nl.hops.forEach((hop, idx) => {
      const x1 = valToX(hop.from);
      const x2 = valToX(hop.to);
      const midX = (x1 + x2) / 2;
      const distPx = x2 - x1;
      const arcHeight = Math.min(115, Math.max(44, distPx * 0.36));
      const ctrlY = lineY - arcHeight * 1.45;

      const palette = ['#0ea5e9', '#6366f1', '#10b981', '#f59e0b', '#ec4899'];
      const color = palette[idx % palette.length];

      const path = createSVG('path', {
        d: `M ${x1} ${lineY - 6} Q ${midX} ${ctrlY} ${x2} ${lineY - 6}`,
        fill: 'none',
        stroke: color,
        'stroke-width': 4,
        'stroke-linecap': 'round',
      });
      svg.appendChild(path);

      const peakY = 0.5 * (lineY - 6) + 0.5 * ctrlY - 10;
      const badgeW = 54;
      const badgeH = 26;

      const rect = createSVG('rect', {
        x: midX - badgeW / 2,
        y: peakY - badgeH / 2,
        width: badgeW,
        height: badgeH,
        rx: 9,
        fill: color,
      });
      svg.appendChild(rect);

      const label = createSVG('text', {
        x: midX,
        y: peakY + 5,
        'text-anchor': 'middle',
        fill: '#ffffff',
        'font-family': 'Fredoka, sans-serif',
        'font-size': '15',
        'font-weight': '700',
      });
      label.textContent = `+${hop.amount}`;
      svg.appendChild(label);
    });

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

    el.bondPartsRow.innerHTML = '';
    const parts = [];
    if (hVal > 0) parts.push({ val: hVal, name: 'Hundreds', cls: 'part-hundreds', color: '#6366f1' });
    if (tVal > 0) parts.push({ val: tVal, name: 'Tens', cls: 'part-tens', color: '#0ea5e9' });
    if (oVal > 0) parts.push({ val: oVal, name: 'Ones', cls: 'part-ones', color: '#10b981' });

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
        recordUserActivity();
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
          recordUserActivity();
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
    const min = state.minuend;
    const sub = state.subtrahend;

    // Initialize starting blocks from any 3-digit minuend (e.g. 500 -> 5H,0T,0O; 542 -> 5H,4T,2O)
    state.b10.hundredsTotal = Math.floor(min / 100);
    state.b10.hundredsCrossed = 0;
    state.b10.tensTotal = Math.floor((min % 100) / 10);
    state.b10.tensCrossed = 0;
    state.b10.onesTotal = min % 10;
    state.b10.onesCrossed = 0;

    state.b10.targetH = Math.floor(sub / 100);
    state.b10.targetT = Math.floor((sub % 100) / 10);
    state.b10.targetO = sub % 10;

    el.b10NeedH.textContent = state.b10.targetH;
    el.b10NeedT.textContent = state.b10.targetT;
    el.b10NeedO.textContent = state.b10.targetO;

    el.b10Instruction.innerHTML =
      min % 100 === 0
        ? `We start with <strong>${min}</strong>. Trade 1 Hundred flat for 10 Ten rods so you have enough blocks to cross out <strong>${sub}</strong>!`
        : `We start with <strong>${min}</strong> (${state.b10.hundredsTotal} hundreds, ${state.b10.tensTotal} tens, ${state.b10.onesTotal} ones). Trade a Hundred for 10 Tens and a Ten for 10 Ones to cross out <strong>${sub}</strong>!`;

    el.tradeTenBtn.style.display = state.b10.targetO > 0 ? 'inline-flex' : 'none';

    renderBase10();
  }

  function tradeHundredForTens() {
    recordUserActivity();
    const uncrossedHundreds = state.b10.hundredsTotal - state.b10.hundredsCrossed;
    if (uncrossedHundreds <= 0) return;
    state.b10.hundredsTotal -= 1;
    state.b10.tensTotal += 10;
    playPopSound();
    renderBase10();
  }

  function tradeTenForOnes() {
    recordUserActivity();
    const uncrossedTens = state.b10.tensTotal - state.b10.tensCrossed;
    if (uncrossedTens <= 0) return;
    state.b10.tensTotal -= 1;
    state.b10.onesTotal += 10;
    playPopSound();
    renderBase10();
  }

  function autoRegroupAndCrossOut() {
    recordUserActivity();
    initBase10();

    // Trade 1 hundred -> 10 tens if needed
    if (state.b10.tensTotal < state.b10.targetT || state.b10.onesTotal < state.b10.targetO) {
      state.b10.hundredsTotal -= 1;
      state.b10.tensTotal += 10;
    }

    // Trade 1 ten -> 10 ones if ones are needed
    if (state.b10.onesTotal < state.b10.targetO) {
      state.b10.tensTotal -= 1;
      state.b10.onesTotal += 10;
    }

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

    el.tradeHundredBtn.disabled = remH <= 0;
    el.tradeTenBtn.disabled = remT <= 0;

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
        recordUserActivity();
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
          recordUserActivity();
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
          recordUserActivity();
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
    if (state.testMode.active) return;
    el.useHelperAnswerBtn.classList.remove('hidden');
    el.useHelperAnswerBtn.onclick = () => {
      recordUserActivity();
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
    recordUserActivity();
    const raw = el.finalAnswerInput.value.trim();
    if (raw === '') {
      showFeedback(
        'hint',
        '✏️',
        'Type your answer first, Abigail!',
        `Enter your answer for ${state.minuend} − ${state.subtrahend}.`
      );
      el.finalAnswerInput.focus();
      return;
    }

    const userAns = parseInt(raw, 10);

    // If in Timed Mastery Test Mode, grade immediately without hints!
    if (state.testMode.active) {
      handleTestQuestionResult(userAns === state.difference, false);
      return;
    }

    if (userAns === state.difference) {
      el.finalAnswerInput.classList.remove('wrong-shake');
      el.finalAnswerInput.classList.add('correct-flash');

      if (!state.solvedCurrent) {
        state.solvedCurrent = true;
        state.streak += 1;
        state.solvedCount += 1;
        state.levelProgress += 1;
        const bonus = state.streak >= 3 ? 15 : 10;
        state.score += bonus;
        saveStats();
        updateScoreboardUI();
        renderMasteryUI();
      }

      playSuccessSound();
      launchConfetti();

      const title = praiseTitles[Math.floor(Math.random() * praiseTitles.length)];
      const readyForTestNote =
        state.levelProgress >= 5 && state.mode !== 'level3'
          ? ' ⚡ You unlocked the Mastery Test! Click "Take Mastery Test Now!" above to level up!'
          : '';

      showFeedback(
        'success',
        '🎉',
        title,
        `${state.minuend} − ${state.subtrahend} = ${state.difference}! Because ${state.subtrahend} + ${state.difference} = ${state.minuend}.${readyForTestNote}`
      );
      el.nextAfterWinBtn.classList.remove('hidden');
    } else {
      state.streak = 0;
      saveStats();
      updateScoreboardUI();

      el.finalAnswerInput.classList.remove('correct-flash');
      void el.finalAnswerInput.offsetWidth;
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
          p.vy += 0.35;
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
    // Track active user interactions for the TV Reward Timer
    ['mousedown', 'keydown', 'touchstart', 'click'].forEach((evt) => {
      window.addEventListener(evt, recordUserActivity, { passive: true });
    });

    setInterval(tickActivePlayTimer, 1000);

    // Redeem 1-Hour TV Pass
    el.redeemTvBtn.addEventListener('click', () => {
      if (state.tvPasses <= 0) return;
      if (window.confirm('Redeem 1-Hour TV Pass for Abigail now?')) {
        state.tvPasses -= 1;
        saveStats();
        renderTvRewardUI();
        showFeedback('success', '📺🍿', '1-Hour TV Pass Redeemed!', 'Enjoy your 1 hour of TV time, Abigail!');
      }
    });

    // Mastery Test Start & Cancel
    el.startTestBtn.addEventListener('click', startMasteryTest);
    el.cancelTestBtn.addEventListener('click', () => stopMasteryTest(true));

    // Strategy Tabs
    el.tabButtons.forEach((btn) => {
      btn.addEventListener('click', () => {
        recordUserActivity();
        const targetTab = btn.dataset.tab;
        state.activeTab = targetTab;
        el.tabButtons.forEach((b) => b.classList.toggle('active', b === btn));
        Object.entries(el.panels).forEach(([key, panel]) => {
          panel.classList.toggle('active', key === targetTab);
        });
      });
    });

    // Difficulty Level Change
    el.difficultySelect.addEventListener('change', (e) => {
      recordUserActivity();
      if (state.testMode.active) stopMasteryTest(false);
      state.mode = e.target.value;
      state.levelProgress = 0;
      if (state.mode === 'level3') {
        forceClassic542Next = true;
      }
      saveStats();
      generateProblem();
    });

    // Main Equation Controls
    el.checkAnswerBtn.addEventListener('click', checkAnswer);
    el.newProblemBtn.addEventListener('click', () => {
      recordUserActivity();
      generateProblem();
    });
    el.nextAfterWinBtn.addEventListener('click', () => {
      recordUserActivity();
      generateProblem();
    });
    el.finalAnswerInput.addEventListener('keydown', (e) => {
      recordUserActivity();
      if (e.key === 'Enter') checkAnswer();
    });

    // Number Line Controls
    el.nlAutoGuideBtn.addEventListener('click', () => {
      const next = getNextFriendlyHop(state.nl.currentPos, state.minuend);
      if (next) addNumberLineHop(next.amount);
    });

    el.nlUndoBtn.addEventListener('click', () => {
      recordUserActivity();
      if (state.nl.hops.length === 0) return;
      const popped = state.nl.hops.pop();
      state.nl.currentPos = popped.from;
      renderNumberLine();
    });

    el.nlResetBtn.addEventListener('click', () => {
      recordUserActivity();
      initNumberLine();
    });

    // Decomposition Controls
    el.decompRevealBtn.addEventListener('click', () => {
      recordUserActivity();
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

    el.decompResetBtn.addEventListener('click', () => {
      recordUserActivity();
      initDecomposition();
    });

    // Base-10 Controls
    el.tradeHundredBtn.addEventListener('click', tradeHundredForTens);
    el.tradeTenBtn.addEventListener('click', tradeTenForOnes);
    el.b10AutoRegroupBtn.addEventListener('click', autoRegroupAndCrossOut);
    el.b10ResetBtn.addEventListener('click', () => {
      recordUserActivity();
      initBase10();
    });
  }

  // Boot the game
  bindEvents();
  renderTvRewardUI();
  renderMasteryUI();
  generateProblem();
})();
