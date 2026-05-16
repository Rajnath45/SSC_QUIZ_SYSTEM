import {
  authReady,
  isFirebaseReady,
  signInWithEmail,
  signInWithGoogle,
  signUpWithEmail
} from "../CORE/firebase-module.js";

const page = document.body.dataset.authPage;
const messageEl = document.getElementById("authMessage");
const emailAuthBtn = document.getElementById("emailAuthBtn");
const googleAuthBtn = document.getElementById("googleAuthBtn");
let isLoading = false;

document.addEventListener("DOMContentLoaded", initAuthPage);

async function initAuthPage() {
  setupPasswordToggles();
  setupForms();

  const user = await authReady;
  if (user) redirectAfterAuth();

  if (!isFirebaseReady()) {
    showMessage("Firebase config is pending. Add your real values in CORE/firebase-config.js before using login.", "error");
  }
}

function setupForms() {
  if (page === "login") {
    const form = document.getElementById("loginForm");
    if (form) form.addEventListener("submit", handleLogin);
  }

  if (page === "signup") {
    const form = document.getElementById("signupForm");
    if (form) form.addEventListener("submit", handleSignup);
  }

  if (googleAuthBtn) {
    googleAuthBtn.addEventListener("click", handleGoogle);
  }
}

function setupPasswordToggles() {
  document.querySelectorAll(".toggle-password").forEach(function (button) {
    button.addEventListener("click", function () {
      const input = document.getElementById(button.dataset.target);
      if (!input) return;
      const show = input.type === "password";
      input.type = show ? "text" : "password";
      button.textContent = show ? "Hide" : "Show";
    });
  });
}

async function handleLogin(event) {
  event.preventDefault();
  if (isLoading) return;

  clearErrors();
  const email = valueOf("loginEmail");
  const password = valueOf("loginPassword");
  let valid = true;

  if (!isEmail(email)) valid = setError("loginEmailError", "Enter a valid email address.");
  if (!password) valid = setError("loginPasswordError", "Password is required.");
  if (!valid) return;

  setLoading(true, "Signing in...");
  const result = await signInWithEmail(email, password);
  setLoading(false);

  if (result.success) {
    showMessage("Signed in. Opening dashboard...", "success");
    setTimeout(redirectAfterAuth, 700);
  } else {
    showMessage(result.error, "error");
  }
}

async function handleSignup(event) {
  event.preventDefault();
  if (isLoading) return;

  clearErrors();
  const name = valueOf("signupName");
  const email = valueOf("signupEmail");
  const password = valueOf("signupPassword");
  const confirmPassword = valueOf("signupConfirmPassword");
  const terms = document.getElementById("signupTerms");
  let valid = true;

  if (name.length < 2) valid = setError("signupNameError", "Enter your full name.");
  if (!isEmail(email)) valid = setError("signupEmailError", "Enter a valid email address.");
  if (password.length < 8) valid = setError("signupPasswordError", "Use at least 8 characters.");
  if (password !== confirmPassword) valid = setError("signupConfirmPasswordError", "Passwords do not match.");
  if (!terms || !terms.checked) valid = setError("signupTermsError", "Please accept the practice tracking terms.");
  if (!valid) return;

  setLoading(true, "Creating account...");
  const result = await signUpWithEmail(email, password, name);
  setLoading(false);

  if (result.success) {
    showMessage("Account created. Opening dashboard...", "success");
    setTimeout(redirectAfterAuth, 700);
  } else {
    showMessage(result.error, "error");
  }
}

async function handleGoogle() {
  if (isLoading) return;

  setLoading(true, "Opening Google sign-in...");
  const result = await signInWithGoogle();
  setLoading(false);

  if (result.success) {
    showMessage("Signed in with Google. Opening dashboard...", "success");
    setTimeout(redirectAfterAuth, 700);
  } else {
    showMessage(result.error, "error");
  }
}

function redirectAfterAuth() {
  const params = new URLSearchParams(window.location.search);
  const next = params.get("next");
  window.location.href = next && next.startsWith("/") ? next : "../dashboard/dashboard.html";
}

function setLoading(loading, message) {
  isLoading = loading;
  document.body.classList.toggle("is-loading", loading);
  if (emailAuthBtn) emailAuthBtn.disabled = loading;
  if (googleAuthBtn) googleAuthBtn.disabled = loading;
  if (message) showMessage(message, "loading");
}

function showMessage(text, type) {
  if (!messageEl) return;
  messageEl.textContent = text;
  messageEl.className = `auth-message ${type}`;
  messageEl.classList.remove("hidden");
}

function clearErrors() {
  document.querySelectorAll(".form-error").forEach(function (item) {
    item.textContent = "";
  });
}

function setError(id, message) {
  const el = document.getElementById(id);
  if (el) el.textContent = message;
  return false;
}

function valueOf(id) {
  const el = document.getElementById(id);
  return el ? el.value.trim() : "";
}

function isEmail(value) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
