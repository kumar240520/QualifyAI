import React, { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'motion/react'
import {
  Sparkles,
  Building2,
  ShieldCheck,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Briefcase,
  Users,
  Check,
  Lock,
  Globe,
  Sliders,
  Award,
  HelpCircle,
  FileCheck,
  AlertCircle,
} from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { normalizeApiError } from '../utils/errorNormalizer.js'
import {
  validateRecruiterOnboarding,
  validateName,
  validateText,
  validateEmail,
  validateUrl,
  validatePhone,
} from '../utils/validators.js'

const INDUSTRY_DOMAINS = [
  'Enterprise SaaS & Cloud Infrastructure',
  'FinTech & Quantitative Trading',
  'Artificial Intelligence & Machine Learning',
  'CyberSecurity & Identity Systems',
  'HealthTech & Medical Systems',
  'Consumer Tech & Mobile Platforms',
]

const COMPANY_SIZES = [
  '1 – 20 employees (Seed / Early Stage)',
  '21 – 100 employees (Growth)',
  '101 – 500 employees (Scale-Up)',
  '501 – 2,000 employees (Mid-Market)',
  '2,000+ employees (Global Enterprise)',
]

const TARGET_ROLES = [
  'Distributed Systems Engineers',
  'Senior Backend (Go / Rust / Java)',
  'Full-Stack Engineers (React / Node)',
  'AI / ML & LLM Platform Engineers',
  'DevOps, SRE & Cloud Architects',
  'Engineering Managers & Technical Leads',
]

/**
 * Recruiter Onboarding Wizard and Persistent Account Activation
 * Implements the unskippable 3-step onboarding contract:
 * - Step 1: Organization Profile & Recruiter Identity
 * - Step 2: Verification (KYC) & Assessment Configuration
 * - Step 3: Finish & Enterprise Workspace Activation
 */
export default function RecruiterOnboardingPage() {
  const { user, completeOnboarding } = useAuth()
  const navigate = useNavigate()

  // Redirect if already submitted or onboarded
  useEffect(() => {
    if (user?.isSubmitted || user?.onboardingCompleted) {
      navigate('/dashboard', { replace: true })
    }
  }, [user?.isSubmitted, user?.onboardingCompleted, navigate])

  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errorMsg, setErrorMsg] = useState('')
  const [fieldErrors, setFieldErrors] = useState({})

  // Form State (with pre-fill and local draft recovery)
  const [formData, setFormData] = useState(() => {
    const draft = localStorage.getItem(`qualifyai_onboarding_draft_${user?.id}`)
    if (draft) {
      try {
        return JSON.parse(draft)
      } catch (e) {}
    }
    return {
      fullName: user?.fullName || '',
      workEmail: user?.email || '',
      companyName: user?.organizationName && user.organizationName !== "My's Organization" ? user.organizationName : '',
      industry: INDUSTRY_DOMAINS[0],
      companySize: COMPANY_SIZES[2],
      recruiterRole: 'Technical Talent Acquisition Lead',
      phone: '',
      location: 'San Francisco, CA (PST)',
      website: '',
      selectedRoles: ['Distributed Systems Engineers', 'Senior Backend (Go / Rust / Java)'],
      rigorLevel: 'Rigorous Senior Probing',
      proctoringLevel: 'High Rigor (Tab Switch + Real-Time Telemetry)',
      interviewDuration: '20 Minutes',
      termsAccepted: false,
    }
  })

  // Save draft on changes
  useEffect(() => {
    if (user?.id) {
      localStorage.setItem(`qualifyai_onboarding_draft_${user.id}`, JSON.stringify(formData))
    }
  }, [formData, user?.id])

  const updateField = (field, value) => {
    setFormData((prev) => ({ ...prev, [field]: value }))
    setErrorMsg('')
    if (fieldErrors[field]) {
      setFieldErrors((prev) => ({ ...prev, [field]: null }))
    }
  }

  const toggleRole = (role) => {
    setFormData((prev) => {
      const exists = prev.selectedRoles.includes(role)
      return {
        ...prev,
        selectedRoles: exists
          ? prev.selectedRoles.filter((r) => r !== role)
          : [...prev.selectedRoles, role],
      }
    })
    if (fieldErrors.selectedRoles) {
      setFieldErrors((prev) => ({ ...prev, selectedRoles: null }))
    }
    setErrorMsg('')
  }

  // Step 1 Validation
  const validateStep1 = () => {
    const errors = {}
    const nameRes = validateName(formData.fullName, 'Full legal name', { min: 2, max: 100 })
    if (!nameRes.valid) errors.fullName = nameRes.error

    const compRes = validateText(formData.companyName, 'Company name', { min: 2, max: 150, required: true })
    if (!compRes.valid) errors.companyName = compRes.error

    const emailRes = validateEmail(formData.workEmail, 'Work email')
    if (!emailRes.valid) errors.workEmail = emailRes.error

    if (formData.phone) {
      const phoneRes = validatePhone(formData.phone, { required: false })
      if (!phoneRes.valid) errors.phone = phoneRes.error
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    }
  }

  // Step 2 Validation
  const validateStep2 = () => {
    const errors = {}
    const webRes = validateUrl(formData.website, 'Company domain or website', { required: true })
    if (!webRes.valid) errors.website = webRes.error

    if (!Array.isArray(formData.selectedRoles) || formData.selectedRoles.length === 0) {
      errors.selectedRoles = 'Please select at least one target engineering role.'
    }

    return {
      isValid: Object.keys(errors).length === 0,
      errors,
    }
  }

  const handleNext = () => {
    if (currentStep === 1) {
      const v = validateStep1()
      if (!v.isValid) {
        setFieldErrors(v.errors)
        setErrorMsg('Please complete all required fields correctly before proceeding.')
        return
      }
      setFieldErrors({})
      setErrorMsg('')
      setCurrentStep(2)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    } else if (currentStep === 2) {
      const v = validateStep2()
      if (!v.isValid) {
        setFieldErrors(v.errors)
        setErrorMsg('Please complete all required verification fields before proceeding.')
        return
      }
      setFieldErrors({})
      setErrorMsg('')
      setCurrentStep(3)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  const handleBack = () => {
    setErrorMsg('')
    setFieldErrors({})
    if (currentStep > 1) {
      setCurrentStep((prev) => prev - 1)
      window.scrollTo({ top: 0, behavior: 'smooth' })
    }
  }

  // Step 3: Final Activation
  const handleActivateAccount = async () => {
    if (!formData.termsAccepted) {
      setErrorMsg('Please confirm that you represent this organization to activate your workspace.')
      return
    }

    const v = validateRecruiterOnboarding(formData)
    if (!v.isValid) {
      setFieldErrors(v.errors)
      setErrorMsg('Some required onboarding information is missing. Please review previous steps.')
      return
    }

    setIsSubmitting(true)
    setErrorMsg('')
    setFieldErrors({})
    try {
      const success = await completeOnboarding(formData)
      if (success) {
        // Clear draft
        if (user?.id) {
          localStorage.removeItem(`qualifyai_onboarding_draft_${user.id}`)
        }
        navigate('/dashboard', { replace: true })
      } else {
        setErrorMsg('Failed to activate account. Please try again.')
      }
    } catch (err) {
      console.error('Account activation error:', err)
      const norm = normalizeApiError(err, 'An unexpected error occurred during account activation.')
      setErrorMsg(norm.message)
      setFieldErrors(norm.fields || {})
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="h-screen w-screen bg-[#f8fafc] text-slate-900 font-sans flex flex-col overflow-hidden selection:bg-blue-600 selection:text-white">
      {/* Top Header */}
      <header className="h-14 px-6 border-b border-slate-200/90 bg-white flex items-center justify-between shrink-0 z-20">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-blue-600 via-indigo-600 to-cyan-500 flex items-center justify-center shadow-md shadow-blue-500/20 text-white">
            <Sparkles className="w-4 h-4" />
          </div>
          <div>
            <span className="font-heading font-extrabold text-sm tracking-tight text-slate-900">
              Qualify<span className="text-blue-600">AI</span>
            </span>
            <span className="hidden sm:inline-block ml-2 text-[10px] font-mono font-bold tracking-widest text-slate-400 uppercase">
              Recruiter Workspace Onboarding
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-slate-50 border border-slate-200 text-[11px] font-mono text-slate-500">
            <Lock className="w-3.5 h-3.5 text-blue-600" />
            <span>256-Bit Encrypted & Tenant Isolated</span>
          </div>
        </div>
      </header>

      {/* Main 2-Column Split Workspace (Strictly fits screen without page scrolling) */}
      <main className="flex-1 grid grid-cols-1 lg:grid-cols-12 overflow-hidden">
        {/* LEFT COLUMN: Workspace Context, Stepper & Security Specs */}
        <div className="lg:col-span-4 bg-white border-r border-slate-200/90 p-6 sm:p-7 flex flex-col justify-between overflow-y-auto">
          <div className="space-y-5">
            {/* Context Card */}
            <div className="p-4 rounded-2xl bg-gradient-to-b from-blue-50/50 via-slate-50/50 to-white border border-slate-200/80 space-y-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-blue-100/70 border border-blue-200 flex items-center justify-center text-blue-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <h2 className="text-sm font-heading font-extrabold text-slate-900 leading-tight">
                    {formData.companyName || 'Hiring Organization'}
                  </h2>
                  <span className="text-[10px] font-mono text-slate-400">
                    Enterprise Workspace Setup
                  </span>
                </div>
              </div>
              <p className="text-[11px] text-slate-500 leading-relaxed">
                Configure your organization profile to calibrate isolated voice AI evaluators and applicant proctoring telemetry.
              </p>
            </div>

            {/* 3-Step Vertical Stepper */}
            <div className="space-y-2.5">
              <div className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                Onboarding Stages
              </div>

              <div className="space-y-2">
                {[
                  { step: 1, title: 'Company & Identity', desc: 'Organization details & recruiter role' },
                  { step: 2, title: 'Verification & Scope', desc: 'Domain verification & interview rigor' },
                  { step: 3, title: 'Confirm & Launch', desc: 'Activate encrypted hiring workspace' },
                ].map((s) => (
                  <div
                    key={s.step}
                    className={`p-3 rounded-xl border flex items-center gap-3 transition-all ${
                      currentStep === s.step
                        ? 'bg-blue-50/80 border-blue-200 text-blue-900 shadow-2xs'
                        : currentStep > s.step
                        ? 'bg-emerald-50/60 border-emerald-200 text-emerald-900'
                        : 'bg-slate-50/60 border-slate-200 text-slate-400'
                    }`}
                  >
                    <div
                      className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${
                        currentStep === s.step
                          ? 'bg-blue-600 text-white'
                          : currentStep > s.step
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {currentStep > s.step ? '✓' : s.step}
                    </div>
                    <div className="min-w-0">
                      <div className="text-xs font-bold leading-tight">{s.title}</div>
                      <div className="text-[10px] opacity-80 truncate">{s.desc}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Enterprise Benefits */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200/80 space-y-2">
              <div className="text-[10px] font-mono font-bold text-slate-500 uppercase tracking-wider">
                Provisioned Capabilities
              </div>
              <div className="space-y-1.5 text-xs text-slate-600">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Real-Time Voice AI Assessment</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Gemini Competency Rubrics</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Anti-Cheating Telemetry & Full-Screen</span>
                </div>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                  <span>Multi-Tenant Isolated Database</span>
                </div>
              </div>
            </div>
          </div>

          {/* Left Footer: Alert */}
          <div className="pt-3 border-t border-slate-100">
            <div className="p-3 rounded-xl bg-amber-50/80 border border-amber-200 text-amber-900 text-[11px] flex items-center gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
              <span>Dashboard access unlocks upon Step 3 activation.</span>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Interactive Step Surface (Fitted Card, No Full-Page Scroll) */}
        <div className="lg:col-span-8 bg-[#f8fafc] p-6 sm:p-8 flex flex-col justify-center overflow-y-auto">
          {/* STEP 1: Organization & Identity */}
          {currentStep === 1 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full">
              <div className="space-y-4">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 1 of 3
                  </span>
                  <h1 className="text-xl font-heading font-extrabold text-slate-900 tracking-tight mt-0.5">
                    Organization Profile & Recruiter Identity
                  </h1>
                  <p className="text-xs text-slate-500">
                    Provide the official details for your hiring organization and recruiter seat.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Full Legal Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.fullName}
                      onChange={(e) => updateField('fullName', e.target.value)}
                      placeholder="e.g. Sarah Jenkins"
                      className={`w-full h-10 px-3 bg-slate-50 border ${
                        fieldErrors.fullName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                      } rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition`}
                    />
                    {fieldErrors.fullName && (
                      <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.fullName}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Work Email Address <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="email"
                      value={formData.workEmail}
                      onChange={(e) => updateField('workEmail', e.target.value)}
                      placeholder="sjenkins@enterprise.com"
                      className={`w-full h-10 px-3 bg-slate-50 border ${
                        fieldErrors.workEmail ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                      } rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition`}
                    />
                    {fieldErrors.workEmail && (
                      <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.workEmail}</p>
                    )}
                  </div>

                  <div className="space-y-1 sm:col-span-2">
                    <label className="text-xs font-semibold text-slate-700">
                      Company / Organization Name <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      value={formData.companyName}
                      onChange={(e) => updateField('companyName', e.target.value)}
                      placeholder="e.g. Acme Distributed Technologies"
                      className={`w-full h-10 px-3 bg-slate-50 border ${
                        fieldErrors.companyName ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                      } rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition`}
                    />
                    {fieldErrors.companyName && (
                      <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.companyName}</p>
                    )}
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Industry Domain</label>
                    <select
                      value={formData.industry}
                      onChange={(e) => updateField('industry', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                    >
                      {INDUSTRY_DOMAINS.map((ind) => (
                        <option key={ind} value={ind}>
                          {ind}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Company Size</label>
                    <select
                      value={formData.companySize}
                      onChange={(e) => updateField('companySize', e.target.value)}
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                    >
                      {COMPANY_SIZES.map((size) => (
                        <option key={size} value={size}>
                          {size}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Your Role / Title</label>
                    <input
                      type="text"
                      value={formData.recruiterRole}
                      onChange={(e) => updateField('recruiterRole', e.target.value)}
                      placeholder="e.g. Lead Technical Recruiter"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">Primary Office Location</label>
                    <input
                      type="text"
                      value={formData.location}
                      onChange={(e) => updateField('location', e.target.value)}
                      placeholder="e.g. San Francisco, CA"
                      className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                    />
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <span className="text-[11px] text-slate-400">Step 1 of 3 • Organization Profile</span>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Proceed to Verification (KYC)</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: KYC & Assessment Calibration */}
          {currentStep === 2 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full">
              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 2 of 3
                  </span>
                  <h1 className="text-xl font-heading font-extrabold text-slate-900 tracking-tight mt-0.5">
                    Verification (KYC) & Assessment Calibration
                  </h1>
                  <p className="text-xs text-slate-500">
                    Verify company domain ownership and establish default interview parameters.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-semibold text-slate-700">
                      Official Company Domain / Website <span className="text-rose-500">*</span>
                    </label>
                    <div className="relative flex items-center">
                      <Globe className="w-3.5 h-3.5 text-slate-400 absolute left-3 pointer-events-none" />
                      <input
                        type="text"
                        value={formData.website}
                        onChange={(e) => updateField('website', e.target.value)}
                        placeholder="https://acme.io"
                        className={`w-full h-10 pl-9 pr-3 bg-slate-50 border ${
                          fieldErrors.website ? 'border-rose-400 bg-rose-50/20' : 'border-slate-200'
                        } rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition`}
                      />
                    </div>
                    {fieldErrors.website && (
                      <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.website}</p>
                    )}
                  </div>

                  {/* Target Roles Multi-Select */}
                  <div className="space-y-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Target Engineering Disciplines <span className="text-rose-500">*</span>
                    </label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
                      {TARGET_ROLES.map((role) => {
                        const isSelected = formData.selectedRoles.includes(role)
                        return (
                          <button
                            type="button"
                            key={role}
                            onClick={() => toggleRole(role)}
                            className={`p-2 rounded-xl border text-left text-[11px] font-medium transition cursor-pointer flex items-center justify-between ${
                              isSelected
                                ? 'bg-blue-50/70 border-blue-500 text-blue-900 font-semibold'
                                : 'bg-slate-50/50 border-slate-200 text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            <span className="truncate">{role}</span>
                            {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0" />}
                          </button>
                        )
                      })}
                    </div>
                    {fieldErrors.selectedRoles && (
                      <p className="text-[11px] text-rose-500 font-medium mt-0.5">{fieldErrors.selectedRoles}</p>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Evaluation Rigor</label>
                      <select
                        value={formData.rigorLevel}
                        onChange={(e) => updateField('rigorLevel', e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                      >
                        <option value="Standard Technical Evaluation">Standard Technical Evaluation</option>
                        <option value="Rigorous Senior Probing">Rigorous Senior Probing (Adaptive)</option>
                        <option value="Staff / Principal Architect Level">Staff / Principal Architect Level</option>
                      </select>
                    </div>

                    <div className="space-y-1">
                      <label className="text-xs font-semibold text-slate-700">Proctoring Telemetry</label>
                      <select
                        value={formData.proctoringLevel}
                        onChange={(e) => updateField('proctoringLevel', e.target.value)}
                        className="w-full h-10 px-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-medium text-slate-900 focus:bg-white focus:border-blue-500 focus:outline-none transition"
                      >
                        <option value="Standard Integrity">Standard Integrity (Browser Focus)</option>
                        <option value="High Rigor (Tab Switch + Real-Time Telemetry)">
                          High Rigor (Tab Switch + Telemetry)
                        </option>
                        <option value="Maximum Strictness">Maximum Strictness (Audio + Flagging)</option>
                      </select>
                    </div>
                  </div>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={handleBack}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition flex items-center gap-1 cursor-pointer"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>
                <button
                  onClick={handleNext}
                  className="px-5 py-2.5 rounded-xl bg-slate-900 hover:bg-black text-white text-xs font-semibold shadow-sm transition flex items-center gap-1.5 cursor-pointer"
                >
                  <span>Review & Activate</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          )}

          {/* STEP 3: Review, Finish & Activation */}
          {currentStep === 3 && (
            <div className="bg-white border border-slate-200/90 rounded-2xl p-6 sm:p-7 shadow-xs flex-1 flex flex-col justify-between max-w-2xl mx-auto w-full">
              <div className="space-y-3.5">
                <div>
                  <span className="text-[10px] font-mono font-bold text-blue-600 uppercase tracking-widest">
                    Step 3 of 3 • Final Step
                  </span>
                  <h1 className="text-xl font-heading font-extrabold text-slate-900 tracking-tight mt-0.5">
                    Confirm & Activate Recruiter Workspace
                  </h1>
                  <p className="text-xs text-slate-500">
                    Review your workspace specifications and activate your account to launch the recruiter dashboard.
                  </p>
                </div>

                {errorMsg && (
                  <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                {/* Provisioning Summary Card */}
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-mono font-bold text-slate-400 uppercase tracking-wider">
                      Workspace Manifest
                    </span>
                    <span className="px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px] font-mono font-bold">
                      READY TO ACTIVATE
                    </span>
                  </div>

                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div>
                      <span className="text-slate-400 block text-[10px]">Organization:</span>
                      <strong className="text-slate-900 font-semibold">{formData.companyName}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Recruiter Lead:</span>
                      <strong className="text-slate-900 font-semibold">{formData.fullName} ({formData.recruiterRole})</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Domain Verification:</span>
                      <strong className="text-slate-900 font-semibold">{formData.website}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block text-[10px]">Proctoring Rigor:</span>
                      <strong className="text-slate-900 font-semibold">{formData.proctoringLevel}</strong>
                    </div>
                  </div>

                  <div className="pt-2 border-t border-slate-200/70">
                    <span className="text-slate-400 block text-[10px] mb-1">Target Disciplines:</span>
                    <div className="flex flex-wrap gap-1">
                      {formData.selectedRoles.map((r, i) => (
                        <span
                          key={i}
                          className="px-2 py-0.5 rounded-md bg-white border border-slate-200 text-[10px] font-medium text-slate-700"
                        >
                          {r}
                        </span>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Terms Agreement Checkbox */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white">
                  <label className="flex items-start gap-2.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={formData.termsAccepted}
                      onChange={(e) => updateField('termsAccepted', e.target.checked)}
                      className="mt-0.5 w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500 cursor-pointer"
                    />
                    <div className="text-xs text-slate-700 leading-relaxed">
                      I confirm that I am an authorized recruiter representing <strong>{formData.companyName || 'this organization'}</strong>. I authorize QualifyAI to provision encrypted interview staging tokens and calibrate AI evaluators according to our organization specifications.
                    </div>
                  </label>
                </div>
              </div>

              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                <button
                  onClick={handleBack}
                  disabled={isSubmitting}
                  className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 text-xs font-semibold transition flex items-center gap-1 cursor-pointer disabled:opacity-50"
                >
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>Back</span>
                </button>

                <button
                  onClick={handleActivateAccount}
                  disabled={isSubmitting}
                  className="px-6 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white text-xs font-bold shadow-md shadow-blue-500/25 transition flex items-center gap-2 cursor-pointer disabled:opacity-60"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      <span>Activating Workspace...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Activate Recruiter Account & Launch Dashboard</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
