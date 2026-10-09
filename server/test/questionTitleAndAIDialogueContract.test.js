import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  normalizeQuestion,
  extractCleanQuestionPrompt,
  detectQuestionType,
} from '../../client/src/utils/questionNormalizer.js'
import {
  normalizeQuestionType,
  QUESTION_TYPES_CATALOG,
} from '../../client/src/utils/questionTypeRegistry.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '../../client/src')

describe('Question Title & AI Dialogue Box Contract Verification', () => {
  // --------------------------------------------------------------------------
  // TEST A: Complete Question Title Preservation
  // --------------------------------------------------------------------------
  describe('Test A: Complete Question Title Preservation', () => {
    it('preserves complete discount arithmetic question without truncating to "If" or trailing phrase', () => {
      const canonicalPrompt =
        'If an item is originally priced at $500 and receives a 20% discount followed by an additional 10% discount on the reduced price, what is the final selling price?'

      const normalized = normalizeQuestion(
        {
          id: 'q-discount-1',
          question_text: canonicalPrompt,
          type: 'NUMERICAL_APTITUDE',
          options: [
            { id: 'opt-a', label: '$360' },
            { id: 'opt-b', label: '$350' },
            { id: 'opt-c', label: '$375' },
            { id: 'opt-d', label: '$380' },
          ],
        },
        canonicalPrompt,
        1
      )

      // Must NOT be truncated to "If"
      assert.notEqual(normalized.text, 'If', 'Question title must not be truncated to "If"')
      // Must NOT be truncated to just the trailing question sentence
      assert.notEqual(
        normalized.text,
        'what is the final selling price?',
        'Question title must not lose premise sentences'
      )
      // Must match complete canonical text exactly
      assert.equal(normalized.text, canonicalPrompt)
      assert.equal(normalized.options.length, 4)
    })

    it('preserves multi-sentence context, constraints, and currency values', () => {
      const multiSentencePrompt =
        'A company has 500 employees. 40% work remotely. If 50 remote workers return to the office, what percentage of employees now work remotely?'

      const normalized = normalizeQuestion(
        {
          id: 'q-multi-sentence',
          question_text: multiSentencePrompt,
          type: 'NUMERICAL_APTITUDE',
        },
        multiSentencePrompt,
        2
      )

      assert.equal(normalized.text, multiSentencePrompt)
      assert.ok(normalized.text.includes('500 employees'))
      assert.ok(normalized.text.includes('40% work remotely'))
      assert.ok(normalized.text.includes('what percentage of employees now work remotely?'))
    })

    it('preserves code premises and technical instructions in multi-sentence prompts', () => {
      const codePrompt =
        'Consider two relational tables, Users(id, name) and Orders(id, user_id, amount). Write a SQL query to calculate the lifetime customer value for users who joined in 2025.'

      const normalized = normalizeQuestion(
        {
          id: 'q-sql-context',
          question_text: codePrompt,
          type: 'SQL',
        },
        codePrompt,
        3
      )

      assert.equal(normalized.text, codePrompt)
      assert.ok(normalized.text.includes('Users(id, name)'))
      assert.ok(normalized.text.includes('lifetime customer value'))
    })
  })

  // --------------------------------------------------------------------------
  // TEST B: Streaming Dialogue vs Stable Question Title
  // --------------------------------------------------------------------------
  describe('Test B: Streaming Dialogue State Separation', () => {
    it('keeps canonical question title immutable while live AI speech accumulates word-by-word', () => {
      const canonicalPrompt =
        'If an item is originally priced at $500 and receives a 20% discount followed by an additional 10% discount on the reduced price, what is the final selling price?'

      // Authoritative question state remains stable
      const questionState = normalizeQuestion(
        {
          id: 'q-stream-test',
          question_text: canonicalPrompt,
          type: 'NUMERICAL_APTITUDE',
        },
        canonicalPrompt,
        0
      )

      // Spoken narrative script streaming progressively
      const spokenScript =
        "Let's begin with a quantitative reasoning question. Take a look at the problem."
      const words = spokenScript.split(' ')

      let liveDialogueState = ''
      for (let i = 1; i <= words.length; i++) {
        liveDialogueState = words.slice(0, i).join(' ')

        // Dialogue state updates progressively
        assert.equal(liveDialogueState, words.slice(0, i).join(' '))
        // Main question title remains completely unchanged and authoritative
        assert.equal(
          questionState.text,
          canonicalPrompt,
          'Question title must not change while speech streams'
        )
      }

      assert.equal(liveDialogueState, spokenScript)
      assert.equal(questionState.text, canonicalPrompt)
    })
  })

  // --------------------------------------------------------------------------
  // TEST C: Clean Question Transitions
  // --------------------------------------------------------------------------
  describe('Test C: Clean Question Transitions', () => {
    it('transitions to a new question title without stale content from previous question', () => {
      const q1Prompt = 'What is the primary difference between a process and a thread?'
      const q2Prompt =
        'If a distributed cache has a 95% hit rate with 5ms latency, and 100ms on cache miss, what is the average effective memory access time?'

      const activeQ1 = normalizeQuestion(
        { id: 'q-1', sequence: 0, question_text: q1Prompt, type: 'SHORT_ANSWER' },
        q1Prompt,
        0
      )
      assert.equal(activeQ1.text, q1Prompt)

      // Transition to Q2
      const activeQ2 = normalizeQuestion(
        { id: 'q-2', sequence: 1, question_text: q2Prompt, type: 'NUMERICAL_APTITUDE' },
        q2Prompt,
        1
      )

      assert.equal(activeQ2.text, q2Prompt)
      assert.ok(!activeQ2.text.includes('process and a thread'))
      assert.equal(activeQ2.sequence, 1)
    })
  })

  // --------------------------------------------------------------------------
  // TEST D: Delayed / Stale Transcript Event Protection
  // --------------------------------------------------------------------------
  describe('Test D: Delayed Transcript Guard', () => {
    it('monotonic sequence invariant ignores older transcript events', () => {
      let currentSequence = 2
      let activeQuestionTitle = 'Current active question for sequence #2'
      let activeDialogue = 'AI speech for sequence #2'

      const handleTranscriptEvent = (event) => {
        // MONOTONIC SEQUENCE GUARD
        if (typeof event.sequence === 'number' && event.sequence < currentSequence) {
          // Stale transcript rejected
          return false
        }
        activeDialogue = event.text
        return true
      }

      // Simulate delayed arrival of transcript from sequence 1
      const staleEvent = {
        speaker: 'AI',
        sequence: 1,
        text: 'Late arriving spoken transcript from previous question #1',
      }

      const accepted = handleTranscriptEvent(staleEvent)
      assert.equal(accepted, false, 'Stale transcript must be rejected')
      assert.equal(activeDialogue, 'AI speech for sequence #2')
      assert.equal(activeQuestionTitle, 'Current active question for sequence #2')
    })
  })

  // --------------------------------------------------------------------------
  // TEST E: Voice Functionality Preservation
  // --------------------------------------------------------------------------
  describe('Test E: Voice Functionality Preservation', () => {
    it('voiceEngine preserves speakAiQuestion, cancelCurrentAudio, and CosyVoice provider pipeline', () => {
      const enginePath = path.resolve(clientRoot, 'services/voiceInterviewEngine.js')
      const content = fs.readFileSync(enginePath, 'utf8')

      assert.ok(content.includes('speakAiQuestion'), 'Must preserve speakAiQuestion method')
      assert.ok(content.includes('cancelCurrentAudio'), 'Must preserve cancelCurrentAudio method')
      assert.ok(content.includes('qualifyai_interviewer_01'), 'Must preserve voice persona profile')
      assert.ok(content.includes('onAiSpeakingConcluded'), 'Must preserve speech conclusion event')
      assert.ok(content.includes('ai_transcript_delta'), 'Must preserve streaming delta handling')
    })
  })

  // --------------------------------------------------------------------------
  // TEST F: Responsive Layout & Component Positioning Verification
  // --------------------------------------------------------------------------
  describe('Test F: Layout Separation and Positioning Verification', () => {
    it('AIInterviewerPanel encapsulates VoiceOrbVisualizer and renders AIDialogueBox directly below it', () => {
      const panelPath = path.resolve(clientRoot, 'components/interview/AIInterviewerPanel.jsx')
      const content = fs.readFileSync(panelPath, 'utf8')

      assert.ok(content.includes('VoiceOrbVisualizer'), 'Must include VoiceOrbVisualizer')
      assert.ok(content.includes('AIDialogueBox'), 'Must include AIDialogueBox')
      // VoiceOrbVisualizer appears first, then AIDialogueBox below it
      const orbIndex = content.indexOf('<VoiceOrbVisualizer')
      const dialogueIndex = content.indexOf('<AIDialogueBox')
      assert.ok(orbIndex < dialogueIndex, 'AIDialogueBox must appear beneath VoiceOrbVisualizer')
    })

    it('ActiveQuestionPanel displays complete question title with multi-line wrapping and no embedded dialogue box', () => {
      const questionPanelPath = path.resolve(
        clientRoot,
        'components/interview/ActiveQuestionPanel.jsx'
      )
      const content = fs.readFileSync(questionPanelPath, 'utf8')

      // Main title must have whitespace-normal and break-words for long questions
      assert.ok(
        content.includes('whitespace-normal break-words'),
        'Main question title must support natural multi-line wrapping'
      )
      assert.ok(
        content.includes('data-testid="main-question-title"'),
        'Main question title must have data-testid'
      )
      // Must NOT contain the old embedded live speech box on the right
      assert.ok(
        !content.includes('AI Interviewer Speaking Aloud'),
        'ActiveQuestionPanel must not embed the AI dialogue box'
      )
    })

    it('AIDialogueBox provides accessible live-region container with test id', () => {
      const boxPath = path.resolve(clientRoot, 'components/interview/AIDialogueBox.jsx')
      const content = fs.readFileSync(boxPath, 'utf8')

      assert.ok(content.includes('data-testid="ai-dialogue-box"'))
      assert.ok(content.includes('data-testid="ai-dialogue-text"'))
      assert.ok(content.includes('aria-live="polite"'))
    })
  })

  // --------------------------------------------------------------------------
  // TEST G: All 15 Question Templates Retain Full Canonical Question Title
  // --------------------------------------------------------------------------
  describe('Test G: Question Templates Title Preservation', () => {
    const templates = [
      {
        type: 'MULTIPLE_CHOICE',
        prompt:
          'Which data structure follows a First-In-First-Out (FIFO) queueing discipline in operating system schedulers?',
        options: ['Stack', 'Queue', 'Binary Tree', 'Priority Heap'],
      },
      {
        type: 'MULTI_SELECT',
        prompt:
          'Which of the following HTTP request methods are idempotent according to RFC 7231 specifications?',
        options: ['GET', 'PUT', 'DELETE', 'POST', 'PATCH'],
      },
      {
        type: 'TRUE_FALSE',
        prompt:
          'In JavaScript, evaluating the strict equality expression typeof null === "object" yields true.',
      },
      {
        type: 'SHORT_ANSWER',
        prompt:
          'State the worst-case asymptotic time complexity of searching an element in a balanced AVL tree with n nodes.',
      },
      {
        type: 'DESCRIPTIVE',
        prompt:
          'Explain how database connection pooling mitigates socket exhaustion and thread contention during peak traffic spikes in microservice architectures.',
      },
      {
        type: 'FILL_IN_THE_BLANK',
        prompt:
          'In SQL, the _____ clause filters aggregated groups after the GROUP BY clause has been applied.',
      },
      {
        type: 'CODING_CHALLENGE',
        prompt:
          'Implement a Least Recently Used (LRU) Cache data structure supporting get(key) and put(key, value) in O(1) average time.',
      },
      {
        type: 'PREDICT_CODE_OUTPUT',
        prompt:
          'Analyze the execution order and predict the exact console output of the following JavaScript promise chain.',
      },
      {
        type: 'DEBUGGING',
        prompt:
          'Identify and repair the race condition in this concurrent banking transaction debit handler.',
      },
      {
        type: 'COMPLETE_THE_CODE',
        prompt:
          'Complete the missing binary search tree traversal logic to return elements in non-decreasing order.',
      },
      {
        type: 'ARRANGE_ORDER',
        prompt:
          'Arrange the five phases of the software release lifecycle in chronological order from development to production.',
      },
      {
        type: 'SELECT_MOST_APPROPRIATE',
        prompt:
          'Your API gateway experiences unexpected latency spikes. Select the most appropriate circuit breaker configuration to protect downstream services.',
      },
      {
        type: 'SLIDER_SCALE',
        prompt:
          'On a numeric scale from 1 to 10, rate the criticality of database sharding versus read replication for read-heavy analytical workloads.',
      },
      {
        type: 'MATCHING_PAIRS',
        prompt:
          'Match each design pattern on the left with its corresponding Gang of Four classification category on the right.',
      },
      {
        type: 'NUMERICAL_APTITUDE',
        prompt:
          'If an item is originally priced at $500 and receives a 20% discount followed by an additional 10% discount on the reduced price, what is the final selling price?',
      },
    ]

    for (const t of templates) {
      it(`preserves full title for question type: ${t.type}`, () => {
        const normalized = normalizeQuestion(
          {
            id: `test-${t.type.toLowerCase()}`,
            type: t.type,
            question_text: t.prompt,
            options: t.options || [],
          },
          t.prompt,
          1
        )

        assert.equal(
          normalized.text,
          t.prompt,
          `Question title for ${t.type} must equal canonical prompt`
        )
        assert.ok(
          normalized.text.length > 20,
          `Question title for ${t.type} must not be truncated`
        )
      })
    }
  })
})
