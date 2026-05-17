import {
  getUserStats,
  isFirebaseReady,
  logoutUser,
  requireAuth
} from "../CORE/firebase-module.js";

const els = {
  userName: document.getElementById("userName"),
  userEmail: document.getElementById("userEmail"),
  currentStreak: document.getElementById("currentStreak"),
  loadingState: document.getElementById("loadingState"),
  dashboardContent: document.getElementById("dashboardContent"),
  totalQuizzes: document.getElementById("totalQuizzes"),
  totalQuestions: document.getElementById("totalQuestions"),
  overallAccuracy: document.getElementById("overallAccuracy"),
  revisionCount: document.getElementById("revisionCount"),
  latestAttempts: document.getElementById("latestAttempts"),
  weakChapters: document.getElementById("weakChapters"),
  bookmarks: document.getElementById("bookmarks"),
  revisionQueue: document.getElementById("revisionQueue"),
  logoutBtn: document.getElementById("logoutBtn"),
  toastHost: document.getElementById("toastHost")
};

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  const user = await requireAuth({ redirectTo: "../auth/login.html" });
  if (!user) return;

  renderUser(user);
  els.logoutBtn.addEventListener("click", handleLogout);

  if (!isFirebaseReady()) {
    showToast("Firebase config is pending. Dashboard data will appear after configuration.", "error");
  }

  const stats = await getUserStats(user.uid);
  if (!stats.success && stats.error) showToast(stats.error, "error");

  renderStats(stats);
  els.loadingState.classList.add("hidden");
  els.dashboardContent.classList.remove("hidden");
}

function renderUser(user) {
  els.userName.textContent = user.displayName || "SSC Aspirant";
  els.userEmail.textContent = user.email || "Signed in with Firebase Authentication";
}

function renderStats(stats) {
  els.totalQuizzes.textContent = String(stats.totalQuizzes || 0);
  els.totalQuestions.textContent = String(stats.totalQuestions || 0);
  els.overallAccuracy.textContent = `${stats.accuracy || 0}%`;
  els.revisionCount.textContent = String((stats.revisionQueue || []).length);
  els.currentStreak.textContent = String((stats.streak && stats.streak.current) || 0);

  renderAttempts(stats.latestAttempts || []);
  renderWeakChapters(stats.weakChapters || []);
  renderQuestionList(els.bookmarks, stats.bookmarks || [], "No bookmarks yet. Use Bookmark during a quiz to save doubts here.");
  renderQuestionList(els.revisionQueue, stats.revisionQueue || [], "Your revision queue is empty. Add wrong or doubtful questions after practice.", { clickable: true });
}

function renderAttempts(attempts) {
  if (!attempts.length) {
    els.latestAttempts.innerHTML = emptyState("No quiz attempts saved yet. Start a chapter quiz to build your dashboard.");
    return;
  }

  els.latestAttempts.innerHTML = attempts.map(function (attempt) {
    return `
      <article class="attempt-item">
        <div>
          <strong>${escapeHtml(attempt.quizTitle || "SSC Quiz")}</strong>
          <span>${escapeHtml(attempt.chapter || "General")} &middot; ${formatDate(attempt.timestamp)}</span>
        </div>
        <div class="attempt-score">
          <strong>${Number(attempt.score || 0).toFixed(1)}</strong>
          <span>${attempt.accuracy || 0}% accuracy</span>
        </div>
      </article>
    `;
  }).join("");
}

function renderWeakChapters(chapters) {
  if (!chapters.length) {
    els.weakChapters.innerHTML = emptyState("No weak chapters detected yet. Submit a few quizzes and this will update automatically.");
    return;
  }

  els.weakChapters.innerHTML = chapters.map(function (chapter) {
    return `
      <article class="weak-item">
        <div>
          <strong>${escapeHtml(chapter.chapter)}</strong>
          <span>${chapter.wrong} wrong across ${chapter.attempts} attempt${chapter.attempts === 1 ? "" : "s"}</span>
        </div>
        <div class="weak-meter" aria-label="${chapter.weakness}% weakness">
          <span style="width:${Math.min(chapter.weakness, 100)}%"></span>
        </div>
      </article>
    `;
  }).join("");
}

function renderQuestionList(container, items, emptyText, options) {
  const settings = options || {};
  if (!items.length) {
    container.innerHTML = emptyState(emptyText);
    return;
  }

  container.innerHTML = items.slice(0, 8).map(function (item) {
    return `
      <article class="question-item${settings.clickable ? " clickable" : ""}"${settings.clickable ? ' role="button" tabindex="0" data-revision-card="true"' : ""}>
        <span>${escapeHtml(item.chapter || item.chapterId || "General")}</span>
        <p>${escapeHtml(item.questionText || "Saved question")}</p>
      </article>
    `;
  }).join("");

  if (settings.clickable) {
    container.querySelectorAll("[data-revision-card]").forEach(function (card) {
      card.addEventListener("click", openRevisionQuiz);
      card.addEventListener("keydown", function (event) {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          openRevisionQuiz();
        }
      });
    });
  }
}

function openRevisionQuiz() {
  window.location.href = "../CORE/index.html?mode=revision";
}

async function handleLogout() {
  els.logoutBtn.disabled = true;
  const result = await logoutUser();
  if (result.success) {
    window.location.href = "../auth/login.html";
  } else {
    showToast(result.error || "Logout failed.", "error");
    els.logoutBtn.disabled = false;
  }
}

function showToast(message, type) {
  const toast = document.createElement("div");
  toast.className = `toast ${type || ""}`;
  toast.textContent = message;
  els.toastHost.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 5000);
}

function emptyState(text) {
  return `<div class="empty-state">${escapeHtml(text)}</div>`;
}

function formatDate(value) {
  const date = toDate(value);
  if (!date) return "Just now";
  return new Intl.DateTimeFormat("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }).format(date);
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
