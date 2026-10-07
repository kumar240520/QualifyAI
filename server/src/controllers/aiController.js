import { generateContent, isGeminiConfigured } from '../integrations/geminiClient.js'
import { config } from '../config/env.js'

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
  async test(req, res) {
    try {
      if (!isGeminiConfigured()) {
        return res.status(400).json({
          success: false,
          error: 'GEMINI_API_KEY is not set. Please paste your key in server/.env.',
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
      console.error('[AIController.test] Error:', err.message)
      return res.status(500).json({
        success: false,
        error: err.message || 'Gemini generation failed.',
      })
    }
  },

  /**
   * General generation endpoint
   */
  async generate(req, res) {
    try {
      const { prompt, systemInstruction, model, temperature } = req.body

      if (!prompt) {
        return res.status(400).json({
          success: false,
          error: 'Prompt string is required.',
        })
      }

      const result = await generateContent({
        prompt,
        systemInstruction,
        model,
        temperature,
      })

      return res.status(200).json({
        success: true,
        data: result,
      })
    } catch (err) {
      console.error('[AIController.generate] Error:', err.message)
      return res.status(500).json({
        success: false,
        error: err.message || 'AI generation failed.',
      })
    }
  },
}
