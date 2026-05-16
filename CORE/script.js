const QUIZ_FOLDER = 'QUIZZES/';
const QUIZ_MANIFEST = `${QUIZ_FOLDER}quizzes.json`;
const DEFAULT_QUIZ_FILE = 'Solar_System.json';
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
let timerSeconds = 0;
let timerInterval = null;
let isPaletteOpen = false;
let quizSubmitted = false;

const els = {};

document.addEventListener('DOMContentLoaded', async function () {
  cacheElements();
  initTheme();
  initEventListeners();
  preventDoubleTapZoom();
  await initQuizCatalog();
  currentQuizFile = getInitialQuizFile();
  const initialQuiz = getQuizByFile(currentQuizFile);
  currentQuizTitle = initialQuiz ? initialQuiz.title : 'SSC Quiz';
  updatePageTitle();
  updateDashboardStats();
  updateTimerDisplay();
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
  els.themeToggle.addEventListener('click', toggleTheme);
  els.fullscreenBtn.addEventListener('click', toggleFullscreen);
  els.paletteFab.addEventListener('click', function () { togglePalette(); });
  els.paletteClose.addEventListener('click', function () { togglePalette(false); });
  els.paletteOverlay.addEventListener('click', function () { togglePalette(false); });

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
  const quiz = getQuizByIdOrFile(chapterId);
  const file = quiz ? quiz.file : chapterId;
  if (!file) return;

  document.body.classList.add('quiz-active');
  if (els.navLinks) els.navLinks.classList.remove('open');
  if (els.headerControls) els.headerControls.classList.remove('open');
  if (els.hamburger) els.hamburger.setAttribute('aria-expanded', 'false');
  const loaded = await loadSelectedQuiz(file, { updateUrl: true, resume: true });
  if (loaded) {
    startTimer();
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

    currentQuizFile = file;
    currentQuizTitle = getQuizTitle(file, data);
    questions = normalizedQuestions;
    const catalogItem = getQuizByFile(currentQuizFile);
    if (catalogItem) catalogItem.questionCount = questions.length;
    localStorage.setItem('selectedQuizFile', currentQuizFile);

    resetAttemptState();
    updatePageTitle();
    updateActiveChapterState();
    resetQuizView();
    updateMarkingInfo();
    createPalette();
    renderChapterCards();
    updateDashboardStats();

    const resumed = settings.resume ? loadFromLocalStorage() : false;
    if (!resumed) {
      loadQuestion(0);
    }

    hideQuizStatus();

    if (settings.updateUrl) {
      const url = new URL(window.location.href);
      url.searchParams.set('quiz', currentQuizFile);
      window.history.replaceState({}, '', url);
    }
    return true;
  } catch (error) {
    questions = [];
    showQuizError(`Could not load quiz: ${error.message}`);
    return false;
  } finally {
    setQuizControlsDisabled(false);
  }
}

async function fetchQuizData(file) {
  const response = await fetch(`${QUIZ_FOLDER}${encodeURIComponent(file)}`, { cache: 'no-store' });
  if (!response.ok) throw new Error(`${file} returned ${response.status}`);
  return response.json();
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
  if (bookmarks.has(srNo)) {
    bookmarks.delete(srNo);
  } else {
    bookmarks.add(srNo);
  }
  els.bookmarkBtn.classList.toggle('active', bookmarks.has(srNo));
  updatePalette();
  saveToLocalStorage();
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
  if (e.key.toLowerCase() === 'c') clearAnswer();
  if (e.key.toLowerCase() === 'p') togglePalette();
  if (['1', '2', '3', '4'].includes(e.key)) selectOption(e.key);
}

function startTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = setInterval(function () {
    timerSeconds++;
    updateTimerDisplay();
  }, 1000);
}

function stopTimer() {
  if (timerInterval) clearInterval(timerInterval);
  timerInterval = null;
}

function updateTimerDisplay() {
  const minutes = Math.floor(timerSeconds / 60);
  const seconds = timerSeconds % 60;
  els.timer.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  els.timer.classList.toggle('warning', timerSeconds > 600);
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

  els.questionSection.classList.add('hidden');
  els.progressSection.classList.add('hidden');
  els.markingInfo.classList.add('hidden');
  els.paletteFab.classList.add('hidden');
  els.bottomNav.classList.add('hidden');

  els.resultSection.innerHTML = buildResultsHtml();
  els.resultSection.classList.remove('hidden');
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

function buildResultsHtml() {
  let correct = 0;
  let wrong = 0;
  let score = 0;
  let totalMarks = 0;

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
    }
  });

  const unattempted = questions.length - correct - wrong;
  const percentage = totalMarks ? (score / totalMarks) * 100 : 0;
  const reviewHtml = questions.map(buildReviewItem).join('');

  return `
    <div class="score-card">
      <p>Final result</p>
      <h2>${score}/${totalMarks}</h2>
      <p>${percentage.toFixed(2)}% Score</p>
      <p>Time Taken: ${formatTime(timerSeconds)}</p>
    </div>
    <div class="stats-grid">
      <div class="stat-card correct-stat"><strong>${correct}</strong><span>Correct</span></div>
      <div class="stat-card wrong-stat"><strong>${wrong}</strong><span>Wrong</span></div>
      <div class="stat-card unattempted-stat"><strong>${unattempted}</strong><span>Unattempted</span></div>
      <div class="stat-card"><strong>${questions.length}</strong><span>Total</span></div>
    </div>
    <h2 class="review-title">Question Review</h2>
    <div class="review-list">${reviewHtml}</div>
    <div class="action-buttons">
      <button class="action-btn restart-btn" type="button" onclick="restartQuiz()">Restart Quiz</button>
      <button class="action-btn download-btn" type="button" onclick="downloadResults()">Download Results</button>
      <button class="action-btn print-btn" type="button" onclick="window.print()">Print Results</button>
      <button class="action-btn home-btn" type="button" onclick="exitQuiz()">Go Home</button>
    </div>
  `;
}

function buildReviewItem(q) {
  const userAnswer = answers[q.sr_no];
  let optionsHtml = '';

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

  return `
    <div class="review-item">
      <h3 class="review-question-title">Q${q.sr_no}: ${escHtml(cleanHindi(q.question))}</h3>
      ${optionsHtml}
    </div>
  `;
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

function downloadResults() {
  const clone = els.resultSection.cloneNode(true);
  const actionButtons = clone.querySelector('.action-buttons');
  if (actionButtons) actionButtons.remove();

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<title>${escHtml(currentQuizTitle)} Results</title>
<style>
body{font-family:Arial,sans-serif;line-height:1.5;padding:24px;color:#212529}
.score-card{background:#007bff;color:#fff;padding:24px;border-radius:12px;text-align:center;margin-bottom:18px}
.stats-grid{display:grid;grid-template-columns:repeat(4,1fr);gap:10px;margin-bottom:20px}
.stat-card,.review-item{border:1px solid #dee2e6;border-radius:10px;padding:14px;margin-bottom:12px}
.review-question-title{white-space:pre-wrap;line-height:1.55}
.review-option{padding:8px;border:1px solid #dee2e6;border-radius:8px;margin:6px 0}
.correct{background:#d4edda;border-color:#28a745}.wrong{background:#f8d7da;border-color:#dc3545}.user-selected{font-weight:bold}
</style>
</head>
<body>
<h1>${escHtml(currentQuizTitle)} Results</h1>
${clone.innerHTML}
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${slugify(currentQuizTitle)}-results.html`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
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

  return `<div class="q-text">${escHtml(text)}</div>`;
}

function formatMatchQuestion(text) {
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);

  var colIIdx = lines.findIndex(function (l) {
    return /^Column\s+I\b/i.test(l) && !/^Column\s+II\b/i.test(l);
  });
  var colIIIdx = lines.findIndex(function (l) { return /^Column\s+II\b/i.test(l); });

  if (colIIdx === -1 || colIIIdx === -1) {
    return '<div class="q-text match-block">' + escHtml(text) + '</div>';
  }

  var intro = lines.slice(0, colIIdx).join(' ');
  var colIItems = lines.slice(colIIdx + 1, colIIIdx);
  var colIIItems = lines.slice(colIIIdx + 1);

  var colIHtml = colIItems.map(function (item) {
    return '<div class="match-row">' + escHtml(item) + '</div>';
  }).join('');

  var colIIHtml = colIIItems.map(function (item) {
    return '<div class="match-row">' + escHtml(item) + '</div>';
  }).join('');

  return '<div class="q-text match-block">' +
    (intro ? '<div class="match-intro">' + escHtml(intro) + '</div>' : '') +
    '<div class="match-columns">' +
      '<div class="match-col">' +
        '<div class="match-col-header">Column I</div>' +
        colIHtml +
      '</div>' +
      '<div class="match-col">' +
        '<div class="match-col-header">Column II</div>' +
        colIIHtml +
      '</div>' +
    '</div>' +
  '</div>';
}

function formatStatementQuestion(text) {
  var lines = text.split('\n').map(function (l) { return l.trim(); }).filter(Boolean);
  var html = '<div class="q-text statement-block">';
  lines.forEach(function (line) {
    if (/^(Statement\s+(?:I{1,3}|IV|V|\d+)|Assertion\s*\(A\)|Reason\s*\(R\))\s*:/i.test(line)) {
      html += '<div class="statement-line">' + escHtml(line) + '</div>';
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
