import React from 'react'
import MultipleChoiceQuestion from './questions/MultipleChoiceQuestion.jsx'
import MultiSelectQuestion from './questions/MultiSelectQuestion.jsx'
import BooleanQuestion from './questions/BooleanQuestion.jsx'
import ShortAnswerQuestion from './questions/ShortAnswerQuestion.jsx'
import DescriptiveQuestion from './questions/DescriptiveQuestion.jsx'
import FillBlankQuestion from './questions/FillBlankQuestion.jsx'
import CodeWritingQuestion from './questions/CodeWritingQuestion.jsx'
import CodeOutputQuestion from './questions/CodeOutputQuestion.jsx'
import DebuggingQuestion from './questions/DebuggingQuestion.jsx'
import CompleteCodeQuestion from './questions/CompleteCodeQuestion.jsx'
import ArrangeOrderQuestion from './questions/ArrangeOrderQuestion.jsx'
import SelectMostAppropriateQuestion from './questions/SelectMostAppropriateQuestion.jsx'
import SliderScaleQuestion from './questions/SliderScaleQuestion.jsx'
import MatchingPairsQuestion from './questions/MatchingPairsQuestion.jsx'
import NumericalAptitudeQuestion from './questions/NumericalAptitudeQuestion.jsx'
import SQLQuestion from './questions/SQLQuestion.jsx'
import ScenarioQuestion from './questions/ScenarioQuestion.jsx'
import BehavioralQuestion from './questions/BehavioralQuestion.jsx'
import { normalizeQuestionType } from '../../utils/questionTypeRegistry.js'

/**
 * QuestionRenderer - Central Dynamic Question Interaction Engine
 * Renders dedicated interactive candidate surfaces for all 15 supported question types.
 */
export default function QuestionRenderer({
  question,
  value,
  candidateSpeech = '',
  onChange,
  onSubmit,
  isSubmitting = false,
  isAiSpeaking = false,
}) {
  if (!question) {
    return (
      <div className="p-8 text-center text-slate-400 font-mono text-xs">
        Waiting for active question...
      </div>
    )
  }

  const commonProps = {
    question,
    value,
    candidateSpeech,
    onChange,
    onSubmit,
    isSubmitting,
    isAiSpeaking,
  }

  const normalizedType = normalizeQuestionType(question.type)

  switch (normalizedType) {
    case 'MULTIPLE_CHOICE':
      return <MultipleChoiceQuestion {...commonProps} />

    case 'MULTI_SELECT':
      return <MultiSelectQuestion {...commonProps} />

    case 'TRUE_FALSE':
      return <BooleanQuestion {...commonProps} />

    case 'SHORT_ANSWER':
      return <ShortAnswerQuestion {...commonProps} />

    case 'DESCRIPTIVE':
      return <DescriptiveQuestion {...commonProps} />

    case 'FILL_IN_THE_BLANK':
      return <FillBlankQuestion {...commonProps} />

    case 'CODING_CHALLENGE':
      return <CodeWritingQuestion {...commonProps} />

    case 'PREDICT_CODE_OUTPUT':
      return <CodeOutputQuestion {...commonProps} />

    case 'DEBUGGING':
      return <DebuggingQuestion {...commonProps} />

    case 'COMPLETE_THE_CODE':
      return <CompleteCodeQuestion {...commonProps} />

    case 'ARRANGE_ORDER':
      return <ArrangeOrderQuestion {...commonProps} />

    case 'SELECT_MOST_APPROPRIATE':
      return <SelectMostAppropriateQuestion {...commonProps} />

    case 'SLIDER_SCALE':
      return <SliderScaleQuestion {...commonProps} />

    case 'MATCHING_PAIRS':
      return <MatchingPairsQuestion {...commonProps} />

    case 'NUMERICAL_APTITUDE':
      return <NumericalAptitudeQuestion {...commonProps} />

    // Legacy / Specialized formats
    case 'SQL':
      return <SQLQuestion {...commonProps} />

    case 'SCENARIO':
      return <ScenarioQuestion {...commonProps} />

    case 'BEHAVIORAL':
      return <BehavioralQuestion {...commonProps} />

    default:
      return (
        <div className="p-6 text-center bg-red-50/60 border border-red-200 rounded-2xl text-red-700 font-sans space-y-2">
          <p className="font-bold text-sm">Unsupported Question Format: &ldquo;{question.type}&rdquo;</p>
          <p className="text-xs text-slate-600">This question type does not match any configured template. Please notify your interview proctor or recruiter.</p>
        </div>
      )
  }
}
