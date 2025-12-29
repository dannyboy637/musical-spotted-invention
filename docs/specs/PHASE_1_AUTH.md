# Phase 1: Authentication

> **Goal:** Users can log in, sessions persist, routes are protected.
> **Branch:** `feature/phase-1-auth`

---

## Deliverables

### Supabase Setup
- [ ] Create Supabase project
- [ ] Configure Auth settings
- [ ] Create `users` table with role column
- [ ] Set up RLS policies

### Backend
- [ ] `backend/db/supabase.py` - Supabase client
- [ ] `backend/middleware/auth.py` - JWT validation
- [ ] `backend/routes/auth.py` - Auth endpoints

### Frontend
- [ ] `src/stores/authStore.ts` - Auth state
- [ ] `src/lib/supabase.ts` - Supabase client
- [ ] `src/modules/auth/LoginPage.tsx`
- [ ] `src/modules/auth/ForgotPasswordPage.tsx`
- [ ] `src/components/layout/ProtectedRoute.tsx`

---

## Auth Flow

```
1. User enters email/password
2. Frontend calls Supabase Auth
3. Supabase returns JWT + refresh token
4. Frontend stores tokens, redirects to dashboard
5. API calls include JWT in Authorization header
6. Backend middleware validates JWT
```

---

## Acceptance Criteria

- [ ] User can log in with email/password
- [ ] Invalid credentials show error
- [ ] Session persists on page refresh
- [ ] Protected routes redirect to login
- [ ] Logout clears session
- [ ] Password reset email works

---

*Phase 1 complete when all acceptance criteria checked.*
