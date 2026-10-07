import { GoogleGenAI } from '@google/genai'
import { AIProvider } from './AIProvider.js'
import { config } from '../../config/env.js'

/**
 * Resilient Google Gemini Provider implementation
 */
export class GeminiProvider extends AIProvider {
  constructor() {
    super('gemini')
    this.client = null
    this.fallbackModels = [
      'gemini-3.5-flash-lite',
      'gemini-flash-latest',
      'gemini-3.5-flash',
      'gemini-3.7-flash',
    ]
  }

  _getClient() {
    if (!config.gemini.apiKey) {
      throw new Error('GEMINI_API_KEY is not configured in server/.env.')
    }
    if (!this.client) {
      this.client = new GoogleGenAI({
        apiKey: config.gemini.apiKey,
      })
    }
    return this.client
  }

  isConfigured() {
    return Boolean(config.gemini.apiKey && config.gemini.apiKey.trim().length > 0)
  }

  /**
   * Generates text with automatic resilience failover across model candidates
   */
  async generateText({
    prompt,
    systemInstruction = 'You are QualifyAI, an expert technical interviewer and systems architect.',
    model,
    temperature = 0.7,
  }) {
    const ai = this._getClient()
    const primaryModel = model || config.gemini.defaultModel || 'gemini-flash-latest'
    const modelChain = [primaryModel, ...this.fallbackModels.filter((m) => m !== primaryModel)]

    let lastError = null

    for (const currentModel of modelChain) {
      try {
        const response = await ai.models.generateContent({
          model: currentModel,
          contents: prompt,
          config: {
            systemInstruction,
            temperature,
          },
        })

        return {
          text: response.text || '',
          model: currentModel,
          provider: 'gemini',
        }
      } catch (err) {
        lastError = err
        const isTransient =
          err?.message?.includes('503') ||
          err?.message?.includes('404') ||
          err?.message?.includes('experiencing high demand') ||
          err?.message?.includes('no longer available')

        if (isTransient) {
          console.warn(`[GeminiProvider] Transient error on ${currentModel}. Falling back to next candidate...`)
          continue
        }
        throw err
      }
    }

    throw lastError || new Error('All candidate Gemini models failed.')
  }

  /**
   * Generates clean structured JSON validated against expected format
   */
  async generateStructured({
    prompt,
    systemInstruction = 'You are QualifyAI. Always return strictly valid JSON matching the requested schema without markdown backticks or explanation.',
    schema,
    model,
  }) {
    const enrichedPrompt = schema
      ? `${prompt}\n\nYou must return strictly valid JSON adhering to this JSON Schema:\n${JSON.stringify(schema, null, 2)}`
      : `${prompt}\n\nYou must return strictly valid JSON without code blocks or extra text.`

    const result = await this.generateText({
      prompt: enrichedPrompt,
      systemInstruction,
      model,
      temperature: 0.2,
    })

    let cleaned = result.text.trim()
    if (cleaned.startsWith('```json')) {
      cleaned = cleaned.replace(/^```json\s*/, '').replace(/\s*```$/, '')
    } else if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```\s*/, '').replace(/\s*```$/, '')
    }

    try {
      const parsed = JSON.parse(cleaned)
      return {
        data: parsed,
        model: result.model,
        provider: 'gemini',
      }
    } catch (parseError) {
      console.error('[GeminiProvider.generateStructured] JSON parse failure on raw output:', cleaned)
      throw new Error(`Gemini response could not be parsed as valid JSON: ${parseError.message}`)
    }
  }

  /**
   * Candidate answer analysis implementation
   */
  async analyzeAnswer({
    question,
    expectedConcepts,
    candidateAnswer,
    skill = 'General Technical Competence',
    difficulty = 5,
  }) {
    const prompt = `Analyze this candidate's interview answer:
Question: ${question}
Target Skill: ${skill}
Difficulty: ${difficulty}/10
Expected Key Concepts: ${Array.isArray(expectedConcepts) ? expectedConcepts.join(', ') : expectedConcepts}
Candidate Answer: "${candidateAnswer}"

Evaluate and respond with a structured JSON object containing:
- "correctnessScore" (integer 0-100)
- "depthScore" (integer 0-100)
- "relevanceScore" (integer 0-100)
- "conceptsDetected" (array of strings)
- "missingConcepts" (array of strings)
- "confidence" (number between 0.0 and 1.0)
- "recommendedAction" ("FOLLOW_UP", "DEEPEN", "CLARIFY", "INCREASE_DIFFICULTY", "DECREASE_DIFFICULTY", "SWITCH_TOPIC", "MOVE_ON")
- "feedbackSummary" (string, max 2 sentences)
`
    const { data } = await this.generateStructured({ prompt })
    return data
  }

  /**
   * Question generation from criteria
   */
  async generateQuestion({
    skill,
    criterion,
    targetDifficulty = 5,
    previousQuestions = [],
  }) {
    const prompt = `Generate a rigorous technical interview question for the following competency:
Skill: ${skill}
Evaluation Criterion: ${criterion}
Target Difficulty Level: ${targetDifficulty}/10
Previous Questions Asked: ${JSON.stringify(previousQuestions)}

Ensure the question is novel, practical, and does not duplicate previous questions.
Respond with a structured JSON object containing:
- "questionText" (string)
- "skill" (string)
- "difficulty" (integer 1-10)
- "expectedConcepts" (array of strings, key points a strong engineer must mention)
- "evaluationRubric" (string, guidelines for scoring)
`
    const { data } = await this.generateStructured({ prompt })
    return data
  }
}
