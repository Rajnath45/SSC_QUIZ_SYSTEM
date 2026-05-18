const intervals = [1, 3, 7, 14, 30];

const app = document.getElementById("revisionApp");
let dueQuestions = [];
let currentIndex = 0;
let selectedIndex = null;
let hasAnswered = false;
let sessionStarted = false;

document.addEventListener("DOMContentLoaded", initRevision);

function initRevision() {
  const queue = readQueue();
  dueQuestions = getDueQuestions(queue);
  currentIndex = 0;
  selectedIndex = null;
  hasAnswered = false;
  sessionStarted = dueQuestions.length > 0;

  if (!dueQuestions.length) {
    renderNoDueState(queue, false);
    return;
  }

  renderQuestion();
}

function renderNoDueState(queue, completedSession) {
  if (!queue.length && !completedSession) {
    app.innerHTML = `
      <div class="state-screen">
        <span class="state-icon" aria-hidden="true">📭</span>
        <h1>No questions in revision yet.</h1>
        <p>Get questions wrong in a quiz and tap<br>"Add to Revision" to see them here.</p>
        <a class="dashboard-link" href="../dashboard/dashboard.html">← Back to Dashboard</a>
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
      <a class="dashboard-link" href="../dashboard/dashboard.html">← Back to Dashboard</a>
    </div>
  `;
}

function renderQuestion() {
  const question = dueQuestions[currentIndex];
  if (!question) {
    renderNoDueState(readQueue(), true);
    return;
  }

  const options = getOptions(question);
  const correctIndex = getCorrectIndex(question);
  const progress = Math.round(((currentIndex + (hasAnswered ? 1 : 0)) / dueQuestions.length) * 100);

  app.innerHTML = `
    <div class="revision-top">
      <a class="back-link" href="../dashboard/dashboard.html">← Revision</a>
      <span class="due-pill">${dueQuestions.length} due today</span>
    </div>
    <div class="progress-track" aria-label="${progress}% complete">
      <div class="progress-fill" style="width: ${progress}%"></div>
    </div>
    <div class="chip-row">
      <span class="chip chip-subject">${escapeHtml(question.subject || "General")}</span>
      <span class="chip chip-chapter">${escapeHtml(question.chapterName || question.chapter || "Chapter")}</span>
    </div>
    <div class="question-text">${escapeHtml(question.question)}</div>
    <div class="options">
      ${options.map(function (option, index) {
        const classes = ["option"];
        if (hasAnswered && index === correctIndex) classes.push("correct");
        if (hasAnswered && index === selectedIndex && index !== correctIndex) classes.push("wrong");
        return `
          <button class="${classes.join(" ")}" type="button" data-option-index="${index}"${hasAnswered ? " disabled" : ""}>
            <span class="option-letter">${String.fromCharCode(65 + index)}</span>
            <span>${escapeHtml(option)}</span>
          </button>
        `;
      }).join("")}
    </div>
    ${hasAnswered ? `
      <div class="explanation-card">💡 ${escapeHtml(question.explanation || "No explanation added yet.")}</div>
      <div class="review-actions">
        <button class="again-btn" id="againBtn" type="button">🔴 Again</button>
        <button class="got-btn" id="gotBtn" type="button">✅ Got It</button>
      </div>
    ` : ""}
  `;

  app.querySelectorAll("[data-option-index]").forEach(function (button) {
    button.addEventListener("click", function () {
      selectedIndex = Number(button.dataset.optionIndex);
      hasAnswered = true;
      renderQuestion();
    });
  });

  const againBtn = document.getElementById("againBtn");
  const gotBtn = document.getElementById("gotBtn");
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

function goToNextQuestion() {
  currentIndex += 1;
  selectedIndex = null;
  hasAnswered = false;
  if (currentIndex >= dueQuestions.length) {
    renderNoDueState(readQueue(), sessionStarted);
    return;
  }
  renderQuestion();
}

function getNextReviewDate(reviewCount) {
  const days = intervals[Math.min(reviewCount, 4)];
  const next = new Date();
  next.setDate(next.getDate() + days);
  return next.toISOString().split("T")[0];
}

function markAsGotIt(questionId) {
  let queue = JSON.parse(localStorage.getItem("revisionQueue") || "[]");
  const idx = queue.findIndex(q => q.id === questionId);
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
  const idx = queue.findIndex(q => q.id === questionId);
  if (idx === -1) return;
  queue[idx].reviewCount = Math.max(0, queue[idx].reviewCount - 1);
  queue[idx].nextReview = getNextReviewDate(0);
  localStorage.setItem("revisionQueue", JSON.stringify(queue));
}

function getDueQuestions(queue) {
  const today = new Date().toISOString().split("T")[0];
  return queue.filter(function (question) {
    return question && question.nextReview && question.nextReview <= today;
  });
}

function readQueue() {
  try {
    const queue = JSON.parse(localStorage.getItem("revisionQueue") || "[]");
    return Array.isArray(queue) ? queue : [];
  } catch (error) {
    return [];
  }
}

function getOptions(question) {
  if (Array.isArray(question.options)) return question.options.slice(0, 4);
  if (question.options && typeof question.options === "object") {
    return ["a", "b", "c", "d"].map(function (key) {
      return question.options[key] || question.options[key.toUpperCase()] || "";
    });
  }
  return [question.option1, question.option2, question.option3, question.option4].filter(Boolean);
}

function getCorrectIndex(question) {
  if (Number.isInteger(question.correct)) return question.correct;
  const value = String(question.correct || question.answer || "").toLowerCase();
  const letterMap = { a: 0, b: 1, c: 2, d: 3, "1": 0, "2": 1, "3": 2, "4": 3 };
  return letterMap[value] ?? 0;
}

function getNextQueuedDate(queue) {
  if (!queue.length) return "No upcoming reviews";
  const times = queue
    .map(function (question) { return question && question.nextReview ? new Date(question.nextReview).getTime() : NaN; })
    .filter(Number.isFinite);
  if (!times.length) return "No upcoming reviews";
  return new Date(Math.min(...times)).toLocaleDateString("en-IN", {
    day: "numeric",
    month: "long",
    year: "numeric"
  });
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
