/**
 * Graph Utilities for PathAI
 * Provides helper functions to build and traverse course prerequisite graphs
 */

/**
 * Build an adjacency list from courses array
 * Edge direction: prerequisite -> course (what it unlocks)
 */
function buildAdjacencyList(courses) {
  const adj = {};
  const inDegree = {};

  courses.forEach(c => {
    adj[c.id] = [];
    inDegree[c.id] = 0;
  });

  courses.forEach(c => {
    c.prerequisites.forEach(prereq => {
      if (adj[prereq]) {
        adj[prereq].push(c.id);
        inDegree[c.id] = (inDegree[c.id] || 0) + 1;
      }
    });
  });

  return { adj, inDegree };
}

/**
 * Topological sort using Kahn's Algorithm
 * Returns sorted order or null if cyclic
 */
function topologicalSort(courses) {
  const { adj, inDegree } = buildAdjacencyList(courses);
  const queue = [];
  const result = [];

  // Start with courses that have no prerequisites
  courses.forEach(c => {
    if (inDegree[c.id] === 0) queue.push(c.id);
  });

  while (queue.length > 0) {
    const node = queue.shift();
    result.push(node);
    adj[node].forEach(neighbor => {
      inDegree[neighbor]--;
      if (inDegree[neighbor] === 0) queue.push(neighbor);
    });
  }

  // If not all courses included, there's a cycle
  if (result.length !== courses.length) return null;
  return result;
}

/**
 * Check if all prerequisites of a course are in the completedSet
 */
function prerequisitesSatisfied(course, completedSet) {
  return course.prerequisites.every(prereq => completedSet.has(prereq));
}

/**
 * Get all courses available to take given completed courses
 */
function getAvailableCourses(courses, completedSet) {
  return courses.filter(c =>
    !completedSet.has(c.id) &&
    prerequisitesSatisfied(c, completedSet)
  );
}

/**
 * Calculate the critical path length (longest path to course)
 * Used as heuristic for A*
 */
function calculateCriticalPath(courseId, courses, memo = {}) {
  if (memo[courseId] !== undefined) return memo[courseId];

  const course = courses.find(c => c.id === courseId);
  if (!course) return 0;
  if (course.prerequisites.length === 0) {
    memo[courseId] = 1;
    return 1;
  }

  const maxPrereqPath = Math.max(
    ...course.prerequisites.map(prereqId =>
      calculateCriticalPath(prereqId, courses, memo)
    )
  );

  memo[courseId] = maxPrereqPath + 1;
  return memo[courseId];
}

/**
 * Build a reverse adjacency list (course -> prerequisites)
 */
function buildReverseAdj(courses) {
  const revAdj = {};
  courses.forEach(c => {
    revAdj[c.id] = [...c.prerequisites];
  });
  return revAdj;
}

/**
 * Get all ancestors of a course (transitive prerequisites)
 */
function getAllAncestors(courseId, courses) {
  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  const visited = new Set();
  const stack = [...(courseMap[courseId]?.prerequisites || [])];

  while (stack.length > 0) {
    const curr = stack.pop();
    if (!visited.has(curr) && courseMap[curr]) {
      visited.add(curr);
      courseMap[curr].prerequisites.forEach(p => stack.push(p));
    }
  }

  return [...visited];
}

/**
 * Count total courses reachable from a node (downstream)
 */
function countReachable(courseId, adj, visited = new Set()) {
  if (visited.has(courseId)) return 0;
  visited.add(courseId);
  let count = 1;
  (adj[courseId] || []).forEach(neighbor => {
    count += countReachable(neighbor, adj, visited);
  });
  return count;
}

module.exports = {
  buildAdjacencyList,
  topologicalSort,
  prerequisitesSatisfied,
  getAvailableCourses,
  calculateCriticalPath,
  buildReverseAdj,
  getAllAncestors,
  countReachable
};
