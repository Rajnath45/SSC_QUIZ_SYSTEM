const QUIZ_FOLDER = '../QUIZZES/';
const QUIZ_MANIFEST = `${QUIZ_FOLDER}quizzes.json`;
const DEFAULT_QUIZ_FILE = 'Solar_System.json';
// To add future chapters: place the new JSON file in /QUIZZES, add it to
// /QUIZZES/quizzes.json, and keep the file name simple (letters, numbers,
// spaces, underscores, hyphens).
const FALLBACK_QUIZZES = [
  { id: 'solar-system', file: 'Solar_System.json', title: 'Solar System Quiz', subject: 'science', questionCount: 47 },
  { id: 'world-map', file: 'World_Map.json', title: 'World Map Quiz', subject: 'geography', questionCount: 60 },
  { id: 'latitudes-longitudes', file: 'Latitudes_Longitudes.json', title: 'Latitudes and Longitudes Quiz', subject: 'geography', questionCount: 16 }
];

let quizCatalog = [];
let currentQuizFile = DEFAULT_QUIZ_FILE;
let currentQuizTitle = 'SSC Quiz';
let currentChapterName = '';
let currentSubject = '';
let selectedQuizFile = '';
let activeSubject = 'all';
let questions = [];
let currentQuestion = 0;
let answers = {};
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
  initEventListeners();
  updateActionCenterDate();
  renderActionCenterMetrics();
  await initFirebaseBridge();
  preventDoubleTapZoom();
  await initQuizCatalog();
  applySubjectParamFromUrl();
  currentQuizFile = getInitialQuizFile();
  const initialQuiz = getQuizByFile(currentQuizFile);
  currentQuizTitle = initialQuiz ? initialQuiz.title : 'SSC Quiz';
  updatePageTitle();
  updateDashboardStats();
  updateTimerDisplay();
  renderRevisionDuePracticeCard();
  updateRevisionNavBadge();
  if (getUrlMode() === 'revision') {
    window.location.href = '../revision/revision.html';
    return;
  }
  setInterval(saveToLocalStorage, 5000);
  setInterval(updateActionCenterDate, 60000);
});

function cacheElements() {
  els.appTitle = document.getElementById('appTitle');
  els.guestContent = document.getElementById('guestContent');
  els.userActionCenter = document.getElementById('userActionCenter');
  els.guestLoginBtn = document.getElementById('guestLoginBtn');
  els.userFirstName = document.getElementById('userFirstName');
  els.todayDate = document.getElementById('todayDate');
  els.streakCount = document.getElementById('streakCount');
  els.weeklyStreakRow = document.getElementById('weeklyStreakRow');
  els.subjectCards = Array.from(document.querySelectorAll('[data-subject-card]'));
  els.subjectChapterCounts = {
    geography: document.getElementById('geographyChapterCount'),
    history: document.getElementById('historyChapterCount'),
    polity: document.getElementById('polityChapterCount'),
    science: document.getElementById('scienceChapterCount')
  };
  els.chaptersSection = document.getElementById('chapters');
  els.chapterSectionTitle = document.getElementById('chapterSectionTitle');
  els.chapterFilterEyebrow = document.getElementById('chapterFilterEyebrow');
  els.clearSubjectFilter = document.getElementById('clearSubjectFilter');
  els.chapterCards = document.getElementById('chapterCards');
  els.chapterSearch = document.getElementById('chapterSearch');
  els.hamburger = document.getElementById('hamburger');
  els.navLinks = document.querySelector('.nav-links');
  els.headerControls = document.querySelector('.header-controls');
  els.authStatus = document.getElementById('authStatus');
  els.authActionBtn = document.getElementById('authActionBtn');
  els.dashboardLink = document.getElementById('dashboardLink');
  els.quizStatus = document.getElementById('quizStatus');
  els.timer = document.getElementById('timer');
  els.fullscreenBtn = document.getElementById('fullscreenBtn');
  els.markingInfo = document.getElementById('markingInfo');
  els.progressSection = document.getElementById('progressSection');
  els.progressText = document.getElementById('progressText');
  els.attemptedText = document.getElementById('attemptedText');
  els.progressBar = document.getElementById('progressBar');
  els.questionSection = document.getElementById('questionSection');
  els.questionCounter = document.getElementById('questionCounter');
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
  els.paletteSearch = document.getElementById('paletteSearch');
  els.paletteGrid = document.getElementById('paletteGrid');
  els.toastHost = document.getElementById('toastHost');
  els.revisionNavLink = document.getElementById('revisionNavLink');
  els.revisionNavBadge = document.getElementById('revisionNavBadge');
  els.customizeModal = document.getElementById('quizCustomizeModal');
  els.customizeSubtitle = document.getElementById('customizeSubtitle');
  els.countPills = Array.from(document.querySelectorAll('[data-count-choice]'));
  els.countAvailability = document.getElementById('countAvailability');
  els.timeLimitOptions = document.getElementById('timeLimitOptions');
  els.startCustomizedQuiz = document.getElementById('startCustomizedQuiz');
}

function initEventListeners() {
  if (els.guestLoginBtn) els.guestLoginBtn.addEventListener('click', handleAuthAction);

  els.subjectCards.forEach(function (card) {
    card.addEventListener('click', function () {
      showSubjectChapters(card.dataset.subjectCard || 'all');
    });
  });

  if (els.clearSubjectFilter) {
    els.clearSubjectFilter.addEventListener('click', function () {
      hideChapterList(true);
    });
  }

  if (els.chapterSearch) els.chapterSearch.addEventListener('input', applyChapterFilters);
  if (els.hamburger) {
    els.hamburger.addEventListener('click', function () {
      const open = !els.navLinks.classList.contains('open');
      els.navLinks.classList.toggle('open', open);
      els.headerControls.classList.toggle('open', open);
      els.hamburger.setAttribute('aria-expanded', String(open));
    });
  }
  document.querySelectorAll('a[href="#workspaceHome"]').forEach(function (link) {
    link.addEventListener('click', function () {
      if (document.body.classList.contains('quiz-active')) exitQuiz();
      hideChapterList(false);
    });
  });
  document.querySelectorAll('a[href="#chapters"]').forEach(function (link) {
    link.addEventListener('click', function (event) {
      if (!currentUser) return;
      event.preventDefault();
      showSubjectChapters('all');
    });
  });

  els.prevBtn.addEventListener('click', prevQuestion);
  els.nextBtn.addEventListener('click', nextQuestion);
  els.clearBtn.addEventListener('click', clearAnswer);
  els.submitBtn.addEventListener('click', submitQuiz);
  if (els.authActionBtn) els.authActionBtn.addEventListener('click', handleAuthAction);
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
      showToast('Firebase config is pending. Add real values in CORE/firebase-config.js to enable login.', 'error');
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
    const firstName = getUserFirstName(currentUser);
    els.authStatus.textContent = firstName;
    els.authActionBtn.textContent = 'Logout';
    if (els.dashboardLink) els.dashboardLink.classList.remove('hidden');
    if (els.guestContent) els.guestContent.classList.add('hidden');
    if (els.userActionCenter) els.userActionCenter.classList.remove('hidden');
    if (els.userFirstName) els.userFirstName.textContent = firstName;
    if (els.chaptersSection && !els.chaptersSection.dataset.openedBySubject) hideChapterList(false);
    renderActionCenterMetrics();
  } else {
    els.authStatus.textContent = firebaseBridgeReady ? 'Guest' : 'Offline';
    els.authActionBtn.textContent = 'Login';
    if (els.dashboardLink) els.dashboardLink.classList.add('hidden');
    if (els.guestContent) els.guestContent.classList.remove('hidden');
    if (els.userActionCenter) els.userActionCenter.classList.add('hidden');
    hideChapterList(false);
  }
}

function getUserFirstName(user) {
  const displayName = user && user.displayName ? user.displayName.trim() : '';
  const emailName = user && user.email ? user.email.split('@')[0] : '';
  const cleaned = (displayName || emailName || 'Aspirant').replace(/[-_.]+/g, ' ').trim();
  return cleaned.split(/\s+/)[0] || 'Aspirant';
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

function applySubjectParamFromUrl() {
  const urlParams = new URLSearchParams(window.location.search);
  const subjectParam = urlParams.get('subject');
  if (!subjectParam) return;
  const normalized = normalizeSubject(subjectParam);
  const matchingCard = document.querySelector(`[data-subject-card="${cssEscape(normalized)}"]`);
  if (matchingCard || normalized === 'all') showSubjectChapters(normalized);
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
  updateSubjectCounts();
  if (els.chaptersSection && !els.chaptersSection.classList.contains('hidden')) {
    renderChapterCards();
  }
  updateDashboardStats();
}

function renderChapterCards() {
  if (!els.chapterCards) return;

  els.chapterCards.innerHTML = '';
  const filteredQuizzes = getFilteredQuizCatalog(activeSubject);

  if (!quizCatalog.length) {
    els.chapterCards.innerHTML = `
      <div class="empty-state">
        <span>&#128218;</span>
        <h3>No chapters available yet</h3>
        <p>Check back soon or contact the admin.</p>
      </div>
    `;
    return;
  }

  if (!filteredQuizzes.length) {
    els.chapterCards.innerHTML = `
      <div class="empty-state">
        <span>&#128218;</span>
        <h3>No matching chapters</h3>
        <p>${activeSubject === 'all' ? 'Try another search.' : `${escHtml(labelFromSubject(activeSubject))} chapters are not available yet.`}</p>
      </div>
    `;
    return;
  }

  filteredQuizzes.forEach(function (quiz, index) {
    const card = document.createElement('article');
    card.className = 'chapter-card';
    card.dataset.title   = quiz.title;
    card.dataset.subject = quiz.subject;
    card.dataset.chapterId = quiz.id;
    card.dataset.file    = quiz.file;

    if (quiz.file === selectedQuizFile) card.classList.add('selected');
    if (quiz.file === currentQuizFile)  card.classList.add('active');

    const questionCount = quiz.file === currentQuizFile && questions.length
      ? questions.length
      : quiz.questionCount;
    const questionText  = questionCount ? `${questionCount} questions` : 'Practice set';
   // NEW — index within the same subject only
    const subjectCatalog = quizCatalog.filter(function (item) { return item.subject === quiz.subject; });
    const chapterNumber = subjectCatalog.findIndex(function (item) { return item.id === quiz.id; }) + 1;
    const numLabel      = String(chapterNumber || index + 1).padStart(2, '0');

    card.innerHTML = `
      <div class="chapter-num-box" aria-hidden="true">${numLabel}</div>
      <div class="chapter-info">
        <strong class="chapter-title">${escHtml(quiz.title)}</strong>
        <span class="chapter-q-count">${escHtml(questionText)}</span>
      </div>
    `;

    card.addEventListener('click', function () {
      launchQuiz(quiz.id);
    });

    els.chapterCards.appendChild(card);
  });
}

function getFilteredQuizCatalog(subject) {
  const selectedSubject = normalizeSubject(subject || activeSubject || 'all');
  const query = (els.chapterSearch && els.chapterSearch.value || '').toLowerCase().trim();

  return quizCatalog.filter(function (quiz) {
    const matchesSubject = selectedSubject === 'all' || quiz.subject === selectedSubject;
    const matchesSearch = !query || (quiz.title || '').toLowerCase().includes(query);
    return matchesSubject && matchesSearch;
  });
}

function showSubjectChapters(subject) {
  activeSubject = normalizeSubject(subject || 'all');
  if (els.chapterSearch) els.chapterSearch.value = '';
  if (els.chaptersSection) {
    els.chaptersSection.dataset.openedBySubject = 'true';
    els.chaptersSection.classList.remove('hidden');
  }
  updateChapterFilterHeading();
  renderChapterCards();
  syncSubjectCardState();
  if (els.chaptersSection) {
    els.chaptersSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
}

function hideChapterList(shouldScroll) {
  activeSubject = 'all';
  selectedQuizFile = '';
  if (els.chapterSearch) els.chapterSearch.value = '';
  if (els.chapterCards) els.chapterCards.innerHTML = '';
  if (els.chaptersSection) {
    delete els.chaptersSection.dataset.openedBySubject;
    els.chaptersSection.classList.add('hidden');
  }
  updateChapterFilterHeading();
  syncSubjectCardState();

  if (shouldScroll && els.subjectGrid) {
    els.subjectGrid.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}

function updateChapterFilterHeading() {
  const subjectLabel = activeSubject === 'all' ? 'All Subjects' : labelFromSubject(activeSubject);
  if (els.chapterFilterEyebrow) {
    els.chapterFilterEyebrow.textContent = activeSubject === 'all' ? 'Chapter practice' : `${subjectLabel} practice`;
  }
  if (els.chapterSectionTitle) {
    els.chapterSectionTitle.textContent = activeSubject === 'all' ? 'All available chapters' : `${subjectLabel} chapters`;
  }
  if (els.clearSubjectFilter) {
    els.clearSubjectFilter.classList.toggle('hidden', !els.chaptersSection || els.chaptersSection.classList.contains('hidden'));
  }
}

function syncSubjectCardState() {
  els.subjectCards.forEach(function (card) {
    const isActive = activeSubject !== 'all' && card.dataset.subjectCard === activeSubject && els.chaptersSection && !els.chaptersSection.classList.contains('hidden');
    card.classList.toggle('active', Boolean(isActive));
  });
}

function updateSubjectCounts() {
  const subjects = ['geography', 'history', 'polity', 'science'];
  subjects.forEach(function (subject) {
    const count = quizCatalog.filter(function (quiz) { return quiz.subject === subject; }).length;
    const el = els.subjectChapterCounts && els.subjectChapterCounts[subject];
    if (el) el.textContent = `${count} chapter${count === 1 ? '' : 's'}`;
  });
}

function getChapterDescription(title, index) {
  const descriptions = [
    'Build accuracy with focused SSC-style objective questions and quick review.',
    'Practice recall, eliminate weak areas, and keep your attempt moving.',
    'Use inline explanations to repair mistakes before the next question.'
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
  if (/polity|constitution|parliament|governance|rights/i.test(title)) return 'polity';
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
}

function applyChapterFilters() {
  if (els.chaptersSection && els.chaptersSection.classList.contains('hidden')) {
    els.chaptersSection.classList.remove('hidden');
  }
  updateChapterFilterHeading();
  if (!els.chaptersSection || !els.chaptersSection.classList.contains('hidden')) {
    renderChapterCards();
  }
}

async function launchQuiz(chapterId) {
  if (firebaseApi && firebaseApi.authReady && shouldRequireLoginForTracking() && !currentUser) {
    currentUser = await firebaseApi.authReady;
    updateAuthUi();
  }

  if (shouldRequireLoginForTracking() && !currentUser) {
    showToast('Login first so your quiz attempt can be started.', 'error');
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
  hideChapterList(false);
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
  currentChapterName = (questions[0] && questions[0].chapterName) || currentQuizTitle;
  currentSubject = (questions[0] && questions[0].subject) || labelFromSubject((catalogItem && catalogItem.subject) || inferSubject(currentQuizTitle));
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

function normalizeQuizData(data) {
  const list = Array.isArray(data) ? data : data.questions;
  if (!Array.isArray(list)) throw new Error('Quiz JSON must be an array or an object with a questions array.');
  const meta = Array.isArray(data) ? {} : data;

  return list.map(function (item, index) {
    const options = normalizeOptions(item);
    const answer = normalizeAnswer(item.answer ?? item.correct);
    const correctIndex = Math.max(0, Number(answer) - 1);
    const chapterName = item.chapterName || meta.chapterName || meta.title || currentQuizTitle || titleFromFileName(currentQuizFile);
    const subject = labelFromSubject(item.subject || meta.subject || inferSubject(chapterName));
    return {
      sr_no: item.sr_no || index + 1,
      id: String(item.id || `${normalizeSubject(subject)}-${slugify(chapterName)}-${String(index + 1).padStart(3, '0')}`),
      question: item.question || '',
      option1: options[0],
      option2: options[1],
      option3: options[2],
      option4: options[3],
      options: options.slice(0, 4),
      answer: answer,
      correct: correctIndex,
      positive_marking: String(item.positive_marking || item.positive || meta.positive_marking || '1'),
      negative_marking: String(item.negative_marking || item.negative || meta.negative_marking || '0'),
      explanation: item.explanation || '',
      subject: subject,
      chapterName: chapterName,
      pyq: item.pyq ?? null,
      difficulty: item.difficulty ?? null
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
  if (Number.isInteger(value)) {
    return String(value >= 0 && value <= 3 ? value + 1 : value);
  }
  const answer = String(value || '').trim();
  const letterMap = { a: '1', b: '2', c: '3', d: '4' };
  return letterMap[answer.toLowerCase()] || answer;
}

function resetAttemptState() {
  answers = {};
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
  if (!els.chaptersSection || !els.chaptersSection.classList.contains('hidden')) {
    renderChapterCards();
  }
}

function setQuizControlsDisabled(disabled) {
  els.prevBtn.disabled = disabled || currentQuestion === 0;
  els.nextBtn.disabled = disabled || currentQuestion >= questions.length - 1;
  els.clearBtn.disabled = disabled;
  els.submitBtn.disabled = disabled;
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
  const selectedAnswer = answers[q.sr_no];
  const hasSelected = Boolean(selectedAnswer);

  els.questionCounter.textContent = `Question ${currentQuestion + 1} of ${questions.length}`;
  els.questionText.innerHTML = `${buildMetaChips(q)}${formatQuestion(q.question)}`;
  els.optionsContainer.innerHTML = '';

  for (let i = 1; i <= 4; i++) {
    const label = document.createElement('label');
    label.className = 'option-label';
    const isCorrect = q.answer === String(i);
    const isSelected = selectedAnswer === String(i);
    if (isSelected) label.classList.add('selected');
    if (hasSelected) {
      label.classList.add('is-disabled');
      if (isCorrect) label.classList.add('correct');
      if (isSelected && !isCorrect) label.classList.add('wrong');
    }

    const input = document.createElement('input');
    input.type = 'radio';
    input.name = 'option';
    input.id = `option${i}`;
    input.value = String(i);
    input.checked = isSelected;
    input.disabled = hasSelected;

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
      saveAnswer(input.value);
    });

    els.optionsContainer.appendChild(label);
  }

  if (hasSelected) renderInlineExplanation(q, selectedAnswer);

  els.prevBtn.disabled = currentQuestion === 0;
  els.nextBtn.disabled = currentQuestion === questions.length - 1;
  els.clearBtn.disabled = hasSelected;
  els.nextBtn.classList.toggle('hidden', currentQuestion === questions.length - 1);
  els.submitBtn.classList.toggle('hidden', currentQuestion !== questions.length - 1);

  updateProgress();
  updatePalette();
  saveToLocalStorage();
}

function saveAnswer(value) {
  const q = questions[currentQuestion];
  if (!q || answers[q.sr_no]) return;
  answers[q.sr_no] = value;
  loadQuestion(currentQuestion);
  updateProgress();
  updatePalette();
  saveToLocalStorage();
}

function clearAnswer() {
  const q = questions[currentQuestion];
  if (answers[q.sr_no]) return;
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

function renderInlineExplanation(q, selectedAnswer) {
  const isWrong = selectedAnswer !== q.answer;
  const feedback = document.createElement('div');
  feedback.className = 'answer-feedback';
  feedback.innerHTML = `
    <div class="inline-explanation">
      <strong>Explanation</strong>
      <p>${escHtml(q.explanation || 'No explanation added yet.')}</p>
    </div>
    ${isWrong ? '<button id="addRevisionBtn" class="add-revision-btn" type="button">+ Add to Revision</button>' : ''}
  `;
  els.optionsContainer.appendChild(feedback);

  const addRevisionBtn = document.getElementById('addRevisionBtn');
  if (addRevisionBtn) {
    addRevisionBtn.addEventListener('click', function () {
      addToRevision(buildRevisionQuestion(q));
    });
  }
}

function buildMetaChips(q) {
  // PYQ exam / year metadata is intentionally not displayed in the quiz UI.
  return '';
}

function buildRevisionQuestion(q) {
  return {
    id: q.id,
    question: cleanHindi(q.question),
    options: q.options.map(cleanOption),
    correct: q.correct,
    explanation: q.explanation || '',
    subject: q.subject || currentSubject,
    chapterName: q.chapterName || currentChapterName,
    pyq: q.pyq ?? null,
    difficulty: q.difficulty ?? null
  };
}

function addToRevision(question) {
  let queue = JSON.parse(localStorage.getItem('revisionQueue') || '[]');
  const exists = queue.some(q => q.id === question.id);
  const btn = document.getElementById('addRevisionBtn');
  if (exists) {
    btn.textContent = '✓ Already in Revision';
    btn.disabled = true;
    return;
  }
  queue.push({
    ...question,
    addedOn: new Date().toISOString().split('T')[0],
    nextReview: new Date(Date.now() + 86400000).toISOString().split('T')[0],
    reviewCount: 0
  });
  localStorage.setItem('revisionQueue', JSON.stringify(queue));
  btn.textContent = '✓ Added to Revision';
  btn.disabled = true;
  renderRevisionDuePracticeCard();
  updateRevisionNavBadge();
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
    els.progressText.textContent = 'Q 0 / 0';
    if (els.attemptedText) els.attemptedText.textContent = '0';
    updateDashboardStats();
    return;
  }

  const progress = ((currentQuestion + 1) / questions.length) * 100;
  els.progressBar.style.width = `${progress}%`;
  els.progressText.textContent = `Q ${currentQuestion + 1} / ${questions.length}`;
  if (els.attemptedText) els.attemptedText.textContent = Object.keys(answers).length;
  updateDashboardStats();
}

function updateDashboardStats() {
  renderActionCenterMetrics();
  renderRevisionDuePracticeCard();
  updateRevisionNavBadge();
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
  els.paletteAnswered.textContent = answered;
  els.paletteNotAnswered.textContent = questions.length - answered;
  els.paletteBadge.textContent = answered;

  Array.from(els.paletteGrid.children).forEach(function (btn, index) {
    const q = questions[index];
    btn.className = 'palette-btn';
    if (answers[q.sr_no]) btn.classList.add('answered');
    if (index === currentQuestion) btn.classList.add('current');
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
  updateStats(result.correct + result.wrong, result.correct);
  setSaveStatus('Progress saved on this device.', 'success');
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
    wrongAnswers: wrongAnswers
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
    </div>
  `;
}

function bindResultActions() {
  els.resultSection.querySelectorAll('[data-result-filter]').forEach(function (button) {
    button.addEventListener('click', function () {
      applyResultFilter(button.dataset.resultFilter);
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

function updateStats(totalAnswered, correctAnswers) {
  let totalQ = parseInt(localStorage.getItem('totalQuestions') || '0');
  let totalQuizzes = parseInt(localStorage.getItem('totalQuizzes') || '0');
  let correct = parseInt(localStorage.getItem('totalCorrect') || '0') + correctAnswers;

  localStorage.setItem('totalQuestions', totalQ + totalAnswered);
  localStorage.setItem('totalQuizzes', totalQuizzes + 1);
  localStorage.setItem('totalCorrect', correct);

  const attemptedTotal = totalQ + totalAnswered;
  const accuracy = attemptedTotal ? Math.round((correct / attemptedTotal) * 100) : 0;
  localStorage.setItem('accuracy', accuracy);

  saveQuizToHistory(correctAnswers, totalAnswered);

  updateStreak();
  renderActionCenterMetrics();

  localStorage.setItem('lastAttempted', JSON.stringify({
    chapterName: currentChapterName,
    subject: currentSubject,
    progress: totalAnswered ? Math.round((correctAnswers / totalAnswered) * 100) : 0,
    url: window.location.href
  }));
}

/**
 * Appends one quiz result to localStorage:quizHistory so dashboard.js
 * can read and display it. Mirrors the schema dashboard.js expects:
 * { id, date, subject, chapterName, score, total }
 */
function saveQuizToHistory(score, total) {
  try {
    const history = JSON.parse(localStorage.getItem('quizHistory') || '[]');
    history.push({
      id:          String(Date.now()) + '-' + Math.random().toString(36).slice(2),
      date:        new Date().toISOString().split('T')[0],          // "YYYY-MM-DD"
      subject:     String(currentSubject || 'general').toLowerCase(),
      chapterName: String(currentChapterName || currentQuizTitle || 'Quiz'),
      score:       Number(score) || 0,
      total:       Number(total) || 1,
    });
    localStorage.setItem('quizHistory', JSON.stringify(history));
  } catch (e) {
    console.warn('Could not save quiz history:', e);
  }
}

function updateStreak() {
  const today = new Date().toISOString().split('T')[0];
  const lastDate = localStorage.getItem('lastStreakDate');
  if (lastDate === today) return;

  let streak = parseInt(localStorage.getItem('streakCount') || '0');
  let days = JSON.parse(localStorage.getItem('streakDays') ||
    '[false,false,false,false,false,false,false]');
  const dayIndex = new Date().getDay();

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const wasYesterday = lastDate === yesterday.toISOString().split('T')[0];

  streak = wasYesterday ? streak + 1 : 1;
  days[dayIndex] = true;

  localStorage.setItem('streakCount', streak);
  localStorage.setItem('streakDays', JSON.stringify(days));
  localStorage.setItem('lastStreakDate', today);
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

  // Find the first line that starts with "Column I" (covers both inline and separate-line formats)
  const colIIdx = lines.findIndex(function (l) {
    return /^Column\s+I\b/i.test(l);
  });

  if (colIIdx === -1) {
    return '<div class="q-text match-block">' + escHtml(text) + '</div>';
  }

  const intro       = lines.slice(0, colIIdx).join(' ');
  const headerLine  = lines[colIIdx];
  const colIItems   = [];
  const colIIItems  = [];

  // Detect inline format: "Column I        Column II" on ONE line
  if (/^Column\s+I\b.*Column\s+II\b/i.test(headerLine)) {
    // Each data line looks like: "I.   Mehrgarh         P.  Assam"
    // Split at 2+ whitespace chars that precede a P–S letter + dot
    lines.slice(colIIdx + 1).forEach(function (line) {
      const m = line.match(/^(.+?)\s{2,}([P-S]\..+)$/);
      if (m) {
        colIItems.push(m[1].replace(/\s+/g, ' ').trim());
        colIIItems.push(m[2].replace(/\s+/g, ' ').trim());
      }
    });

  } else {
    // Separate-lines format (World Map style): Column I header, then items, then Column II header, then items
    const colIIIdx = lines.findIndex(function (l) { return /^Column\s+II\b/i.test(l); });
    if (colIIIdx === -1) {
      return '<div class="q-text match-block">' + escHtml(text) + '</div>';
    }

    let leftLines  = lines.slice(colIIdx + 1, colIIIdx);
    let rightLines = lines.slice(colIIIdx + 1);

    leftLines.filter(function (l) {
      return /^(?:I{1,3}|IV|V|VI|VII|VIII|IX|X)\.\s+/i.test(l);
    }).forEach(function (l) { colIItems.push(l); });

    rightLines.filter(function (l) {
      return /^[P-S]\.\s+/i.test(l);
    }).forEach(function (l) { colIIItems.push(l); });

    // Fallback: take all lines if the regex filters produced nothing
    if (!colIItems.length)  leftLines.forEach(function (l) { colIItems.push(l); });
    if (!colIIItems.length) rightLines.forEach(function (l) { colIIItems.push(l); });
  }

  const rowCount = Math.max(colIItems.length, colIIItems.length);
  let tableHtml = '<div class="match-table">'
    + '<div class="match-header">Column I</div>'
    + '<div class="match-header">Column II</div>';

  for (let i = 0; i < rowCount; i++) {
    tableHtml += '<div class="match-cell">' + escHtml(colIItems[i]  || '') + '</div>';
    tableHtml += '<div class="match-cell">' + escHtml(colIIItems[i] || '') + '</div>';
  }
  tableHtml += '</div>';

  return '<div class="q-text match-block">'
    + (intro ? '<div class="match-intro">' + escHtml(intro) + '</div>' : '')
    + tableHtml
    + '</div>';
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

function cssEscape(value) {
  if (window.CSS && typeof window.CSS.escape === 'function') return window.CSS.escape(value);
  return String(value || '').replace(/[^a-zA-Z0-9_-]/g, '');
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

function renderActionCenterMetrics() {
  updateActionCenterDate();
  updateSubjectCounts();

  if (els.streakCount) {
    els.streakCount.textContent = String(Math.max(parseInt(localStorage.getItem('streakCount') || '0', 10), 0));
  }

  if (els.weeklyStreakRow) {
    const days = readStreakDays();
    const todayIndex = new Date().getDay();
    const labels = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
    els.weeklyStreakRow.innerHTML = labels.map(function (label, index) {
      const classes = ['week-day'];
      if (days[index]) classes.push('complete');
      if (index === todayIndex) classes.push('today');
      return `<span class="${classes.join(' ')}" aria-label="${getWeekdayName(index)}">${label}</span>`;
    }).join('');
  }
}

function updateActionCenterDate() {
  if (!els.todayDate) return;
  els.todayDate.textContent = new Date().toLocaleDateString('en-GB', {
    weekday: 'long',
    day: '2-digit',
    month: 'long',
    year: 'numeric'
  });
}

function readStreakDays() {
  try {
    const fallback = [false, false, false, false, false, false, false];
    const days = JSON.parse(localStorage.getItem('streakDays') || JSON.stringify(fallback));
    return Array.isArray(days) ? days.slice(0, 7).concat(fallback).slice(0, 7) : fallback;
  } catch (e) {
    return [false, false, false, false, false, false, false];
  }
}

function getWeekdayName(index) {
  return ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'][index] || '';
}

function renderRevisionDuePracticeCard() {
  const card = document.getElementById('revisionDuePractice');
  if (!card) return;

  const dueCount = getRevisionDueCount();

  if (!dueCount) {
    card.innerHTML = `
      <div class="rdp-left">
        <span class="rdp-icon caught-up" aria-hidden="true">&#10003;</span>
        <div class="rdp-text">
          <span class="rdp-label">Revision Due</span>
          <span class="rdp-title">All Caught Up! &#127881;</span>
          <span class="rdp-message">0 questions waiting for review today. Keep up the streak!</span>
        </div>
      </div>
      <a class="rdp-link is-muted" href="../revision/revision.html">Open Revision</a>
    `;
    card.classList.remove('hidden');
    return;
  }

  card.innerHTML = `
    <div class="rdp-left">
      <span class="rdp-icon" aria-hidden="true">R</span>
      <div class="rdp-text">
        <span class="rdp-label">Revision Due</span>
        <span class="rdp-title">${dueCount} question${dueCount === 1 ? '' : 's'} waiting for review today</span>
      </div>
    </div>
    <a class="rdp-link" href="../revision/revision.html">Start Revision →</a>
  `;
  card.classList.remove('hidden');
}

function getRevisionDueCount() {
  const queue = readRevisionQueue();
  const today = new Date().toISOString().split('T')[0];
  return queue.filter(function (q) {
    return q && q.nextReview && q.nextReview <= today;
  }).length;
}

function updateRevisionNavBadge() {
  const link = document.getElementById('revisionNavLink');
  const badge = document.getElementById('revisionNavBadge');
  if (!link || !badge) return;

  const dueCount = getRevisionDueCount();

  if (dueCount > 0) {
    badge.textContent = dueCount;
    link.style.display = '';
  } else {
    link.style.display = 'none';
  }
}

function readRevisionQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem('revisionQueue') || '[]');
    return Array.isArray(queue) ? queue : [];
  } catch (e) {
    return [];
  }
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
