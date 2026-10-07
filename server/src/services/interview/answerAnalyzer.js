import { aiOrchestrator } from '../../integrations/ai/index.js'

/**
 * Enterprise AI Candidate Answer Analyzer
 * Evaluates candidate responses against rubric criteria and expected concepts.
 */
export const answerAnalyzer = {
  /**
   * Analyze candidate response using Google Gemini
   */
  async analyzeAnswer({ question, rubricCriterion, candidateAnswer, previousContext = [] }) {
    if (!candidateAnswer || candidateAnswer.trim().length === 0) {
      return {
        correctness: 1,
        relevance: 1,
        depth: 1,
        concepts_detected: [],
        missing_concepts: question?.metadata?.expected_concepts || [],
        confidence: 1.0,
        skill_estimate: 'NOVICE',
        feedback_summary: 'Candidate provided empty or silence response.',
        strengths: [],
        weaknesses: ['No answer was provided.'],
        claims_requiring_verification: [],
        topics_mentioned: [],
        skills_demonstrated: [],
        skills_not_demonstrated: [],
      }
    }

    const expectedConcepts = question?.metadata?.expected_concepts || []
    const guidance = rubricCriterion?.evaluation_guidance || {}

    const prompt = `You are the QualifyAI evidence analyst. Evaluate this candidate response strictly against the rubric and expected concepts. Provide evidence only; do not decide or write the next question:

Question:
"""
${question?.question_text}
"""
Question Difficulty: ${question?.difficulty || 'MEDIUM'}
Rubric Criterion: ${rubricCriterion?.name || 'Technical Depth'}
Expected Competency: ${rubricCriterion?.expected_competency || 'Demonstrate solid production systems knowledge'}
Level 1 (Novice benchmark): ${guidance.level1 || 'Superficial answers, confusion of core concepts'}
Level 3 (Competent benchmark): ${guidance.level3 || 'Working knowledge of fundamentals and typical trade-offs'}
Level 5 (Expert benchmark): ${guidance.level5 || 'Deep architectural mastery, failure modes, edge-case mitigation'}

Expected Key Concepts to verify:
- ${expectedConcepts.join('\n- ') || 'System trade-offs, scalability, failure modes'}

Candidate's Answer:
"""
${candidateAnswer}
"""

Prior committed answer evidence:
${JSON.stringify(previousContext.slice(-8))}

Task: Perform an objective, evidence-based technical analysis.
Evaluate:
1. correctness (1-10 integer): Technical accuracy of statements
2. relevance (1-10 integer): Did they answer the specific question asked?
3. depth (1-10 integer): Thoroughness, trade-off analysis, edge-case consideration
4. concepts_detected: Array of expected and emergent technical concepts the candidate correctly explained
5. missing_concepts: Array of key concepts that the candidate failed to mention or glossed over
6. confidence (0.0 to 1.0 float): Evaluator confidence in this assessment
7. skill_estimate ('NOVICE' | 'COMPETENT' | 'EXPERT')
8. feedback_summary: 1-2 sentence evidence-based summary of strengths and omissions
10. strengths, weaknesses, claims_requiring_verification, topics_mentioned, skills_demonstrated, skills_not_demonstrated: concise evidence tags

Respond strictly with a valid JSON object matching this schema:
{
  "correctness": 8,
  "relevance": 9,
  "depth": 7,
  "concepts_detected": ["concept1", "concept2"],
  "missing_concepts": ["concept3"],
  "confidence": 0.95,
  "skill_estimate": "COMPETENT",
  "feedback_summary": "string",
  "strengths": ["string"],
  "weaknesses": ["string"],
  "claims_requiring_verification": ["string"],
  "topics_mentioned": ["string"],
  "skills_demonstrated": ["string"],
  "skills_not_demonstrated": ["string"]
}`

    const schema = {
      type: 'object',
      properties: {
        correctness: { type: 'integer' },
        relevance: { type: 'integer' },
        depth: { type: 'integer' },
        concepts_detected: { type: 'array', items: { type: 'string' } },
        missing_concepts: { type: 'array', items: { type: 'string' } },
        confidence: { type: 'number' },
        skill_estimate: { type: 'string', enum: ['NOVICE', 'COMPETENT', 'EXPERT'] },
        feedback_summary: { type: 'string' },
        strengths: { type: 'array', items: { type: 'string' } },
        weaknesses: { type: 'array', items: { type: 'string' } },
        claims_requiring_verification: { type: 'array', items: { type: 'string' } },
        topics_mentioned: { type: 'array', items: { type: 'string' } },
        skills_demonstrated: { type: 'array', items: { type: 'string' } },
        skills_not_demonstrated: { type: 'array', items: { type: 'string' } },
      },
      required: [
        'correctness',
        'relevance',
        'depth',
        'concepts_detected',
        'missing_concepts',
        'confidence',
        'skill_estimate',
        'feedback_summary',
      ],
    }

    const aiResult = await aiOrchestrator.generateStructured({
      prompt,
      schema,
      systemInstruction:
        'You are the QualifyAI Answer Evaluation Engine. Be strict, objective, and evidence-grounded. Never hallucinate concepts. Return strictly valid JSON.',
    })

    const parsed = aiResult.data

    return {
      correctness: Math.min(Math.max(Number(parsed.correctness) || 5, 1), 10),
      relevance: Math.min(Math.max(Number(parsed.relevance) || 5, 1), 10),
      depth: Math.min(Math.max(Number(parsed.depth) || 5, 1), 10),
      concepts_detected: Array.isArray(parsed.concepts_detected) ? parsed.concepts_detected : [],
      missing_concepts: Array.isArray(parsed.missing_concepts) ? parsed.missing_concepts : [],
      confidence: Math.min(Math.max(Number(parsed.confidence) || 0.85, 0.1), 1.0),
      skill_estimate: parsed.skill_estimate || 'COMPETENT',
      feedback_summary: parsed.feedback_summary || 'Analysis completed.',
      strengths: Array.isArray(parsed.strengths) ? parsed.strengths : [],
      weaknesses: Array.isArray(parsed.weaknesses) ? parsed.weaknesses : [],
      claims_requiring_verification: Array.isArray(parsed.claims_requiring_verification) ? parsed.claims_requiring_verification : [],
      topics_mentioned: Array.isArray(parsed.topics_mentioned) ? parsed.topics_mentioned : [],
      skills_demonstrated: Array.isArray(parsed.skills_demonstrated) ? parsed.skills_demonstrated : [],
      skills_not_demonstrated: Array.isArray(parsed.skills_not_demonstrated) ? parsed.skills_not_demonstrated : [],
    }
  },
}
