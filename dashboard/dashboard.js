import { logoutUser, requireAuth } from "../CORE/firebase-module.js";

const els = {
  firstName: document.getElementById("firstName"),
  profileName: document.getElementById("profileName"),
  todayDate: document.getElementById("todayDate"),
  streakCount: document.getElementById("streakCount"),
  weekRow: document.getElementById("weekRow"),
  totalQuizzes: document.getElementById("totalQuizzes"),
  totalQuestions: document.getElementById("totalQuestions"),
  accuracy: document.getElementById("accuracy"),
  continueCard: document.getElementById("continueCard"),
  revisionDueCard: document.getElementById("revisionDueCard"),
  profileTab: document.getElementById("profileTab"),
  profileDropdown: document.getElementById("profileDropdown"),
  logoutBtn: document.getElementById("logoutBtn"),
  toastHost: document.getElementById("toastHost")
};

document.addEventListener("DOMContentLoaded", initDashboard);

async function initDashboard() {
  const user = await requireAuth({ redirectTo: "../auth/login.html" });
  if (!user) return;

  const firstName = user.displayName?.split(" ")[0] || "Aspirant";
  els.firstName.textContent = firstName;
  els.profileName.textContent = firstName;
  els.todayDate.textContent = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  bindProfileMenu();
  renderDashboard();
}

function bindProfileMenu() {
  els.profileTab.addEventListener("click", function (event) {
    event.stopPropagation();
    els.profileDropdown.classList.toggle("hidden");
  });

  els.profileDropdown.addEventListener("click", function (event) {
    event.stopPropagation();
  });

  document.addEventListener("click", function () {
    els.profileDropdown.classList.add("hidden");
  });

  els.logoutBtn.addEventListener("click", handleLogout);
}

function renderDashboard() {
  const streakCount = readNumber("streakCount");
  const streakDays = readArray("streakDays", [false, false, false, false, false, false, false]);

  els.streakCount.textContent = String(streakCount);
  renderWeek(streakDays);

  els.totalQuizzes.textContent = String(readNumber("totalQuizzes"));
  els.totalQuestions.textContent = String(readNumber("totalQuestions"));
  els.accuracy.textContent = `${readNumber("accuracy")}%`;

  renderContinueCard(readJson("lastAttempted"));
  renderRevisionDue();
}

function renderWeek(days) {
  const uiDays = [
    { label: "M", index: 1 },
    { label: "T", index: 2 },
    { label: "W", index: 3 },
    { label: "T", index: 4 },
    { label: "F", index: 5 },
    { label: "S", index: 6 },
    { label: "S", index: 0 }
  ];

  els.weekRow.innerHTML = uiDays.map(function (day) {
    const done = Boolean(days[day.index]);
    return `
      <div class="week-day${done ? " is-done" : ""}">
        <span>${day.label}</span>
        <i aria-hidden="true"></i>
      </div>
    `;
  }).join("");
}

function renderContinueCard(attempt) {
  if (!attempt || !attempt.url) {
    els.continueCard.classList.add("hidden");
    els.continueCard.innerHTML = "";
    return;
  }

  const subject = String(attempt.subject || "General");
  const subjectKey = subject.toLowerCase();
  const progress = clamp(readPercent(attempt.progress), 0, 100);

  els.continueCard.innerHTML = `
    <p class="card-kicker">Continue where you left off</p>
    <div class="continue-top">
      <span class="subject-chip chip-${escapeAttr(subjectKey)}">${escapeHtml(labelFromSubject(subject))}</span>
      <strong class="continue-title">${escapeHtml(attempt.chapterName || "SSC Quiz")}</strong>
    </div>
    <div class="progress-track" aria-label="${progress}% complete">
      <div class="progress-fill" style="width: ${progress}%"></div>
    </div>
    <span class="progress-value">${progress}%</span>
    <a class="primary-link" href="${escapeAttr(attempt.url)}">Continue →</a>
  `;
  els.continueCard.classList.remove("hidden");
}

function renderRevisionDue() {
  const queue = readArray("revisionQueue", []);
  const today = new Date().toISOString().split("T")[0];
  const dueCount = queue.filter(function (question) {
    return question && question.nextReview && question.nextReview <= today;
  }).length;

  if (!dueCount) {
    els.revisionDueCard.classList.add("hidden");
    els.revisionDueCard.innerHTML = "";
    return;
  }

  els.revisionDueCard.innerHTML = `
    <div class="revision-heading">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M12 7v14"/>
        <path d="M3 18a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1h5a4 4 0 0 1 4 4 4 4 0 0 1 4-4h5a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1h-6a3 3 0 0 0-3 3 3 3 0 0 0-3-3z"/>
      </svg>
      <span>Revision Due</span>
    </div>
    <p>${dueCount} question${dueCount === 1 ? "" : "s"} waiting for review today</p>
    <a class="primary-link" href="../revision/revision.html">Start Revision →</a>
  `;
  els.revisionDueCard.classList.remove("hidden");
}

async function handleLogout() {
  els.logoutBtn.disabled = true;
  const result = await logoutUser();
  if (result.success) {
    window.location.href = "../auth/login.html";
    return;
  }

  els.logoutBtn.disabled = false;
  showToast(result.error || "Logout failed.");
}

function readNumber(key) {
  const value = Number(localStorage.getItem(key));
  return Number.isFinite(value) ? value : 0;
}

function readPercent(value) {
  const numeric = Number(value);
  return Number.isFinite(numeric) ? Math.round(numeric) : 0;
}

function readJson(key) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : null;
  } catch (error) {
    return null;
  }
}

function readArray(key, fallback) {
  const value = readJson(key);
  return Array.isArray(value) ? value : fallback;
}

function labelFromSubject(subject) {
  return String(subject || "General")
    .replace(/[-_]+/g, " ")
    .replace(/\b\w/g, function (char) { return char.toUpperCase(); });
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function showToast(message) {
  const toast = document.createElement("div");
  toast.className = "toast";
  toast.textContent = message;
  els.toastHost.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 5000);
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeAttr(value) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
