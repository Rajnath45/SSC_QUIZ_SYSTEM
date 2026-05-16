import { initializeApp } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-app.js";
import {
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  getAuth,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDocs,
  getFirestore,
  limit,
  orderBy,
  query,
  serverTimestamp,
  setDoc
} from "https://www.gstatic.com/firebasejs/9.23.0/firebase-firestore.js";

import { firebaseConfig, hasFirebaseConfig } from "./firebase-config.js";

const CONFIG_ERROR = "Firebase config is still using placeholders. Add your real Firebase web app config in CORE/firebase-config.js.";

let app = null;
let auth = null;
let db = null;
let authReadyResolver = null;
let latestUser = null;

export const authReady = new Promise(function (resolve) {
  authReadyResolver = resolve;
});

try {
  if (hasFirebaseConfig()) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
    db = getFirestore(app);
    onAuthStateChanged(auth, function (user) {
      latestUser = user;
      if (authReadyResolver) authReadyResolver(user);
    });
  } else if (authReadyResolver) {
    authReadyResolver(null);
  }
} catch (error) {
  console.error("Firebase initialization failed:", error);
  if (authReadyResolver) authReadyResolver(null);
}

export { app, auth, db, getAuth, getFirestore, initializeApp };

export function isFirebaseReady() {
  return Boolean(app && auth && db);
}

export function getCurrentUser() {
  return auth ? auth.currentUser : latestUser;
}

export function onAuthState(callback) {
  if (!auth) {
    callback(null);
    return function () {};
  }
  return onAuthStateChanged(auth, callback);
}

export async function requireAuth(options) {
  const settings = options || {};
  const redirectTo = settings.redirectTo || "../auth/login.html";
  const user = await authReady;

  if (user) return user;

  const next = encodeURIComponent(window.location.pathname + window.location.search + window.location.hash);
  window.location.href = `${redirectTo}?next=${next}`;
  return null;
}

export async function signUpWithEmail(email, password, displayName) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);

  try {
    const credential = await createUserWithEmailAndPassword(auth, email, password);
    if (displayName) {
      await updateProfile(credential.user, { displayName: displayName });
    }

    await upsertUserProfile(credential.user, { displayName: displayName || credential.user.displayName || "" });
    return success({ user: credential.user });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function signInWithEmail(email, password) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await upsertUserProfile(credential.user);
    return success({ user: credential.user });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function signInWithGoogle() {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);

  try {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    await upsertUserProfile(credential.user);
    return success({ user: credential.user });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function logoutUser() {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);

  try {
    await signOut(auth);
    return success();
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function upsertUserProfile(user, extraProfile) {
  if (!isFirebaseReady() || !user) return failure(CONFIG_ERROR);

  const profile = {
    uid: user.uid,
    name: (extraProfile && extraProfile.displayName) || user.displayName || "SSC Aspirant",
    email: user.email || "",
    photoURL: user.photoURL || "",
    lastLoginAt: serverTimestamp()
  };

  try {
    await setDoc(doc(db, "users", user.uid), {
      profile: profile,
      updatedAt: serverTimestamp()
    }, { merge: true });

    // Explicit profile document for teams that prefer users/{uid}/profile/main.
    await setDoc(doc(db, "users", user.uid, "profile", "main"), {
      ...profile,
      updatedAt: serverTimestamp()
    }, { merge: true });

    return success({ profile: profile });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function saveQuizAttempt(uid, attempt) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to save quiz progress.");

  const safeAttempt = {
    chapter: attempt.chapter || attempt.chapterId || "general",
    quizTitle: attempt.quizTitle || attempt.title || "SSC Quiz",
    score: Number(attempt.score) || 0,
    totalMarks: Number(attempt.totalMarks) || 0,
    correct: Number(attempt.correct) || 0,
    wrong: Number(attempt.wrong) || 0,
    unattempted: Number(attempt.unattempted) || 0,
    totalQuestions: Number(attempt.totalQuestions) || 0,
    accuracy: Number(attempt.accuracy) || 0,
    timeTaken: Number(attempt.timeTaken) || 0,
    wrongAnswers: Array.isArray(attempt.wrongAnswers) ? attempt.wrongAnswers : [],
    bookmarkedQuestions: Array.isArray(attempt.bookmarkedQuestions) ? attempt.bookmarkedQuestions : [],
    revisionQuestions: Array.isArray(attempt.revisionQuestions) ? attempt.revisionQuestions : [],
    timestamp: serverTimestamp()
  };

  try {
    const attemptRef = await addDoc(collection(db, "users", userId, "attempts"), safeAttempt);
    await setDoc(doc(db, "users", userId), {
      statsUpdatedAt: serverTimestamp()
    }, { merge: true });
    return success({ id: attemptRef.id, attempt: safeAttempt });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function addBookmark(uid, question) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to bookmark questions.");

  const bookmark = normalizeQuestionRecord(question);
  const bookmarkId = safeDocId(`${bookmark.chapterId}_${bookmark.questionId}`);

  try {
    await setDoc(doc(db, "users", userId, "bookmarks", bookmarkId), {
      ...bookmark,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return success({ id: bookmarkId });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function removeBookmark(uid, question) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to update bookmarks.");

  try {
    const bookmark = normalizeQuestionRecord(question);
    await deleteDoc(doc(db, "users", userId, "bookmarks", safeDocId(`${bookmark.chapterId}_${bookmark.questionId}`)));
    return success();
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function getBookmarks(uid) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR, { bookmarks: [] });
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to view bookmarks.", { bookmarks: [] });

  try {
    const snapshot = await getDocs(query(collection(db, "users", userId, "bookmarks"), orderBy("updatedAt", "desc")));
    return success({ bookmarks: snapshot.docs.map(docToRecord) });
  } catch (error) {
    return failure(formatFirebaseError(error), { bookmarks: [] });
  }
}

export async function addRevisionItem(uid, question) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to add revision items.");

  const item = normalizeQuestionRecord(question);
  const itemId = safeDocId(`${item.chapterId}_${item.questionId}`);

  try {
    await setDoc(doc(db, "users", userId, "revisionQueue", itemId), {
      ...item,
      status: item.status || "pending",
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    }, { merge: true });
    return success({ id: itemId });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function getRevisionQueue(uid) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR, { revisionQueue: [] });
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to view revision queue.", { revisionQueue: [] });

  try {
    const snapshot = await getDocs(query(collection(db, "users", userId, "revisionQueue"), orderBy("updatedAt", "desc")));
    return success({ revisionQueue: snapshot.docs.map(docToRecord) });
  } catch (error) {
    return failure(formatFirebaseError(error), { revisionQueue: [] });
  }
}

export async function getUserStats(uid) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR, emptyStats());
  const userId = uid || (auth.currentUser && auth.currentUser.uid);
  if (!userId) return failure("Please sign in to view dashboard stats.", emptyStats());

  try {
    const attemptsSnap = await getDocs(query(collection(db, "users", userId, "attempts"), orderBy("timestamp", "desc"), limit(250)));
    const bookmarksSnap = await getDocs(query(collection(db, "users", userId, "bookmarks"), orderBy("updatedAt", "desc"), limit(100)));
    const revisionSnap = await getDocs(query(collection(db, "users", userId, "revisionQueue"), orderBy("updatedAt", "desc"), limit(100)));

    const attempts = attemptsSnap.docs.map(docToRecord);
    const bookmarks = bookmarksSnap.docs.map(docToRecord);
    const revisionQueue = revisionSnap.docs.map(docToRecord);
    const attemptedQuestions = attempts.reduce(function (sum, item) {
      return sum + (Number(item.totalQuestions) || 0);
    }, 0);
    const correct = attempts.reduce(function (sum, item) {
      return sum + (Number(item.correct) || 0);
    }, 0);
    const wrong = attempts.reduce(function (sum, item) {
      return sum + (Number(item.wrong) || 0);
    }, 0);
    const answered = correct + wrong;
    const accuracy = answered ? Math.round((correct / answered) * 100) : 0;

    return success({
      attempts: attempts,
      latestAttempts: attempts.slice(0, 8),
      totalQuizzes: attempts.length,
      totalQuestions: attemptedQuestions,
      correct: correct,
      wrong: wrong,
      accuracy: accuracy,
      weakChapters: buildWeakChapters(attempts),
      bookmarks: bookmarks,
      revisionQueue: revisionQueue,
      streak: buildStreak(attempts)
    });
  } catch (error) {
    return failure(formatFirebaseError(error), emptyStats());
  }
}

function normalizeQuestionRecord(question) {
  return {
    chapterId: question.chapterId || question.chapter || "general",
    chapter: question.chapter || question.chapterId || "General",
    quizTitle: question.quizTitle || question.title || "SSC Quiz",
    questionId: String(question.questionId || question.sr_no || question.id || Date.now()),
    questionText: question.questionText || question.question || "",
    selectedAnswer: question.selectedAnswer || "",
    correctAnswer: question.correctAnswer || question.answer || "",
    explanation: question.explanation || "",
    options: question.options || {}
  };
}

function buildWeakChapters(attempts) {
  const grouped = {};

  attempts.forEach(function (attempt) {
    const chapter = attempt.chapter || "General";
    if (!grouped[chapter]) {
      grouped[chapter] = { chapter: chapter, attempts: 0, wrong: 0, answered: 0 };
    }
    grouped[chapter].attempts += 1;
    grouped[chapter].wrong += Number(attempt.wrong) || 0;
    grouped[chapter].answered += (Number(attempt.correct) || 0) + (Number(attempt.wrong) || 0);
  });

  return Object.values(grouped).map(function (item) {
    const weakness = item.answered ? Math.round((item.wrong / item.answered) * 100) : 0;
    return { ...item, weakness: weakness };
  }).filter(function (item) {
    return item.wrong > 0;
  }).sort(function (a, b) {
    return b.weakness - a.weakness || b.wrong - a.wrong;
  }).slice(0, 5);
}

function buildStreak(attempts) {
  const days = new Set(attempts.map(function (attempt) {
    const date = toDate(attempt.timestamp);
    return date ? date.toISOString().slice(0, 10) : "";
  }).filter(Boolean));

  let current = 0;
  const cursor = new Date();
  cursor.setHours(0, 0, 0, 0);

  while (days.has(cursor.toISOString().slice(0, 10))) {
    current += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return {
    current: current,
    activeDays: days.size,
    lastActive: attempts[0] ? toDate(attempts[0].timestamp) : null
  };
}

function docToRecord(snapshot) {
  return { id: snapshot.id, ...snapshot.data() };
}

function toDate(value) {
  if (!value) return null;
  if (typeof value.toDate === "function") return value.toDate();
  if (value.seconds) return new Date(value.seconds * 1000);
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

function emptyStats() {
  return {
    attempts: [],
    latestAttempts: [],
    totalQuizzes: 0,
    totalQuestions: 0,
    correct: 0,
    wrong: 0,
    accuracy: 0,
    weakChapters: [],
    bookmarks: [],
    revisionQueue: [],
    streak: { current: 0, activeDays: 0, lastActive: null }
  };
}

function safeDocId(value) {
  return String(value || "item").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 120);
}

function success(data) {
  return { success: true, ...(data || {}) };
}

function failure(error, data) {
  return { success: false, error: error, ...(data || {}) };
}

function formatFirebaseError(error) {
  const code = error && error.code ? error.code : "";
  const friendly = {
    "auth/email-already-in-use": "This email is already registered. Try logging in instead.",
    "auth/invalid-email": "Please enter a valid email address.",
    "auth/invalid-login-credentials": "Email or password is incorrect.",
    "auth/popup-closed-by-user": "Google sign-in was cancelled before completion.",
    "auth/too-many-requests": "Too many attempts. Please wait a moment and try again.",
    "auth/user-not-found": "No account was found for this email.",
    "auth/weak-password": "Use a stronger password with at least 6 characters.",
    "auth/wrong-password": "Email or password is incorrect.",
    "permission-denied": "Firestore security rules blocked this action."
  };

  return friendly[code] || (error && error.message) || "Something went wrong. Please try again.";
}
