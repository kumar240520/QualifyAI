import test from 'node:test'
import assert from 'node:assert/strict'

const NON_VOICE_INTERACTIVE_TYPES = [
  'MULTIPLE_CHOICE',
  'SINGLE_CHOICE',
  'MULTI_SELECT',
  'FILL_IN_THE_BLANK',
  'CODE_OUTPUT',
  'CODE_WRITING',
  'SQL',
  'TRUE_FALSE',
  'YES_NO',
]

function getDefaultMicEnabled(questionOrType) {
  if (!questionOrType) return true
  const t = typeof questionOrType === 'string'
    ? questionOrType.toUpperCase()
    : String(questionOrType.type || questionOrType.question_type || '').toUpperCase()

  if (!t) return true
  return !NON_VOICE_INTERACTIVE_TYPES.includes(t)
}

function isLongFormVoiceQuestion(questionOrType) {
  return getDefaultMicEnabled(questionOrType)
}

function getQuestionStageDuration(questionOrType) {
  if (!questionOrType) return 15
  const t = typeof questionOrType === 'string'
    ? questionOrType.toUpperCase()
    : String(questionOrType.type || questionOrType.question_type || '').toUpperCase()

  switch (t) {
    case 'CODE_WRITING':
    case 'SQL':
      return 45
    case 'CODE_OUTPUT':
    case 'FILL_IN_THE_BLANK':
      return 20
    case 'MULTIPLE_CHOICE':
    case 'SINGLE_CHOICE':
    case 'MULTI_SELECT':
    case 'TRUE_FALSE':
    case 'YES_NO':
      return 15
    case 'SHORT_ANSWER':
    case 'DESCRIPTIVE':
    case 'BEHAVIORAL':
    case 'SCENARIO':
    default:
      return 15
  }
}

/**
 * State machine simulating the InterviewRoomPage silence & activity monitor
 */
class InterviewRoomSilenceEngine {
  constructor({ question = { type: 'MULTIPLE_CHOICE' } } = {}) {
    this.question = question
    this.isVoiceQuestion = isLongFormVoiceQuestion(question)
    this.stageDuration = getQuestionStageDuration(question)
    this.hasCandidateResponded = false
    this.voiceState = 'SPEAKING'
    this.isCandidateTurnLocked = true
    this.roomStartupCountdown = 0
    this.isSubmitting = false
    this.isCompleted = false
    this.nudgeCount = 0
    this.silenceSeconds = 0
    this.unansweredCount = 0
    this.lastUserActivityTime = Date.now()
    this.lastSpeechActivityTime = 0
    this.lastTypingActivityTime = 0
    this.recordedSpeech = ''
    this.audioLevel = 0
    this.eventsTriggered = []
    this.currentTime = Date.now()
  }

  advanceTime(ms) {
    const steps = Math.floor(ms / 1000)
    for (let i = 0; i < steps; i++) {
      this.currentTime += 1000
      this.tick()
    }
    const remainder = ms % 1000
    if (remainder > 0) {
      this.currentTime += remainder
    }
  }

  concludeAiSpeakingAndUnlock() {
    this.voiceState = 'LISTENING'
    this.isCandidateTurnLocked = false
    this.lastUserActivityTime = this.currentTime
    this.silenceSeconds = 0
    this.eventsTriggered.push({ type: 'mic_unlocked', time: this.currentTime })
  }

  speakFillerNudge(level) {
    this.isCandidateTurnLocked = true
    this.voiceState = 'SPEAKING'
    this.silenceSeconds = 0
    this.lastUserActivityTime = this.currentTime
    this.eventsTriggered.push({ type: `filler_${level}_started`, time: this.currentTime })
  }

  handleUserActivity(evtType = 'keydown') {
    if (this.voiceState === 'SPEAKING' || this.isCandidateTurnLocked || this.isCompleted) {
      return
    }
    // On voice questions, passive mouse movements do not reset activity
    if (this.isVoiceQuestion && (evtType === 'mousemove' || evtType === 'wheel')) {
      return
    }
    this.lastUserActivityTime = this.currentTime
    this.silenceSeconds = 0
    if (this.nudgeCount > 0) {
      this.nudgeCount = 0
    }
    this.eventsTriggered.push({ type: 'user_activity', evtType, time: this.currentTime })
  }

  candidateSpeaks(text = 'Hello I am answering') {
    this.recordedSpeech = text
    this.lastSpeechActivityTime = this.currentTime
    this.lastUserActivityTime = this.currentTime
    if (this.isVoiceQuestion) {
      this.hasCandidateResponded = true
    }
    this.eventsTriggered.push({ type: 'candidate_spoke', text, time: this.currentTime })
  }

  candidateTypes(text = 'My answer here') {
    this.lastTypingActivityTime = this.currentTime
    this.lastUserActivityTime = this.currentTime
    if (this.isVoiceQuestion && text.trim().length >= 3) {
      this.hasCandidateResponded = true
    }
    this.eventsTriggered.push({ type: 'candidate_typed', text, time: this.currentTime })
  }

  submitAnswer() {
    this.unansweredCount = 0
    this.hasCandidateResponded = false
    this.nudgeCount = 0
    this.silenceSeconds = 0
    this.eventsTriggered.push({ type: 'answer_submitted', time: this.currentTime })
  }

  skipUnanswered() {
    this.unansweredCount++
    this.nudgeCount = 0
    this.silenceSeconds = 0
    this.hasCandidateResponded = false
    this.eventsTriggered.push({ type: 'question_skipped', count: this.unansweredCount, time: this.currentTime })

    if (this.unansweredCount >= 3) {
      this.isCompleted = true
      this.eventsTriggered.push({ type: 'session_closed_unanswered', time: this.currentTime })
    }
  }

  tick() {
    // 0. AI speaking or turn locked
    if (
      this.voiceState === 'SPEAKING' ||
      this.isCandidateTurnLocked ||
      this.roomStartupCountdown > 0 ||
      this.isSubmitting ||
      this.isCompleted
    ) {
      this.silenceSeconds = 0
      return
    }

    // 1. Inactivity measurement from last user activity
    const idleMs = this.currentTime - (this.lastUserActivityTime || 0)
    const idleSeconds = Math.max(0, Math.floor(idleMs / 1000))
    this.silenceSeconds = idleSeconds

    // Step 1: Exactly stageDuration seconds of inactivity -> Filler Nudge #1
    if (idleSeconds >= this.stageDuration && this.nudgeCount === 0) {
      this.nudgeCount = 1
      this.lastUserActivityTime = this.currentTime
      this.silenceSeconds = 0
      this.speakFillerNudge(1)
      return
    }

    // Step 2: Exactly stageDuration seconds of inactivity after Nudge 1 -> Filler Nudge #2
    if (idleSeconds >= this.stageDuration && this.nudgeCount === 1) {
      this.nudgeCount = 2
      this.lastUserActivityTime = this.currentTime
      this.silenceSeconds = 0
      this.speakFillerNudge(2)
      return
    }

    // Step 3: Exactly stageDuration seconds of inactivity after Nudge 2 -> Inactivity fallback
    if (idleSeconds >= this.stageDuration && this.nudgeCount === 2) {
      this.silenceSeconds = 0
      if (this.isVoiceQuestion && this.recordedSpeech.length >= 3) {
        this.submitAnswer()
      } else {
        this.skipUnanswered()
      }
      return
    }
  }
}

test('Interview Room Silence, Mic Policy & Activity Engine', async (t) => {
  await t.test('Test 1: Mic default policy strictly un-mutes descriptive and short answer questions', () => {
    assert.equal(getDefaultMicEnabled({ type: 'SHORT_ANSWER' }), true)
    assert.equal(getDefaultMicEnabled({ type: 'DESCRIPTIVE' }), true)
    assert.equal(getDefaultMicEnabled({ type: 'BEHAVIORAL' }), true)
    assert.equal(getDefaultMicEnabled({ question_type: 'short_answer' }), true)
    assert.equal(getDefaultMicEnabled({ question_type: 'descriptive' }), true)
    assert.equal(getDefaultMicEnabled({}), true) // Unknown defaults to active voice

    // Non-voice interactive types are muted by default
    assert.equal(getDefaultMicEnabled({ type: 'MULTIPLE_CHOICE' }), false)
    assert.equal(getDefaultMicEnabled({ type: 'CODE_WRITING' }), false)
    assert.equal(getDefaultMicEnabled({ type: 'SQL' }), false)
    assert.equal(getDefaultMicEnabled({ type: 'CODE_OUTPUT' }), false)
    assert.equal(getDefaultMicEnabled({ type: 'FILL_IN_THE_BLANK' }), false)
  })

  await t.test('Test 2: Per-question stage durations vary by question type', () => {
    assert.equal(getQuestionStageDuration({ type: 'MULTIPLE_CHOICE' }), 15)
    assert.equal(getQuestionStageDuration({ type: 'FILL_IN_THE_BLANK' }), 20)
    assert.equal(getQuestionStageDuration({ type: 'CODE_OUTPUT' }), 20)
    assert.equal(getQuestionStageDuration({ type: 'CODE_WRITING' }), 45)
    assert.equal(getQuestionStageDuration({ type: 'SQL' }), 45)
    assert.equal(getQuestionStageDuration({ type: 'DESCRIPTIVE' }), 15)
    assert.equal(getQuestionStageDuration({ type: 'SHORT_ANSWER' }), 15)
  })

  await t.test('Test 3: Multiple choice question 15s idle triggers Filler 1, then Filler 2, then skips', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'MULTIPLE_CHOICE' } })
    engine.concludeAiSpeakingAndUnlock()
    assert.equal(engine.stageDuration, 15)
    assert.equal(engine.nudgeCount, 0)

    // 14 seconds: no filler
    engine.advanceTime(14000)
    assert.equal(engine.nudgeCount, 0)

    // 15th second: Filler 1 triggers
    engine.advanceTime(1000)
    assert.equal(engine.nudgeCount, 1)
    assert.equal(engine.voiceState, 'SPEAKING')

    // AI speaks filler for 3s
    engine.advanceTime(3000)
    engine.concludeAiSpeakingAndUnlock()

    // 15 seconds after Filler 1 concludes: Filler 2 triggers
    engine.advanceTime(15000)
    assert.equal(engine.nudgeCount, 2)
    assert.equal(engine.voiceState, 'SPEAKING')

    // AI speaks filler for 3s
    engine.advanceTime(3000)
    engine.concludeAiSpeakingAndUnlock()

    // 15 seconds after Filler 2 concludes: Question skips!
    engine.advanceTime(15000)
    assert.equal(engine.unansweredCount, 1)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'question_skipped').length, 1)
  })

  await t.test('Test 4: Descriptive question has NO time limit once candidate responds', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'DESCRIPTIVE' } })
    engine.concludeAiSpeakingAndUnlock()
    assert.equal(engine.isVoiceQuestion, true)

    // Candidate starts speaking at second 5
    engine.advanceTime(5000)
    engine.candidateSpeaks('I would design the system with microservices...')
    assert.equal(engine.hasCandidateResponded, true)

    // Candidate continues talking/formulating for 60 full seconds: NO filler words, NO timeout!
    for (let s = 0; s < 12; s++) {
      engine.advanceTime(5000)
      // Candidate speaks a few words every 5s
      engine.candidateSpeaks('Adding redis caching layer...')
    }

    assert.equal(engine.nudgeCount, 0)
    assert.equal(engine.eventsTriggered.filter(e => e.type.startsWith('filler_')).length, 0)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'question_skipped').length, 0)

    // Candidate pauses for 6.0 and 10.0 seconds to think: NO premature auto-submission!
    engine.advanceTime(6000)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'answer_submitted').length, 0)
    engine.advanceTime(4000)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'answer_submitted').length, 0)

    // Candidate resumes speaking after pause
    engine.candidateSpeaks('And finally implement event-driven pub-sub architecture.')
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'answer_submitted').length, 0)

    // Candidate explicitly selects Submit Response
    engine.submitAnswer()
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'answer_submitted').length, 1)
  })

  await t.test('Test 5: Three consecutive unanswered questions closes the interview session', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'MULTIPLE_CHOICE' } })
    engine.concludeAiSpeakingAndUnlock()

    // Question 1: Unanswered (15s -> Filler 1 -> 15s -> Filler 2 -> 15s -> Skip)
    engine.advanceTime(15000) // Filler 1
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Filler 2
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Skip Q1
    assert.equal(engine.unansweredCount, 1)
    assert.equal(engine.isCompleted, false)

    // Question 2: Unanswered
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Filler 1
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Filler 2
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Skip Q2
    assert.equal(engine.unansweredCount, 2)
    assert.equal(engine.isCompleted, false)

    // Question 3: Unanswered
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Filler 1
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Filler 2
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000) // Skip Q3 -> CLOSES SESSION!
    assert.equal(engine.unansweredCount, 3)
    assert.equal(engine.isCompleted, true)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'session_closed_unanswered').length, 1)
  })

  await t.test('Test 6: Answering a question resets consecutive unanswered count back to 0', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'MULTIPLE_CHOICE' } })
    engine.concludeAiSpeakingAndUnlock()

    // Skip Question 1
    engine.advanceTime(15000)
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000)
    engine.advanceTime(2000)
    engine.concludeAiSpeakingAndUnlock()
    engine.advanceTime(15000)
    assert.equal(engine.unansweredCount, 1)

    // Question 2: Candidate submits an answer!
    engine.concludeAiSpeakingAndUnlock()
    engine.submitAnswer()
    assert.equal(engine.unansweredCount, 0) // Reset back to 0!
  })

  await t.test('Test 7: Ambient mic audio level does NOT mark candidate responded on voice questions; 15s idle triggers Filler 1 then Filler 2', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'DESCRIPTIVE' } })
    assert.equal(engine.isVoiceQuestion, true)
    engine.concludeAiSpeakingAndUnlock()

    // Simulate ambient room noise (audioLevel spikes to 0.45)
    engine.audioLevel = 0.45
    // But candidate has NOT spoken any words (recordedSpeech is empty)
    assert.equal(engine.hasCandidateResponded, false)

    // Advance 15 seconds without spoken words: Filler 1 MUST fire!
    engine.advanceTime(15000)
    assert.equal(engine.nudgeCount, 1)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'filler_1_started').length, 1)

    // AI concludes filler 1
    engine.concludeAiSpeakingAndUnlock()

    // Advance another 15 seconds without spoken words: Filler 2 MUST fire!
    engine.advanceTime(15000)
    assert.equal(engine.nudgeCount, 2)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'filler_2_started').length, 1)

    // Candidate now starts speaking!
    engine.concludeAiSpeakingAndUnlock()
    engine.candidateSpeaks('Here is my complete architecture explanation...')
    assert.equal(engine.hasCandidateResponded, true)

    // Now unlimited time applies: advancing 30s does NOT trigger skip or fillers
    engine.advanceTime(30000)
    assert.equal(engine.unansweredCount, 0)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'question_skipped').length, 0)
  })

  await t.test('Test 8: Warmup countdown buffer (roomStartupCountdown) decrements 2 -> 1 -> 0 and then 15s silence triggers Filler 1 and Filler 2', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'MULTIPLE_CHOICE' } })
    // Room starts with 2 second warmup countdown
    engine.roomStartupCountdown = 2
    engine.concludeAiSpeakingAndUnlock()

    // At 1s: countdown is still active (1 > 0), silence remains 0
    engine.roomStartupCountdown = 1
    engine.advanceTime(1000)
    assert.equal(engine.silenceSeconds, 0)
    assert.equal(engine.nudgeCount, 0)

    // At 2s: countdown finishes (0), candidate turn is active
    engine.roomStartupCountdown = 0
    engine.lastUserActivityTime = engine.currentTime

    // Advance 15s without activity -> Filler 1 triggers!
    engine.advanceTime(15000)
    assert.equal(engine.nudgeCount, 1)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'filler_1_started').length, 1)

    // AI concludes filler 1
    engine.concludeAiSpeakingAndUnlock()

    // Advance another 15s without activity -> Filler 2 triggers!
    engine.advanceTime(15000)
    assert.equal(engine.nudgeCount, 2)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'filler_2_started').length, 1)
  })

  await t.test('Test 9: Passive mouse movements on voice questions are ignored and do NOT reset silence or cancel nudges', () => {
    const engine = new InterviewRoomSilenceEngine({ question: { type: 'SHORT_ANSWER' } })
    assert.equal(engine.isVoiceQuestion, true)
    engine.concludeAiSpeakingAndUnlock()

    // Advance 8 seconds
    engine.advanceTime(8000)
    assert.equal(engine.silenceSeconds, 8)

    // Passive mousemove occurs
    engine.handleUserActivity('mousemove')
    // Silence should NOT be reset to 0!
    assert.equal(engine.silenceSeconds, 8)

    // Advance another 7 seconds (total 15s) -> Filler 1 triggers!
    engine.advanceTime(7000)
    assert.equal(engine.nudgeCount, 1)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'filler_1_started').length, 1)

    // AI concludes filler 1
    engine.concludeAiSpeakingAndUnlock()

    // More mouse moves after nudge 1 do NOT reset nudgeCount back to 0!
    engine.handleUserActivity('mousemove')
    assert.equal(engine.nudgeCount, 1)

    // Advance another 15 seconds -> Filler 2 triggers!
    engine.advanceTime(15000)
    assert.equal(engine.nudgeCount, 2)
    assert.equal(engine.eventsTriggered.filter(e => e.type === 'filler_2_started').length, 1)
  })
})

