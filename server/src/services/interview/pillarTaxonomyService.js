/**
 * Enterprise Assessment Pillar Taxonomy Service
 * 
 * Invariant: Every assessment pillar is treated as an independent assessment domain
 * with its own fundamentals, assessment objective, and topic taxonomy.
 * 
 * Job context is a modifier where appropriate (e.g. behavioral scenarios),
 * NEVER a replacement for the pillar's fundamental assessment domain.
 * 
 * General aptitude pillars (Quantitative Aptitude, Logical Reasoning, Verbal Ability)
 * evaluate fundamental reasoning and aptitude, NOT the job title's operational duties.
 */

export const CANONICAL_TAXONOMIES = {
  QUANTITATIVE_APTITUDE: {
    id: 'quantitative_aptitude',
    name: 'Quantitative Aptitude',
    objective: 'Assess foundational arithmetic, numerical reasoning, ratios, percentages, and problem-solving fundamentals independently of job role duties.',
    subtopics: [
      { id: 'percentages', name: 'Percentages and Percentage Changes', description: 'Percentage increase, decrease, successive changes, discounts, and margins' },
      { id: 'ratios_proportions', name: 'Ratios and Proportions', description: 'Dividing quantities in ratios, direct and inverse proportion, mixture problems' },
      { id: 'averages', name: 'Averages and Weighted Means', description: 'Arithmetic mean, weighted average, and impact of new values on dataset mean' },
      { id: 'profit_loss', name: 'Profit and Loss', description: 'Cost price, selling price, profit/loss percentage, and markup' },
      { id: 'time_work', name: 'Time and Work', description: 'Work efficiency, rate problems, joint work completion' },
      { id: 'speed_distance_time', name: 'Speed, Distance, and Time', description: 'Relative speed, average speed, travel times, and distance calculations' },
      { id: 'ages', name: 'Age Problems', description: 'Linear equations relating past, present, and future ages' },
      { id: 'family_relationships', name: 'Family Relationship Reasoning', description: 'Kinship and relationship deduction from given familial statements' },
      { id: 'numerical_reasoning', name: 'Numerical Series and Mental Arithmetic', description: 'Arithmetic and geometric number series, missing term determination' },
    ],
    excludedTopics: [
      'Agile velocity',
      'Agile metrics',
      'agile_metrics',
      'Story point costs',
      'story_points',
      'Sprint budget calculations',
      'Scrum burndown metrics',
      'Project management overhead',
      'Team velocity',
      'sprint_velocity',
    ],
    appropriateQuestionTypes: ['NUMERICAL_APTITUDE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'SLIDER_SCALE', 'MULTI_SELECT'],
    allowsJobContext: false, // Invariant: Pure quantitative aptitude word problems
  },

  LOGICAL_REASONING: {
    id: 'logical_reasoning',
    name: 'Logical Reasoning',
    objective: 'Assess deductive logic, premise-conclusion validity, sequence analysis, pattern recognition, and structural reasoning.',
    subtopics: [
      { id: 'sequences', name: 'Number and Letter Sequences', description: 'Identifying progression rules and finding next or missing terms in symbolic series' },
      { id: 'deductions', name: 'Logical Deductions and Syllogisms', description: 'Determining if formal conclusions follow necessarily from stated premises' },
      { id: 'arrangements', name: 'Ordering and Seating Arrangements', description: 'Linear, circular, and ranking constraints to deduce positions' },
      { id: 'patterns', name: 'Pattern Recognition & Rule Induction', description: 'Abstract rule detection, classification, and odd-one-out puzzles' },
      { id: 'direction_spatial', name: 'Direction and Spatial Logic', description: 'Navigating directional turns, compass coordinates, and relative positions' },
      { id: 'cause_effect', name: 'Cause and Effect Analysis', description: 'Distinguishing necessary vs sufficient conditions and valid causal links' },
      { id: 'puzzles', name: 'Truth-Teller and Paradox Puzzles', description: 'Analytical deduction under conditional truth/lie statements' },
    ],
    excludedTopics: [
      'Agile ceremonies',
      'Team retrospective processes',
      'Sprint planning procedures',
      'Generic management tools',
    ],
    appropriateQuestionTypes: ['ARRANGE_ORDER', 'MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER', 'MATCHING_PAIRS'],
    allowsJobContext: false,
  },

  VERBAL_ABILITY: {
    id: 'verbal_ability',
    name: 'Verbal Ability',
    objective: 'Assess grammar, vocabulary precision, sentence correction, reading comprehension, and verbal reasoning.',
    subtopics: [
      { id: 'grammar_syntax', name: 'Grammar and Sentence Correction', description: 'Subject-verb agreement, tense consistency, misplaced modifiers, and syntax rules' },
      { id: 'vocabulary', name: 'Vocabulary and Contextual Meaning', description: 'Precise word selection, synonyms, antonyms, and connotation nuances' },
      { id: 'sentence_completion', name: 'Sentence Completion & Cloze', description: 'Selecting appropriate transitional words and grammatical completions' },
      { id: 'reading_comprehension', name: 'Reading Comprehension', description: 'Extracting key claims, drawing valid inferences, and identifying main ideas' },
      { id: 'verbal_analogies', name: 'Verbal Analogies and Critical Reasoning', description: 'Evaluating relational pairs, hidden assumptions, and argument strength' },
    ],
    excludedTopics: [
      'Math calculations',
      'Software code syntax',
      'Sprint budgeting',
    ],
    appropriateQuestionTypes: ['FILL_IN_THE_BLANK', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'DESCRIPTIVE', 'MATCHING_PAIRS'],
    allowsJobContext: false,
  },

  DATA_INTERPRETATION: {
    id: 'data_interpretation',
    name: 'Data Interpretation',
    objective: 'Assess ability to read, analyze, compare, and extract calculations from structured datasets, tables, or charts.',
    subtopics: [
      { id: 'table_analysis', name: 'Tabular Data Analysis', description: 'Interpreting multi-column tables, computing row/column ratios, identifying extrema' },
      { id: 'chart_evaluation', name: 'Bar and Line Chart Trends', description: 'Evaluating trajectories, percentage growths, and trend reversals over intervals' },
      { id: 'pie_chart_distribution', name: 'Pie Chart Proportions', description: 'Calculating sector contributions, degree angles, and percentage allocations' },
      { id: 'caselet_interpretation', name: 'Dataset Caselet Interpretation', description: 'Synthesizing insights from multi-variable descriptive data summaries' },
    ],
    excludedTopics: [
      'Abstract philosophy',
      'Vague behavioral anecdotes',
    ],
    appropriateQuestionTypes: ['MULTIPLE_CHOICE', 'NUMERICAL_APTITUDE', 'MULTI_SELECT', 'SHORT_ANSWER'],
    allowsJobContext: true, // Can use relevant industry data, but MUST require actual table/data analysis!
  },

  BEHAVIORAL_COMPETENCIES: {
    id: 'behavioral_competencies',
    name: 'Behavioral Competencies & Leadership',
    objective: 'Assess interpersonal collaboration, conflict resolution, leadership, stakeholder communication, and decision-making.',
    subtopics: [
      { id: 'collaboration', name: 'Cross-Functional Collaboration', description: 'Working across disciplines, aligning shared goals, and empathetic teamwork' },
      { id: 'conflict_resolution', name: 'Conflict Resolution', description: 'Navigating professional disagreements constructively and maintaining morale' },
      { id: 'prioritization', name: 'Prioritization & Resource Trade-offs', description: 'Balancing urgent vs important, managing scarce bandwidth and deadlines' },
      { id: 'accountability', name: 'Accountability and Ownership', description: 'Taking responsibility for project outcomes, failures, and proactive remediation' },
      { id: 'decision_making', name: 'Decision-Making under Uncertainty', description: 'Evaluating ambiguous data, assessing risks, and committing to direction' },
      { id: 'mentorship', name: 'Team Mentorship and Coaching', description: 'Fostering growth, psychological safety, and providing actionable feedback' },
    ],
    excludedTopics: [
      'Pure numerical arithmetic tricks',
      'Syntax memorization',
    ],
    appropriateQuestionTypes: ['SELECT_MOST_APPROPRIATE', 'DESCRIPTIVE', 'SHORT_ANSWER', 'SLIDER_SCALE'],
    allowsJobContext: true, // Role context (e.g. Team Manager, Senior Engineer) is directly relevant
  },

  PROGRAMMING_FUNDAMENTALS: {
    id: 'programming_fundamentals',
    name: 'Programming Fundamentals',
    objective: 'Assess syntax, control structures, functions, scoping, memory lifecycle, and clean coding principles.',
    subtopics: [
      { id: 'syntax_semantics', name: 'Language Syntax and Semantics', description: 'Keywords, operators, statements, and idiomatic constructs' },
      { id: 'scoping_closures', name: 'Scope, Closures, and Variable Lifetime', description: 'Lexical scope, closure capture, shadowing, and stack/heap memory' },
      { id: 'control_flow', name: 'Control Flow and Recursion', description: 'Branching, loop mechanics, recursion base cases, and iteration safety' },
      { id: 'error_handling', name: 'Error and Exception Handling', description: 'Try-catch mechanisms, custom exceptions, and resource cleanup' },
      { id: 'data_types', name: 'Types and Data Structures', description: 'Primitive vs reference types, mutability, type coercion, and memory layout' },
    ],
    excludedTopics: [
      'Generic marketing slogans',
      'Team retrospectives',
    ],
    appropriateQuestionTypes: ['CODING_CHALLENGE', 'PREDICT_CODE_OUTPUT', 'DEBUGGING', 'COMPLETE_THE_CODE', 'MULTIPLE_CHOICE'],
    allowsJobContext: true,
  },

  DATA_STRUCTURES_ALGORITHMS: {
    id: 'data_structures_algorithms',
    name: 'Data Structures & Algorithms',
    objective: 'Assess fundamental data structures, algorithmic paradigms, and space/time asymptotic complexity.',
    subtopics: [
      { id: 'linear_structures', name: 'Arrays, Linked Lists, Stacks, Queues', description: 'Operations, memory overhead, cache locality, and FIFO/LIFO mechanics' },
      { id: 'trees_graphs', name: 'Trees and Graphs', description: 'Binary search trees, balanced trees, BFS, DFS, and graph traversal' },
      { id: 'sorting_searching', name: 'Sorting and Searching', description: 'Binary search, Quicksort, Mergesort, and search space optimization' },
      { id: 'complexity_analysis', name: 'Asymptotic Complexity (Big-O)', description: 'Worst-case, average-case, amortized time and auxiliary space analysis' },
      { id: 'dynamic_programming', name: 'Dynamic Programming and Greedy', description: 'Optimal substructure, memoization, tabular state transitions' },
      { id: 'hashing', name: 'Hash Maps and Sets', description: 'Collision resolution strategies, load factors, hash distribution' },
    ],
    excludedTopics: [
      'Sprint velocity calculation',
      'Product marketing strategy',
    ],
    appropriateQuestionTypes: ['CODING_CHALLENGE', 'PREDICT_CODE_OUTPUT', 'COMPLETE_THE_CODE', 'MULTIPLE_CHOICE', 'NUMERICAL_APTITUDE'],
    allowsJobContext: false,
  },

  DATABASE_CONCEPTS: {
    id: 'database_concepts',
    name: 'Database Concepts & Query Optimization',
    objective: 'Assess relational and document databases, schema normalization, indexing, transactions, and ACID guarantees.',
    subtopics: [
      { id: 'schema_normalization', name: 'Schema Design and Normalization', description: 'Entity relationships, 1NF through BCNF, denormalization trade-offs' },
      { id: 'indexing_plans', name: 'Indexing and Query Plans', description: 'B-Trees, composite indexes, full-table scans, and execution plan analysis' },
      { id: 'transactions_acid', name: 'Transactions, ACID & Isolation Levels', description: 'Dirty reads, non-repeatable reads, phantom reads, serializability' },
      { id: 'sql_queries', name: 'Advanced SQL Querying', description: 'Complex joins, window functions, CTEs, and aggregation pipelines' },
      { id: 'distributed_data', name: 'Distributed Storage & Consistency', description: 'Replication lag, sharding, partitioning, CAP theorem, and event consistency' },
    ],
    excludedTopics: [
      'Agile story points',
      'Team meetings',
    ],
    appropriateQuestionTypes: ['CODING_CHALLENGE', 'MULTIPLE_CHOICE', 'SHORT_ANSWER', 'TRUE_FALSE', 'DEBUGGING'],
    allowsJobContext: true,
  },

  SYSTEM_DESIGN: {
    id: 'system_design',
    name: 'System Design & Distributed Architecture',
    objective: 'Assess scalable architecture design, trade-offs, fault tolerance, caching, and distributed communication.',
    subtopics: [
      { id: 'scalability_balancing', name: 'Scalability & Load Balancing', description: 'Horizontal scaling, reverse proxies, layer 4 vs layer 7 routing' },
      { id: 'caching_strategies', name: 'Caching and Invalidation', description: 'Cache-aside, write-through, write-back, Redis, eviction policies (LRU/LFU)' },
      { id: 'asynchronous_messaging', name: 'Message Queues & Event Streaming', description: 'Kafka, RabbitMQ, at-least-once delivery, consumer groups, idempotency' },
      { id: 'resilience_fault_tolerance', name: 'Fault Tolerance & Resilience', description: 'Circuit breakers, retry with exponential backoff, rate limiting, self-healing' },
      { id: 'consensus_coordination', name: 'Consensus & Coordination', description: 'Raft, Paxos, leader election, distributed locking, split-brain mitigation' },
    ],
    excludedTopics: [
      'Simple arithmetic drills',
      'Sprint velocity formulas',
    ],
    appropriateQuestionTypes: ['DESCRIPTIVE', 'SELECT_MOST_APPROPRIATE', 'SLIDER_SCALE', 'ARRANGE_ORDER'],
    allowsJobContext: true,
  },
}

/**
 * Resolves or builds a structured taxonomy for any assessment pillar criterion.
 * 
 * @param {Object} criterion - Rubric criterion record { id, name, description, ... }
 * @param {'technical' | 'non_technical'} foundationalBackground - Foundational interview background
 * @returns {Object} Structured pillar taxonomy
 */
export function resolvePillarTaxonomy(criterion, foundationalBackground = 'technical') {
  if (!criterion) {
    return CANONICAL_TAXONOMIES.BEHAVIORAL_COMPETENCIES
  }

  const rawName = String(criterion.name || '').trim()
  const rawDesc = String(criterion.description || '').trim()
  const combined = `${rawName} ${rawDesc}`.toLowerCase()

  const attachMeta = (tax) => ({
    ...tax,
    taxonomyId: tax.id,
    criterionId: criterion.id,
    criterionName: criterion.name,
  })

  // Match canonical taxonomies
  if (/quant|aptitude|math|arithmetic|numerical reasoning|calculation/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.QUANTITATIVE_APTITUDE)
  }

  if (/logical|reasoning|deduct|syllogism|analytical thinking|pattern/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.LOGICAL_REASONING)
  }

  if (/verbal|english|grammar|comprehension|vocabulary|communication clarity/i.test(combined) && !/system|design|code/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.VERBAL_ABILITY)
  }

  if (/data interpretation|chart|graph|table interpretation|tabular/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.DATA_INTERPRETATION)
  }

  if (/behavior|collaboration|leadership|conflict|management|people|teamwork|ownership/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.BEHAVIORAL_COMPETENCIES)
  }

  if (/database|sql|nosql|storage|query|indexing|acid|transaction/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.DATABASE_CONCEPTS)
  }

  if (/system design|distributed|architecture|scalable|microservice|concurrency/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.SYSTEM_DESIGN)
  }

  if (/data structure|algorithm|dsa|complexity|tree|graph|sorting/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.DATA_STRUCTURES_ALGORITHMS)
  }

  if (/program|coding|software|syntax|implementation|code quality/i.test(combined)) {
    return attachMeta(CANONICAL_TAXONOMIES.PROGRAMMING_FUNDAMENTALS)
  }

  // Fallback: Dynamically synthesize taxonomy for custom recruiter-defined pillar
  return synthesizeCustomTaxonomy(criterion, foundationalBackground)
}

function synthesizeCustomTaxonomy(criterion, foundationalBackground) {
  const name = criterion.name || 'Assessment Competency'
  const desc = criterion.description || 'Evaluation of core competencies'
  const isTech = foundationalBackground === 'technical'

  return {
    id: `custom_${String(name).toLowerCase().replace(/[^a-z0-9]+/g, '_')}`,
    name,
    criterionId: criterion.id,
    criterionName: name,
    objective: desc,
    subtopics: [
      { id: 'sub_1', name: `${name} Fundamentals`, description: `Foundational principles and concepts in ${name}` },
      { id: 'sub_2', name: `${name} Practical Execution`, description: `Application, methodologies, and edge-cases in ${name}` },
      { id: 'sub_3', name: `${name} Problem-Solving`, description: `Troubleshooting and resolving real-world problems in ${name}` },
      { id: 'sub_4', name: `${name} Trade-offs & Analysis`, description: `Evaluating alternative strategies and trade-offs in ${name}` },
      { id: 'sub_5', name: `${name} Best Practices`, description: `Industry standards, quality metrics, and best practices in ${name}` },
    ],
    excludedTopics: [
      'Unrelated job trivia',
      'Irrelevant superficial calculations',
    ],
    appropriateQuestionTypes: isTech
      ? ['SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SELECT_MOST_APPROPRIATE', 'TRUE_FALSE']
      : ['SELECT_MOST_APPROPRIATE', 'SHORT_ANSWER', 'DESCRIPTIVE', 'MULTIPLE_CHOICE', 'SLIDER_SCALE'],
    allowsJobContext: true,
  }
}
