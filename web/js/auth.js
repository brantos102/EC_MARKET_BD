import { supabase } from './supabaseClient.js';

const loginScreen = document.getElementById('login-screen');
const appShell = document.getElementById('app-shell');
const loginForm = document.getElementById('login-form');
const loginError = document.getElementById('login-error');
const userEmailEl = document.getElementById('current-user-email');
const logoutBtn = document.getElementById('logout-btn');

let currentSession = null;
const listeners = [];

export function onAuthReady(cb) {
  listeners.push(cb);
  if (currentSession !== null) cb(currentSession);
}

function showApp(session) {
  currentSession = session;
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  if (userEmailEl) userEmailEl.textContent = session.user.email ?? '';
  listeners.forEach((cb) => cb(session));
}

function showLogin() {
  currentSession = false;
  appShell.classList.add('hidden');
  loginScreen.classList.remove('hidden');
}

loginForm?.addEventListener('submit', async (e) => {
  e.preventDefault();
  loginError.textContent = '';
  const email = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-password').value;
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) {
    loginError.textContent = error.message;
  }
});

logoutBtn?.addEventListener('click', async () => {
  await supabase.auth.signOut();
});

supabase.auth.onAuthStateChange((_event, session) => {
  if (session) {
    showApp(session);
  } else {
    showLogin();
  }
});

supabase.auth.getSession().then(({ data }) => {
  if (data.session) {
    showApp(data.session);
  } else {
    showLogin();
  }
});

export function getSupabase() {
  return supabase;
}
