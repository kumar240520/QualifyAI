import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  LayoutDashboard,
  BarChart3,
  Briefcase,
  Users,
  Database,
  Scale,
  Settings,
  UserCheck,
  LogOut,
  ChevronRight,
  X,
} from 'lucide-react'

const NAVIGATION_GROUPS = [
  {
    category: 'OVERVIEW',
    items: [
      { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, path: '/dashboard', badge: 'Live', badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
      { id: 'analytics', label: 'Cohort Analytics', icon: BarChart3, path: '/analytics' },
    ],
  },
  {
    category: 'HIRING PIPELINE',
    items: [
      { id: 'jobs', label: 'Job Requisitions', icon: Briefcase, path: '/jobs', badge: '12', badgeColor: 'bg-blue-50 text-blue-700 border-blue-200' },
      { id: 'candidates', label: 'Candidate Cohort', icon: Users, path: '/candidates', badge: '148', badgeColor: 'bg-slate-100 text-slate-700 border-slate-200' },
    ],
  },
  {
    category: 'EVALUATION & AUDIT',
    items: [
      { id: 'datasets', label: 'AI Training Datasets', icon: Database, path: '/datasets', badge: 'v1.0', badgeColor: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
      { id: 'benchmarks', label: 'Model Benchmarks', icon: Scale, path: '/benchmarks', badge: 'Eval', badgeColor: 'bg-amber-50 text-amber-700 border-amber-200' },
    ],
  },
  {
    category: 'ORGANIZATION',
    items: [
      { id: 'settings', label: 'Workspace Settings', icon: Settings, path: '/settings' },
      { id: 'team', label: 'Recruiter Seats', icon: UserCheck, path: '/team' },
    ],
  },
]

export default function DashboardSidebar({
  isExpanded: controlledExpanded,
  onExpandedChange,
  activePath = '/dashboard',
  onNavigate,
  onLogout,
  mobileOpen = false,
  onCloseMobile,
  userProfile = {
    fullName: 'Alex Vance',
    role: 'ORG_ADMIN',
    email: 'alex@enterprise.qualifyai.com',
    avatarInitials: 'AV',
  },
}) {
  const [internalExpanded, setInternalExpanded] = useState(false)
  const isExpanded = controlledExpanded !== undefined ? controlledExpanded : internalExpanded

  const handleMouseEnter = () => {
    if (controlledExpanded !== undefined) {
      onExpandedChange?.(true)
    } else {
      setInternalExpanded(true)
    }
  }

  const handleMouseLeave = () => {
    if (controlledExpanded !== undefined) {
      onExpandedChange?.(false)
    } else {
      setInternalExpanded(false)
    }
  }

  return (
    <>
      {/* Mobile Backdrop Overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onCloseMobile}
            className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-50 lg:hidden"
            aria-hidden="true"
          />
        )}
      </AnimatePresence>

      {/* Sidebar Rail */}
      <aside
        aria-label="Dashboard global navigation"
        onMouseEnter={handleMouseEnter}
        onMouseLeave={handleMouseLeave}
        className={`fixed left-0 top-0 bottom-0 z-50 bg-white border-r border-slate-200/90 shadow-[4px_0_24px_rgba(15,23,42,0.05)] flex flex-col transition-[width,transform] duration-200 ease-out select-none ${
          mobileOpen
            ? 'translate-x-0 w-[260px]'
            : '-translate-x-full lg:translate-x-0'
        }`}
        style={{
          width: undefined,
          ...(typeof window !== 'undefined' && window.innerWidth >= 1024
            ? { width: isExpanded ? '260px' : '72px' }
            : {}),
        }}
      >
        {/* 1. Fixed Brand Header (72px) */}
        <div className="h-[72px] shrink-0 border-b border-slate-200/80 flex items-center px-4 gap-3 overflow-hidden bg-white justify-between">
          <div className="flex items-center gap-3 overflow-hidden">
            <button
              onClick={() => onExpandedChange?.(!isExpanded)}
              title={isExpanded ? 'Collapse Sidebar' : 'Expand Sidebar'}
              className="w-10 h-10 shrink-0 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/25 transition-transform duration-200 hover:scale-105 cursor-pointer focus:outline-none"
            >
              <Sparkles className="w-5 h-5 text-white" />
            </button>

            <AnimatePresence>
              {(isExpanded || mobileOpen) && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.15 }}
                  className="flex-1 flex flex-col truncate"
                >
                  <span className="font-heading font-extrabold text-lg tracking-tight text-slate-900 leading-tight">
                    Qualify<span className="text-blue-600">AI</span>
                  </span>
                  <span className="text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
                    Recruiter Portal
                  </span>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Toggle button on desktop when expanded */}
          {isExpanded && !mobileOpen && (
            <button
              onClick={() => onExpandedChange?.(false)}
              title="Collapse Sidebar"
              className="hidden lg:flex p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <ChevronRight className="w-4 h-4 rotate-180" />
            </button>
          )}

          {/* Close button for mobile drawer */}
          {mobileOpen && (
            <button
              onClick={onCloseMobile}
              aria-label="Close navigation"
              className="lg:hidden ml-auto p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* 2. Scrollable Navigation Region (No visible scrollbar) */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden py-4 px-2.5 space-y-6 [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {NAVIGATION_GROUPS.map((group) => (
            <div key={group.category} className="space-y-1">
              {/* Category Header (visible only when expanded or on mobile open) */}
              <AnimatePresence>
                {(isExpanded || mobileOpen) && (
                  <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.15 }}
                    className="px-3 pb-1 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase"
                  >
                    {group.category}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Group Navigation Items */}
              {group.items.map((item) => {
                const isActive = activePath === item.path
                const Icon = item.icon

                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      onNavigate?.(item.path)
                      onCloseMobile?.()
                    }}
                    title={!(isExpanded || mobileOpen) ? item.label : undefined}
                    className={`w-full h-11 rounded-xl flex items-center px-3 gap-3 transition-all duration-150 group relative text-left overflow-hidden ${
                      isActive
                        ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 font-semibold'
                    }`}
                  >
                    {/* Icon Container */}
                    <div className="w-5 h-5 shrink-0 flex items-center justify-center">
                      <Icon
                        className={`w-5 h-5 transition-transform duration-200 group-hover:scale-110 ${
                          isActive ? 'text-white' : 'text-slate-500 group-hover:text-blue-600'
                        }`}
                      />
                    </div>

                    {/* Label and Semantic Badge */}
                    <AnimatePresence>
                      {(isExpanded || mobileOpen) && (
                        <motion.div
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: -6 }}
                          transition={{ duration: 0.18 }}
                          className="flex-1 flex items-center justify-between truncate"
                        >
                          <span className="text-xs truncate">{item.label}</span>

                          {item.badge && (
                            <span
                              className={`text-[10px] font-mono font-bold px-1.5 py-0.5 rounded-full border ${
                                isActive
                                  ? 'bg-white/20 text-white border-white/30'
                                  : item.badgeColor || 'bg-slate-100 text-slate-600 border-slate-200'
                              }`}
                            >
                              {item.badge}
                            </span>
                          )}
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </button>
                )
              })}
            </div>
          ))}
        </div>

        {/* 3. Fixed Identity & Actions Region */}
        <div className="shrink-0 p-3 border-t border-slate-200/80 bg-slate-50/50">
          <div
            className={`rounded-2xl border border-slate-200 bg-white p-2 flex items-center transition-all ${
              isExpanded || mobileOpen ? 'gap-3' : 'justify-center'
            }`}
          >
            {/* User Avatar */}
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white font-bold text-xs flex items-center justify-center shrink-0 shadow-sm">
              {userProfile.avatarInitials || 'AV'}
            </div>

            {/* User Metadata */}
            <AnimatePresence>
              {(isExpanded || mobileOpen) && (
                <motion.div
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -6 }}
                  transition={{ duration: 0.18 }}
                  className="flex-1 truncate"
                >
                  <div className="text-xs font-bold text-slate-900 truncate">
                    {userProfile.fullName}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[9px] font-mono font-bold px-1.5 py-0.2 rounded bg-blue-50 text-blue-700 border border-blue-200">
                      {userProfile.role}
                    </span>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Logout Action */}
            {(isExpanded || mobileOpen) && (
              <button
                onClick={onLogout}
                title="Sign Out"
                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </aside>
    </>
  )
}
