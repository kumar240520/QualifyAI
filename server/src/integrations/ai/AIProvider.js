/**
 * Abstract AI Provider Interface Contract
 * 
 * Defines the vendor-agnostic specification that all AI service providers
 * (e.g. GeminiProvider, future OpenAIProvider, future Deepgram/ElevenLabs)
 * must implement. Application business logic interacts solely with this interface.
 */
export class AIProvider {
  constructor(name = 'base-provider') {
    this.name = name
  }

  /**
   * Check if provider is configured with credentials and available
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error('Method isConfigured() must be implemented by provider.')
  }

  /**
   * High-level text generation
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} [params.systemInstruction]
   * @param {string} [params.model]
   * @param {number} [params.temperature]
   * @returns {Promise<{ text: string, model: string, usage?: Object }>}
   */
  async generateText({ prompt, systemInstruction, model, temperature }) {
    throw new Error('Method generateText() must be implemented by provider.')
  }

  /**
   * Structured JSON generation with schema validation
   * @param {Object} params
   * @param {string} params.prompt
   * @param {string} [params.systemInstruction]
   * @param {Object} [params.schema]
   * @param {string} [params.model]
   * @returns {Promise<any>}
   */
  async generateStructured({ prompt, systemInstruction, schema, model }) {
    throw new Error('Method generateStructured() must be implemented by provider.')
  }

  /**
   * Candidate answer analysis
   * @param {Object} params
   * @param {string} params.question
   * @param {string} params.expectedConcepts
   * @param {string} params.candidateAnswer
   * @param {string} [params.skill]
   * @param {number} [params.difficulty]
   * @returns {Promise<Object>}
   */
  async analyzeAnswer(params) {
    throw new Error('Method analyzeAnswer() must be implemented by provider.')
  }

  /**
   * Question generation from rubric criteria
   * @param {Object} params
   * @param {string} params.skill
   * @param {string} params.criterion
   * @param {number} params.targetDifficulty
   * @param {string[]} [params.previousQuestions]
   * @returns {Promise<Object>}
   */
  async generateQuestion(params) {
    throw new Error('Method generateQuestion() must be implemented by provider.')
  }

  /**
   * Generate comprehensive candidate or recruiter evaluation report
   * @param {Object} params
   * @returns {Promise<Object>}
   */
  async generateReport(params) {
    throw new Error('Method generateReport() must be implemented by provider.')
  }
}
