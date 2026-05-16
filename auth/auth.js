/**
 * AUTHENTICATION MODULE
 * Handles login, signup, and Google sign-in
 */

let authForm = null;
let messageEl = null;
let isLoading = false;

document.addEventListener('DOMContentLoaded', function() {
  initializeAuth();
});

async function initializeAuth() {
  // Wait for Firebase to initialize
  await new Promise(resolve => {
    const checkFirebase = setInterval(() => {
      if (typeof firebase !== 'undefined') {
        clearInterval(checkFirebase);
        resolve();
      }
    }, 100);
  });

  // Initialize Firebase
  await initFirebase();

  // Set up event listeners
  setupEventListeners();

  // Check if user is already logged in
  checkAuthState();
}

function setupEventListeners() {
  // Get form based on current page
  const currentPage = document.body.getAttribute('data-page');
  
  if (window.location.pathname.includes('login')) {
    setupLoginForm();
  } else if (window.location.pathname.includes('signup')) {
    setupSignupForm();
  }

  // Password visibility toggles
  document.querySelectorAll('.toggle-password').forEach(btn => {
    btn.addEventListener('click', function(e) {
      e.preventDefault();
      const targetId = this.getAttribute('data-target');
      const input = document.getElementById(targetId);
      const isPassword = input.type === 'password';
      input.type = isPassword ? 'text' : 'password';
      this.classList.toggle('active');
    });
  });
}

function setupLoginForm() {
  authForm = document.getElementById('loginForm');
  messageEl = document.getElementById('authMessage');

  if (authForm) {
    authForm.addEventListener('submit', handleLoginSubmit);
  }

  // Google Sign-In
  const googleBtn = document.getElementById('googleSignInBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
  }
}

function setupSignupForm() {
  authForm = document.getElementById('signupForm');
  messageEl = document.getElementById('authMessage');

  if (authForm) {
    authForm.addEventListener('submit', handleSignupSubmit);
  }

  // Google Sign-Up
  const googleBtn = document.getElementById('googleSignUpBtn');
  if (googleBtn) {
    googleBtn.addEventListener('click', handleGoogleSignIn);
  }
}

async function handleLoginSubmit(e) {
  e.preventDefault();

  if (isLoading) return;
  isLoading = true;

  // Clear previous errors
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');

  const email = document.getElementById('loginEmail')?.value.trim();
  const password = document.getElementById('loginPassword')?.value;

  // Validate
  let isValid = true;
  if (!email) {
    document.getElementById('loginEmailError').textContent = 'Email is required';
    isValid = false;
  } else if (!validateEmail(email)) {
    document.getElementById('loginEmailError').textContent = 'Please enter a valid email';
    isValid = false;
  }

  if (!password) {
    document.getElementById('loginPasswordError').textContent = 'Password is required';
    isValid = false;
  } else if (password.length < 6) {
    document.getElementById('loginPasswordError').textContent = 'Password must be at least 6 characters';
    isValid = false;
  }

  if (!isValid) {
    isLoading = false;
    return;
  }

  showMessage('Signing in...', 'loading');

  const result = await signInWithEmail(email, password);
  
  if (result.success) {
    showMessage('Sign in successful! Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = '../dashboard/dashboard.html';
    }, 1500);
  } else {
    showMessage('Sign in failed: ' + result.error, 'error');
  }

  isLoading = false;
}

async function handleSignupSubmit(e) {
  e.preventDefault();

  if (isLoading) return;
  isLoading = true;

  // Clear previous errors
  document.querySelectorAll('.form-error').forEach(el => el.textContent = '');

  const name = document.getElementById('signupName')?.value.trim();
  const email = document.getElementById('signupEmail')?.value.trim();
  const password = document.getElementById('signupPassword')?.value;
  const confirmPassword = document.getElementById('signupConfirmPassword')?.value;
  const termsChecked = document.getElementById('signupTerms')?.checked;

  // Validate
  let isValid = true;

  if (!name) {
    document.getElementById('signupNameError').textContent = 'Name is required';
    isValid = false;
  } else if (name.length < 2) {
    document.getElementById('signupNameError').textContent = 'Name must be at least 2 characters';
    isValid = false;
  }

  if (!email) {
    document.getElementById('signupEmailError').textContent = 'Email is required';
    isValid = false;
  } else if (!validateEmail(email)) {
    document.getElementById('signupEmailError').textContent = 'Please enter a valid email';
    isValid = false;
  }

  if (!password) {
    document.getElementById('signupPasswordError').textContent = 'Password is required';
    isValid = false;
  } else if (password.length < 8) {
    document.getElementById('signupPasswordError').textContent = 'Password must be at least 8 characters';
    isValid = false;
  }

  if (!confirmPassword) {
    document.getElementById('signupConfirmPasswordError').textContent = 'Please confirm your password';
    isValid = false;
  } else if (password !== confirmPassword) {
    document.getElementById('signupConfirmPasswordError').textContent = 'Passwords do not match';
    isValid = false;
  }

  if (!termsChecked) {
    document.getElementById('signupTermsError').textContent = 'You must agree to the terms';
    isValid = false;
  }

  if (!isValid) {
    isLoading = false;
    return;
  }

  showMessage('Creating account...', 'loading');

  // Create auth user
  const authResult = await signUpWithEmail(email, password);
  
  if (authResult.success) {
    // Update display name
    await authResult.user.updateProfile({ displayName: name });
    
    // Update Firestore with name
    try {
      const db = firebase.firestore();
      await db.collection('users').doc(authResult.user.uid).update({
        name: name,
        email: email
      });
    } catch (error) {
      console.error('Error updating user profile:', error);
    }

    showMessage('Account created! Redirecting to dashboard...', 'success');
    setTimeout(() => {
      window.location.href = '../dashboard/dashboard.html';
    }, 1500);
  } else {
    showMessage('Sign up failed: ' + authResult.error, 'error');
  }

  isLoading = false;
}

async function handleGoogleSignIn(e) {
  e.preventDefault();

  if (isLoading) return;
  isLoading = true;

  showMessage('Signing in with Google...', 'loading');

  const result = await signInWithGoogle();
  
  if (result.success) {
    showMessage('Sign in successful! Redirecting...', 'success');
    setTimeout(() => {
      window.location.href = '../dashboard/dashboard.html';
    }, 1500);
  } else {
    showMessage('Google sign-in failed: ' + result.error, 'error');
  }

  isLoading = false;
}

function checkAuthState() {
  onAuthStateChanged(user => {
    if (user) {
      // User is logged in, redirect to dashboard
      if (!window.location.pathname.includes('dashboard')) {
        window.location.href = '../dashboard/dashboard.html';
      }
    } else {
      // User is not logged in
      if (window.location.pathname.includes('dashboard')) {
        window.location.href = './login.html';
      }
    }
  });
}

function showMessage(text, type) {
  if (!messageEl) return;

  messageEl.textContent = text;
  messageEl.className = `auth-message ${type}`;
  messageEl.classList.remove('hidden');

  if (type === 'success' || type === 'error') {
    setTimeout(() => {
      messageEl.classList.add('hidden');
    }, 5000);
  }
}

function validateEmail(email) {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
}
