import React, { useState } from 'react'
import { motion } from 'motion/react'
import DashboardSidebar from '../components/navigation/DashboardSidebar.jsx'
import DashboardNavbar from '../components/navigation/DashboardNavbar.jsx'

/**
 * DashboardLayout
 * Synchronized layout shell coordinating DashboardSidebar, DashboardNavbar,
 * and the main content area with spring physics (stiffness: 350, damping: 30).
 */
export default function DashboardLayout({
  children,
  activePath = '/dashboard',
  onNavigate,
  onLogout,
  workspaceTitle = 'QualifyAI Requisitions',
  activeContext = 'Active Cohort • Senior Distributed Systems Engineer',
  userProfile = {
    fullName: 'Alex Vance',
    role: 'ORG_ADMIN',
    email: 'alex@enterprise.qualifyai.com',
    avatarInitials: 'AV',
  },
}) {
  const [isSidebarExpanded, setIsSidebarExpanded] = useState(false)
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans relative selection:bg-blue-500 selection:text-white">
      {/* 1. Global Synchronized Dashboard Sidebar */}
      <DashboardSidebar
        isExpanded={isSidebarExpanded}
        onExpandedChange={setIsSidebarExpanded}
        mobileOpen={mobileMenuOpen}
        onCloseMobile={() => setMobileMenuOpen(false)}
        activePath={activePath}
        onNavigate={(path) => {
          setMobileMenuOpen(false)
          onNavigate?.(path)
        }}
        onLogout={onLogout}
        userProfile={userProfile}
      />

      {/* 2. Top Dashboard Navbar (dynamically synchronized left offset on desktop) */}
      <motion.div
        animate={{
          left: isSidebarExpanded ? 260 : 72,
        }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="fixed top-0 right-0 z-40 max-lg:!left-0"
      >
        <DashboardNavbar
          onToggleSidebar={() => setMobileMenuOpen((prev) => !prev)}
          workspaceTitle={workspaceTitle}
          activeContext={activeContext}
          userProfile={userProfile}
          onLogout={onLogout}
          onNavigate={onNavigate}
        />
      </motion.div>

      {/* 3. Main Operational Content Shell (dynamically synchronized padding on desktop) */}
      <motion.main
        animate={{
          paddingLeft: isSidebarExpanded ? 260 : 72,
        }}
        transition={{ duration: 0.2, ease: [0.2, 0, 0, 1] }}
        className="flex-1 pt-16 max-lg:!pl-0"
      >
        <div className="max-w-[1720px] mx-auto p-4 sm:p-6 lg:p-8">
          {children}
        </div>
      </motion.main>
    </div>
  )
}
