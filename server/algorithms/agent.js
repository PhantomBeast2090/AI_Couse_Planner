/**
 * Intelligent Agent for Academic Planning
 *
 * The agent operates as a goal-based, utility-maximizing agent: it scores
 * candidate plans per goal and picks the highest-utility one. "Best" below
 * always means highest utility score, never a proven global optimum.
 *
 * It chooses the BEST-scoring algorithm and configuration based on:
 *   - User's optimization goal
 *   - Course graph properties
 *   - Constraint severity
 *
 * Optimization Goals:
 *   1. 'fastest'       → Prefers fewer semesters (uses BFS-style)
 *   2. 'easiest'       → Prefers lower cumulative difficulty (uses UCS)
 *   3. 'balanced'      → Even workload distribution (uses A*)
 *   4. 'specialization'→ Front-load tagged courses (custom priority)
 * 
 * The agent uses:
 *   - Environment perception (analyze course graph)
 *   - Goal reasoning
 *   - Action selection (pick + run best algorithm)
 *   - Plan scoring (utility function)
 */

const { bfsPlanner } = require('./bfs');
const { ucsPlanner } = require('./ucs');
const { astarPlanner } = require('./astar');
const { cspPlanner } = require('./csp');
const { buildAdjacencyList, topologicalSort } = require('../utils/graphUtils');

/**
 * Utility scoring function for a semester plan
 * Higher score = better plan
 */
function scorePlan(semesterPlan, goal, specializationTags = []) {
  if (!semesterPlan || semesterPlan.length === 0) return -Infinity;

  let score = 0;
  const totalSemesters = semesterPlan.length;
  const totalCredits = semesterPlan.reduce((s, sem) => s + sem.totalCredits, 0);
  const avgCredits = totalCredits / totalSemesters;

  // Average difficulty per semester
  const diffPerSem = semesterPlan.map(sem =>
    sem.courses.reduce((s, c) => s + c.difficulty, 0) / sem.courses.length
  );
  const diffVariance = variance(diffPerSem);

  switch (goal) {
    case 'fastest':
      // Reward fewer semesters, penalize more
      score = 100 - (totalSemesters * 10);
      // Bonus for high credit loads
      score += avgCredits * 2;
      break;

    case 'easiest':
      // Reward low total difficulty, penalize hard early semesters
      const totalDiff = semesterPlan.reduce((s, sem) =>
        s + sem.courses.reduce((cs, c) => cs + c.difficulty, 0), 0);
      score = 200 - totalDiff;
      // Reward if hard courses are later
      semesterPlan.forEach((sem, i) => {
        const semDiff = sem.courses.reduce((s, c) => s + c.difficulty, 0);
        score += (i / totalSemesters) * semDiff * 0.5; // later = less penalty
      });
      break;

    case 'balanced':
      // Reward low variance in workload across semesters
      score = 100 - (diffVariance * 20);
      // Reward consistent credit counts
      const creditPerSem = semesterPlan.map(sem => sem.totalCredits);
      score -= variance(creditPerSem) * 2;
      break;

    case 'specialization':
      // Reward early scheduling of specialized courses
      let specializationScore = 0;
      semesterPlan.forEach((sem, i) => {
        sem.courses.forEach(c => {
          const hasTag = specializationTags.some(t => (c.tags || []).includes(t));
          if (hasTag) {
            // Earlier is better (lower i = better)
            specializationScore += (totalSemesters - i) * 5;
          }
        });
      });
      score = specializationScore;
      break;

    default:
      score = 100 - (totalSemesters * 5) - (diffVariance * 10);
  }

  return score;
}

function variance(arr) {
  if (arr.length === 0) return 0;
  const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
  return arr.reduce((s, v) => s + Math.pow(v - mean, 2), 0) / arr.length;
}

/**
 * Analyze the course graph to inform algorithm selection.
 * Returns zeroed metrics (never NaN) for the empty course set.
 */
function perceiveEnvironment(courses) {
  if (!courses || courses.length === 0) {
    return {
      totalCourses: 0,
      avgPrereqs: 0,
      avgDifficulty: 0,
      hasCycles: false,
      maxDepth: 0,
      isComplexGraph: false
    };
  }
  const { adj } = buildAdjacencyList(courses);
  const topoOrder = topologicalSort(courses);
  const totalCourses = courses.length;
  const avgPrereqs = courses.reduce((s, c) => s + c.prerequisites.length, 0) / totalCourses;
  const avgDifficulty = courses.reduce((s, c) => s + c.difficulty, 0) / totalCourses;
  const hasCycles = topoOrder === null;

  // Find the maximum depth (critical path length)
  let maxDepth = 0;
  if (topoOrder) {
    const depth = {};
    courses.forEach(c => { depth[c.id] = 0; });
    topoOrder.forEach(id => {
      const course = courses.find(c => c.id === id);
      if (course) {
        course.prerequisites.forEach(prereq => {
          depth[id] = Math.max(depth[id], (depth[prereq] || 0) + 1);
        });
        maxDepth = Math.max(maxDepth, depth[id]);
      }
    });
  }

  return {
    totalCourses,
    avgPrereqs,
    avgDifficulty,
    hasCycles,
    maxDepth,
    isComplexGraph: avgPrereqs > 2 || maxDepth > 5
  };
}

/**
 * Main Intelligent Agent function
 */
function intelligentAgent(courses, constraints = {}, completedCourses = new Set(), goal = 'balanced', specializationTags = []) {
  const agentLog = [];

  // PERCEPTION: Analyze environment
  const perception = perceiveEnvironment(courses);
  agentLog.push({
    phase: 'PERCEPTION',
    perception,
    message: `Agent perceives: ${perception.totalCourses} courses, avg difficulty=${perception.avgDifficulty.toFixed(1)}, max chain depth=${perception.maxDepth}`
  });

  if (perception.hasCycles) {
    return {
      algorithm: 'Agent',
      success: false,
      error: 'Cyclic prerequisites detected',
      unplanned: courses.map(c => c.id),
      agentLog,
      semesterPlan: []
    };
  }

  // Empty course set: vacuous success with an empty plan (never NaN scores).
  if (perception.totalCourses === 0) {
    agentLog.push({
      phase: 'DECISION',
      chosenStrategy: null,
      score: 0,
      message: 'Agent DECISION: no courses to plan - returning empty plan'
    });
    return {
      algorithm: 'Intelligent Agent',
      success: true,
      unplanned: [],
      chosenStrategy: null,
      allStrategiesEvaluated: [],
      semesterPlan: [],
      nodesExplored: [],
      totalSemesters: 0,
      totalCourses: 0,
      workloadAnalysis: [],
      recommendations: [],
      agentLog,
      steps: []
    };
  }

  // REASONING: Choose strategies to evaluate
  const strategyMap = {
    fastest: ['bfs', 'astar'],
    easiest: ['ucs', 'astar'],
    balanced: ['astar', 'bfs'],
    specialization: ['astar', 'bfs', 'ucs']
  };

  const strategies = strategyMap[goal] || ['astar', 'bfs'];

  agentLog.push({
    phase: 'REASONING',
    goal,
    strategies,
    message: `Agent reasoning: Goal="${goal}", evaluating strategies: ${strategies.join(', ')}`
  });

  // ACTION: Run all candidate algorithms and score
  const results = [];

  strategies.forEach(strat => {
    let result;
    const startTime = Date.now();

    switch (strat) {
      case 'bfs':
        result = bfsPlanner(courses, constraints, completedCourses);
        break;
      case 'ucs':
        result = ucsPlanner(courses, constraints, completedCourses);
        break;
      case 'astar':
        result = astarPlanner(courses, constraints, completedCourses, goal);
        break;
      default:
        result = bfsPlanner(courses, constraints, completedCourses);
    }

    const elapsed = Date.now() - startTime;
    const utilityScore = scorePlan(result.semesterPlan, goal, specializationTags);

    results.push({ strat, result, score: utilityScore, elapsed });

    agentLog.push({
      phase: 'ACTION',
      strategy: strat,
      semesters: result.semesterPlan?.length,
      score: utilityScore,
      elapsed,
      message: `Agent ran "${strat}": ${result.semesterPlan?.length} semesters, utility=${utilityScore.toFixed(1)}, time=${elapsed}ms`
    });
  });

  // DECISION: successful candidates outrank failed ones; argmax on score
  // within each group. A partial failure must never win on score alone and
  // be returned as a success.
  results.sort((a, b) => {
    const sa = a.result && a.result.success ? 1 : 0;
    const sb = b.result && b.result.success ? 1 : 0;
    if (sa !== sb) return sb - sa;
    return b.score - a.score;
  });
  const best = results[0];

  // If every candidate failed (empty plan), fail safely instead of
  // returning an empty plan as if it were a valid schedule.
  const bestPlan = best.result.semesterPlan || [];
  const bestFailed = !best.result.success;
  if (bestPlan.length === 0 || bestFailed) {
    agentLog.push({
      phase: 'DECISION',
      chosenStrategy: bestFailed ? best.strat : null,
      score: best.score,
      message: bestFailed
        ? `Agent DECISION: best candidate "${best.strat}" failed - no valid plan`
        : `Agent DECISION: all strategies failed (${results.map(r => r.strat).join(', ')}) - no valid plan`
    });
    return {
      algorithm: 'Intelligent Agent',
      success: false,
      error: best.result.error || 'No valid plan found for the given constraints',
      unplanned: best.result.unplanned || courses.map(c => c.id),
      chosenStrategy: null,
      allStrategiesEvaluated: results.map(r => ({
        strategy: r.strat,
        semesters: r.result.semesterPlan?.length || 0,
        score: Number.isFinite(r.score) ? +r.score.toFixed(2) : null,
        elapsed: r.elapsed
      })),
      semesterPlan: [],
      nodesExplored: [],
      totalSemesters: 0,
      totalCourses: courses.length,
      workloadAnalysis: [],
      recommendations: [],
      agentLog,
      steps: []
    };
  }

  // Build semester-by-semester workload analysis
  const workloadAnalysis = best.result.semesterPlan.map((sem, i) => {
    const avgDiff = sem.courses.length > 0
      ? sem.courses.reduce((s, c) => s + c.difficulty, 0) / sem.courses.length
      : 0;
    return {
      semester: i + 1,
      avgDifficulty: +avgDiff.toFixed(2),
      totalCredits: sem.totalCredits,
      hardCount: sem.hardCourseCount,
      workloadLabel: avgDiff < 2 ? 'Light' : avgDiff < 3.5 ? 'Moderate' : 'Heavy'
    };
  });

  // Recommendations
  const recommendations = generateRecommendations(best.result.semesterPlan, goal, perception);

  agentLog.push({
    phase: 'DECISION',
    chosenStrategy: best.strat,
    score: best.score,
    message: `Agent DECISION: Best strategy is "${best.strat}" with utility score ${best.score.toFixed(1)}`
  });

  return {
    algorithm: 'Intelligent Agent',
    success: true,
    unplanned: best.result.unplanned || [],
    chosenStrategy: best.strat,
    allStrategiesEvaluated: results.map(r => ({
      strategy: r.strat,
      semesters: r.result.semesterPlan?.length || 0,
      score: Number.isFinite(r.score) ? +r.score.toFixed(2) : null,
      elapsed: r.elapsed
    })),
    semesterPlan: best.result.semesterPlan,
    nodesExplored: best.result.nodesExplored,
    totalSemesters: best.result.semesterPlan?.length || 0,
    totalCourses: courses.length,
    workloadAnalysis,
    recommendations,
    agentLog,
    steps: best.result.steps || []
  };
}

function generateRecommendations(semesterPlan, goal, perception) {
  const recs = [];

  if (!semesterPlan || semesterPlan.length === 0) return recs;

  // Check for very heavy semesters
  semesterPlan.forEach((sem, i) => {
    if (sem.hardCourseCount >= 2 && sem.totalCredits >= 15) {
      recs.push({
        type: 'WARNING',
        semester: i + 1,
        message: `Semester ${i + 1} is very heavy (${sem.totalCredits} credits, ${sem.hardCourseCount} hard courses). Consider redistributing.`
      });
    }
  });

  // Check for light semesters
  semesterPlan.forEach((sem, i) => {
    if (sem.totalCredits < 9 && i < semesterPlan.length - 1) {
      recs.push({
        type: 'TIP',
        semester: i + 1,
        message: `Semester ${i + 1} is light (${sem.totalCredits} credits). You could add electives or move courses earlier.`
      });
    }
  });

  // General goal-based advice
  if (goal === 'fastest' && semesterPlan.length > 6) {
    recs.push({
      type: 'INFO',
      message: `Your plan takes ${semesterPlan.length} semesters. Consider taking summer courses to graduate faster.`
    });
  }

  if (perception.avgDifficulty > 3.5) {
    recs.push({
      type: 'WARNING',
      message: 'High average course difficulty detected. Consider increasing max credits limit or reducing max hard courses per semester.'
    });
  }

  return recs;
}

module.exports = { intelligentAgent, scorePlan, perceiveEnvironment };
