import React from 'react'
import Navbar from '../components/landing/Navbar.jsx'
import LandingChapterRail from '../components/navigation/LandingChapterRail.jsx'
import HeroSection from '../components/landing/HeroSection.jsx'
import TrustStrip from '../components/landing/TrustStrip.jsx'
import ProblemSection from '../components/landing/ProblemSection.jsx'
import WorkflowSection from '../components/landing/WorkflowSection.jsx'
import DualSidedSection from '../components/landing/DualSidedSection.jsx'
import JdIntelligenceSection from '../components/landing/JdIntelligenceSection.jsx'
import VoiceEngineSection from '../components/landing/VoiceEngineSection.jsx'
import ScorecardSection from '../components/landing/ScorecardSection.jsx'
import IntegritySection from '../components/landing/IntegritySection.jsx'
import LeaderboardSection from '../components/landing/LeaderboardSection.jsx'
import DiagnosticReportSection from '../components/landing/DiagnosticReportSection.jsx'
import TechSecuritySection from '../components/landing/TechSecuritySection.jsx'
import MetricsSection from '../components/landing/MetricsSection.jsx'
import CTASection from '../components/landing/CTASection.jsx'
import Footer from '../components/landing/Footer.jsx'

export default function LandingPage({ onOpenAuth }) {
  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans selection:bg-blue-500 selection:text-white">
      {/* 1. Header / Navbar */}
      <Navbar onOpenAuth={onOpenAuth} />

      {/* Floating Left Chapter Sidebar Navigation Rail */}
      <LandingChapterRail />

      {/* 2. Hero Section */}
      <HeroSection onOpenAuth={onOpenAuth} />

      {/* 3. Section 2: Trust & Capability Indicator Strip */}
      <TrustStrip />

      {/* 4. Section 3: The Recruitment Problem (Why Traditional Screening Fails) */}
      <ProblemSection />

      {/* 5. Section 4: 8-Step Autonomous Screening Workflow */}
      <WorkflowSection />

      {/* 6. Section 5: Dual-Sided Platform (Recruiter vs Candidate) */}
      <DualSidedSection onOpenAuth={onOpenAuth} />

      {/* 7. Section 6: Deep Dive: JD Intelligence & Calibrated Rubric */}
      <JdIntelligenceSection />

      {/* 8. Section 7: Real-Time AI Voice Engine */}
      <VoiceEngineSection />

      {/* 9. Section 8: Assessment & Multi-Dimensional Scorecard */}
      <ScorecardSection />

      {/* 10. Section 9: Assessment Integrity & Ethical Proctoring */}
      <IntegritySection />

      {/* 11. Section 10: Recruiter Leaderboard Preview */}
      <LeaderboardSection />

      {/* 12. Section 11: Candidate Diagnostic Report */}
      <DiagnosticReportSection onOpenAuth={onOpenAuth} />

      {/* 13. Section 12: Technology Architecture & Enterprise Security */}
      <TechSecuritySection />

      {/* 14. Section 13: Impact & Projected Metrics */}
      <MetricsSection />

      {/* 15. Section 14: Final Call To Action */}
      <CTASection onOpenAuth={onOpenAuth} />

      {/* 16. Footer */}
      <Footer />
    </div>
  )
}
