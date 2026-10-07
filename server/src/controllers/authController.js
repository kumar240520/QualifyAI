import { authService } from '../services/authService.js'

export const authController = {
  /**
   * Handle candidate/recruiter signup
   */
  async signup(req, res) {
    try {
      const { email, password, fullName, organizationName, role } = req.body

      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid email address is required.' })
      }
      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, error: 'Password must be at least 6 characters long.' })
      }

      const result = await authService.signUpUser({
        email,
        password,
        fullName,
        organizationName,
        role: role || 'ORG_ADMIN',
      })

      return res.status(201).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[AuthController.signup] Error:', err.message)
      return res.status(400).json({
        success: false,
        error: err.message || 'Signup failed.',
      })
    }
  },

  /**
   * Handle user login
   */
  async login(req, res) {
    try {
      const { email, password } = req.body

      if (!email || !password) {
        return res.status(400).json({ success: false, error: 'Email and password are required.' })
      }

      const result = await authService.signInUser({ email, password })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[AuthController.login] Error:', err.message)
      return res.status(401).json({
        success: false,
        error: err.message || 'Invalid email or password.',
      })
    }
  },

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(req, res) {
    try {
      const { email, redirectTo } = req.body

      if (!email || !email.includes('@')) {
        return res.status(400).json({ success: false, error: 'Valid email address is required.' })
      }

      const result = await authService.requestPasswordReset({ email, redirectTo })

      return res.status(200).json({
        success: true,
        message: result.message,
      })
    } catch (err) {
      console.error('[AuthController.forgotPassword] Error:', err.message)
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to send password reset email.',
      })
    }
  },

  /**
   * Reset / update password with token
   */
  async resetPassword(req, res) {
    try {
      const token = req.token || (req.headers.authorization && req.headers.authorization.split(' ')[1]) || req.body.token
      const { password } = req.body

      if (!password || password.length < 6) {
        return res.status(400).json({ success: false, error: 'New password must be at least 6 characters long.' })
      }
      if (!token) {
        return res.status(401).json({ success: false, error: 'Authentication token required for password update.' })
      }

      const result = await authService.resetPassword({
        accessToken: token,
        newPassword: password,
      })

      return res.status(200).json({
        success: true,
        message: result.message,
      })
    } catch (err) {
      console.error('[AuthController.resetPassword] Error:', err.message)
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to update password.',
      })
    }
  },

  /**
   * Get current authenticated user details
   */
  async getMe(req, res) {
    try {
      const user = req.user
      const userDetails = await authService.getUserProfileAndOrg(user.id, req.token)

      return res.status(200).json({
        success: true,
        data: {
          id: user.id,
          email: user.email,
          fullName: userDetails?.profile?.full_name || user.fullName,
          role: userDetails?.profile?.role || user.role,
          organization: userDetails?.organization || null,
          profile: userDetails?.profile || null,
        },
      })
    } catch (err) {
      console.error('[AuthController.getMe] Error:', err.message)
      return res.status(500).json({
        success: false,
        error: 'Failed to retrieve user profile.',
      })
    }
  },

  /**
   * Complete recruiter onboarding and persist profile & organization data
   */
  async completeOnboarding(req, res) {
    try {
      const user = req.user
      const onboardingData = req.body || {}

      const result = await authService.updateOnboarding(user.id, onboardingData)

      return res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully.',
        data: result,
      })
    } catch (err) {
      console.error('[AuthController.completeOnboarding] Error:', err.message)
      return res.status(400).json({
        success: false,
        error: err.message || 'Failed to complete recruiter onboarding.',
      })
    }
  },

  /**
   * Handle user logout
   */
  async logout(req, res) {
    return res.status(200).json({
      success: true,
      message: 'Logged out successfully.',
    })
  },
}
