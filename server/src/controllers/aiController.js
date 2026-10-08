import { generateContent, isGeminiConfigured } from '../integrations/geminiClient.js'
import { config } from '../config/env.js'
import { ValidationError } from '../utils/errors.js'

export const aiController = {
  /**
   * Check Gemini SDK configuration status
   */
  async getStatus(req, res) {
    const configured = isGeminiConfigured()
    return res.status(200).json({
      success: true,
      configured,
      provider: 'Google Gemini',
      model: config.gemini.defaultModel,
      message: configured
        ? 'Gemini SDK is configured and ready.'
        : 'GEMINI_API_KEY is not configured in server/.env yet.',
    })
  },

  /**
   * Test generation endpoint for verification
   */
  async test(req, res, next) {
    try {
      if (!isGeminiConfigured()) {
        return res.status(503).json({
          success: false,
          error: {
            code: 'AI_SERVICE_UNAVAILABLE',
            message: 'AI Service is not configured yet. Please configure GEMINI_API_KEY in server environment.',
          },
        })
      }

      const prompt = req.body.prompt || 'Explain distributed consensus in one concise sentence for a systems engineer.'
      const result = await generateContent({ prompt })

      return res.status(200).json({
        success: true,
        prompt,
        model: result.model,
        answer: result.text,
      })
    } catch (err) {
      next(err)
    }
  },

  /**
   * General generation endpoint
   */
  async generate(req, res, next) {
    try {
      const { prompt, systemInstruction, model, temperature } = req.body

      if (!prompt || typeof prompt !== 'string' || !prompt.trim()) {
        throw new ValidationError({ prompt: 'Prompt is required and cannot be empty.' })
      }

      const result = await generateContent({
        prompt: prompt.trim(),
        systemInstruction,
        model,
        temperature,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      next(err)
    }
  },
}
