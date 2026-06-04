import { createRouter, createWebHashHistory } from 'vue-router'
import { getStoredUser } from '../services/auth'

const routes = [
  {
    path: '/login',
    name: 'Login',
    component: () => import('../views/LoginView.vue'),
    meta: { title: 'Sign In', guest: true }
  },
  {
    path: '/register',
    name: 'Register',
    component: () => import('../views/RegisterView.vue'),
    meta: { title: 'Sign Up', guest: true }
  },
  {
    path: '/forgot-password',
    name: 'ForgotPassword',
    component: () => import('../views/ForgotPasswordView.vue'),
    meta: { title: 'Reset Password', guest: true }
  },
  {
    path: '/',
    redirect: '/home'
  },
  {
    path: '/home',
    name: 'Home',
    component: () => import('../views/HomeView.vue'),
    meta: { title: 'Home', requiresAuth: true }
  },
  {
    path: '/search',
    name: 'Search',
    component: () => import('../views/SearchView.vue'),
    meta: { title: 'Search', requiresAuth: true }
  },
  {
    path: '/email',
    name: 'Email',
    component: () => import('../views/EmailView.vue'),
    meta: { title: 'AI Email', requiresAuth: true }
  },
  {
    path: '/clients',
    name: 'Clients',
    component: () => import('../views/ClientsView.vue'),
    meta: { title: 'Clients', requiresAuth: true }
  },
  {
    path: '/profile',
    name: 'Profile',
    component: () => import('../views/ProfileView.vue'),
    meta: { title: 'Profile', requiresAuth: true }
  },
]

const router = createRouter({
  history: createWebHashHistory(),
  routes,
})

// ---- Auth Guard ----
router.beforeEach((to, from, next) => {
  const isLoggedIn = !!getStoredUser()

  // Pages marked "guest" are only for logged-out users
  if (to.meta.guest && isLoggedIn) {
    next('/home')
    return
  }

  // Pages that require auth → redirect to /login
  if (to.meta.requiresAuth && !isLoggedIn) {
    next('/login')
    return
  }

  next()
})

export default router
