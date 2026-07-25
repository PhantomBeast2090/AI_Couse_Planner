/**
 * PathAI — Large Academic Course Dataset
 * 80+ courses across CS, AI/ML, Data Science, Systems, Math, and Electives
 * Forms a valid DAG with beginner → intermediate → advanced chains
 */

const sampleCourses = [
  // ─────────────────────────────────────────────
  // MATHEMATICS FOUNDATION
  // ─────────────────────────────────────────────
  {
    id: 'math101', name: 'Pre-Calculus & Algebra', credits: 3, difficulty: 1,
    tags: ['Math', 'Foundation'], prerequisites: [], color: '#00ffff'
  },
  {
    id: 'math102', name: 'Calculus I', credits: 4, difficulty: 2,
    tags: ['Math', 'Foundation'], prerequisites: ['math101'], color: '#00ffff'
  },
  {
    id: 'math103', name: 'Calculus II', credits: 4, difficulty: 3,
    tags: ['Math', 'Foundation'], prerequisites: ['math102'], color: '#00ffff'
  },
  {
    id: 'math104', name: 'Multivariable Calculus', credits: 3, difficulty: 3,
    tags: ['Math', 'Intermediate'], prerequisites: ['math103'], color: '#00ffff'
  },
  {
    id: 'math201', name: 'Linear Algebra', credits: 3, difficulty: 3,
    tags: ['Math', 'Core'], prerequisites: ['math102'], color: '#00ffff'
  },
  {
    id: 'math202', name: 'Probability & Statistics', credits: 3, difficulty: 3,
    tags: ['Math', 'Core'], prerequisites: ['math102'], color: '#00ffff'
  },
  {
    id: 'math203', name: 'Discrete Mathematics', credits: 3, difficulty: 2,
    tags: ['Math', 'CS'], prerequisites: ['math101'], color: '#00ffff'
  },
  {
    id: 'math301', name: 'Numerical Methods', credits: 3, difficulty: 3,
    tags: ['Math', 'Intermediate'], prerequisites: ['math201', 'math103'], color: '#00ffff'
  },
  {
    id: 'math302', name: 'Stochastic Processes', credits: 3, difficulty: 4,
    tags: ['Math', 'Advanced'], prerequisites: ['math202'], color: '#00ffff'
  },
  {
    id: 'math303', name: 'Optimization Theory', credits: 3, difficulty: 4,
    tags: ['Math', 'AI', 'Advanced'], prerequisites: ['math201', 'math104'], color: '#00ffff'
  },
  {
    id: 'math304', name: 'Information Theory', credits: 3, difficulty: 4,
    tags: ['Math', 'AI', 'Advanced'], prerequisites: ['math202'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // COMPUTER SCIENCE FOUNDATION
  // ─────────────────────────────────────────────
  {
    id: 'cs101', name: 'Introduction to Programming (Python)', credits: 3, difficulty: 1,
    tags: ['CS', 'Foundation'], prerequisites: [], color: '#00ffff'
  },
  {
    id: 'cs102', name: 'Introduction to Programming (C++)', credits: 3, difficulty: 2,
    tags: ['CS', 'Foundation'], prerequisites: ['cs101'], color: '#00ffff'
  },
  {
    id: 'cs103', name: 'Web Development Basics', credits: 2, difficulty: 1,
    tags: ['CS', 'Web', 'Elective'], prerequisites: ['cs101'], color: '#00ffff'
  },
  {
    id: 'cs201', name: 'Data Structures', credits: 3, difficulty: 2,
    tags: ['CS', 'Core'], prerequisites: ['cs101', 'math203'], color: '#00ffff'
  },
  {
    id: 'cs202', name: 'Object-Oriented Programming', credits: 3, difficulty: 2,
    tags: ['CS', 'Core'], prerequisites: ['cs102'], color: '#00ffff'
  },
  {
    id: 'cs203', name: 'Functional Programming', credits: 3, difficulty: 3,
    tags: ['CS', 'Elective'], prerequisites: ['cs201'], color: '#00ffff'
  },
  {
    id: 'cs301', name: 'Algorithm Design & Analysis', credits: 3, difficulty: 4,
    tags: ['CS', 'Core'], prerequisites: ['cs201', 'math201', 'math203'], color: '#00ffff'
  },
  {
    id: 'cs302', name: 'Computer Organization & Architecture', credits: 3, difficulty: 3,
    tags: ['CS', 'Systems'], prerequisites: ['cs102', 'math203'], color: '#00ffff'
  },
  {
    id: 'cs303', name: 'Database Systems', credits: 3, difficulty: 3,
    tags: ['CS', 'Systems', 'Data'], prerequisites: ['cs202', 'cs201'], color: '#00ffff'
  },
  {
    id: 'cs304', name: 'Software Engineering Principles', credits: 3, difficulty: 2,
    tags: ['CS', 'Core'], prerequisites: ['cs202'], color: '#00ffff'
  },
  {
    id: 'cs305', name: 'Theory of Computation', credits: 3, difficulty: 4,
    tags: ['CS', 'Theory'], prerequisites: ['cs301', 'math203'], color: '#00ffff'
  },
  {
    id: 'cs306', name: 'Programming Languages & Compilers', credits: 3, difficulty: 4,
    tags: ['CS', 'Systems'], prerequisites: ['cs305', 'cs202'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // SYSTEMS
  // ─────────────────────────────────────────────
  {
    id: 'sys401', name: 'Operating Systems', credits: 3, difficulty: 4,
    tags: ['CS', 'Systems'], prerequisites: ['cs302', 'cs201'], color: '#00ffff'
  },
  {
    id: 'sys402', name: 'Computer Networks', credits: 3, difficulty: 3,
    tags: ['CS', 'Systems'], prerequisites: ['sys401'], color: '#00ffff'
  },
  {
    id: 'sys403', name: 'Distributed Systems', credits: 3, difficulty: 4,
    tags: ['CS', 'Systems', 'Advanced'], prerequisites: ['sys401', 'sys402'], color: '#00ffff'
  },
  {
    id: 'sys404', name: 'Cloud Computing', credits: 3, difficulty: 3,
    tags: ['CS', 'Systems', 'Elective'], prerequisites: ['sys403'], color: '#00ffff'
  },
  {
    id: 'sys405', name: 'Embedded Systems', credits: 3, difficulty: 4,
    tags: ['CS', 'Systems', 'Hardware'], prerequisites: ['cs302', 'sys401'], color: '#00ffff'
  },
  {
    id: 'sys406', name: 'Parallel Computing', credits: 3, difficulty: 4,
    tags: ['CS', 'Systems', 'Advanced'], prerequisites: ['sys401', 'cs301'], color: '#00ffff'
  },
  {
    id: 'sys407', name: 'Cybersecurity Fundamentals', credits: 3, difficulty: 3,
    tags: ['CS', 'Security'], prerequisites: ['sys402', 'cs301'], color: '#00ffff'
  },
  {
    id: 'sys408', name: 'Advanced Cybersecurity & Cryptography', credits: 3, difficulty: 5,
    tags: ['CS', 'Security', 'Advanced'], prerequisites: ['sys407', 'math203'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // ARTIFICIAL INTELLIGENCE
  // ─────────────────────────────────────────────
  {
    id: 'ai401', name: 'Introduction to Artificial Intelligence', credits: 3, difficulty: 3,
    tags: ['AI', 'Core'], prerequisites: ['cs301', 'math201'], color: '#00ffff'
  },
  {
    id: 'ai402', name: 'Knowledge Representation & Reasoning', credits: 3, difficulty: 4,
    tags: ['AI', 'Intermediate'], prerequisites: ['ai401'], color: '#00ffff'
  },
  {
    id: 'ai403', name: 'Search & Optimization in AI', credits: 3, difficulty: 4,
    tags: ['AI', 'Intermediate'], prerequisites: ['ai401', 'math303'], color: '#00ffff'
  },
  {
    id: 'ai404', name: 'Multi-Agent Systems', credits: 3, difficulty: 4,
    tags: ['AI', 'Advanced'], prerequisites: ['ai402', 'ai403'], color: '#00ffff'
  },
  {
    id: 'ai405', name: 'AI Ethics & Safety', credits: 2, difficulty: 2,
    tags: ['AI', 'Elective'], prerequisites: ['ai401'], color: '#00ffff'
  },
  {
    id: 'ai406', name: 'Planning & Decision Making', credits: 3, difficulty: 4,
    tags: ['AI', 'Advanced'], prerequisites: ['ai402', 'math302'], color: '#00ffff'
  },
  {
    id: 'ai407', name: 'Robotics & Autonomous Systems', credits: 3, difficulty: 5,
    tags: ['AI', 'Robotics', 'Advanced'], prerequisites: ['ai403', 'sys405'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // MACHINE LEARNING
  // ─────────────────────────────────────────────
  {
    id: 'ml401', name: 'Machine Learning Fundamentals', credits: 3, difficulty: 3,
    tags: ['ML', 'AI', 'Core'], prerequisites: ['math201', 'math202', 'cs301'], color: '#00ffff'
  },
  {
    id: 'ml402', name: 'Supervised Learning', credits: 3, difficulty: 3,
    tags: ['ML', 'Intermediate'], prerequisites: ['ml401'], color: '#00ffff'
  },
  {
    id: 'ml403', name: 'Unsupervised Learning & Clustering', credits: 3, difficulty: 4,
    tags: ['ML', 'Intermediate'], prerequisites: ['ml401', 'math201'], color: '#00ffff'
  },
  {
    id: 'ml404', name: 'Feature Engineering & Model Selection', credits: 3, difficulty: 3,
    tags: ['ML', 'Intermediate'], prerequisites: ['ml402'], color: '#00ffff'
  },
  {
    id: 'ml405', name: 'Ensemble Methods & Boosting', credits: 3, difficulty: 4,
    tags: ['ML', 'Advanced'], prerequisites: ['ml402', 'ml403'], color: '#00ffff'
  },
  {
    id: 'ml406', name: 'Bayesian Machine Learning', credits: 3, difficulty: 5,
    tags: ['ML', 'Advanced'], prerequisites: ['ml401', 'math302'], color: '#00ffff'
  },
  {
    id: 'ml407', name: 'Probabilistic Graphical Models', credits: 3, difficulty: 5,
    tags: ['ML', 'Advanced'], prerequisites: ['ml406', 'math304'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // DEEP LEARNING
  // ─────────────────────────────────────────────
  {
    id: 'dl501', name: 'Introduction to Deep Learning', credits: 3, difficulty: 4,
    tags: ['DL', 'AI', 'ML', 'Core'], prerequisites: ['ml401', 'math201'], color: '#00ffff'
  },
  {
    id: 'dl502', name: 'Convolutional Neural Networks', credits: 3, difficulty: 4,
    tags: ['DL', 'CV', 'Intermediate'], prerequisites: ['dl501'], color: '#00ffff'
  },
  {
    id: 'dl503', name: 'Recurrent Neural Networks & LSTMs', credits: 3, difficulty: 4,
    tags: ['DL', 'NLP', 'Intermediate'], prerequisites: ['dl501'], color: '#00ffff'
  },
  {
    id: 'dl504', name: 'Transformer Architecture & Attention', credits: 3, difficulty: 5,
    tags: ['DL', 'NLP', 'Advanced'], prerequisites: ['dl503', 'dl502'], color: '#00ffff'
  },
  {
    id: 'dl505', name: 'Generative Adversarial Networks', credits: 3, difficulty: 5,
    tags: ['DL', 'GenAI', 'Advanced'], prerequisites: ['dl502', 'dl503'], color: '#00ffff'
  },
  {
    id: 'dl506', name: 'Diffusion Models & Generative AI', credits: 3, difficulty: 5,
    tags: ['DL', 'GenAI', 'Advanced'], prerequisites: ['dl505', 'math302'], color: '#00ffff'
  },
  {
    id: 'dl507', name: 'Graph Neural Networks', credits: 3, difficulty: 5,
    tags: ['DL', 'Advanced'], prerequisites: ['dl501', 'cs301'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // NATURAL LANGUAGE PROCESSING
  // ─────────────────────────────────────────────
  {
    id: 'nlp501', name: 'Natural Language Processing', credits: 3, difficulty: 4,
    tags: ['NLP', 'AI', 'ML'], prerequisites: ['ml401', 'math202'], color: '#00ffff'
  },
  {
    id: 'nlp502', name: 'Text Mining & Information Retrieval', credits: 3, difficulty: 3,
    tags: ['NLP', 'Data'], prerequisites: ['nlp501'], color: '#00ffff'
  },
  {
    id: 'nlp503', name: 'Large Language Models', credits: 3, difficulty: 5,
    tags: ['NLP', 'DL', 'Advanced'], prerequisites: ['dl504', 'nlp501'], color: '#00ffff'
  },
  {
    id: 'nlp504', name: 'Speech Recognition & Synthesis', credits: 3, difficulty: 4,
    tags: ['NLP', 'Audio', 'Advanced'], prerequisites: ['dl503', 'nlp501'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // COMPUTER VISION
  // ─────────────────────────────────────────────
  {
    id: 'cv501', name: 'Computer Vision Fundamentals', credits: 3, difficulty: 3,
    tags: ['CV', 'AI', 'ML'], prerequisites: ['ml401', 'math201'], color: '#00ffff'
  },
  {
    id: 'cv502', name: 'Image Processing & Feature Detection', credits: 3, difficulty: 3,
    tags: ['CV', 'Intermediate'], prerequisites: ['cv501'], color: '#00ffff'
  },
  {
    id: 'cv503', name: 'Object Detection & Segmentation', credits: 3, difficulty: 5,
    tags: ['CV', 'DL', 'Advanced'], prerequisites: ['dl502', 'cv502'], color: '#00ffff'
  },
  {
    id: 'cv504', name: '3D Vision & Point Clouds', credits: 3, difficulty: 5,
    tags: ['CV', 'Advanced'], prerequisites: ['cv503', 'math104'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // REINFORCEMENT LEARNING
  // ─────────────────────────────────────────────
  {
    id: 'rl501', name: 'Reinforcement Learning Fundamentals', credits: 3, difficulty: 4,
    tags: ['RL', 'AI', 'ML'], prerequisites: ['ml401', 'math302'], color: '#00ffff'
  },
  {
    id: 'rl502', name: 'Deep Reinforcement Learning', credits: 3, difficulty: 5,
    tags: ['RL', 'DL', 'Advanced'], prerequisites: ['rl501', 'dl501'], color: '#00ffff'
  },
  {
    id: 'rl503', name: 'Multi-Agent Reinforcement Learning', credits: 3, difficulty: 5,
    tags: ['RL', 'AI', 'Advanced'], prerequisites: ['rl502', 'ai404'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // DATA SCIENCE
  // ─────────────────────────────────────────────
  {
    id: 'ds401', name: 'Data Analysis & Visualization', credits: 3, difficulty: 2,
    tags: ['Data', 'DS', 'Core'], prerequisites: ['cs101', 'math202'], color: '#00ffff'
  },
  {
    id: 'ds402', name: 'Big Data Engineering', credits: 3, difficulty: 3,
    tags: ['Data', 'DS', 'Systems'], prerequisites: ['cs303', 'ds401'], color: '#00ffff'
  },
  {
    id: 'ds403', name: 'Data Warehousing & ETL', credits: 3, difficulty: 3,
    tags: ['Data', 'DS'], prerequisites: ['cs303', 'ds401'], color: '#00ffff'
  },
  {
    id: 'ds404', name: 'Statistical Learning & Inference', credits: 3, difficulty: 4,
    tags: ['Data', 'DS', 'Statistics'], prerequisites: ['math202', 'ml401'], color: '#00ffff'
  },
  {
    id: 'ds405', name: 'Time Series Analysis', credits: 3, difficulty: 4,
    tags: ['Data', 'DS', 'ML'], prerequisites: ['ds404', 'ml402'], color: '#00ffff'
  },
  {
    id: 'ds406', name: 'Data Engineering at Scale', credits: 3, difficulty: 4,
    tags: ['Data', 'DS', 'Systems', 'Advanced'], prerequisites: ['ds402', 'sys403'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // ELECTIVES & SPECIALIZATIONS
  // ─────────────────────────────────────────────
  {
    id: 'ele101', name: 'Technical Communication', credits: 2, difficulty: 1,
    tags: ['Elective', 'Soft Skills'], prerequisites: [], color: '#00ffff'
  },
  {
    id: 'ele102', name: 'Project Management for Engineers', credits: 2, difficulty: 1,
    tags: ['Elective', 'Soft Skills'], prerequisites: [], color: '#00ffff'
  },
  {
    id: 'ele201', name: 'Human-Computer Interaction', credits: 3, difficulty: 2,
    tags: ['CS', 'Elective', 'Design'], prerequisites: ['cs101'], color: '#00ffff'
  },
  {
    id: 'ele202', name: 'Game Development', credits: 3, difficulty: 3,
    tags: ['CS', 'Elective', 'Graphics'], prerequisites: ['cs202', 'math201'], color: '#00ffff'
  },
  {
    id: 'ele301', name: 'Quantum Computing', credits: 3, difficulty: 5,
    tags: ['CS', 'Elective', 'Advanced'], prerequisites: ['cs305', 'math201'], color: '#00ffff'
  },
  {
    id: 'ele302', name: 'Bioinformatics', credits: 3, difficulty: 4,
    tags: ['CS', 'Elective', 'Biology'], prerequisites: ['ml401', 'math202'], color: '#00ffff'
  },
  {
    id: 'ele303', name: 'AR/VR Development', credits: 3, difficulty: 3,
    tags: ['CS', 'Elective', 'Graphics'], prerequisites: ['cs202', 'math201'], color: '#00ffff'
  },
  {
    id: 'ele304', name: 'Blockchain & Decentralized Systems', credits: 3, difficulty: 4,
    tags: ['CS', 'Elective', 'Security'], prerequisites: ['sys407', 'cs301'], color: '#00ffff'
  },
  {
    id: 'ele305', name: 'DevOps & CI/CD', credits: 2, difficulty: 2,
    tags: ['CS', 'Elective', 'Systems'], prerequisites: ['cs304'], color: '#00ffff'
  },

  // ─────────────────────────────────────────────
  // CAPSTONE / THESIS
  // ─────────────────────────────────────────────
  {
    id: 'cap601', name: 'AI Research Project I', credits: 3, difficulty: 4,
    tags: ['Capstone', 'AI', 'Research'], prerequisites: ['ai401', 'ml401', 'cs304'], color: '#00ffff'
  },
  {
    id: 'cap602', name: 'AI Research Project II', credits: 3, difficulty: 4,
    tags: ['Capstone', 'AI', 'Research'], prerequisites: ['cap601'], color: '#00ffff'
  },
  {
    id: 'cap603', name: 'Industry Internship', credits: 3, difficulty: 2,
    tags: ['Capstone', 'Elective', 'Industry'], prerequisites: ['cap601'], color: '#00ffff'
  },
  {
    id: 'cap604', name: 'Master\'s Thesis / Final Project', credits: 6, difficulty: 5,
    tags: ['Capstone', 'Thesis', 'Advanced'], prerequisites: ['cap602', 'dl501'], color: '#00ffff'
  }
];

// Auto-assign semester recommendations based on course depth
function assignSemesterRecommendations(courses) {
  const courseMap = {};
  courses.forEach(c => { courseMap[c.id] = c; });

  function getDepth(courseId, memo = {}) {
    if (memo[courseId] !== undefined) return memo[courseId];
    const course = courseMap[courseId];
    if (!course || course.prerequisites.length === 0) {
      memo[courseId] = 1;
      return 1;
    }
    const maxPrereq = Math.max(...course.prerequisites.map(p => getDepth(p, memo)));
    memo[courseId] = maxPrereq + 1;
    return memo[courseId];
  }

  const memo = {};
  return courses.map(c => ({
    ...c,
    recommendedSemester: getDepth(c.id, memo)
  }));
}

const coursesWithRecommendations = assignSemesterRecommendations(sampleCourses);

module.exports = { sampleCourses: coursesWithRecommendations };
