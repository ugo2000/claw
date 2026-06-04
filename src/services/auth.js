/**
 * Auth service - supports both Supabase and local fallback
 * When Supabase is configured → use it
 * When not configured → use localStorage mock auth
 */
import { getSupabase, isSupabaseConfigured } from './supabase'

// ============================================================
// Local storage mock auth (when no Supabase)
// ============================================================
const LOCAL_USER_KEY = 'claw_local_user'
const LOCAL_PW_KEY = 'claw_local_pw'

function getLocalUser() {
  try {
    const raw = localStorage.getItem(LOCAL_USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch { return null }
}

function setLocalUser(user) {
  localStorage.setItem(LOCAL_USER_KEY, JSON.stringify(user))
}

function clearLocalUser() {
  localStorage.removeItem(LOCAL_USER_KEY)
  localStorage.removeItem(LOCAL_PW_KEY)
}

// ============================================================
// Exported auth functions
// ============================================================

/**
 * Register a new user
 * @param {string} email
 * @param {string} password
 * @param {object} extra - { companyName, industry }
 * @returns {Promise<{user: object|null, error: string|null}>}
 */
export async function register(email, password, extra = {}) {
  // --- Supabase mode ---
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    const { data, error } = await sb.auth.signUp({
      email,
      password,
      options: {
        data: {
          company_name: extra.companyName || '',
          industry: extra.industry || '',
        }
      }
    })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  }

  // --- Local mock mode ---
  const users = JSON.parse(localStorage.getItem('claw_all_users') || '{}')
  if (users[email]) {
    return { user: null, error: 'Email already registered' }
  }
  const user = {
    id: 'local_' + Date.now(),
    email,
    companyName: extra.companyName || '',
    industry: extra.industry || '',
    createdAt: new Date().toISOString(),
  }
  users[email] = { ...user, password } // Note: storing pw in plaintext only for demo!
  localStorage.setItem('claw_all_users', JSON.stringify(users))
  setLocalUser(user)
  return { user, error: null }
}

/**
 * Login
 * Local mode: auto-creates account on first login (smooth onboarding)
 */
export async function login(email, password) {
  // --- Supabase mode ---
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    const { data, error } = await sb.auth.signInWithPassword({ email, password })
    if (error) return { user: null, error: error.message }
    return { user: data.user, error: null }
  }

  // --- Local mock mode ---
  const users = JSON.parse(localStorage.getItem('claw_all_users') || '{}')
  const record = users[email]

  if (!record) {
    // Auto-create account on first login (no separate registration needed)
    const user = {
      id: 'local_' + Date.now(),
      email,
      name: email.split('@')[0],
      companyName: '',
      createdAt: new Date().toISOString(),
    }
    users[email] = { ...user, password }
    localStorage.setItem('claw_all_users', JSON.stringify(users))
    setLocalUser(user)
    return { user, error: null }
  }

  if (record.password !== password) {
    return { user: null, error: 'Invalid email or password' }
  }
  const { password: _, ...user } = record
  setLocalUser(user)
  return { user, error: null }
}

/**
 * Logout
 */
export async function logout() {
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    await sb.auth.signOut()
  }
  clearLocalUser()
}

/**
 * Get current logged-in user (reactive helper)
 * Returns null if not logged in
 */
export function getCurrentUser() {
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    return sb.auth.getUser().then(({ data }) => data.user)
  }
  return Promise.resolve(getLocalUser())
}

/**
 * Check if user is logged in (sync, for router guard)
 */
export function isLoggedIn() {
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    return sb.auth.getSession().then(({ data }) => !!data.session)
  }
  return Promise.resolve(!!getLocalUser())
}

/**
 * Get stored local user synchronously (for immediate UI)
 */
export function getStoredUser() {
  return getLocalUser()
}

/**
 * Check if user is logged in (synchronous, for UI guards)
 * Returns boolean for immediate tab bar display
 */
export function isAuthenticated() {
  if (isSupabaseConfigured()) {
    // For Supabase, we can't check synchronously, so check localStorage fallback
    // The router guard uses the async isLoggedIn() for proper checks
    return !!localStorage.getItem('claw_local_user') || !!localStorage.getItem('sb-session')
  }
  return !!getLocalUser()
}

/**
 * Send password reset email
 * @param {string} email
 * @returns {Promise<{success: boolean, error: string|null}>}
 */
export async function sendPasswordResetEmail(email) {
  if (isSupabaseConfigured()) {
    const sb = getSupabase()
    const { error } = await sb.auth.resetPasswordForEmail(email)
    if (error) return { success: false, error: error.message }
    return { success: true, error: null }
  }

  // Mock: just show success
  const users = JSON.parse(localStorage.getItem('claw_all_users') || '{}')
  if (!users[email]) {
    return { success: false, error: 'No account found with this email' }
  }
  return { success: true, error: null }
}
