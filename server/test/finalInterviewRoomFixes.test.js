import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizeQuestionPayload,
  validateQuestionSchema,
  evaluateAnswerDeterministically,
} from '../src/services/interview/questionTypeRegistry.js'
import { normalizeQuestion } from '../../client/src/utils/questionNormalizer.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '../../client/src')

describe('QUALIFYAI — Final Interview Room Fixes Test Suite', () => {

  // ==========================================================================
  // SECTION 1: STANDARDIZE ANSWER-OPTION FONT SIZES & TYPOGRAPHY
  // ==========================================================================
  describe('Section 1: Standardized Answer-Option Typography Across Templates', () => {
    it('MultipleChoiceQuestion uses readable base font size (~16px), proper wrapping, and non-clipped badges', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/MultipleChoiceQuestion.jsx'), 'utf8')
      assert.ok(file.includes('text-[15px] sm:text-base text-slate-800 leading-relaxed font-sans break-words pt-0.5'), 'Option text must use ~16px font size with natural word break')
      assert.ok(file.includes('w-7 h-7 sm:w-8 sm:h-8') && file.includes('shrink-0'), 'Badge must have consistent dimensions and shrink-0 to prevent compression')
      assert.ok(file.includes('p-3.5 sm:p-4'), 'Option item container must have accessible padding')
      assert.ok(file.includes('pt-1'), 'Selection indicator must be aligned properly with multiline text')
    })

    it('MultiSelectQuestion uses readable base font size, proper wrapping, and non-clipped badges', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/MultiSelectQuestion.jsx'), 'utf8')
      assert.ok(file.includes('text-[15px] sm:text-base text-slate-800 leading-relaxed font-sans break-words pt-0.5'), 'MultiSelect option text must use ~16px font size with natural wrapping')
      assert.ok(file.includes('w-7 h-7 sm:w-8 sm:h-8') && file.includes('shrink-0'), 'Badge must not compress on multiline options')
    })

    it('SelectMostAppropriateQuestion uses standardized readable font size and responsive padding', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/SelectMostAppropriateQuestion.jsx'), 'utf8')
      assert.ok(file.includes('text-[15px] sm:text-base text-slate-800 font-sans leading-relaxed break-words pt-0.5'), 'SelectBest option text must use ~16px typography')
      assert.ok(file.includes('w-7 h-7 sm:w-8 sm:h-8') && file.includes('shrink-0'), 'Badge must not shrink')
      assert.ok(file.includes('w-5 h-5') && file.includes('shrink-0'), 'Radio indicator must have stable sizing')
    })

    it('BooleanQuestion uses bold, legible typography on selection cards', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/BooleanQuestion.jsx'), 'utf8')
      assert.ok(file.includes('font-heading font-bold text-base sm:text-lg tracking-wide'), 'Boolean True/False text must be legible and bold')
    })

    it('ArrangeOrderQuestion rows use standardized typography and flexible wrapping', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/ArrangeOrderQuestion.jsx'), 'utf8')
      assert.ok(file.includes('text-[15px] sm:text-base text-slate-800 font-sans leading-relaxed break-words'), 'ArrangeOrder row label must use ~16px typography with break-words')
      assert.ok(file.includes('w-7 h-7 sm:w-8 sm:h-8') && file.includes('shrink-0'), 'Sequence badge must be clearly sized and uncompressed')
    })

    it('MatchingPairsQuestion left-hand prompts use standardized typography and responsive select inputs', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/MatchingPairsQuestion.jsx'), 'utf8')
      assert.ok(file.includes('text-[15px] sm:text-base font-semibold text-slate-800 font-sans leading-relaxed break-words'), 'Matching pair item label must use ~16px typography')
      assert.ok(file.includes('text-xs sm:text-sm text-slate-800'), 'Dropdown select element must be legible')
    })

    it('ShortAnswerQuestion and DescriptiveQuestion input areas use standardized typography', () => {
      const shortFile = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/ShortAnswerQuestion.jsx'), 'utf8')
      const descFile = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/DescriptiveQuestion.jsx'), 'utf8')
      assert.ok(shortFile.includes('text-[15px] sm:text-base') && shortFile.includes('leading-relaxed font-sans'), 'ShortAnswer textarea must use ~16px font size')
      assert.ok(descFile.includes('text-[15px] sm:text-base') && descFile.includes('leading-relaxed'), 'Descriptive textarea must use ~16px font size')
    })
  })

  // ==========================================================================
  // SECTION 2: ARRANGE IN ORDER QUESTIONS CONTENT & INTERACTION
  // ==========================================================================
  describe('Section 2: Arrange in Order Content, Normalization, Interaction & Validation', () => {
    it('client questionNormalizer extracts and canonicalizes structured items list', () => {
      const rawQuestion = {
        question_id: 'q-order-1',
        type: 'ARRANGE_IN_ORDER',
        question: 'Arrange the following numbers from least to greatest',
        items: ['Twelve', 'Four', 'Twenty', 'One'],
        meta: {
          items: ['Twelve', 'Four', 'Twenty', 'One']
        }
      }

      const normalized = normalizeQuestion(rawQuestion)
      assert.ok(Array.isArray(normalized.items), 'Normalized question must include items array')
      assert.equal(normalized.items.length, 4)
      assert.equal(normalized.items[0].label, 'Twelve')
      assert.equal(normalized.items[1].label, 'Four')
      assert.equal(normalized.items[2].label, 'Twenty')
      assert.equal(normalized.items[3].label, 'One')
      assert.ok(normalized.items[0].id, 'Each item must have a stable identifier')
    })

    it('client ArrangeOrderQuestion component does not fall back to generic Step 1..4 placeholders', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/ArrangeOrderQuestion.jsx'), 'utf8')
      assert.ok(!file.includes("label: 'Step 1'"), 'Generic Step 1 placeholder must be removed')
      assert.ok(!file.includes("label: 'Step 2'"), 'Generic Step 2 placeholder must be removed')
      assert.ok(!file.includes("label: 'Step 3'"), 'Generic Step 3 placeholder must be removed')
      assert.ok(!file.includes("label: 'Step 4'"), 'Generic Step 4 placeholder must be removed')
      assert.ok(file.includes('initialItems'), 'Must maintain initial candidate items for Reset action')
      assert.ok(file.includes('moveUp') && file.includes('moveDown'), 'Must provide interactive move controls')
      assert.ok(file.includes('orderedIds'), 'Must submit structured orderedIds')
    })

    it('server questionTypeRegistry normalizes items, preserves expectedAnswer, and scrambles initial order', () => {
      const raw = {
        type: 'ARRANGE_IN_ORDER',
        question_text: 'Arrange stages of software delivery in chronological order',
        items: ['Code Review', 'Requirements Analysis', 'Production Deployment', 'Testing'],
        expected_answer: ['Requirements Analysis', 'Code Review', 'Testing', 'Production Deployment']
      }

      const normalized = normalizeQuestionPayload(raw)
      assert.equal(normalized.items.length, 4)
      assert.ok(normalized.items.every(item => item.id && item.label))
      assert.deepEqual(normalized.expectedAnswer, ['Requirements Analysis', 'Code Review', 'Testing', 'Production Deployment'])
      
      // If initial items were in the exact expected order, registry scrambles them
      const preSolved = {
        type: 'ARRANGE_IN_ORDER',
        question_text: 'Arrange alphabet letters',
        items: ['A', 'B', 'C', 'D'],
        expected_answer: ['A', 'B', 'C', 'D']
      }
      const scrambledNorm = normalizeQuestionPayload(preSolved)
      const scrambledLabels = scrambledNorm.items.map(i => i.label)
      assert.notDeepEqual(scrambledLabels, ['A', 'B', 'C', 'D'], 'Initial order presented to candidate must not be pre-solved')
    })

    it('server questionTypeRegistry validates schema and rejects generic Step 1..n placeholders', () => {
      const valid = {
        type: 'ARRANGE_IN_ORDER',
        text: 'Arrange algorithm complexities from best to worst',
        items: [
          { id: '1', label: 'O(1)' },
          { id: '2', label: 'O(log n)' },
          { id: '3', label: 'O(n)' },
          { id: '4', label: 'O(n^2)' }
        ]
      }
      assert.equal(validateQuestionSchema(valid).valid, true)

      // Rejects fewer than 2 items
      assert.equal(validateQuestionSchema({
        type: 'ARRANGE_IN_ORDER',
        text: 'Order this',
        items: [{ id: '1', label: 'Single item' }]
      }).valid, false)

      // Rejects generic Step 1, Step 2 placeholders
      const dummyPlaceholders = {
        type: 'ARRANGE_IN_ORDER',
        text: 'Order the steps',
        items: [
          { id: '1', label: 'Step 1' },
          { id: '2', label: 'Step 2' },
          { id: '3', label: 'Step 3' }
        ]
      }
      const dummyValidation = validateQuestionSchema(dummyPlaceholders)
      assert.equal(dummyValidation.valid, false)
      assert.ok(dummyValidation.error.toLowerCase().includes('placeholder'))
    })

    it('server questionTypeRegistry evaluates submitted order with exact match and partial credit', () => {
      const question = {
        type: 'ARRANGE_IN_ORDER',
        items: [
          { id: 'q1', label: 'Alpha' },
          { id: 'q2', label: 'Beta' },
          { id: 'q3', label: 'Gamma' },
          { id: 'q4', label: 'Delta' }
        ],
        expected_answer: ['Alpha', 'Beta', 'Gamma', 'Delta']
      }

      // Perfect match by labels
      const perfectEval = evaluateAnswerDeterministically(
        question,
        null,
        { orderedItems: ['Alpha', 'Beta', 'Gamma', 'Delta'] }
      )
      assert.equal(perfectEval.score, 10)
      assert.equal(perfectEval.correct, true)

      // Perfect match by structured IDs
      const perfectIdEval = evaluateAnswerDeterministically(
        question,
        null,
        { orderedIds: ['q1', 'q2', 'q3', 'q4'] }
      )
      assert.equal(perfectIdEval.score, 10)
      assert.equal(perfectIdEval.correct, true)

      // Completely inverted order
      const reverseEval = evaluateAnswerDeterministically(
        question,
        null,
        { orderedItems: ['Delta', 'Gamma', 'Beta', 'Alpha'] }
      )
      assert.equal(reverseEval.score <= 3, true)
      assert.equal(reverseEval.correct, false)
    })
  })

  // ==========================================================================
  // SECTION 3: SHORT ANSWER & DESCRIPTIVE VOICE AUTO-SUBMISSION PROTECTION
  // ==========================================================================
  describe('Section 3: Short Answer & Descriptive Voice Submission Behavior', () => {
    it('InterviewRoomPage removes premature 6-second speech pause auto-submission triggers', () => {
      const pageFile = fs.readFileSync(path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx'), 'utf8')
      
      // Must not contain the premature 6000ms pause triggers
      assert.ok(!pageFile.includes("console.log('[Silence Engine] 6.0s speech pause threshold reached"), '6.0s pause watchdog must be removed')
      assert.ok(!pageFile.includes('speechPauseTimerRef.current = setTimeout('), '6.0s speechPauseTimerRef must not be scheduled')
      
      // UI badge must communicate that candidate can speak naturally and submit when ready
      assert.ok(pageFile.includes('Speak naturally • Submit when ready'), 'UI badge must indicate manual submission readiness')
      assert.ok(!pageFile.includes('Auto-submits in 6s on pause'), 'Old 6s auto-submit badge must be removed')
    })

    it('InterviewRoomPage reconciles finalizing speech buffers before manual submission', () => {
      const pageFile = fs.readFileSync(path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx'), 'utf8')
      assert.ok(pageFile.includes('candidateSpeechBufferRef.current'), 'Must track accumulated transcript in ref')
      assert.ok(pageFile.includes('isSubmittingRef.current'), 'Must maintain atomic isSubmitting guard')
      assert.ok(pageFile.includes('lastSubmittedSequenceRef.current'), 'Must maintain monotonic sequence guard')
      assert.ok(pageFile.includes('finalizingSpeech'), 'Must reconcile finalizing speech buffer before submission')
    })

    it('DescriptiveQuestion synchronizes live candidate speech into editable textarea', () => {
      const file = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/DescriptiveQuestion.jsx'), 'utf8')
      assert.ok(file.includes('candidateSpeech'), 'Descriptive component must accept candidateSpeech prop')
      assert.ok(file.includes('onChange({ text: clean, inputMethod: \'voice_text\' })'), 'Component must sync speech into form state')
      assert.ok(file.includes('placeholder'), 'Textarea placeholder must support speech or typing')
    })

    it('Question 1 room_rules explicitly instruct candidate to click Submit Response when finished', () => {
      const engineFile = fs.readFileSync(path.resolve(__dirname, '../src/services/interview/interviewEngineService.js'), 'utf8')
      assert.ok(
        engineFile.includes('Click Submit Response when finished with your answer'),
        'Initial descriptive question room_rules must instruct candidate to click Submit Response'
      )
    })
  })
})
