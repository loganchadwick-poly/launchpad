'use client'

import { useState } from 'react'
import Link from 'next/link'
import { signUp } from '@/app/actions/auth'
import PolyAILogo from '@/app/components/PolyAILogo'

export default function SignUpPage() {
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setLoading(true)

    const formData = new FormData(e.currentTarget)
    
    const password = formData.get('password') as string
    const confirmPassword = formData.get('confirmPassword') as string
    
    if (password !== confirmPassword) {
      setError('Passwords do not match')
      setLoading(false)
      return
    }

    try {
      const result = await signUp(formData)
      if (result?.error) {
        setError(result.error)
        setLoading(false)
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'An error occurred'
      setError(errorMessage)
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen">
      {/* Left Panel - Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        {/* Solid Dark Background */}
        <div className="absolute inset-0 bg-dark-700" />
        
        {/* Content */}
        <div className="relative z-10 flex flex-col justify-between p-12 w-full">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-lg overflow-hidden">
              <PolyAILogo className="h-full w-full" />
            </div>
            <span className="text-xl font-semibold text-white">PolyAI LaunchPad</span>
          </div>
          
          {/* Main Content */}
          <div className="space-y-6">
            <h1 className="text-4xl font-bold text-white leading-tight">
              Join teams who<br />
              ship faster<br />
              with confidence
            </h1>
            <p className="text-lg text-gray-400 max-w-md">
              Create your account and start managing deployments in minutes.
            </p>
            
            {/* Stats */}
            <div className="grid grid-cols-3 gap-6 pt-6">
              <div>
                <div className="text-3xl font-bold text-white">50%</div>
                <div className="text-sm text-gray-400">Less UAT time</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">2x</div>
                <div className="text-sm text-gray-400">Faster feedback</div>
              </div>
              <div>
                <div className="text-3xl font-bold text-white">100%</div>
                <div className="text-sm text-gray-400">Visibility</div>
              </div>
            </div>
          </div>
          
          {/* Footer */}
          <div className="text-sm text-gray-500">
            © 2026 PolyAI LaunchPad
          </div>
        </div>
        
        {/* Decorative Pattern */}
        <div className="absolute bottom-0 right-0 w-1/2 h-1/2 opacity-5">
          <svg viewBox="0 0 200 200" className="w-full h-full">
            <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="white"/>
            </pattern>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>
      </div>

      {/* Right Panel - Form */}
      <div className="flex w-full lg:w-1/2 items-center justify-center px-6 py-12 gradient-mesh">
        <div className="w-full max-w-md opacity-0 animate-fade-in">
          {/* Mobile Logo */}
          <div className="lg:hidden mb-8 text-center">
            <div className="inline-flex items-center justify-center gap-3">
              <div className="h-10 w-10 rounded-lg overflow-hidden">
                <PolyAILogo className="h-full w-full" />
              </div>
              <span className="text-xl font-semibold text-brand-dark">PolyAI LaunchPad</span>
            </div>
          </div>

          {/* Header */}
          <div className="mb-8">
            <h2 className="text-2xl font-bold text-brand-dark">Create your account</h2>
            <p className="mt-2 text-gray-600">Get started with UAT management</p>
          </div>

          {/* Signup Form */}
          <div className="card p-8">
            <form onSubmit={handleSubmit} className="space-y-4">
              {error && (
                <div className="rounded-lg bg-red-50 border border-red-200 p-4 animate-scale-in">
                  <div className="flex items-center gap-2">
                    <svg className="h-5 w-5 text-red-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-sm font-medium text-red-600">{error}</p>
                  </div>
                </div>
              )}

              <div className="space-y-1.5">
                <label htmlFor="name" className="block text-sm font-medium text-brand-dark">
                  Full Name
                </label>
                <input
                  id="name"
                  name="name"
                  type="text"
                  autoComplete="name"
                  required
                  className="input-field"
                  placeholder="John Doe"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="email" className="block text-sm font-medium text-brand-dark">
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  className="input-field"
                  placeholder="you@company.com"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="role" className="block text-sm font-medium text-brand-dark">
                  Role
                </label>
                <select
                  id="role"
                  name="role"
                  required
                  defaultValue="PSM"
                  className="input-field cursor-pointer"
                >
                  <option value="PSM">PSM (Product Solutions Manager)</option>
                  <option value="AD">AD (Agent Designer)</option>
                  <option value="FDE">FDE (Forward Deployed Engineer)</option>
                  <option value="Client">Client</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label htmlFor="password" className="block text-sm font-medium text-brand-dark">
                    Password
                  </label>
                  <input
                    id="password"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="input-field"
                    placeholder="Min. 6 chars"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="confirmPassword" className="block text-sm font-medium text-brand-dark">
                    Confirm
                  </label>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type="password"
                    autoComplete="new-password"
                    required
                    minLength={6}
                    className="input-field"
                    placeholder="Re-enter"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full py-3 text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:transform-none disabled:shadow-none mt-2"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Creating account...
                  </span>
                ) : 'Create Account'}
              </button>
            </form>

            <div className="mt-6 text-center">
              <p className="text-sm text-gray-600">
                Already have an account?{' '}
                <Link href="/login" className="font-semibold text-brand-dark hover:text-gray-600 transition-colors">
                  Sign in
                </Link>
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
