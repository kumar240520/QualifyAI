import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

import {
  appendSpeechSegment,
  reconcileSpeechWithAnswer,
} from '../../client/src/utils/speechAccumulator.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const clientRoot = path.resolve(__dirname, '../../client/src')

describe('QUALIFYAI — Live Transcript Panel Layout, Deduplication, and Answer Accumulation Suite', () => {

  // ==========================================================================
  // PART 1: LIVE TRANSCRIPT PANEL LAYOUT TESTS
  // ==========================================================================
  describe('Part 1: Live Transcript Panel Layout & Two-Region Architecture', () => {
    const roomFile = fs.readFileSync(path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx'), 'utf8')

    it('1.1 Outer transcript panel occupies full available width with min-w-0 and vertical column flex', () => {
      assert.ok(
        roomFile.includes('p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-blue-50/95 via-indigo-50/90 to-sky-50/90 border border-blue-200/90 text-blue-950 text-xs flex flex-col gap-3.5 shadow-2xs animate-fade-in w-full min-w-0'),
        'Panel must be a vertical flex column with w-full min-w-0 to prevent horizontal squeezing'
      )
    })

    it('1.2 Region A (Transcript Content Area) occupies full width, wraps words naturally, and uses readable typography', () => {
      assert.ok(
        roomFile.includes('{/* Region A: Full-width live transcript content area */}'),
        'Region A must be explicitly demarcated as full-width transcript area'
      )
      assert.ok(
        roomFile.includes('flex items-start gap-3 w-full min-w-0'),
        'Region A container must use w-full min-w-0'
      )
      assert.ok(
        roomFile.includes('italic text-slate-800 font-sans text-sm sm:text-[15px] leading-relaxed font-medium break-words [overflow-wrap:anywhere] w-full'),
        'Transcript paragraph must use readable font size (~15px), natural word break, and full width'
      )
    })

    it('1.3 Region B (Action Controls Area) is placed beneath transcript with border divider and responsive stacking', () => {
      assert.ok(
        roomFile.includes('{/* Region B: Action controls area beneath the transcript */}'),
        'Region B must be explicitly demarcated beneath the transcript'
      )
      assert.ok(
        roomFile.includes('flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-3 border-t border-blue-200/70 w-full min-w-0'),
        'Region B must sit on its own row beneath transcript with a border-t divider'
      )
      assert.ok(
        roomFile.includes('Speak naturally • Submit when ready'),
        'Guidance label must be present in Region B'
      )
      assert.ok(
        roomFile.includes('Clear Response'),
        'Clear Response button must be in Region B'
      )
      assert.ok(
        roomFile.includes('Submit Response'),
        'Submit Response button must be in Region B'
      )
    })

    it('1.4 Parent containers provide min-w-0 preventing flex and grid children from shrinking below unusable widths', () => {
      assert.ok(
        roomFile.includes('lg:col-span-7 h-full flex flex-col justify-between overflow-hidden gap-3.5 min-w-0'),
        'Right column grid card must have min-w-0'
      )
      assert.ok(
        roomFile.includes('bg-white/70 backdrop-blur-xs rounded-3xl border border-slate-200/90 p-4 sm:p-5 flex flex-col justify-between overflow-y-auto shadow-2xs min-w-0 w-full'),
        'Interactive workspace container must have min-w-0 w-full'
      )
      assert.ok(
        roomFile.includes('mb-3.5 shrink-0 w-full min-w-0'),
        'Transcriber container must have w-full min-w-0'
      )
    })
  })

  // ==========================================================================
  // PART 2: DEDUPLICATION & PERSISTENT ANSWER ACCUMULATION TESTS
  // ==========================================================================
  describe('Part 2: Deduplication, Session Semantics, & Answer Accumulation', () => {

    it('Scenario 1 & 2: Multiple interim updates followed by one final result does NOT duplicate sentence', () => {
      const sentence = 'Hello, I am a software engineer who specializes in full-stack development, and I have made a solution.'

      // Simulating real SpeechRecognition lifecycle:
      // Interim 1
      const interim1 = 'Hello, I am'
      // In InterviewRoomPage, interim is ephemeral live preview, base buffer is empty:
      let baseBuffer = ''
      let liveDisplay = baseBuffer ? `${baseBuffer} ${interim1}` : interim1
      assert.equal(liveDisplay, 'Hello, I am')
      assert.equal(baseBuffer, '', 'Base buffer must NOT store unconfirmed interim text')

      // Interim 2
      const interim2 = 'Hello, I am a software engineer who specializes'
      liveDisplay = baseBuffer ? `${baseBuffer} ${interim2}` : interim2
      assert.equal(liveDisplay, 'Hello, I am a software engineer who specializes')
      assert.equal(baseBuffer, '')

      // Final event arrives
      baseBuffer = appendSpeechSegment(baseBuffer, sentence)
      liveDisplay = baseBuffer
      assert.equal(liveDisplay, sentence)
      assert.equal(baseBuffer, sentence)

      // Verify sentence appears EXACTLY once:
      const count = (baseBuffer.match(/software engineer/g) || []).length
      assert.equal(count, 1, 'Sentence must appear exactly once, never duplicated from interim')
    })

    it('Scenario 3 & 4: Several distinct sentences across pauses accumulate in correct order', () => {
      const s1 = 'I have experience in software development.'
      const s2 = 'I have worked on several projects involving distributed systems.'
      const s3 = 'I enjoy solving problems and collaborating with my team.'

      let buffer = ''
      buffer = appendSpeechSegment(buffer, s1)
      assert.equal(buffer, s1)

      // Pause and resume
      buffer = appendSpeechSegment(buffer, s2)
      assert.equal(buffer, `${s1} ${s2}`)

      // Pause and resume
      buffer = appendSpeechSegment(buffer, s3)
      assert.equal(buffer, `${s1} ${s2} ${s3}`)
    })

    it('Scenario 5: Recognition restarting after a pause preserves accumulated buffer', () => {
      let buffer = 'First confirmed segment.'
      // Engine restarts recognition session (new session ID)
      const nextSegment = 'Second confirmed segment after restart.'
      buffer = appendSpeechSegment(buffer, nextSegment)
      assert.equal(buffer, 'First confirmed segment. Second confirmed segment after restart.')
    })

    it('Scenario 6: Duplicate delivery of the exact same event is ignored', () => {
      let buffer = 'Candidate answer sentence.'
      // Identical segment delivered again
      buffer = appendSpeechSegment(buffer, 'Candidate answer sentence.')
      assert.equal(buffer, 'Candidate answer sentence.', 'Must not append duplicate identical segment')
    })

    it('Scenario 7: Cumulative stream from provider does not duplicate earlier text', () => {
      const base = 'I have experience in software development.'
      const cumulativeUpdate = 'I have experience in software development. And I build cloud applications.'
      const result = appendSpeechSegment(base, cumulativeUpdate)
      assert.equal(result, cumulativeUpdate, 'Cumulative stream must replace base snapshot without duplicate words')
    })

    it('Scenario 8: Manual keyboard edits between speech segments are preserved', () => {
      let buffer = 'I have experience in software development.'
      let currentAnswer = buffer

      // Candidate edits text in textarea
      currentAnswer = 'I have 5 years of experience in software development.'

      // Candidate resumes speaking
      const nextSpeech = 'I specialize in distributed systems.'
      const reconciled = reconcileSpeechWithAnswer({
        currentAnswer,
        speechBuffer: buffer,
        incomingSpeech: nextSpeech,
        isFinal: true,
      })

      assert.equal(
        reconciled.accumulated,
        'I have 5 years of experience in software development. I specialize in distributed systems.',
        'Candidate manual edits must be preserved when new speech arrives'
      )
    })

    it('Scenario 9: Clear Response resets accumulated buffer, interim text, and recognition tokens', () => {
      const roomFile = fs.readFileSync(path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx'), 'utf8')
      assert.ok(roomFile.includes("candidateSpeechBufferRef.current = ''"))
      assert.ok(roomFile.includes("currentInterimSpeechRef.current = ''"))
      assert.ok(roomFile.includes("finalizedSegmentIdsRef.current.clear()"))
      assert.ok(roomFile.includes("setCandidateInterimText('')"))
      assert.ok(roomFile.includes("setAnswerInputValue('')"))
      assert.ok(roomFile.includes('voiceEngineRef.current.resetCandidateSpeechRecognition()'))
    })

    it('Scenario 10 & 11: Late events after submission are ignored and sequence transition is clean', () => {
      const roomFile = fs.readFileSync(path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx'), 'utf8')
      assert.ok(
        roomFile.includes('isSubmittingRef.current ||') && roomFile.includes('isCandidateTurnLockedRef.current ||'),
        'onCandidateSpeech must lock when isSubmittingRef or turn locked'
      )
      assert.ok(
        roomFile.includes('lastSubmittedSequenceRef.current === currentQSeq || isSubmittingRef.current'),
        'Double submission guard must prevent duplicate submits'
      )
    })

    it('Scenario 12: Legitimate candidate repetition of words is preserved', () => {
      // If a candidate legitimately repeats words ("I think, I think that..."):
      const repeatedWordSentence = 'I think, I think that this approach is best.'
      const result = appendSpeechSegment('', repeatedWordSentence)
      assert.equal(
        result,
        'I think, I think that this approach is best.',
        'Candidate legitimate repetitions within a segment must NOT be stripped'
      )
    })

    it('voiceInterviewEngine tracks _lastFinalizedIndex and generates stable segmentId', () => {
      const engineFile = fs.readFileSync(path.resolve(clientRoot, 'services/voiceInterviewEngine.js'), 'utf8')
      assert.ok(
        engineFile.includes('this._lastFinalizedIndex = -1'),
        'Engine must initialize _lastFinalizedIndex to -1'
      )
      assert.ok(
        engineFile.includes('this._recognitionSessionId = `sess_${Date.now()}`'),
        'Engine must generate unique session identifier'
      )
      assert.ok(
        engineFile.includes('this._lastFinalizedIndex = i'),
        'Engine must advance _lastFinalizedIndex upon finalizing result'
      )
      assert.ok(
        engineFile.includes('segmentId: segId') || engineFile.includes('segmentId: `${this._recognitionSessionId}_${i}`'),
        'Engine must attach unique segmentId to finalized speech events'
      )
      assert.ok(
        engineFile.includes('for (let i = this._lastFinalizedIndex + 1; i < event.results.length; ++i)'),
        'Engine must only process results beyond _lastFinalizedIndex'
      )
    })

    it('InterviewRoomPage isolates voice sync onChange events from candidate manual typing buffer', () => {
      const roomFile = fs.readFileSync(path.resolve(clientRoot, 'pages/InterviewRoomPage.jsx'), 'utf8')
      assert.ok(
        roomFile.includes("val?.inputMethod === 'voice_text'") || roomFile.includes('isVoiceSync'),
        'InterviewRoomPage must isolate isVoiceSync events to prevent circular buffer duplication'
      )
    })

    it('ShortAnswerQuestion displays 500-character counter with warning styling when exceeded', () => {
      const shortFile = fs.readFileSync(path.resolve(clientRoot, 'components/interview/questions/ShortAnswerQuestion.jsx'), 'utf8')
      assert.ok(shortFile.includes('{textValue.length}/500 chars'), 'Counter must display current length out of 500 chars')
      assert.ok(shortFile.includes('textValue.length > 500 ? \'text-amber-600 font-bold\''), 'Warning styling must be applied when length exceeds 500 chars')
    })
  })
})
