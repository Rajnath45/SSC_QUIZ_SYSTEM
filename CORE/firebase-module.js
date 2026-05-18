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

import { firebaseConfig, hasFirebaseConfig } from "./firebase-config.js";

const CONFIG_ERROR = "Firebase config is still using placeholders. Add your real Firebase web app config in CORE/firebase-config.js.";

let app = null;
let auth = null;
let authReadyResolver = null;
let latestUser = null;

export const authReady = new Promise(function (resolve) {
  authReadyResolver = resolve;
});

try {
  if (hasFirebaseConfig()) {
    app = initializeApp(firebaseConfig);
    auth = getAuth(app);
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

export { app, auth, getAuth, initializeApp };

export function isFirebaseReady() {
  return Boolean(app && auth);
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
    return success({ user: credential.user });
  } catch (error) {
    return failure(formatFirebaseError(error));
  }
}

export async function signInWithEmail(email, password) {
  if (!isFirebaseReady()) return failure(CONFIG_ERROR);

  try {
    const credential = await signInWithEmailAndPassword(auth, email, password);
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

export async function upsertUserProfile(user) {
  return user ? success({ profile: {
    uid: user.uid,
    name: user.displayName || "SSC Aspirant",
    email: user.email || "",
    photoURL: user.photoURL || ""
  } }) : failure(CONFIG_ERROR);
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
    "auth/wrong-password": "Email or password is incorrect."
  };

  return friendly[code] || (error && error.message) || "Something went wrong. Please try again.";
}
