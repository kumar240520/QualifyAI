import { authService } from '../services/authService.js'
import {
  assertValid,
  validateSignupPayload,
  validateLoginPayload,
  validateOnboardingPayload,
  validateEmail,
  validatePassword,
} from '../validators/index.js'
import { AuthenticationError } from '../utils/errors.js'

export const authController = {
  /**
   * Handle candidate/recruiter signup
   */
  async signup(req, res, next) {
    try {
      const validated = assertValid(validateSignupPayload(req.body))

      const result = await authService.signUpUser({
        email: validated.email,
        password: validated.password,
        fullName: validated.fullName,
        organizationName: validated.organizationName,
        role: validated.role,
      })

      return res.status(201).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Handle user login
   */
  async login(req, res, next) {
    try {
      const validated = assertValid(validateLoginPayload(req.body))

      const result = await authService.signInUser({
        email: validated.email,
        password: validated.password,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Initiate forgot password flow
   */
  async forgotPassword(req, res, next) {
    try {
      const emailRes = validateEmail(req.body?.email)
      if (!emailRes.valid) {
        assertValid(emailRes, 'Please enter a valid email address.')
      }

      const result = await authService.requestPasswordReset({
        email: emailRes.value,
        redirectTo: req.body?.redirectTo,
      })

      return res.status(200).json({
        success: true,
        message: result.message,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Reset / update password with token
   */
  async resetPassword(req, res, next) {
    try {
      const token =
        req.token ||
        (req.headers.authorization && req.headers.authorization.split(' ')[1]) ||
        req.body?.token

      if (!token) {
        throw new AuthenticationError('Authentication token required for password update.')
      }

      const passRes = validatePassword(req.body?.password, { min: 6 })
      if (!passRes.valid) {
        assertValid(passRes, 'Please choose a stronger password.')
      }

      const result = await authService.resetPassword({
        accessToken: token,
        newPassword: passRes.value,
      })

      return res.status(200).json({
        success: true,
        message: result.message,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Get current authenticated user details
   */
  async getMe(req, res, next) {
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
          isSubmitted: userDetails?.isSubmitted ?? user.isSubmitted ?? false,
          onboardingCompleted: userDetails?.onboardingCompleted ?? user.onboardingCompleted ?? false,
          organization: userDetails?.organization || null,
          profile: userDetails?.profile || null,
        },
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * Complete recruiter onboarding and persist profile & organization data
   */
  async completeOnboarding(req, res, next) {
    try {
      const user = req.user
      const validated = assertValid(validateOnboardingPayload(req.body))

      const token = req.token || (req.headers.authorization && req.headers.authorization.split(' ')[1])
      const result = await authService.updateOnboarding(user.id, validated, token)

      return res.status(200).json({
        success: true,
        message: 'Onboarding completed successfully.',
        data: result,
      })
    } catch (err) {
      next(err)
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
