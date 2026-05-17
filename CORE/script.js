const QUIZ_FOLDER = 'QUIZZES/';
const QUIZ_MANIFEST = `${QUIZ_FOLDER}quizzes.json`;
const DEFAULT_QUIZ_FILE = 'Solar_System.json';
// To add future chapters: place the new JSON file in /QUIZZES, add it to
// /QUIZZES/quizzes.json, and keep the file name simple (letters, numbers,
// spaces, underscores, hyphens). Netlify copies those files into CORE/QUIZZES.
const FALLBACK_QUIZZES = [
  { id: 'solar-system', file: 'Solar_System.json', title: 'Solar System Quiz', subject: 'science', questionCount: 25 },
  { id: 'world-map', file: 'World_Map.json', title: 'World Map Quiz', subject: 'geography', questionCount: 30 }
];

let quizCatalog = [];
let currentQuizFile = DEFAULT_QUIZ_FILE;
let currentQuizTitle = 'SSC Quiz';
let selectedQuizFile = '';
let activeSubject = 'all';
let questions = [];
let currentQuestion = 0;
let answers = {};
let bookmarks = new Set();
let revisionQueue = new Set();
let timerSeconds = 0;
let quizTimeLimitSeconds = 0;
let timerInterval = null;
let isPaletteOpen = false;
let quizSubmitted = false;
let firebaseApi = null;
let currentUser = null;
let firebaseBridgeReady = false;
let pendingQuizConfig = null;
let selectedCustomCount = 'all';
let selectedCustomTime = 'none';

const els = {};

document.addEventListener('DOMContentLoaded', async function () {
  cacheElements();
  initTheme();
  initEventListeners();
  await initFirebaseBridge();
  preventDoubleTapZoom();
  await initQuizCatalog();
  currentQuizFile = getInitialQuizFile();
  const initialQuiz = getQuizByFile(currentQuizFile);
  currentQuizTitle = initialQuiz ? initialQuiz.title : 'SSC Quiz';
  updatePageTitle();
  updateDashboardStats();
  updateTimerDisplay();
  if (getUrlMode() === 'revision') {
    await launchRevisionQuizFromUrl();
  }
  setInterval(saveToLocalStorage, 5000);
});

function cacheElements() {
  els.appTitle = document.getElementById('appTitle');
  els.heroStartBtn = document.getElementById('heroStartBtn');
  els.chapterCards = document.getElementById('chapterCards');
  els.chapterSearch = document.getElementById('chapterSearch');
  els.subjectTabs = Array.from(document.querySelectorAll('.tab'));
  els.hamburger = document.getElementById('hamburger');
  els.navLinks = document.querySelector('.nav-links');
  els.headerControls = document.querySelector('.header-controls');
  els.authStatus = document.getElementById('authStatus');
  els.authActionBtn = document.getElementById('authActionBtn');
  els.dashboardLink = document.getElementById('dashboardLink');
  els.dashboardQuizTitle = document.getElementById('dashboardQuizTitle');
  els.homeQuizCount = document.getElementById('homeQuizCount');
  els.homeQuestionCount = document.getElementById('homeQuestionCount');
  els.homeAttemptedCount = document.getElementById('homeAttemptedCount');
  els.homeProgressPercent = document.getElementById('homeProgressPercent');
  els.homeProgressBar = document.getElementById('homeProgressBar');
  els.quizStatus = document.getElementById('quizStatus');
  els.timer = document.getElementById('timer');
  els.themeToggle = document.getElementById('themeToggle');
  els.fullscreenBtn = document.getElementById('fullscreenBtn');
  els.markingInfo = document.getElementById('markingInfo');
  els.progressSection = document.getElementById('progressSection');
  els.progressText = document.getElementById('progressText');
  els.attemptedText = document.getElementById('attemptedText');
  els.progressBar = document.getElementById('progressBar');
  els.questionSection = document.getElementById('questionSection');
  els.questionCounter = document.getElementById('questionCounter');
  els.bookmarkBtn = document.getElementById('bookmarkBtn');
  els.revisionBtn = document.getElementById('revisionBtn');
  els.questionText = document.getElementById('questionText');
  els.optionsContainer = document.getElementById('optionsContainer');
  els.resultSection = document.getElementById('result-section');
  els.bottomNav = document.getElementById('bottomNav');
  els.prevBtn = document.getElementById('prevBtn');
  els.clearBtn = document.getElementById('clearBtn');
  els.nextBtn = document.getElementById('nextBtn');
  els.submitBtn = document.getElementById('submitBtn');
  els.paletteFab = document.getElementById('paletteFab');
  els.paletteIcon = document.getElementById('paletteIcon');
  els.paletteBadge = document.getElementById('paletteBadge');
  els.paletteOverlay = document.getElementById('paletteOverlay');
  els.questionPalette = document.getElementById('questionPalette');
  els.paletteClose = document.getElementById('paletteClose');
  els.paletteAnswered = document.getElementById('paletteAnswered');
  els.paletteNotAnswered = document.getElementById('paletteNotAnswered');
  els.paletteBookmarked = document.getElementById('paletteBookmarked');
  els.paletteSearch = document.getElementById('paletteSearch');
  els.paletteGrid = document.getElementById('paletteGrid');
  els.toastHost = document.getElementById('toastHost');
  els.customizeModal = document.getElementById('quizCustomizeModal');
  els.customizeSubtitle = document.getElementById('customizeSubtitle');
  els.countPills = Array.from(document.querySelectorAll('[data-count-choice]'));
  els.countAvailability = document.getElementById('countAvailability');
  els.timeLimitOptions = document.getElementById('timeLimitOptions');
  els.startCustomizedQuiz = document.getElementById('startCustomizedQuiz');
}

function initTheme() {
  const savedTheme = localStorage.getItem('quizTheme') || 'dark';
  document.documentElement.setAttribute('data-theme', savedTheme);
  els.themeToggle.textContent = savedTheme === 'dark' ? 'Light' : 'Dark';
}

function initEventListeners() {
  els.heroStartBtn.addEventListener('click', function () {
    if (selectedQuizFile) launchQuiz(selectedQuizFile);
  });

  if (els.chapterSearch) els.chapterSearch.addEventListener('input', applyChapterFilters);
  els.subjectTabs.forEach(function (tab) {
    tab.addEventListener('click', function () {
      els.subjectTabs.forEach(function (item) { item.classList.remove('active'); });
      tab.classList.add('active');
      activeSubject = tab.dataset.subject || 'all';
      applyChapterFilters();
    });
  });
  if (els.hamburger) {
    els.hamburger.addEventListener('click', function () {
      const open = !els.navLinks.classList.contains('open');
      els.navLinks.classList.toggle('open', open);
      els.headerControls.classList.toggle('open', open);
      els.hamburger.setAttribute('aria-expanded', String(open));
    });
  }
  document.querySelectorAll('a[href="#home"]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (document.body.classList.contains('quiz-active')) exitQuiz();
    });
  });

  els.prevBtn.addEventListener('click', prevQuestion);
  els.nextBtn.addEventListener('click', nextQuestion);
  els.clearBtn.addEventListener('click', clearAnswer);
  els.submitBtn.addEventListener('click', submitQuiz);
  els.bookmarkBtn.addEventListener('click', toggleBookmark);
  els.revisionBtn.addEventListener('click', toggleRevisionItem);
  if (els.authActionBtn) els.authActionBtn.addEventListener('click', handleAuthAction);
  els.themeToggle.addEventListener('click', toggleTheme);
  els.fullscreenBtn.addEventListener('click', toggleFullscreen);
  els.paletteFab.addEventListener('click', function () { togglePalette(); });
  els.paletteClose.addEventListener('click', function () { togglePalette(false); });
  els.paletteOverlay.addEventListener('click', function () { togglePalette(false); });
  els.countPills.forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.disabled) return;
      selectedCustomCount = button.dataset.countChoice;
      updateCustomizeModal();
    });
  });
  if (els.startCustomizedQuiz) els.startCustomizedQuiz.addEventListener('click', startCustomizedQuiz);

  els.paletteSearch.addEventListener('change', jumpFromSearch);
  els.paletteSearch.addEventListener('keydown', function (e) {
    if (e.key === 'Enter') jumpFromSearch();
  });

  document.addEventListener('keydown', handleKeyboard);
  document.addEventListener('visibilitychange', function () {
    if (document.visibilityState === 'hidden') saveToLocalStorage();
  });

  window.addEventListener('beforeunload', function (e) {
    if (document.body.classList.contains('quiz-active') && !quizSubmitted && questions.length) {
      saveToLocalStorage();
      e.preventDefault();
      e.returnValue = '';
    }
  });
}

async function initFirebaseBridge() {
  try {
    firebaseApi = await import('./firebase-module.js');
    firebaseBridgeReady = true;

    if (!firebaseApi.isFirebaseReady()) {
      updateAuthUi();
      showToast('Firebase config is pending. Add real values in CORE/firebase-config.js to enable login and cloud tracking.', 'error');
      return;
    }

    firebaseApi.onAuthState(function (user) {
      currentUser = user;
      updateAuthUi();
    });
  } catch (error) {
    firebaseBridgeReady = false;
    console.warn('Firebase module could not be loaded. Quiz will continue without cloud tracking.', error);
    updateAuthUi();
  }
}

function updateAuthUi() {
  if (!els.authStatus || !els.authActionBtn) return;

  if (currentUser) {
    els.authStatus.textContent = currentUser.displayName || currentUser.email || 'Signed in';
    els.authActionBtn.textContent = 'Logout';
    if (els.dashboardLink) els.dashboardLink.classList.remove('hidden');
  } else {
    els.authStatus.textContent = firebaseBridgeReady ? 'Guest' : 'Offline';
    els.authActionBtn.textContent = 'Login';
  }
}

async function handleAuthAction() {
  if (currentUser && firebaseApi && firebaseApi.logoutUser) {
    const result = await firebaseApi.logoutUser();
    if (result.success) {
      currentUser = null;
      updateAuthUi();
      showToast('Logged out successfully.', 'success');
    } else {
      showToast(result.error || 'Logout failed.', 'error');
    }
    return;
  }

  window.location.href = getLoginUrl();
}

function getLoginUrl() {
  const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  return `../auth/login.html?next=${next}`;
}

function getUrlMode() {
  return new URLSearchParams(window.location.search).get('mode') || '';
}

function shouldRequireLoginForTracking() {
  return Boolean(firebaseApi && firebaseApi.isFirebaseReady && firebaseApi.isFirebaseReady());
}

async function initQuizCatalog() {
  try {
    const response = await fetch(QUIZ_MANIFEST, { cache: 'no-store' });
    if (!response.ok) throw new Error(`Manifest returned ${response.status}`);
    const manifest = await response.json();
    quizCatalog = normalizeQuizCatalog(manifest);
  } catch (error) {
    quizCatalog = FALLBACK_QUIZZES.slice();
  }

  populateQuizSelect();
}

function normalizeQuizCatalog(manifest) {
  const items = Array.isArray(manifest) ? manifest : (manifest.chapters || manifest.quizzes);
  if (!Array.isArray(items)) throw new Error('Quiz manifest must contain a chapters array.');

  return items.map(function (item, index) {
    if (typeof item === 'string') {
      return {
        id: slugify(titleFromFileName(item)),
        file: item,
        title: titleFromFileName(item),
        subject: inferSubject(titleFromFileName(item)),
        questionCount: 0
      };
    }

    const file = item.file || item.filename || item.path;
    const title = item.title || item.name || titleFromFileName(file);
    const rawCount = Array.isArray(item.questions) ? item.questions.length : (item.questionCount || item.questions || item.count || 0);
    return {
      id: item.id || slugify(title) || `chapter-${index + 1}`,
      file: file,
      title: title,
      subject: normalizeSubject(item.subject || inferSubject(title)),
      questionCount: Number(rawCount) || 0
    };
  }).filter(function (item) {
    return item.file && isSafeQuizFile(item.file);
  });
}

function populateQuizSelect() {
  renderChapterCards();
  updateDashboardStats();
}

function renderChapterCards() {
  if (!els.chapterCards) return;

  els.chapterCards.innerHTML = '';
  if (!quizCatalog.length) {
    els.chapterCards.innerHTML = `
      <div class="empty-state">
        <span>📚</span>
        <h3>No chapters available yet</h3>
        <p>Check back soon or contact the admin.</p>
      </div>
    `;
    updateHeroStartState();
    return;
  }

  quizCatalog.forEach(function (quiz, index) {
    const card = document.createElement('article');
    card.className = 'chapter-card';
    card.dataset.title = quiz.title;
    card.dataset.subject = quiz.subject;
    card.dataset.chapterId = quiz.id;
    card.dataset.file = quiz.file;
    if (quiz.file === selectedQuizFile) card.classList.add('selected');
    if (quiz.file === currentQuizFile) card.classList.add('active');

    const questionCount = quiz.file === currentQuizFile && questions.length ? questions.length : quiz.questionCount;
    const questionText = questionCount ? `${questionCount} questions` : 'Practice set';

    card.innerHTML = `
      <div>
        <span class="subject-badge">${escHtml(labelFromSubject(quiz.subject))}</span>
        <h3>${escHtml(quiz.title)}</h3>
        <p>${escHtml(questionText)} · JSON powered · Instant result</p>
        <div class="chapter-meta">
          <span>Chapter ${String(index + 1).padStart(2, '0')}</span>
          <span>${escHtml(getChapterDescription(quiz.title, index))}</span>
        </div>
      </div>
      <button class="chapter-start" type="button">Start quiz</button>
    `;

    card.addEventListener('click', function () {
      selectChapterCard(quiz.file);
    });
    card.querySelector('.chapter-start').addEventListener('click', function () {
      launchQuiz(quiz.id);
    });

    els.chapterCards.appendChild(card);
  });

  applyChapterFilters();
  updateHeroStartState();
}

function getChapterDescription(title, index) {
  const descriptions = [
    'Build accuracy with focused SSC-style objective questions and quick review.',
    'Practice recall, eliminate weak areas, and keep your attempt moving.',
    'Use bookmarks to flag doubts and return to them before submission.'
  ];

  if (/map|world|geo/i.test(title)) {
    return 'Sharpen geography recall with map-based practice and fast answer review.';
  }

  if (/solar|science|system/i.test(title)) {
    return 'Strengthen science fundamentals with compact, exam-ready questions.';
  }

  return descriptions[index % descriptions.length];
}

function getQuizByFile(file) {
  return quizCatalog.find(function (quiz) { return quiz.file === file; });
}

function getQuizByIdOrFile(idOrFile) {
  return quizCatalog.find(function (quiz) {
    return quiz.id === idOrFile || quiz.file === idOrFile;
  });
}

function normalizeSubject(subject) {
  return String(subject || 'general').toLowerCase().trim().replace(/[^a-z0-9-]+/g, '-');
}

function inferSubject(title) {
  if (/map|world|geo/i.test(title)) return 'geography';
  if (/solar|science|system/i.test(title)) return 'science';
  if (/history|ancient|medieval|modern/i.test(title)) return 'history';
  if (/math|arith|algebra|number|geometry/i.test(title)) return 'math';
  return 'general';
}

function labelFromSubject(subject) {
  return String(subject || 'general')
    .replace(/[-_]+/g, ' ')
    .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
}

function selectChapterCard(file) {
  selectedQuizFile = file;
  document.querySelectorAll('.chapter-card').forEach(function (card) {
    card.classList.toggle('selected', card.dataset.file === selectedQuizFile);
  });
  updateHeroStartState();
}

function updateHeroStartState() {
  if (!els.heroStartBtn) return;
  const hasSelection = Boolean(selectedQuizFile);
  els.heroStartBtn.disabled = !hasSelection;
  els.heroStartBtn.style.opacity = hasSelection ? '1' : '0.55';
}

function applyChapterFilters() {
  const q = (els.chapterSearch && els.chapterSearch.value || '').toLowerCase().trim();
  let visibleCount = 0;

  document.querySelectorAll('.chapter-card').forEach(function (card) {
    const matchesSearch = !q || (card.dataset.title || '').toLowerCase().includes(q);
    const matchesSubject = activeSubject === 'all' || card.dataset.subject === activeSubject;
    const visible = matchesSearch && matchesSubject;
    card.style.display = visible ? '' : 'none';
    if (visible) visibleCount++;
  });

  let empty = document.getElementById('chapterFilterEmpty');
  if (!visibleCount && quizCatalog.length) {
    if (!empty) {
      empty = document.createElement('div');
      empty.id = 'chapterFilterEmpty';
      empty.className = 'empty-state';
      empty.innerHTML = '<span>📚</span><h3>No matching chapters</h3><p>Try another search or subject.</p>';
      els.chapterCards.appendChild(empty);
    }
  } else if (empty) {
    empty.remove();
  }
}

async function launchQuiz(chapterId) {
  if (firebaseApi && firebaseApi.authReady && shouldRequireLoginForTracking() && !currentUser) {
    currentUser = await firebaseApi.authReady;
    updateAuthUi();
  }

  if (shouldRequireLoginForTracking() && !currentUser) {
    showToast('Login first so your quiz attempt, score, bookmarks, and revision queue can be saved.', 'error');
    setTimeout(function () {
      window.location.href = getLoginUrl();
    }, 900);
    return;
  }

  const quiz = getQuizByIdOrFile(chapterId);
  const file = quiz ? quiz.file : chapterId;
  if (!file) return;

  document.body.classList.add('quiz-active');
  if (els.navLinks) els.navLinks.classList.remove('open');
  if (els.headerControls) els.headerControls.classList.remove('open');
  if (els.hamburger) els.hamburger.setAttribute('aria-expanded', 'false');
  const loaded = await loadSelectedQuiz(file, { updateUrl: true, resume: false, customize: true });
  if (loaded) {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } else {
    stopTimer();
  }
}

function exitQuiz() {
  document.body.classList.remove('quiz-active');
  stopTimer();
  resetTimer();
  togglePalette(false);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function resetTimer() {
  timerSeconds = 0;
  quizTimeLimitSeconds = 0;
  updateTimerDisplay();
}

async function startQuizExperience(file) {
  await launchQuiz(file);
}

function getInitialQuizFile() {
  const params = new URLSearchParams(window.location.search);
  const requestedQuiz = params.get('quiz');
  if (requestedQuiz && isSafeQuizFile(requestedQuiz)) {
    return requestedQuiz;
  }

  const savedQuiz = localStorage.getItem('selectedQuizFile');
  const choices = [savedQuiz, DEFAULT_QUIZ_FILE, quizCatalog[0] && quizCatalog[0].file];
  const match = choices.find(function (file) {
    return file && isSafeQuizFile(file) && quizCatalog.some(function (quiz) { return quiz.file === file; });
  });

  return match || DEFAULT_QUIZ_FILE;
}

async function loadSelectedQuiz(file, options) {
  const settings = options || {};
  if (!isSafeQuizFile(file)) {
    showQuizError('That quiz file name is not allowed.');
    return false;
  }

  stopTimer();
  showQuizStatus('Loading quiz...');
  setQuizControlsDisabled(true);

  try {
    const data = await fetchQuizData(file);
    const normalizedQuestions = normalizeQuizData(data);
    if (!normalizedQuestions.length) throw new Error('No questions found in this quiz file.');

    if (settings.customize) {
      currentQuizFile = file;
      currentQuizTitle = getQuizTitle(file, data);
      updatePageTitle();
      hideQuizStatus();
      showCustomizeModal(file, currentQuizTitle, normalizedQuestions, settings);
      return true;
    }

    beginQuizSession(file, getQuizTitle(file, data), normalizedQuestions, settings);
    return true;
  } catch (error) {
    questions = [];
    showQuizError(`Could not load quiz: ${error.message}`);
    return false;
  } finally {
    setQuizControlsDisabled(false);
  }
}

function beginQuizSession(file, title, quizQuestions, options) {
  const settings = options || {};
  currentQuizFile = file;
  currentQuizTitle = title || 'SSC Quiz';
  questions = quizQuestions.slice();
  const catalogItem = getQuizByFile(currentQuizFile);
  if (catalogItem) catalogItem.questionCount = questions.length;
  if (isSafeQuizFile(currentQuizFile)) localStorage.setItem('selectedQuizFile', currentQuizFile);

  resetAttemptState();
  quizTimeLimitSeconds = Number(settings.timeLimitSeconds) || 0;
  document.body.classList.add('quiz-active');
  updatePageTitle();
  if (!settings.skipCatalogUpdate) updateActiveChapterState();
  resetQuizView();
  updateMarkingInfo();
  createPalette();
  if (!settings.skipCatalogUpdate) renderChapterCards();
  updateDashboardStats();

  const resumed = settings.resume ? loadFromLocalStorage() : false;
  if (!resumed) {
    loadQuestion(0);
  }

  hideQuizStatus();

  if (settings.updateUrl) {
    const url = new URL(window.location.href);
    if (isSafeQuizFile(currentQuizFile)) {
      url.searchParams.set('quiz', currentQuizFile);
      url.searchParams.delete('mode');
    }
    window.history.replaceState({}, '', url);
  }

  startTimer();
}

function showCustomizeModal(file, title, quizQuestions, settings) {
  pendingQuizConfig = {
    file: file,
    title: title,
    questions: quizQuestions.slice(),
    updateUrl: Boolean(settings && settings.updateUrl)
  };

  const prefs = readQuizPrefs();
  selectedCustomCount = getValidCountChoice(prefs.questionCount, quizQuestions.length);
  selectedCustomTime = getValidTimeChoice(selectedCustomCount, prefs.timeLimit);
  if (els.customizeSubtitle) {
    els.customizeSubtitle.textContent = `${title} · ${quizQuestions.length} questions available`;
  }
  updateCustomizeModal();
  if (els.customizeModal) els.customizeModal.classList.remove('hidden');
}

function updateCustomizeModal() {
  if (!pendingQuizConfig) return;
  const available = pendingQuizConfig.questions.length;

  els.countPills.forEach(function (button) {
    const choice = button.dataset.countChoice;
    const numeric = Number(choice);
    const disabled = choice !== 'all' && available < numeric;
    button.disabled = disabled;
    button.classList.toggle('active', choice === selectedCustomCount);
    if (choice === 'all') {
      button.textContent = 'All';
    } else {
      button.textContent = disabled ? `${choice} (only ${available} available)` : choice;
    }
  });

  if (els.countAvailability) {
    els.countAvailability.textContent = `${available} question${available === 1 ? '' : 's'} available in this chapter`;
  }

  selectedCustomTime = getValidTimeChoice(selectedCustomCount, selectedCustomTime);
  renderTimeLimitOptions();
}

function renderTimeLimitOptions() {
  if (!els.timeLimitOptions) return;
  const options = getTimeOptions(selectedCustomCount);
  els.timeLimitOptions.innerHTML = options.map(function (option) {
    const disabled = Boolean(option.disabled);
    const active = option.value === selectedCustomTime;
    return `<button class="time-pill${active ? ' active' : ''}" type="button" data-time-choice="${option.value}"${disabled ? ' disabled' : ''}>${escHtml(option.label)}</button>`;
  }).join('');

  els.timeLimitOptions.querySelectorAll('[data-time-choice]').forEach(function (button) {
    button.addEventListener('click', function () {
      if (button.disabled) return;
      selectedCustomTime = button.dataset.timeChoice;
      renderTimeLimitOptions();
    });
  });
}

function getValidCountChoice(choice, available) {
  const requested = String(choice || 'all');
  if (requested === '25' && available >= 25) return '25';
  if (requested === '50' && available >= 50) return '50';
  return 'all';
}

function getValidTimeChoice(countChoice, timeChoice) {
  const validValues = getTimeOptions(countChoice).map(function (option) { return option.value; });
  return validValues.includes(String(timeChoice || '')) ? String(timeChoice) : validValues[0];
}

function getTimeOptions(countChoice) {
  if (countChoice === '25') {
    return [
      { value: '10', label: '10 min' },
      { value: '15', label: '15 min' },
      { value: 'none', label: 'No limit' }
    ];
  }
  if (countChoice === '50') {
    return [
      { value: '20', label: '20 min' },
      { value: '30', label: '30 min' },
      { value: 'none', label: 'No limit' }
    ];
  }
  return [
    { value: 'none', label: 'No limit', disabled: true }
  ];
}

function startCustomizedQuiz() {
  if (!pendingQuizConfig) return;
  const count = selectedCustomCount === 'all' ? pendingQuizConfig.questions.length : Number(selectedCustomCount);
  const shuffled = shuffleQuestions(pendingQuizConfig.questions);
  const selectedQuestions = shuffled.slice(0, count);
  const timeLimitSeconds = selectedCustomTime === 'none' ? 0 : Number(selectedCustomTime) * 60;

  localStorage.setItem('quizPrefs', JSON.stringify({
    questionCount: selectedCustomCount,
    timeLimit: selectedCustomTime
  }));

  if (els.customizeModal) els.customizeModal.classList.add('hidden');
  beginQuizSession(pendingQuizConfig.file, pendingQuizConfig.title, selectedQuestions, {
    updateUrl: pendingQuizConfig.updateUrl,
    resume: false,
    timeLimitSeconds: timeLimitSeconds
  });
  pendingQuizConfig = null;
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function readQuizPrefs() {
  try {
    return JSON.parse(localStorage.getItem('quizPrefs') || '{}') || {};
  } catch (error) {
    return {};
  }
}

function shuffleQuestions(list) {
  const copy = list.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const temp = copy[i];
    copy[i] = copy[j];
    copy[j] = temp;
  }
  return copy;
}

async function fetchQuizData(file) {
  const response = await fetch(`${QUIZ_FOLDER}${encodeURIComponent(file)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${file} returned ${response.status}`);
  return response.json();
}

async function launchRevisionQuizFromUrl() {
  document.body.classList.add('quiz-active');
  showQuizStatus('Loading your revision queue...');
  setQuizControlsDisabled(true);

  if (!firebaseApi || !firebaseApi.isFirebaseReady || !firebaseApi.isFirebaseReady()) {
    showQuizError('Firebase must be configured to load your revision queue.');
    return;
  }

  const user = currentUser || await firebaseApi.authReady;
  currentUser = user;
  updateAuthUi();
  if (!user) {
    showToast('Login first to open your revision queue.', 'error');
    setTimeout(function () {
      window.location.href = getLoginUrl();
    }, 900);
    return;
  }

  try {
    const result = await firebaseApi.getRevisionQueue(user.uid);
    if (!result.success) throw new Error(result.error || 'Could not load revision queue.');
    const revisionItems = result.revisionQueue || [];
    if (!revisionItems.length) {
      showQuizError('Your revision queue is empty. Add questions with the + Revision button first.');
      return;
    }

    const revisionQuestions = await loadRevisionQuestions(revisionItems);
    if (!revisionQuestions.length) {
      showQuizError('No matching revision questions were found in the local quiz JSON files.');
      return;
    }

    beginQuizSession('revision-queue', 'Revision Queue', revisionQuestions, {
      updateUrl: false,
      resume: false,
      timeLimitSeconds: 0,
      skipCatalogUpdate: true
    });
    const url = new URL(window.location.href);
    url.searchParams.set('mode', 'revision');
    url.searchParams.delete('quiz');
    window.history.replaceState({}, '', url);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  } catch (error) {
    showQuizError(`Could not start revision quiz: ${error.message}`);
  } finally {
    setQuizControlsDisabled(false);
  }
}

async function loadRevisionQuestions(revisionItems) {
  const wanted = new Set(revisionItems.map(function (item) {
    return revisionKey(item.chapterId || item.chapter, item.questionId);
  }));
  const files = getRevisionSourceFiles(revisionItems);
  const matched = [];

  for (const quiz of files) {
    try {
      const data = await fetchQuizData(quiz.file);
      const normalized = normalizeQuizData(data).map(function (q) {
        return {
          ...q,
          sourceChapterId: quiz.id,
          sourceChapter: quiz.title,
          sourceQuizTitle: quiz.title
        };
      });
      normalized.forEach(function (q) {
        const keys = [
          revisionKey(quiz.id, q.sr_no),
          revisionKey(quiz.title, q.sr_no),
          revisionKey(q.sourceChapter, q.sr_no)
        ];
        if (keys.some(function (key) { return wanted.has(key); })) {
          matched.push(q);
        }
      });
    } catch (error) {
      console.warn(`Could not load ${quiz.file} for revision mode.`, error);
    }
  }

  return matched;
}

function getRevisionSourceFiles(revisionItems) {
  const selected = [];
  const seen = new Set();

  revisionItems.forEach(function (item) {
    const chapterKey = String(item.chapterId || item.chapter || item.quizTitle || '').toLowerCase();
    const quiz = quizCatalog.find(function (candidate) {
      return [candidate.id, candidate.title, candidate.file].some(function (value) {
        return String(value || '').toLowerCase() === chapterKey;
      });
    });
    if (quiz && !seen.has(quiz.file)) {
      selected.push(quiz);
      seen.add(quiz.file);
    }
  });

  if (selected.length) return selected;
  return quizCatalog.filter(function (quiz) { return quiz.file && isSafeQuizFile(quiz.file); });
}

function revisionKey(chapterId, questionId) {
  return `${String(chapterId || '').toLowerCase()}::${String(questionId || '')}`;
}

function normalizeQuizData(data) {
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list)) throw new Error('Quiz JSON must be an array or an object with a questions array.');

  return list.map(function (item, index) {
    const options = normalizeOptions(item);
    return {
      sr_no: item.sr_no || item.id || index + 1,
      question: item.question || '',
      option1: options[0],
      option2: options[1],
      option3: options[2],
      option4: options[3],
      answer: normalizeAnswer(item.answer || item.correct),
      positive_marking: String(item.positive_marking || item.positive || data.positive_marking || '1'),
      negative_marking: String(item.negative_marking || item.negative || data.negative_marking || '0'),
      explanation: item.explanation || ''
    };
  }).filter(function (item) {
    return item.question && item.option1 && item.option2 && item.option3 && item.option4 && item.answer;
  });
}

function normalizeOptions(item) {
  if (item.options && !Array.isArray(item.options)) {
    return ['a', 'b', 'c', 'd'].map(function (key) { return item.options[key] || item.options[key.toUpperCase()] || ''; });
  }

  if (Array.isArray(item.options)) {
    return item.options.slice(0, 4);
  }

  return [item.option1, item.option2, item.option3, item.option4];
}

function normalizeAnswer(value) {
  const answer = String(value || '').trim();
  const letterMap = { a: '1', b: '2', c: '3', d: '4' };
  return letterMap[answer.toLowerCase()] || answer;
}

function resetAttemptState() {
  answers = {};
  bookmarks = new Set();
  revisionQueue = new Set();
  currentQuestion = 0;
  timerSeconds = 0;
  quizSubmitted = false;
}

function resetQuizView() {
  togglePalette(false);
  els.resultSection.classList.add('hidden');
  els.questionSection.classList.remove('hidden');
  els.progressSection.classList.remove('hidden');
  els.markingInfo.classList.remove('hidden');
  els.paletteFab.classList.remove('hidden');
  els.bottomNav.classList.remove('hidden');
  updateTimerDisplay();
}

function getQuizTitle(file, data) {
  const catalogItem = quizCatalog.find(function (quiz) { return quiz.file === file; });
  return (data && (data.title || data.name)) || (catalogItem && catalogItem.title) || titleFromFileName(file);
}

function updatePageTitle() {
  document.title = `${currentQuizTitle} | SSC Prep Hub`;
  els.appTitle.textContent = currentQuizTitle;
  if (els.dashboardQuizTitle) els.dashboardQuizTitle.textContent = currentQuizTitle;
}

function updateActiveChapterState() {
  if (!quizCatalog.some(function (quiz) { return quiz.file === currentQuizFile; })) {
    quizCatalog.push({
      id: slugify(currentQuizTitle),
      file: currentQuizFile,
      title: currentQuizTitle,
      subject: inferSubject(currentQuizTitle),
      questionCount: questions.length
    });
    populateQuizSelect();
  }
  renderChapterCards();
}

function setQuizControlsDisabled(disabled) {
  els.prevBtn.disabled = disabled || currentQuestion === 0;
  els.nextBtn.disabled = disabled || currentQuestion >= questions.length - 1;
  els.clearBtn.disabled = disabled;
  els.submitBtn.disabled = disabled;
  els.bookmarkBtn.disabled = disabled;
  els.paletteFab.disabled = disabled;
}

function showQuizStatus(message) {
  els.quizStatus.textContent = message;
  els.quizStatus.classList.remove('hidden', 'error');
}

function showQuizError(message) {
  els.quizStatus.textContent = message;
  els.quizStatus.classList.remove('hidden');
  els.quizStatus.classList.add('error');
  els.questionSection.classList.add('hidden');
  els.progressSection.classList.add('hidden');
  els.markingInfo.classList.add('hidden');
  els.paletteFab.classList.add('hidden');
  els.bottomNav.classList.add('hidden');
}

function hideQuizStatus() {
  els.quizStatus.classList.add('hidden');
  els.quizStatus.classList.remove('error');
}

function isSafeQuizFile(file) {
  return /^[\w .()-]+\.json$/i.test(String(file || ''));
}

function titleFromFileName(file) {
  return String(file || 'Quiz')
    .replace(/\.json$/i, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, function (char) { return char.toUpperCase(); })
    .trim();
}

function slugify(text) {
  return String(text || 'quiz')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'quiz';
}

function updateMarkingInfo() {
  if (!questions.length) {
    els.markingInfo.textContent = 'Marking: +0, -0';
    return;
  }
  els.markingInfo.textContent = `Marking: +${questions[0].positive_marking}, -${questions[0].negative_marking}`;
}

function loadQuestion(index) {
  if (index < 0 || index >= questions.length) return;
  currentQuestion = index;
  const q = questions[currentQuestion];

  els.questionCounter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
  els.questionText.innerHTML = formatQuestion(q.question);
  els.optionsContainer.innerHTML = '';

  for (let i = 1; i <= 4; i++) {
    const label = document.createElement('label');
    label.className = 'option-label';
    if (answers[q.sr_no] === String(i)) label.classList.add('selected');

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'option';
    input.id = `option${i}`;
    input.value = String(i);
    input.checked = answers[q.sr_no] === String(i);

    const content = document.createElement('div');
    content.className = 'option-content';

    const badge = document.createElement('span');
    badge.className = 'option-badge';
    badge.textContent = String.fromCharCode(64 + i);

    const optionText = document.createElement('span');
    optionText.textContent = cleanOption(q[`option${i}`]);

    content.appendChild(badge);
    content.appendChild(optionText);
    label.appendChild(input);
    label.appendChild(content);

    input.addEventListener('change', function () {
      document.querySelectorAll('.option-label').forEach(function (item) {
        item.classList.remove('selected');
      });
      label.classList.add('selected');
      saveAnswer();
    });

    els.optionsContainer.appendChild(label);
  }

  els.bookmarkBtn.classList.toggle('active', bookmarks.has(q.sr_no));
  els.revisionBtn.classList.toggle('active', revisionQueue.has(q.sr_no));
  els.prevBtn.disabled = currentQuestion === 0;
  els.nextBtn.disabled = currentQuestion === questions.length - 1;
  els.nextBtn.classList.toggle('hidden', currentQuestion === questions.length - 1);
  els.submitBtn.classList.toggle('hidden', currentQuestion !== questions.length - 1);

  updateProgress();
  updatePalette();
  saveToLocalStorage();
}

function saveAnswer() {
  const q = questions[currentQuestion];
  const checked = document.querySelector('input[name="option"]:checked');
  if (checked) {
    answers[q.sr_no] = checked.value;
  }
  updateProgress();
  updatePalette();
  saveToLocalStorage();
}

function clearAnswer() {
  const q = questions[currentQuestion];
  delete answers[q.sr_no];
  document.querySelectorAll('input[name="option"]').forEach(function (input) {
    input.checked = false;
  });
  document.querySelectorAll('.option-label').forEach(function (label) {
    label.classList.remove('selected');
  });
  updateProgress();
  updatePalette();
  saveToLocalStorage();
}

function toggleBookmark() {
  const srNo = questions[currentQuestion].sr_no;
  const q = questions[currentQuestion];
  const shouldAdd = !bookmarks.has(srNo);

  if (bookmarks.has(srNo)) {
    bookmarks.delete(srNo);
  } else {
    bookmarks.add(srNo);
  }
  els.bookmarkBtn.classList.toggle('active', bookmarks.has(srNo));
  updatePalette();
  saveToLocalStorage();

  if (currentUser && firebaseApi && firebaseApi.isFirebaseReady && firebaseApi.isFirebaseReady()) {
    const record = buildQuestionRecord(q);
    const action = shouldAdd ? firebaseApi.addBookmark(currentUser.uid, record) : firebaseApi.removeBookmark(currentUser.uid, record);
    action.then(function (result) {
      if (!result.success) showToast(result.error, 'error');
      if (result.success && shouldAdd) showToast('Question bookmarked for revision.', 'success');
    });
  } else if (shouldAdd && shouldRequireLoginForTracking()) {
    showToast('Login to sync bookmarks across devices.', 'error');
  }
}

function toggleRevisionItem() {
  const srNo = questions[currentQuestion].sr_no;
  const q = questions[currentQuestion];
  const shouldAdd = !revisionQueue.has(srNo);

  if (revisionQueue.has(srNo)) {
    revisionQueue.delete(srNo);
  } else {
    revisionQueue.add(srNo);
  }

  els.revisionBtn.classList.toggle('active', revisionQueue.has(srNo));
  saveToLocalStorage();

  if (shouldAdd && currentUser && firebaseApi && firebaseApi.addRevisionItem && firebaseApi.isFirebaseReady()) {
    firebaseApi.addRevisionItem(currentUser.uid, buildQuestionRecord(q)).then(function (result) {
      if (result.success) showToast('Added to revision queue.', 'success');
      else showToast(result.error, 'error');
    });
  } else if (shouldAdd && shouldRequireLoginForTracking()) {
    showToast('Login to sync your revision queue.', 'error');
  }
}

function buildQuestionRecord(q) {
  const quiz = getQuizByFile(currentQuizFile);
  const chapterId = q.sourceChapterId || (quiz ? quiz.id : slugify(currentQuizTitle));
  const chapter = q.sourceChapter || currentQuizTitle;
  const quizTitle = q.sourceQuizTitle || currentQuizTitle;
  return {
    chapterId: chapterId,
    chapter: chapter,
    quizTitle: quizTitle,
    questionId: q.sr_no,
    questionText: cleanHindi(q.question),
    selectedAnswer: answers[q.sr_no] || '',
    correctAnswer: q.answer,
    explanation: q.explanation || '',
    options: {
      A: cleanOption(q.option1),
      B: cleanOption(q.option2),
      C: cleanOption(q.option3),
      D: cleanOption(q.option4)
    }
  };
}

function updateProgress() {
  if (!questions.length) {
    els.progressBar.style.width = '0%';
    els.progressText.textContent = '0/0';
    els.attemptedText.textContent = '0';
    updateDashboardStats();
    return;
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  els.progressBar.style.width = `${progress}%`;
  els.progressText.textContent = `${currentQuestion + 1}/${questions.length}`;
  els.attemptedText.textContent = Object.keys(answers).length;
  updateDashboardStats();
}

function updateDashboardStats() {
  if (!els.homeQuizCount) return;

  const attempted = Object.keys(answers).length;
  const catalogItem = getQuizByFile(currentQuizFile);
  const totalQuestions = questions.length || (catalogItem && catalogItem.questionCount) || 0;
  const attemptPercent = totalQuestions ? Math.round((attempted / totalQuestions) * 100) : 0;

  els.homeQuizCount.textContent = quizCatalog.length;
  els.homeQuestionCount.textContent = totalQuestions;
  els.homeAttemptedCount.textContent = attempted;
  els.homeProgressPercent.textContent = attempted === 0 ? 'Start a quiz to track your progress' : `${attemptPercent}%`;
  els.homeProgressBar.style.width = `${attemptPercent}%`;
  els.homeProgressBar.closest('.mini-progress-track').classList.toggle('is-empty', attempted === 0);
  if (els.dashboardQuizTitle) els.dashboardQuizTitle.textContent = currentQuizTitle;
}

function prevQuestion() {
  if (currentQuestion > 0) loadQuestion(currentQuestion - 1);
}

function nextQuestion() {
  if (currentQuestion < questions.length - 1) loadQuestion(currentQuestion + 1);
}

function selectOption(n) {
  const radio = document.getElementById(`option${n}`);
  if (radio) {
    radio.checked = true;
    radio.dispatchEvent(new Event('change', { bubbles: true }));
  }
}

function handleKeyboard(e) {
  if (!document.body.classList.contains('quiz-active')) return;
  const tag = document.activeElement.tagName.toLowerCase();
  if (isPaletteOpen || tag === 'input' || tag === 'textarea' || tag === 'select') return;

  if (e.key === 'ArrowLeft') prevQuestion();
  if (e.key === 'ArrowRight' || e.key === 'Enter') nextQuestion();
  if (e.key.toLowerCase() === 'b') toggleBookmark();
  if (e.key.toLowerCase() === 'r') toggleRevisionItem();
  if (e.key.toLowerCase() === 'c') clearAnswer();
  if (e.key.toLowerCase() === 'p') togglePalette();
  if (['1', '2', '3', '4'].includes(e.key)) selectOption(e.key);
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(function () {
    timerSeconds++;
    updateTimerDisplay();
    if (quizTimeLimitSeconds && timerSeconds >= quizTimeLimitSeconds) {
      showToast('Time limit reached. Submitting your quiz.', 'error');
      submitQuiz();
    }
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimerDisplay() {
  const displaySeconds = quizTimeLimitSeconds ? Math.max(quizTimeLimitSeconds - timerSeconds, 0) : timerSeconds;
  const minutes = Math.floor(displaySeconds / 60);
  const seconds = displaySeconds % 60;
  els.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  els.timer.classList.toggle('warning', quizTimeLimitSeconds ? displaySeconds <= 60 : timerSeconds > 600);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('quizTheme', next);
  els.themeToggle.textContent = next === 'dark' ? 'Light' : 'Dark';
}

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(function () {});
  } else {
    document.exitFullscreen().catch(function () {});
  }
}

function createPalette() {
  els.paletteGrid.innerHTML = '';
  els.paletteSearch.max = String(Math.max(questions.length, 1));
  for (let i = 0; i < questions.length; i++) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'palette-btn';
    btn.textContent = questions[i].sr_no;
    btn.addEventListener('click', function () {
      loadQuestion(i);
      togglePalette(false);
    });
    els.paletteGrid.appendChild(btn);
  }
  updatePalette();
}

function updatePalette() {
  if (!els.paletteGrid || !els.paletteGrid.children.length) return;

  const answered = Object.keys(answers).length;
  const bookmarked = bookmarks.size;
  els.paletteAnswered.textContent = answered;
  els.paletteNotAnswered.textContent = questions.length - answered;
  els.paletteBookmarked.textContent = bookmarked;
  els.paletteBadge.textContent = answered;

  Array.from(els.paletteGrid.children).forEach(function (btn, index) {
    const q = questions[index];
    btn.className = 'palette-btn';
    if (answers[q.sr_no]) btn.classList.add('answered');
    if (index === currentQuestion) btn.classList.add('current');
    if (bookmarks.has(q.sr_no)) btn.classList.add('bookmarked');
  });
}

function togglePalette(force) {
  const shouldOpen = typeof force === 'boolean' ? force : !isPaletteOpen;
  isPaletteOpen = shouldOpen;
  els.questionPalette.classList.toggle('open', shouldOpen);
  els.paletteOverlay.classList.toggle('show', shouldOpen);
  els.paletteFab.classList.toggle('open', shouldOpen);
  document.body.classList.toggle('palette-open', shouldOpen);
  els.paletteIcon.textContent = shouldOpen ? 'Close' : 'Grid';
  els.paletteFab.setAttribute('aria-label', shouldOpen ? 'Close question palette' : 'Open question palette');
  if (shouldOpen) {
    els.paletteSearch.value = '';
  }
}

function jumpFromSearch() {
  const n = Number(els.paletteSearch.value);
  if (Number.isInteger(n) && n >= 1 && n <= questions.length) {
    loadQuestion(n - 1);
    togglePalette(false);
  }
}

function saveToLocalStorage() {
  if (!document.body.classList.contains('quiz-active')) return;
  if (quizSubmitted || !questions.length) return;
  const state = {
    currentQuestion: currentQuestion,
    answers: answers,
    bookmarks: Array.from(bookmarks),
    revisionQueue: Array.from(revisionQueue),
    timerSeconds: timerSeconds,
    timestamp: Date.now()
  };
  localStorage.setItem(getQuizStateKey(), JSON.stringify(state));
}

function loadFromLocalStorage() {
  const raw = localStorage.getItem(getQuizStateKey());
  if (!raw) return false;

  try {
    const state = JSON.parse(raw);
    const age = Date.now() - state.timestamp;
    if (age < 24 * 60 * 60 * 1000) {
      if (confirm('Resume your saved quiz attempt?')) {
        answers = state.answers || {};
        bookmarks = new Set(state.bookmarks || []);
        revisionQueue = new Set(state.revisionQueue || []);
        timerSeconds = Number(state.timerSeconds) || 0;
        currentQuestion = Math.min(Math.max(Number(state.currentQuestion) || 0, 0), questions.length - 1);
        updateTimerDisplay();
        loadQuestion(currentQuestion);
        return true;
      } else {
        localStorage.removeItem(getQuizStateKey());
      }
    } else {
      localStorage.removeItem(getQuizStateKey());
    }
  } catch (e) {
    localStorage.removeItem(getQuizStateKey());
  }

  return false;
}

function getQuizStateKey() {
  return `quizState:${currentQuizFile}`;
}

function submitQuiz() {
  quizSubmitted = true;
  stopTimer();
  localStorage.removeItem(getQuizStateKey());
  togglePalette(false);
  const result = calculateQuizResult();

  els.questionSection.classList.add('hidden');
  els.progressSection.classList.add('hidden');
  els.markingInfo.classList.add('hidden');
  els.paletteFab.classList.add('hidden');
  els.bottomNav.classList.add('hidden');

  els.resultSection.innerHTML = buildResultsHtml(result);
  els.resultSection.classList.remove('hidden');
  bindResultActions();
  persistQuizAttempt(result);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function calculateQuizResult() {
  let correct = 0;
  let wrong = 0;
  let score = 0;
  let totalMarks = 0;
  const wrongAnswers = [];

  questions.forEach(function (q) {
    totalMarks += parseFloat(q.positive_marking || '0');
    const userAnswer = answers[q.sr_no];
    if (!userAnswer) return;
    if (userAnswer === q.answer) {
      correct++;
      score += parseFloat(q.positive_marking || '0');
    } else {
      wrong++;
      score -= parseFloat(q.negative_marking || '0');
      wrongAnswers.push(buildQuestionRecord(q));
    }
  });

  const unattempted = questions.length - correct - wrong;
  const scorePercentage = totalMarks ? (score / totalMarks) * 100 : 0;
  const answered = correct + wrong;
  const accuracy = answered ? (correct / answered) * 100 : 0;
  const bookmarkedQuestions = questions.filter(function (q) { return bookmarks.has(q.sr_no); }).map(buildQuestionRecord);
  const revisionQuestions = questions.filter(function (q) { return revisionQueue.has(q.sr_no); }).map(buildQuestionRecord);

  return {
    correct: correct,
    wrong: wrong,
    unattempted: unattempted,
    score: score,
    totalMarks: totalMarks,
    totalQuestions: questions.length,
    scorePercentage: scorePercentage,
    accuracy: accuracy,
    timeTaken: timerSeconds,
    wrongAnswers: wrongAnswers,
    bookmarkedQuestions: bookmarkedQuestions,
    revisionQuestions: revisionQuestions
  };
}

function buildResultsHtml(result) {
  const reviewHtml = questions.map(buildReviewItem).join('');
  const mistakeButtonDisabled = result.wrong ? '' : ' disabled';

  return `
    <div class="score-card">
      <p>Final result</p>
      <h2>${result.score}/${result.totalMarks}</h2>
      <p>${result.scorePercentage.toFixed(2)}% Score &middot; ${result.accuracy.toFixed(2)}% Accuracy</p>
      <p>Time Taken: ${formatTime(result.timeTaken)}</p>
    </div>
    <div id="saveStatus" class="save-status">Saving attempt to your dashboard...</div>
    <div class="stats-grid">
      <div class="stat-card correct-stat"><strong>${result.correct}</strong><span>Correct</span></div>
      <div class="stat-card wrong-stat"><strong>${result.wrong}</strong><span>Wrong</span></div>
      <div class="stat-card unattempted-stat"><strong>${result.unattempted}</strong><span>Unattempted</span></div>
      <div class="stat-card"><strong>${result.totalQuestions}</strong><span>Total</span></div>
    </div>
    <h2 class="review-title">Question Review</h2>
    <div class="review-list">${reviewHtml}</div>
    <div class="action-buttons">
      <button class="action-btn review-mistakes-btn" type="button" data-result-filter="mistakes"${mistakeButtonDisabled}>Review Mistakes</button>
      <button class="action-btn show-all-btn" type="button" data-result-filter="all">Show All</button>
      <button class="action-btn restart-btn" type="button" onclick="restartQuiz()">Restart Quiz</button>
      <button class="action-btn home-btn" type="button" onclick="exitQuiz()">Go Home</button>
      <a class="action-btn dashboard-btn" href="../dashboard/dashboard.html">Open Dashboard</a>
    </div>
  `;
}

function buildReviewItem(q) {
  const userAnswer = answers[q.sr_no];
  let optionsHtml = '';
  const isWrong = Boolean(userAnswer && userAnswer !== q.answer);
  const status = isWrong ? 'wrong' : (userAnswer ? 'correct' : 'unattempted');

  for (let i = 1; i <= 4; i++) {
    const isCorrect = q.answer === String(i);
    const isUser = userAnswer === String(i);
    const classes = ['review-option'];
    if (isCorrect) classes.push('correct');
    if (isUser && !isCorrect) classes.push('wrong');
    if (isUser) classes.push('user-selected');

    let prefix = '';
    if (isCorrect) prefix += 'Correct: ';
    if (isUser) prefix += 'Your answer: ';

    optionsHtml += `<div class="${classes.join(' ')}">${prefix}${String.fromCharCode(64 + i)}. ${escHtml(cleanOption(q[`option${i}`]))}</div>`;
  }

  const explanationHtml = (isWrong || !userAnswer) && q.explanation ? `
      <div class="review-explanation">
        <strong>Explanation:</strong> ${escHtml(q.explanation)}
      </div>
    ` : '';

  return `
    <div class="review-item" data-review-status="${status}">
      <div class="review-question-title">
        <span class="review-question-number">Q${escHtml(q.sr_no)}</span>
        ${formatQuestion(q.question)}
      </div>
      ${optionsHtml}
      ${explanationHtml}
      <div class="review-actions">
        <button class="review-mini-btn" type="button" data-review-action="bookmark" data-question-id="${escHtml(q.sr_no)}">Save Bookmark</button>
        <button class="review-mini-btn" type="button" data-review-action="revision" data-question-id="${escHtml(q.sr_no)}">Add to Revision</button>
      </div>
    </div>
  `;
}

function bindResultActions() {
  els.resultSection.querySelectorAll('[data-result-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyResultFilter(button.dataset.resultFilter);
    });
  });

  els.resultSection.querySelectorAll('[data-review-action]').forEach(function (button) {
    button.addEventListener('click', function () {
      const q = questions.find(function (item) {
        return String(item.sr_no) === String(button.dataset.questionId);
      });
      if (!q) return;

      const action = button.dataset.reviewAction;
      if (action === 'bookmark') {
        bookmarks.add(q.sr_no);
        saveToLocalStorage();
        saveQuestionBookmark(q, button);
      }
      if (action === 'revision') {
        revisionQueue.add(q.sr_no);
        saveToLocalStorage();
        saveQuestionRevision(q, button);
      }
    });
  });
}

function applyResultFilter(filter) {
  const showMistakesOnly = filter === 'mistakes';
  els.resultSection.querySelectorAll('.review-item').forEach(function (item) {
    item.classList.toggle('hidden', showMistakesOnly && item.dataset.reviewStatus !== 'wrong');
  });
  els.resultSection.querySelectorAll('[data-result-filter]').forEach(function (button) {
    button.classList.toggle('active', button.dataset.resultFilter === filter);
  });
  const title = els.resultSection.querySelector('.review-title');
  if (title) title.textContent = showMistakesOnly ? 'Mistake Review' : 'Question Review';
}

async function persistQuizAttempt(result) {
  if (!firebaseApi || !firebaseApi.isFirebaseReady || !firebaseApi.isFirebaseReady()) {
    setSaveStatus('Firebase is not configured yet. Result is shown locally; add config to enable cloud tracking.', 'error');
    return;
  }

  if (!currentUser) {
    setSaveStatus('Login required to save this result to your dashboard.', 'error');
    return;
  }

  const quiz = getQuizByFile(currentQuizFile);
  const payload = {
    chapter: currentQuizTitle,
    chapterId: quiz ? quiz.id : slugify(currentQuizTitle),
    quizTitle: currentQuizTitle,
    score: result.score,
    totalMarks: result.totalMarks,
    correct: result.correct,
    wrong: result.wrong,
    unattempted: result.unattempted,
    totalQuestions: result.totalQuestions,
    accuracy: Number(result.accuracy.toFixed(2)),
    timeTaken: result.timeTaken,
    wrongAnswers: result.wrongAnswers,
    bookmarkedQuestions: result.bookmarkedQuestions,
    revisionQuestions: result.revisionQuestions
  };

  const attemptResult = await firebaseApi.saveQuizAttempt(currentUser.uid, payload);
  if (!attemptResult.success) {
    setSaveStatus(attemptResult.error || 'Could not save quiz attempt.', 'error');
    return;
  }

  await Promise.all([
    ...result.bookmarkedQuestions.map(function (item) { return firebaseApi.addBookmark(currentUser.uid, item); }),
    ...result.revisionQuestions.map(function (item) { return firebaseApi.addRevisionItem(currentUser.uid, item); })
  ]);

  setSaveStatus('Attempt saved to dashboard with score, accuracy, wrong answers, time taken, bookmarks, and revision items.', 'success');
}

function saveQuestionBookmark(q, button) {
  if (!currentUser || !firebaseApi || !firebaseApi.addBookmark || !firebaseApi.isFirebaseReady()) {
    showToast('Login to sync this bookmark to your dashboard.', 'error');
    return;
  }

  firebaseApi.addBookmark(currentUser.uid, buildQuestionRecord(q)).then(function (result) {
    if (result.success) {
      button.textContent = 'Bookmarked';
      button.disabled = true;
      showToast('Bookmark saved.', 'success');
    } else {
      showToast(result.error, 'error');
    }
  });
}

function saveQuestionRevision(q, button) {
  if (!currentUser || !firebaseApi || !firebaseApi.addRevisionItem || !firebaseApi.isFirebaseReady()) {
    showToast('Login to sync this revision item to your dashboard.', 'error');
    return;
  }

  firebaseApi.addRevisionItem(currentUser.uid, buildQuestionRecord(q)).then(function (result) {
    if (result.success) {
      button.textContent = 'Added';
      button.disabled = true;
      showToast('Revision item saved.', 'success');
    } else {
      showToast(result.error, 'error');
    }
  });
}

function setSaveStatus(message, type) {
  const status = document.getElementById('saveStatus');
  if (!status) return;
  status.textContent = message;
  status.className = `save-status ${type || ''}`;
}

function restartQuiz() {
  if (!confirm('Restart quiz?')) return;

  document.body.classList.add('quiz-active');
  resetAttemptState();
  localStorage.removeItem(getQuizStateKey());

  resetQuizView();

  createPalette();
  loadQuestion(0);
  startTimer();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function formatTime(totalSeconds) {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

function formatQuestion(rawText) {
  const text = normalizeQuestionDisplayText(cleanHindi(rawText));

  if (/Match\s+the\s+following/i.test(text) || /\bColumn\s+I\b/i.test(text)) {
    return formatMatchQuestion(text);
  }

  if (/Statement\s+(?:I{1,3}|IV|V|\d+)\s*:/i.test(text) || /^Assertion\s*\(A\)\s*:/i.test(text)) {
    return formatStatementQuestion(text);
  }

  // "Consider the following statements:" + numbered list ("1. ...", "2. ...")
  if (/consider the following/i.test(text) && /^\d+\.\s+\S/m.test(text)) {
    return formatStatementQuestion(text);
  }

  return `<div class="q-text">${escHtml(text)}</div>`;
}

function formatMatchQuestion(text) {
  const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

  const colIIdx = lines.findIndex(function (l) {
    return /^Column\s+I\b/i.test(l) && !/^Column\s+II\b/i.test(l);
  });
  const colIIIdx = lines.findIndex(function (l) { return /^Column\s+II\b/i.test(l); });

  if (colIIdx === -1 || colIIIdx === -1) {
    return '<div class="q-text match-block">' + escHtml(text) + '</div>';
  }

  const intro = lines.slice(0, colIIdx).join(' ');
  let colIItems = lines.slice(colIIdx + 1, colIIIdx).filter(function (line) {
    return /^(?:I|II|III|IV|V|VI|VII|VIII|IX|X)\.\s+/i.test(line);
  });
  let colIIItems = lines.slice(colIIIdx + 1).filter(function (line) {
    return /^[P-S]\.\s+/i.test(line);
  });

  if (!colIItems.length) colIItems = lines.slice(colIIdx + 1, colIIIdx);
  if (!colIIItems.length) colIIItems = lines.slice(colIIIdx + 1);

  const rowCount = Math.max(colIItems.length, colIIItems.length);
  let tableHtml = '<div class="match-table"><div class="match-header">Column I</div><div class="match-header">Column II</div>';
  for (let i = 0; i < rowCount; i++) {
    tableHtml += '<div class="match-cell">' + escHtml(colIItems[i] || '') + '</div>';
    tableHtml += '<div class="match-cell">' + escHtml(colIIItems[i] || '') + '</div>';
  }
  tableHtml += '</div>';

  return '<div class="q-text match-block">' +
    (intro ? '<div class="match-intro">' + escHtml(intro) + '</div>' : '') +
    tableHtml +
  '</div>';
}

function formatStatementQuestion(text) {
  const lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  let html = '<div class="q-text statement-group">';
  lines.forEach(function (line) {
    if (/^(Statement\s+(?:I{1,3}|IV|V|\d+)|Assertion\s*\(A\)|Reason\s*\(R\))\s*:/i.test(line)) {
      html += '<div class="statement-block">' + escHtml(line) + '</div>';
    } else if (/^\d+\.\s+\S/.test(line) || /^[A-D]\.\s+\S/.test(line)) {
      // numbered list items ("1. Isochronos...") and lettered items get statement-block style
      html += '<div class="statement-block">' + escHtml(line) + '</div>';
    } else {
      html += '<div class="statement-plain">' + escHtml(line) + '</div>';
    }
  });
  html += '</div>';
  return html;
}

function normalizeQuestionDisplayText(text) {
  return String(text || '')
    .replace(/\r\n?/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

// Remove Hindi (Devanagari) from question text
function cleanHindi(text) {
  if (!text) return '';
  return text.replace(/\s*[\u0900-\u097F][\s\S]*/g, '').trim()
             .replace(/[:\s]+$/, '').trim();
}

// Clean option text — split on " / " or " // " for bilingual options
function cleanOption(text) {
  if (!text) return '';
  if (text.includes(' / '))  return text.split(' / ')[0].trim();
  if (text.includes(' // ')) return text.split(' // ')[0].trim();
  return cleanHindi(text);
}

// HTML-escape for safe innerHTML insertion
function escHtml(t) {
  return String(t).replace(/&/g,'&amp;').replace(/</g,'&lt;')
                  .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function showToast(message, type) {
  if (!els.toastHost) return;
  const toast = document.createElement('div');
  toast.className = `toast ${type || ''}`;
  toast.textContent = message;
  els.toastHost.appendChild(toast);
  setTimeout(function () {
    toast.remove();
  }, 4600);
}

function preventDoubleTapZoom() {
  let lastTouchEnd = 0;
  document.addEventListener('touchend', function (event) {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) {
      event.preventDefault();
    }
    lastTouchEnd = now;
  }, { passive: false });
}
