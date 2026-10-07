import { aiOrchestrator } from './ai/index.js'
import { config } from '../config/env.js'

export { aiOrchestrator }

/**
 * Checks if the Gemini SDK has an API key configured.
 */
export function isGeminiConfigured() {
  return aiOrchestrator.isReady()
}

/**
 * High-level abstract content generation function.
 * Encapsulates the AI Orchestrator according to Rule 4.
 */
export async function generateContent({
  prompt,
  systemInstruction = 'You are QualifyAI, an expert technical interviewer and systems architect.',
  model,
  temperature = 0.7,
}) {
  const result = await aiOrchestrator.generateText({
    prompt,
    systemInstruction,
    model,
    temperature,
  })

  return {
    text: result.text,
    model: result.model,
    latencyMs: result.latencyMs,
  }
}

/**
 * Generate structured JSON response using AI Orchestrator.
 */
export async function generateStructuredJson({
  prompt,
  systemInstruction = 'You are QualifyAI. Always return strictly valid JSON matching the requested schema without markdown backticks or extra text.',
  schema,
  model,
}) {
  const result = await aiOrchestrator.generateStructured({
    prompt,
    systemInstruction,
    schema,
    model,
  })

  return result.data
}
