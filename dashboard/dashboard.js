/**
 * dashboard.js — Records & Quiz Analytics
 * SSC Prep Hub
 *
 * Expected localStorage schema (written by quiz module):
 *
 * quizHistory: JSON array of entries shaped as:
 * {
 *   id:          string,   // unique  (Date.now() + Math.random)
 *   date:        string,   // ISO date "YYYY-MM-DD"
 *   subject:     string,   // e.g. "geography"
 *   chapterName: string,   // e.g. "Solar System"
 *   score:       number,   // correct answers
 *   total:       number    // total questions attempted
 * }
 */

import { logoutUser, requireAuth } from "../CORE/firebase-module.js";

// ─── Constants ──────────────────────────────────────────────────────────────
const WEAK_THRESHOLD   = 70;   // chapters below this % are flagged as weak
const HISTORY_PER_PAGE = 10;   // rows shown per page in the history log

// ─── Element map ────────────────────────────────────────────────────────────
const els = {
  // Topbar (desktop)
  topbarUsername:   document.getElementById("topbarUsername"),
  topbarLogoutBtn:  document.getElementById("topbarLogoutBtn"),
  dashHamburger:    document.getElementById("dashHamburger"),
  dashNavLinks:     document.getElementById("dashNavLinks"),
  dashHeaderControls: document.getElementById("dashHeaderControls"),

  // Mobile bottom-nav profile
  profileTab:       document.getElementById("profileTab"),
  profileDropdown:  document.getElementById("profileDropdown"),
  profileName:      document.getElementById("profileName"),
  mobileLogoutBtn:  document.getElementById("mobileLogoutBtn"),

  // Page chrome
  todayDate:        document.getElementById("todayDate"),
  clearHistoryBtn:  document.getElementById("clearHistoryBtn"),
  toastHost:        document.getElementById("toastHost"),

  // Analytics sections
  statTotalQuizzes:        document.getElementById("statTotalQuizzes"),
  statLifetimeAcc:         document.getElementById("statLifetimeAcc"),
  subjectBreakdownSection: document.getElementById("subjectBreakdownSection"),
  subjectBreakdown:        document.getElementById("subjectBreakdown"),
  weakChapterContainer:    document.getElementById("weakChapterContainer"),
  historyContainer:        document.getElementById("historyContainer"),
};

// ─── State ───────────────────────────────────────────────────────────────────
let currentPage = 1;

// ─── Bootstrap ───────────────────────────────────────────────────────────────
document.addEventListener("DOMContentLoaded", initAnalytics);

async function initAnalytics() {
  const user = await requireAuth({ redirectTo: "../auth/login.html" });
  if (!user) return;

  const firstName = user.displayName?.split(" ")[0] || "Aspirant";

  // Populate both topbar and mobile profile with user's name
  if (els.topbarUsername) els.topbarUsername.textContent = firstName;
  if (els.profileName)    els.profileName.textContent    = firstName;

  // Date line under page title
  if (els.todayDate) {
    els.todayDate.textContent = new Date().toLocaleDateString("en-IN", {
      weekday: "long",
      day:     "numeric",
      month:   "long",
      year:    "numeric",
    });
  }

  bindUI();
  renderAll();
}

// ─── UI bindings ─────────────────────────────────────────────────────────────
function bindUI() {
  // ── Topbar logout (desktop) ──────────────────────────────
  if (els.topbarLogoutBtn) {
    els.topbarLogoutBtn.addEventListener("click", handleLogout);
  }

  // ── Hamburger (mobile) ───────────────────────────────────
  if (els.dashHamburger) {
    els.dashHamburger.addEventListener("click", function (e) {
      e.stopPropagation();
      const isOpen = els.dashNavLinks.classList.toggle("open");
      els.dashHeaderControls.classList.toggle("open", isOpen);
      els.dashHamburger.setAttribute("aria-expanded", String(isOpen));
    });
  }

  // Close mobile menu when clicking outside
  document.addEventListener("click", function () {
    if (els.dashNavLinks) {
      els.dashNavLinks.classList.remove("open");
      els.dashHeaderControls.classList.remove("open");
      els.dashHamburger?.setAttribute("aria-expanded", "false");
    }
  });

  // ── Mobile bottom-nav profile tab ───────────────────────
  if (els.profileTab) {
    els.profileTab.addEventListener("click", function (e) {
      e.stopPropagation();
      els.profileDropdown?.classList.toggle("hidden");
    });
  }

  if (els.profileDropdown) {
    els.profileDropdown.addEventListener("click", function (e) {
      e.stopPropagation();
    });
  }

  if (els.mobileLogoutBtn) {
    els.mobileLogoutBtn.addEventListener("click", handleLogout);
  }

  // ── Clear history ────────────────────────────────────────
  if (els.clearHistoryBtn) {
    els.clearHistoryBtn.addEventListener("click", function () {
      if (!confirm("Clear all quiz history? This cannot be undone.")) return;
      localStorage.removeItem("quizHistory");
      ["totalQuizzes", "totalQuestions", "accuracy"].forEach(function (k) {
        localStorage.removeItem(k);
      });
      currentPage = 1;
      renderAll();
      showToast("History cleared.", "success");
    });
  }
}

// ─── Main render ─────────────────────────────────────────────────────────────
function renderAll() {
  const history = readHistory();
  renderPerformanceOverview(history);
  renderSubjectBreakdown(history);
  renderWeakChapters(history);
  renderHistoryLog(history);
}

// ─── Data helpers ─────────────────────────────────────────────────────────────

/**
 * Reads, validates and sorts the quiz history array from localStorage.
 * Returns [] on any failure.
 */
function readHistory() {
  try {
    const raw = localStorage.getItem("quizHistory");
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];

    return parsed
      .filter(function (e) { return e && typeof e === "object"; })
      .map(function (e) {
        const score = Number(e.score);
        const total = Number(e.total);
        return {
          id:          String(e.id || Math.random()),
          date:        String(e.date || ""),
          subject:     String(e.subject || "general").toLowerCase(),
          chapterName: String(e.chapterName || "Unknown Chapter"),
          score:       Number.isFinite(score) ? score : 0,
          total:       Number.isFinite(total) && total > 0 ? total : 1,
        };
      })
      .sort(function (a, b) { return b.date.localeCompare(a.date); }); // newest first
  } catch (_) {
    return [];
  }
}

/** Accuracy % for one entry, 0–100 rounded integer. */
function entryAccuracy(entry) {
  if (!entry.total) return 0;
  return Math.round((entry.score / entry.total) * 100);
}

/**
 * Groups by chapterName+subject, returns array sorted by avgAccuracy ascending
 * (weakest chapter first — correct order for the Radar section).
 */
function groupByChapter(history) {
  const map = Object.create(null);
  history.forEach(function (e) {
    const key = e.subject + "::" + e.chapterName;
    if (!map[key]) {
      map[key] = { chapterName: e.chapterName, subject: e.subject, totalScore: 0, totalQuestions: 0 };
    }
    map[key].totalScore     += e.score;
    map[key].totalQuestions += e.total;
  });

  return Object.values(map)
    .map(function (ch) {
      ch.avgAccuracy = ch.totalQuestions > 0
        ? Math.round((ch.totalScore / ch.totalQuestions) * 100)
        : 0;
      return ch;
    })
    .sort(function (a, b) { return a.avgAccuracy - b.avgAccuracy; });
}

/**
 * Groups by subject, returns array sorted alphabetically.
 */
function groupBySubject(history) {
  const map = Object.create(null);
  history.forEach(function (e) {
    const s = e.subject;
    if (!map[s]) { map[s] = { subject: s, totalScore: 0, totalQuestions: 0, quizCount: 0 }; }
    map[s].totalScore     += e.score;
    map[s].totalQuestions += e.total;
    map[s].quizCount      += 1;
  });

  return Object.values(map)
    .map(function (s) {
      s.avgAccuracy = s.totalQuestions > 0
        ? Math.round((s.totalScore / s.totalQuestions) * 100)
        : 0;
      return s;
    })
    .sort(function (a, b) { return a.subject.localeCompare(b.subject); });
}

// ─── Section renderers ────────────────────────────────────────────────────────

function renderPerformanceOverview(history) {
  const totalQuizzes = history.length;
  let sumScore = 0, sumTotal = 0;
  history.forEach(function (e) { sumScore += e.score; sumTotal += e.total; });
  const lifetimeAcc = sumTotal > 0 ? Math.round((sumScore / sumTotal) * 100) : null;

  animateValue(els.statTotalQuizzes, 0, totalQuizzes, 600, function (v) {
    return totalQuizzes === 0 ? "—" : String(v);
  });

  animateValue(els.statLifetimeAcc, 0, lifetimeAcc ?? 0, 700, function (v) {
    return lifetimeAcc === null ? "—" : v + "%";
  });
}

function renderSubjectBreakdown(history) {
  if (history.length === 0) {
    els.subjectBreakdownSection.classList.add("hidden");
    return;
  }
  els.subjectBreakdownSection.classList.remove("hidden");

  const subjects = groupBySubject(history);

  els.subjectBreakdown.innerHTML = subjects.map(function (s) {
    const cls = accuracyClass(s.avgAccuracy);
    return `
      <div class="breakdown-row">
        <span class="breakdown-subject">${escapeHtml(capitalize(s.subject))}</span>
        <div class="breakdown-bar-wrap"
             aria-label="${s.avgAccuracy}% accuracy in ${capitalize(s.subject)}">
          <div class="breakdown-bar bar-${cls}"
               style="width:0%"
               data-target="${s.avgAccuracy}"></div>
        </div>
        <span class="breakdown-pct pct-${cls}">${s.avgAccuracy}%</span>
      </div>
    `;
  }).join("");

  // Animate bar widths after the next paint so CSS transition fires
  requestAnimationFrame(function () {
    requestAnimationFrame(function () {
      els.subjectBreakdown.querySelectorAll(".breakdown-bar").forEach(function (bar) {
        bar.style.width = bar.dataset.target + "%";
      });
    });
  });
}

function renderWeakChapters(history) {
  const container = els.weakChapterContainer;

  if (history.length === 0) {
    container.innerHTML = buildEmptyState();
    return;
  }

  const weakChapters = groupByChapter(history).filter(function (c) {
    return c.avgAccuracy < WEAK_THRESHOLD;
  });

  if (weakChapters.length === 0) {
    container.innerHTML = `
      <div class="all-clear" role="status">
        <div class="all-clear-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"
               aria-hidden="true">
            <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/>
            <polyline points="22 4 12 14.01 9 11.01"/>
          </svg>
        </div>
        <div class="all-clear-text">
          <strong>You're going strong!</strong>
          <p>No weak areas detected — every chapter is above ${WEAK_THRESHOLD}%. Keep the momentum!</p>
        </div>
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div class="weak-card" role="list" aria-label="Weak chapters">
      ${weakChapters.map(function (ch) {
        const pct = ch.avgAccuracy;
        return `
          <div class="weak-item" role="listitem">
            <div class="weak-item-left">
              <div class="weak-warn-dot" aria-hidden="true"></div>
              <div class="weak-item-text">
                <div class="weak-chapter-name">${escapeHtml(ch.chapterName)}</div>
                <div class="weak-subject-tag">${escapeHtml(capitalize(ch.subject))}</div>
              </div>
            </div>
            <div style="display:flex;align-items:center;gap:10px;flex-shrink:0;">
              <div class="weak-bar-mini" aria-hidden="true">
                <div class="weak-bar-fill" style="width:${pct}%"></div>
              </div>
              <span class="weak-badge" aria-label="${pct}% accuracy">${pct}%</span>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;
}

function renderHistoryLog(history) {
  const container = els.historyContainer;

  if (history.length === 0) {
    container.innerHTML = "";
    return;
  }

  const totalPages = Math.ceil(history.length / HISTORY_PER_PAGE);
  currentPage      = Math.min(Math.max(currentPage, 1), totalPages);
  const pageItems  = history.slice(
    (currentPage - 1) * HISTORY_PER_PAGE,
    currentPage * HISTORY_PER_PAGE
  );

  container.innerHTML = `
    <div class="history-card">
      <div class="history-header-row" aria-hidden="true">
        <span>Date</span>
        <span>Chapter</span>
        <span>Score</span>
      </div>
      <div role="list" aria-label="Quiz history entries">
        ${pageItems.map(function (entry) {
          const acc = entryAccuracy(entry);
          const cls = accuracyClass(acc);
          return `
            <div class="history-row" role="listitem">
              <div class="history-date">${escapeHtml(formatDate(entry.date))}</div>
              <div class="history-chapter">
                <div class="history-chapter-name">${escapeHtml(entry.chapterName)}</div>
                <div class="history-subject-tag">${escapeHtml(capitalize(entry.subject))}</div>
              </div>
              <div class="history-accuracy">
                <span class="accuracy-pill acc-${cls}"
                      aria-label="${acc}% accuracy">${acc}%</span>
              </div>
            </div>
          `;
        }).join("")}
      </div>
      ${totalPages > 1 ? buildPagination(currentPage, totalPages) : ""}
    </div>
  `;

  // Wire pagination buttons
  if (totalPages > 1) {
    container.querySelector("#histPrevBtn")?.addEventListener("click", function () {
      currentPage--;
      renderHistoryLog(history);
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    });

    container.querySelector("#histNextBtn")?.addEventListener("click", function () {
      currentPage++;
      renderHistoryLog(history);
      container.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
}

// ─── HTML builders ────────────────────────────────────────────────────────────

function buildEmptyState() {
  return `
    <div class="empty-analytics">
      <span class="empty-analytics-icon" aria-hidden="true">📊</span>
      <h3>No quiz history yet</h3>
      <p>Take your first quiz to start tracking progress, accuracy, and weak chapters.</p>
      <a href="../CORE/index.html" class="start-quiz-link">Start Practising →</a>
    </div>
  `;
}

function buildPagination(page, total) {
  return `
    <div class="history-pagination">
      <span>Page ${page} of ${total}</span>
      <div class="pagination-btns">
        <button id="histPrevBtn" class="page-btn" type="button"
                ${page <= 1 ? "disabled" : ""} aria-label="Previous page">
          ← Prev
        </button>
        <button id="histNextBtn" class="page-btn" type="button"
                ${page >= total ? "disabled" : ""} aria-label="Next page">
          Next →
        </button>
      </div>
    </div>
  `;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────

async function handleLogout() {
  // Disable both logout buttons while the request is in flight
  if (els.topbarLogoutBtn)  els.topbarLogoutBtn.disabled  = true;
  if (els.mobileLogoutBtn)  els.mobileLogoutBtn.disabled  = true;

  const result = await logoutUser();

  if (result.success) {
    window.location.href = "../auth/login.html";
    return;
  }

  if (els.topbarLogoutBtn)  els.topbarLogoutBtn.disabled  = false;
  if (els.mobileLogoutBtn)  els.mobileLogoutBtn.disabled  = false;
  showToast(result.error || "Logout failed.", "error");
}

// ─── Utilities ────────────────────────────────────────────────────────────────

/**
 * Maps an accuracy value to a CSS modifier string:
 *   strong (≥ 80) | ok (≥ 70) | warn (≥ 50) | danger (< 50)
 */
function accuracyClass(pct) {
  if (pct >= 80) return "strong";
  if (pct >= 70) return "ok";
  if (pct >= 50) return "warn";
  return "danger";
}

/**
 * Converts an ISO "YYYY-MM-DD" string to a compact locale label.
 * Parses as local date so no UTC-shift surprises.
 */
function formatDate(iso) {
  if (!iso) return "—";
  try {
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, m - 1, d).toLocaleDateString("en-IN", {
      day: "numeric", month: "short", year: "2-digit",
    });
  } catch (_) {
    return iso;
  }
}

/** Capitalises the first character of a string. */
function capitalize(str) {
  const s = String(str || "");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

/**
 * Smooth ease-out cubic counter from `from` → `to` over `duration` ms.
 * @param {HTMLElement}          el
 * @param {number}               from
 * @param {number}               to
 * @param {number}               duration  milliseconds
 * @param {function(number):string} formatter
 */
function animateValue(el, from, to, duration, formatter) {
  if (!el) return;
  const start = performance.now();
  (function tick(now) {
    const t       = Math.min((now - start) / duration, 1);
    const eased   = 1 - Math.pow(1 - t, 3);          // ease-out cubic
    const current = Math.round(from + (to - from) * eased);
    el.textContent = formatter(current);
    if (t < 1) requestAnimationFrame(tick);
  }(performance.now()));
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function showToast(message, type) {
  const toast     = document.createElement("div");
  toast.className = "toast" + (type ? " " + type : "");
  toast.textContent = message;
  els.toastHost.appendChild(toast);
  setTimeout(function () { toast.remove(); }, 4500);
}

// ─── Public helper — call from your quiz completion handler ──────────────────
/**
 * Appends one quiz result to localStorage:quizHistory and refreshes
 * the legacy scalar keys so the main action-centre page stays in sync.
 *
 * @param {{ subject: string, chapterName: string, score: number, total: number }} result
 */
export function saveQuizResult(result) {
  const history = JSON.parse(localStorage.getItem("quizHistory") || "[]");

  history.push({
    id:          String(Date.now()) + "-" + Math.random().toString(36).slice(2),
    date:        new Date().toISOString().split("T")[0],
    subject:     String(result.subject     || "general").toLowerCase(),
    chapterName: String(result.chapterName || "Quiz"),
    score:       Number(result.score)  || 0,
    total:       Number(result.total)  || 1,
  });

  localStorage.setItem("quizHistory", JSON.stringify(history));

  // Keep legacy scalar keys in sync for the action-centre page
  const sumS = history.reduce(function (a, e) { return a + e.score; }, 0);
  const sumT = history.reduce(function (a, e) { return a + e.total; }, 0);
  localStorage.setItem("totalQuizzes",   String(history.length));
  localStorage.setItem("totalQuestions", String(sumT));
  localStorage.setItem("accuracy",       String(sumT > 0 ? Math.round((sumS / sumT) * 100) : 0));
}
