/*
 * revision.js
 * ─────────────────────────────────────────────────────────────
 * LOGIC:  unchanged (intervals, markAsGotIt, markAsAgain, etc.)
 * HTML:   rewritten to use the SAME class names as quiz mode:
 *           .options-container  (was .options)
 *           .option-label       (was .option)
 *           .option-content     (new wrapper inside button)
 *           .option-badge       (was .option-letter)
 *           .inline-explanation (was .explanation-card)
 *           .question-counter   (was .question-label)
 *           .progress-section / .progress-meta / .progress-bar / .progress-fill
 *           .meta-chips / .chip / .chip--subject / .chip--chapter
 * ─────────────────────────────────────────────────────────────
 */

const intervals = [1, 3, 7, 14, 30];

const app = document.getElementById("revisionApp");
let dueQuestions = [];
let currentIndex  = 0;
let selectedIndex = null;
let hasAnswered    = false;
let sessionStarted = false;

document.addEventListener("DOMContentLoaded", initRevision);

/* ─── Init ──────────────────────────────────────────────────── */

function initRevision() {
  const queue  = readQueue();
  dueQuestions = getDueQuestions(queue);
  currentIndex  = 0;
  selectedIndex = null;
  hasAnswered    = false;
  sessionStarted = dueQuestions.length > 0;

  if (!dueQuestions.length) {
    renderNoDueState(queue, false);
    return;
  }

  renderQuestion();
}

/* ─── State screen (empty queue / session complete) ─────────── */

function renderNoDueState(queue, completedSession) {
  if (!queue.length && !completedSession) {
    app.innerHTML = `
      <div class="state-screen">
        <span class="state-icon" aria-hidden="true">📭</span>
        <h1>No questions in revision yet.</h1>
        <p>Get questions wrong in a quiz and tap
          <br>"Add to Revision" to see them here.</p>
        <a class="dashboard-link" href="../dashboard/dashboard.html">← Back to Home</a>
      </div>
    `;
    return;
  }

  app.innerHTML = `
    <div class="state-screen">
      <span class="state-icon" aria-hidden="true">🎉</span>
      <h1>All caught up!</h1>
      <p>You've reviewed all questions due today.</p>
      <p>Next review: ${escapeHtml(getNextQueuedDate(queue))}</p>
      <a class="dashboard-link" href="../dashboard/dashboard.html">← Back to Home</a>
    </div>
  `;
}

/* ─── Question render (quiz-style HTML) ─────────────────────── */

function renderQuestion() {
  const question = dueQuestions[currentIndex];
  if (!question) {
    renderNoDueState(readQueue(), true);
    return;
  }

  const options      = getOptions(question);
  const correctIndex = getCorrectIndex(question);
  const total        = dueQuestions.length;
  const progress     = Math.round(
    ((currentIndex + (hasAnswered ? 1 : 0)) / total) * 100
  );

  /* ── Option buttons — reuse .option-label / .option-badge / .option-content
        from style.css (same as quiz mode, but rendered as <button> elements) */
  const optionsHtml = options.map(function (opt, i) {
    const cls = ["option-label"];
    if (hasAnswered) {
      cls.push("is-disabled");
      if (i === correctIndex)                          cls.push("correct");
      if (i === selectedIndex && i !== correctIndex)   cls.push("wrong");
    }
    return `
      <button
        class="${cls.join(" ")}"
        type="button"
        data-option-index="${i}"
        ${hasAnswered ? "disabled" : ""}
      >
        <span class="option-content">
          <span class="option-badge">${String.fromCharCode(65 + i)}</span>
          <span>${escapeHtml(opt)}</span>
        </span>
      </button>`;
  }).join("");

  /* ── Post-answer section: explanation + Again / Got It ─────── */
  const postAnswerHtml = hasAnswered ? `
    <div class="revision-explanation">
      <div class="inline-explanation">
        <strong>Explanation</strong>
        ${escapeHtml(question.explanation || "No explanation added yet.")}
      </div>
    </div>
    <div class="review-actions">
      <button class="again-btn" id="againBtn" type="button">🔴 Again</button>
      <button class="got-btn"   id="gotBtn"   type="button">✅ Got It</button>
    </div>` : "";

  /* ── Full card HTML — mirrors quiz workspace structure ─────── */
  app.innerHTML = `
    <div class="revision-top">
      <a class="back-link" href="../dashboard/dashboard.html">← Revision</a>
      <span class="due-pill">${total} due today</span>
    </div>

    <div class="progress-section revision-progress">
      <div class="progress-meta">
        <span>Q ${currentIndex + 1} / ${total}</span>
      </div>
      <div class="progress-bar">
        <div class="progress-fill" style="width: ${progress}%"></div>
      </div>
    </div>

    <div class="meta-chips">
      <span class="chip chip--subject">${escapeHtml(question.subject    || "General")}</span>
      <span class="chip chip--chapter">${escapeHtml(question.chapterName || question.chapter || "Chapter")}</span>
    </div>

    <div class="question-header">
      <div class="question-counter">QUESTION ${currentIndex + 1} OF ${total}</div>
    </div>

    <div class="question-text">${escapeHtml(question.question)}</div>

    <div class="options-container">
      ${optionsHtml}
    </div>

    ${postAnswerHtml}
  `;

  /* ── Event listeners ─────────────────────────────────────────── */
  app.querySelectorAll("[data-option-index]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      selectedIndex = Number(btn.dataset.optionIndex);
      hasAnswered   = true;
      renderQuestion();
    });
  });

  const againBtn = document.getElementById("againBtn");
  const gotBtn   = document.getElementById("gotBtn");

  if (againBtn) {
    againBtn.addEventListener("click", function () {
      markAsAgain(question.id);
      goToNextQuestion();
    });
  }
  if (gotBtn) {
    gotBtn.addEventListener("click", function () {
      markAsGotIt(question.id);
      goToNextQuestion();
    });
  }
}

/* ─── Navigation ────────────────────────────────────────────── */

function goToNextQuestion() {
  currentIndex  += 1;
  selectedIndex  = null;
  hasAnswered    = false;
  if (currentIndex >= dueQuestions.length) {
    renderNoDueState(readQueue(), sessionStarted);
    return;
  }
  renderQuestion();
}

/* ─── Spaced-repetition logic (unchanged) ───────────────────── */

function getNextReviewDate(reviewCount) {
  const days = intervals[Math.min(reviewCount, 4)];
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

function markAsGotIt(questionId) {
  let queue = JSON.parse(localStorage.getItem("revisionQueue") || "[]");
  const idx = queue.findIndex(function (q) { return q.id === questionId; });
  if (idx === -1) return;
  queue[idx].reviewCount += 1;
  if (queue[idx].reviewCount >= 3) {
    queue.splice(idx, 1);
  } else {
    queue[idx].nextReview = getNextReviewDate(queue[idx].reviewCount);
  }
  localStorage.setItem("revisionQueue", JSON.stringify(queue));
}

function markAsAgain(questionId) {
  let queue = JSON.parse(localStorage.getItem("revisionQueue") || "[]");
  const idx = queue.findIndex(function (q) { return q.id === questionId; });
  if (idx === -1) return;
  queue[idx].reviewCount = Math.max(0, queue[idx].reviewCount - 1);
  queue[idx].nextReview  = getNextReviewDate(0);
  localStorage.setItem("revisionQueue", JSON.stringify(queue));
}

/* ─── Queue helpers (unchanged) ─────────────────────────────── */

function getDueQuestions(queue) {
  const today = new Date().toISOString().split("T")[0];
  return queue.filter(function (q) {
    return q && q.nextReview && q.nextReview <= today;
  });
}

function readQueue() {
  try {
    const raw = JSON.parse(localStorage.getItem("revisionQueue") || "[]");
    return Array.isArray(raw) ? raw : [];
  } catch (_) {
    return [];
  }
}

function getOptions(question) {
  if (Array.isArray(question.options)) return question.options.slice(0, 4);
  if (question.options && typeof question.options === "object") {
    return ["a", "b", "c", "d"].map(function (k) {
      return question.options[k] || question.options[k.toUpperCase()] || "";
    });
  }
  return [question.option1, question.option2, question.option3, question.option4]
    .filter(Boolean);
}

function getCorrectIndex(question) {
  if (Number.isInteger(question.correct)) return question.correct;
  const val = String(question.correct || question.answer || "").toLowerCase();
  const map  = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
  return map[val] ?? 0;
}

function getNextQueuedDate(queue) {
  if (!queue.length) return "No upcoming reviews";
  const times = queue
    .map(function (q) {
      return q && q.nextReview ? new Date(q.nextReview).getTime() : NaN;
    })
    .filter(Number.isFinite);
  if (!times.length) return "No upcoming reviews";
  return new Date(Math.min(...times)).toLocaleDateString("en-IN", {
    day: "numeric", month: "long", year: "numeric"
  });
}

/* ─── Utility ───────────────────────────────────────────────── */

function escapeHtml(val) {
  return String(val || "")
    .replace(/&/g,  "&amp;")
    .replace(/</g,  "&lt;")
    .replace(/>/g,  "&gt;")
    .replace(/"/g,  "&quot;");
}
