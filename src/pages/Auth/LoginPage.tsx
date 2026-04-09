import React, { useEffect, useRef, useState } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { Eye, EyeOff, X, Loader2 } from 'lucide-react'
import { useAuthStore } from '../../store/auth'
import { get as storeGet } from '../../lib/storage'
import { isValidEmail } from '../../lib/utils'
import { cn } from '../../lib/utils'

// ─────────────────────────────────────────────────────────────────────────────
// Animated gradient mesh background
// ─────────────────────────────────────────────────────────────────────────────

function MeshBackground() {
  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden">
      {/* Slow-moving radial gradients that create a subtle aurora effect */}
      <motion.div
        className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(10,132,255,0.12) 0%, transparent 70%)',
        }}
        animate={{ x: [0, 40, 0], y: [0, 60, 0] }}
        transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute -bottom-40 -right-40 h-[500px] w-[500px] rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(191,90,242,0.10) 0%, transparent 70%)',
        }}
        animate={{ x: [0, -30, 0], y: [0, -50, 0] }}
        transition={{ duration: 22, repeat: Infinity, ease: 'easeInOut' }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 h-[400px] w-[400px] -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{
          background:
            'radial-gradient(circle, rgba(48,209,88,0.06) 0%, transparent 70%)',
        }}
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 14, repeat: Infinity, ease: 'easeInOut' }}
      />
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// Floating label input
// ─────────────────────────────────────────────────────────────────────────────

interface FloatingInputProps {
  id: string
  name?: string
  label: string
  type: string
  value: string
  onChange: (v: string) => void
  onBlur?: () => void
  autoFocus?: boolean
  autoComplete?: 'username' | 'current-password'
  error?: string
  suffix?: React.ReactNode
}

function FloatingInput({
  id,
  name,
  label,
  type,
  value,
  onChange,
  onBlur,
  autoFocus,
  autoComplete,
  error,
  suffix,
}: FloatingInputProps) {
  const [focused, setFocused] = useState(false)
  const isFloated = focused || value.length > 0

  return (
    <div className="relative">
      <div
        className={cn(
          'relative flex items-center rounded-apple-sm border transition-all duration-200',
          focused
            ? 'border-spann-accent bg-spann-bg-secondary shadow-apple-sm'
            : 'border-spann-border bg-spann-bg-tertiary',
          error && 'border-spann-red',
        )}
      >
        <label
          htmlFor={id}
          className={cn(
            'pointer-events-none absolute left-4 select-none transition-all duration-200',
            isFloated
              ? 'top-2 text-[11px] text-spann-text-muted'
              : 'top-1/2 -translate-y-1/2 text-sm text-spann-text-secondary',
            focused && !error && 'text-spann-accent',
            error && 'text-spann-red',
          )}
        >
          {label}
        </label>
        {autoComplete === 'username' ? (
          <input
            id={id}
            name={name}
            type={type}
            value={value}
            autoComplete="username"
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              onBlur?.()
            }}
            className={cn(
              'w-full bg-transparent pb-2 pl-4 pr-4 pt-6 text-sm text-spann-text-primary',
              'outline-none placeholder-transparent',
              suffix && 'pr-12',
            )}
          />
        ) : autoComplete === 'current-password' ? (
          <input
            id={id}
            name={name}
            type={type}
            value={value}
            autoComplete="current-password"
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              onBlur?.()
            }}
            className={cn(
              'w-full bg-transparent pb-2 pl-4 pr-4 pt-6 text-sm text-spann-text-primary',
              'outline-none placeholder-transparent',
              suffix && 'pr-12',
            )}
          />
        ) : (
          <input
            id={id}
            name={name}
            type={type}
            value={value}
            autoFocus={autoFocus}
            onChange={(e) => onChange(e.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => {
              setFocused(false)
              onBlur?.()
            }}
            className={cn(
              'w-full bg-transparent pb-2 pl-4 pr-4 pt-6 text-sm text-spann-text-primary',
              'outline-none placeholder-transparent',
              suffix && 'pr-12',
            )}
          />
        )}
        {suffix && (
          <div className="absolute right-3 flex items-center">{suffix}</div>
        )}
      </div>
      <AnimatePresence>
        {error && (
          <motion.p
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="mt-1 pl-1 text-xs text-spann-red"
          >
            {error}
          </motion.p>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─────────────────────────────────────────────────────────────────────────────
// LoginPage
// ─────────────────────────────────────────────────────────────────────────────

export default function LoginPage() {
  const navigate = useNavigate()
  const { login, isLoading, error, clearError } = useAuthStore()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [rememberEmail, setRememberEmail] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [passwordError, setPasswordError] = useState('')

  const passwordRef = useRef<HTMLInputElement>(null)

  // Pre-fill last used email
  useEffect(() => {
    const last = storeGet('lastEmail')
    if (last) {
      setEmail(last)
      setRememberEmail(true)
      // Focus password since email is already filled
      setTimeout(() => passwordRef.current?.focus(), 100)
    }
  }, [])

  // Clear store error when user starts typing
  useEffect(() => {
    if (error) clearError()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [email, password])

  function validateEmail(): boolean {
    if (!email.trim()) {
      setEmailError('Email is required.')
      return false
    }
    if (!isValidEmail(email.trim())) {
      setEmailError('Please enter a valid email address.')
      return false
    }
    setEmailError('')
    return true
  }

  function validatePassword(): boolean {
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.')
      return false
    }
    setPasswordError('')
    return true
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const emailOk = validateEmail()
    const passwordOk = validatePassword()
    if (!emailOk || !passwordOk) return

    try {
      await login(email.trim(), password)
      navigate('/app/chat', { replace: true })
    } catch {
      // error is already set in the store
    }
  }

  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-spann-bg-primary">
      <MeshBackground />

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
        className="relative z-10 w-full max-w-[400px] px-4"
      >
        {/* Card */}
        <div
          className={cn(
            'rounded-apple-lg border border-spann-border p-8',
            'bg-spann-card backdrop-blur-[20px]',
            'shadow-apple-lg',
          )}
        >
          {/* Logo + wordmark */}
          <div className="mb-8 flex flex-col items-center gap-3">
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.1, duration: 0.35 }}
              className="flex h-14 w-14 items-center justify-center rounded-apple-md bg-spann-accent"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 28 28"
                fill="none"
                aria-hidden="true"
              >
                <circle cx="14" cy="14" r="12" fill="white" fillOpacity={0.9} />
                <path
                  d="M8 14 C8 10 10 8 14 8 C18 8 20 10 20 14 C20 18 18 20 14 22"
                  stroke="#0A84FF"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            </motion.div>
            <div className="text-center">
              <p className="text-xl font-semibold tracking-tight text-spann-text-primary">
                Spann
              </p>
              <p className="mt-0.5 text-sm text-spann-text-secondary">
                Sign in to your workspace
              </p>
            </div>
          </div>

          {/* Store-level error banner */}
          <AnimatePresence>
            {error && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                className={cn(
                  'mb-4 flex items-center gap-2 rounded-apple-pill px-4 py-2.5',
                  'bg-spann-red/10 text-spann-red',
                )}
              >
                <span className="flex-1 text-sm">{error}</span>
                <button
                  type="button"
                  onClick={clearError}
                  className="flex-shrink-0 rounded-full p-0.5 hover:bg-spann-red/20 transition-colors"
                  aria-label="Dismiss error"
                >
                  <X size={14} />
                </button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Form */}
          <form onSubmit={handleSubmit} noValidate className="space-y-3">
            <FloatingInput
              id="login-email"
              name="username"
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              onBlur={validateEmail}
              autoFocus={!storeGet('lastEmail')}
              autoComplete="username"
              error={emailError}
            />

            <FloatingInput
              id="login-password"
              name="password"
              label="Password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={setPassword}
              onBlur={validatePassword}
              autoComplete="current-password"
              error={passwordError}
              suffix={
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  className="text-spann-text-muted transition-colors hover:text-spann-text-primary"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              }
            />

            {/* Remember email */}
            <label className="flex cursor-pointer items-center gap-2.5 pt-1">
              <input
                type="checkbox"
                checked={rememberEmail}
                onChange={(e) => setRememberEmail(e.target.checked)}
                className="h-4 w-4 rounded accent-spann-accent"
              />
              <span className="text-sm text-spann-text-secondary">
                Remember my email
              </span>
            </label>

            {/* Submit */}
            <button
              type="submit"
              disabled={isLoading}
              className={cn(
                'mt-2 flex w-full items-center justify-center gap-2 rounded-apple-pill',
                'bg-spann-accent py-3 text-sm font-semibold text-white',
                'transition-all duration-200',
                'hover:bg-[#0076EB] active:scale-[0.98]',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-spann-accent focus-visible:ring-offset-2 focus-visible:ring-offset-spann-bg-primary',
                'disabled:cursor-not-allowed disabled:opacity-60',
              )}
            >
              {isLoading ? (
                <>
                  <Loader2 size={16} className="animate-spin" />
                  Signing in…
                </>
              ) : (
                'Sign in'
              )}
            </button>
          </form>

          {/* Footer */}
          <p className="mt-6 text-center text-sm text-spann-text-secondary">
            Don&apos;t have an account?{' '}
            <Link
              to="/register"
              className="font-medium text-spann-accent transition-colors hover:text-[#3D9EFF]"
            >
              Create account
            </Link>
          </p>
        </div>
      </motion.div>
    </div>
  )
}
