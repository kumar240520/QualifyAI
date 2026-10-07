import React, { useState, useEffect, useRef } from 'react'
import {
  Search,
  Bell,
  Sparkles,
  Command,
  ChevronDown,
  Menu,
  ShieldCheck,
  CheckCircle2,
  SlidersHorizontal,
  LogOut,
  User,
  Settings,
  Users,
  Briefcase,
  ExternalLink,
  X,
  Layers,
  Award,
} from 'lucide-react'

// Quick Search Sample Dataset across candidates, jobs, and sections
const SEARCHABLE_ITEMS = [
  { id: 'cand-1', type: 'candidate', title: 'Alex Rivera', subtitle: 'Senior Systems Engineer • Score 92% (Recommended)', path: '/candidates' },
  { id: 'cand-2', type: 'candidate', title: 'Sarah Chen', subtitle: 'Senior Systems Engineer • Score 88% (Strong Hire)', path: '/candidates' },
  { id: 'cand-3', type: 'candidate', title: 'Marcus Brody', subtitle: 'Senior Systems Engineer • Score 74% (Review Needed)', path: '/candidates' },
  { id: 'cand-4', type: 'candidate', title: 'Elena Rostova', subtitle: 'Senior Systems Engineer • Score 94% (Recommended)', path: '/candidates' },
  { id: 'job-1', type: 'job', title: 'Senior Distributed Systems Engineer', subtitle: 'Engineering • 14 Candidates • Active', path: '/jobs' },
  { id: 'job-2', type: 'job', title: 'Staff AI Platform Architect', subtitle: 'AI Core • 8 Candidates • Active', path: '/jobs' },
  { id: 'job-3', type: 'job', title: 'Senior Backend Engineer (Go/Rust)', subtitle: 'Infrastructure • 21 Candidates • Active', path: '/jobs' },
  { id: 'nav-1', type: 'navigation', title: 'Job Requisitions & JD Intelligence', subtitle: 'Manage roles and calibrate rubrics', path: '/jobs' },
  { id: 'nav-2', type: 'navigation', title: 'Candidate Cohort & Invitations', subtitle: 'Candidate pipeline, status, and tokens', path: '/candidates' },
  { id: 'nav-3', type: 'navigation', title: 'Ranked Leaderboard & Analytics', subtitle: 'Candidate scoring metrics & integrity', path: '/analytics' },
  { id: 'nav-4', type: 'navigation', title: 'AI Training Datasets', subtitle: 'Domain-specific evaluation datasets', path: '/datasets' },
  { id: 'nav-5', type: 'navigation', title: 'Model Benchmarks', subtitle: 'Evaluate AI evaluator models', path: '/benchmarks' },
]

export default function DashboardNavbar({
  onToggleSidebar,
  workspaceTitle = 'QualifyAI Requisitions',
  activeContext = 'Active Cohort • Senior Distributed Systems Engineer',
  userProfile = {
    fullName: 'Alex Vance',
    role: 'ORG_ADMIN',
    email: 'recruiter@qualifyai.com',
    avatarInitials: 'AV',
  },
  onLogout,
  onNavigate,
}) {
  const [searchQuery, setSearchQuery] = useState('')
  const [isSearchOpen, setIsSearchOpen] = useState(false)
  const [isProfileOpen, setIsProfileOpen] = useState(false)

  const profileRef = useRef(null)
  const searchInputRef = useRef(null)

  // Keyboard shortcut Command+K / Ctrl+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsSearchOpen(true)
        setTimeout(() => searchInputRef.current?.focus(), 50)
      } else if (e.key === 'Escape') {
        setIsSearchOpen(false)
        setIsProfileOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Close profile dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setIsProfileOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const filteredResults = searchQuery.trim()
    ? SEARCHABLE_ITEMS.filter(
        (item) =>
          item.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
          item.subtitle.toLowerCase().includes(searchQuery.toLowerCase())
      )
    : SEARCHABLE_ITEMS.slice(0, 6)

  const handleSelectResult = (item) => {
    setIsSearchOpen(false)
    setSearchQuery('')
    if (item.path && onNavigate) {
      onNavigate(item.path)
    }
  }

  return (
    <header className="h-16 bg-white/95 backdrop-blur-md border-b border-slate-200/90 px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-40 select-none">
      {/* Zone 1: Left - Mobile Toggle & Workspace Context */}
      <div className="flex items-center gap-3 shrink-0">
        {onToggleSidebar && (
          <button
            onClick={onToggleSidebar}
            aria-label="Toggle navigation"
            className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 lg:hidden transition-colors cursor-pointer"
          >
            <Menu className="w-5 h-5" />
          </button>
        )}

        <div className="hidden sm:flex flex-col truncate">
          <div className="flex items-center gap-1.5 text-xs font-bold text-slate-900 truncate">
            <span>{workspaceTitle}</span>
            <span className="text-slate-300">/</span>
            <span className="text-blue-600 font-semibold truncate">{activeContext}</span>
          </div>
          <span className="text-[10px] font-mono text-slate-400">
            Tenant: <span className="font-semibold text-slate-600">Enterprise Engineering HQ</span>
          </span>
        </div>
      </div>

      {/* Zone 2: Center - Global Search */}
      <div className="flex-1 max-w-md mx-auto relative hidden md:block">
        <div
          onClick={() => {
            setIsSearchOpen(true)
            setTimeout(() => searchInputRef.current?.focus(), 50)
          }}
          className="relative flex items-center cursor-pointer"
        >
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 pointer-events-none" />
          <input
            type="text"
            readOnly
            placeholder="Search candidates, skills, or job rubrics..."
            className="w-full h-10 pl-10 pr-12 rounded-xl bg-slate-50 border border-slate-200 text-xs font-medium text-slate-800 placeholder-slate-400 focus:bg-white focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 focus:outline-none transition-all cursor-pointer"
          />
          <div className="absolute right-3 flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-slate-200/70 text-[10px] font-mono text-slate-500 pointer-events-none">
            <Command className="w-2.5 h-2.5" />
            <span>K</span>
          </div>
        </div>
      </div>

      {/* Zone 3: Right - Utilities & Recruiter Profile */}
      <div className="flex items-center gap-3 shrink-0">
        {/* Live AI Status Badge */}
        <div className="hidden lg:flex items-center gap-2 px-2.5 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-[11px] font-bold text-emerald-800">
          <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
          <span>AI Engine Ready</span>
        </div>

        {/* Notifications Button */}
        <button
          title="Notifications"
          className="relative p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer"
        >
          <Bell className="w-4 h-4" />
          <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-blue-600 ring-2 ring-white" />
        </button>

        {/* Recruiter Profile Pill Dropdown */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setIsProfileOpen((prev) => !prev)}
            aria-expanded={isProfileOpen}
            className="flex items-center gap-2 pl-2 border-l border-slate-200/80 hover:opacity-90 transition cursor-pointer focus:outline-none"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shadow-sm">
              {userProfile.avatarInitials || 'AV'}
            </div>
            <div className="hidden xl:flex flex-col text-left">
              <span className="text-xs font-bold text-slate-900 leading-tight">
                {userProfile.fullName}
              </span>
              <span className="text-[10px] font-mono text-slate-500">
                {userProfile.role}
              </span>
            </div>
            <ChevronDown
              className={`w-3.5 h-3.5 text-slate-400 hidden xl:block transition-transform duration-200 ${
                isProfileOpen ? 'rotate-180 text-blue-600' : ''
              }`}
            />
          </button>

          {/* Interactive Profile Dropdown Menu */}
          {isProfileOpen && (
            <div className="absolute right-0 mt-2.5 w-72 rounded-2xl bg-white border border-slate-200 shadow-xl shadow-slate-900/10 py-2 z-50 animate-in fade-in slide-in-from-top-2 duration-150">
              {/* Header Info */}
              <div className="px-4 py-3 border-b border-slate-100">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-sm flex items-center justify-center shadow-sm shrink-0">
                    {userProfile.avatarInitials || 'AV'}
                  </div>
                  <div className="truncate">
                    <div className="text-xs font-bold text-slate-900 truncate">
                      {userProfile.fullName}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono truncate">
                      {userProfile.email || 'recruiter@qualifyai.com'}
                    </div>
                  </div>
                </div>
                <div className="mt-2.5 flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 text-[10px] font-mono font-bold text-blue-700">
                    {userProfile.role || 'ORG_ADMIN'}
                  </span>
                  <span className="text-[10px] text-slate-400 font-medium">Enterprise Tenant HQ</span>
                </div>
              </div>

              {/* Navigation Actions */}
              <div className="py-1 px-1.5 text-xs text-slate-700 space-y-0.5">
                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    onNavigate?.('/jobs')
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Briefcase className="w-3.5 h-3.5 text-slate-500" />
                  <span>Job Requisitions</span>
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    onNavigate?.('/candidates')
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Users className="w-3.5 h-3.5 text-slate-500" />
                  <span>Candidate Pipeline</span>
                </button>
                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    onNavigate?.('/settings')
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left hover:bg-slate-50 flex items-center gap-2.5 transition cursor-pointer"
                >
                  <Settings className="w-3.5 h-3.5 text-slate-500" />
                  <span>Workspace Settings</span>
                </button>
              </div>

              {/* Sign Out Action */}
              <div className="pt-1 mt-1 border-t border-slate-100 px-1.5">
                <button
                  onClick={() => {
                    setIsProfileOpen(false)
                    onLogout?.()
                  }}
                  className="w-full px-3 py-2 rounded-xl text-left hover:bg-rose-50 text-rose-600 flex items-center gap-2.5 transition cursor-pointer font-semibold text-xs"
                >
                  <LogOut className="w-3.5 h-3.5 text-rose-500" />
                  <span>Sign Out</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Global Command / Search Palette Modal */}
      {isSearchOpen && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 backdrop-blur-xs flex items-start justify-center pt-20 px-4">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Search Input Bar */}
            <div className="p-3.5 border-b border-slate-100 flex items-center gap-3">
              <Search className="w-5 h-5 text-slate-400 shrink-0" />
              <input
                ref={searchInputRef}
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search candidates, roles, datasets, or benchmarks..."
                className="w-full text-sm font-medium text-slate-900 placeholder-slate-400 focus:outline-none"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="p-1 rounded-md text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
              <button
                onClick={() => setIsSearchOpen(false)}
                className="px-2 py-1 rounded bg-slate-100 text-[10px] font-mono text-slate-500 hover:bg-slate-200"
              >
                ESC
              </button>
            </div>

            {/* Results List */}
            <div className="max-h-80 overflow-y-auto p-2 space-y-1">
              <div className="px-3 py-1.5 text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400">
                {searchQuery ? 'Matching Results' : 'Quick Jump'}
              </div>

              {filteredResults.length === 0 ? (
                <div className="py-8 text-center text-xs text-slate-400">
                  No matching candidates, roles, or benchmarks found.
                </div>
              ) : (
                filteredResults.map((item) => (
                  <button
                    key={item.id}
                    onClick={() => handleSelectResult(item)}
                    className="w-full p-2.5 rounded-xl hover:bg-blue-50/70 text-left flex items-center gap-3 transition cursor-pointer group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-slate-100 group-hover:bg-blue-100/80 flex items-center justify-center shrink-0 text-slate-600 group-hover:text-blue-700">
                      {item.type === 'candidate' ? (
                        <Users className="w-4 h-4" />
                      ) : item.type === 'job' ? (
                        <Briefcase className="w-4 h-4" />
                      ) : (
                        <Layers className="w-4 h-4" />
                      )}
                    </div>
                    <div className="flex-1 truncate">
                      <div className="text-xs font-bold text-slate-900 group-hover:text-blue-600 truncate">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-400 truncate">
                        {item.subtitle}
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>

            {/* Footer with Hint */}
            <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100 text-[11px] text-slate-400 flex items-center justify-between">
              <span>Press <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">↑</kbd> <kbd className="font-mono bg-white px-1.5 py-0.5 rounded border border-slate-200 text-slate-600">↓</kbd> or click to navigate</span>
              <span className="font-mono text-[10px]">QualifyAI Global Index</span>
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
