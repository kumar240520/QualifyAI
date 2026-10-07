import React from 'react'
import DescriptiveQuestion from './questions/DescriptiveQuestion.jsx'
import MultipleChoiceQuestion from './questions/MultipleChoiceQuestion.jsx'
import MultiSelectQuestion from './questions/MultiSelectQuestion.jsx'
import FillBlankQuestion from './questions/FillBlankQuestion.jsx'
import CodeOutputQuestion from './questions/CodeOutputQuestion.jsx'
import CodeWritingQuestion from './questions/CodeWritingQuestion.jsx'
import SQLQuestion from './questions/SQLQuestion.jsx'
import BooleanQuestion from './questions/BooleanQuestion.jsx'
import ScenarioQuestion from './questions/ScenarioQuestion.jsx'
import BehavioralQuestion from './questions/BehavioralQuestion.jsx'

/**
 * QuestionRenderer - Dynamic Question Interaction Engine
 * Renders tailored interactive answer surfaces based on the normalized question model
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

  switch (question.type) {
    case 'MULTIPLE_CHOICE':
    case 'SINGLE_CHOICE':
      return <MultipleChoiceQuestion {...commonProps} />

    case 'MULTI_SELECT':
      return <MultiSelectQuestion {...commonProps} />

    case 'FILL_IN_THE_BLANK':
      return <FillBlankQuestion {...commonProps} />

    case 'CODE_OUTPUT':
      return <CodeOutputQuestion {...commonProps} />

    case 'CODE_WRITING':
      return <CodeWritingQuestion {...commonProps} />

    case 'SQL':
      return <SQLQuestion {...commonProps} />

    case 'TRUE_FALSE':
    case 'YES_NO':
      return <BooleanQuestion {...commonProps} />

    case 'SCENARIO':
      return <ScenarioQuestion {...commonProps} />

    case 'BEHAVIORAL':
      return <BehavioralQuestion {...commonProps} />

    case 'DESCRIPTIVE':
    default:
      return <DescriptiveQuestion {...commonProps} />
  }
}
