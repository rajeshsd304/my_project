// Default admission-test structure: Unit → Subject → Topics.
export const DEFAULT_TAXONOMY: { unit: string; subjects: Record<string, string[]> }[] = [
  {
    unit: "Engineering",
    subjects: {
      Physics: ["Vectors", "Motion", "Newtonian Mechanics", "Work, Energy & Power", "Gravitation", "Waves", "Electricity", "Modern Physics"],
      Chemistry: ["Qualitative Chemistry", "Periodic Properties", "Chemical Changes", "Organic Chemistry", "Quantitative Chemistry"],
      "Higher Math": ["Matrices & Determinants", "Vectors", "Straight Lines", "Circles", "Trigonometry", "Differentiation", "Integration", "Complex Numbers"],
      English: ["Grammar", "Vocabulary"],
    },
  },
  {
    unit: "Medical",
    subjects: {
      Biology: ["Cell & Cell Division", "Plant Physiology", "Human Physiology", "Genetics", "Microorganisms"],
      Chemistry: ["Organic Chemistry", "Chemical Changes", "Environmental Chemistry"],
      Physics: ["Motion", "Heat", "Electricity"],
      English: ["Grammar", "Vocabulary"],
      "General Knowledge": ["Bangladesh Affairs", "International Affairs"],
    },
  },
  {
    unit: "Public University A Unit (Science)",
    subjects: {
      Physics: ["Motion", "Electricity", "Optics"],
      Chemistry: ["Organic Chemistry", "Periodic Properties"],
      Math: ["Algebra", "Calculus", "Geometry"],
      Biology: ["Botany", "Zoology"],
    },
  },
  {
    unit: "Public University B Unit (Humanities)",
    subjects: { Bangla: ["Grammar", "Literature"], English: ["Grammar", "Vocabulary"], "General Knowledge": ["Bangladesh Affairs", "International Affairs"] },
  },
  {
    unit: "Public University C Unit (Business Studies)",
    subjects: { Accounting: ["Basics", "Financial Statements"], Management: ["Principles"], Bangla: ["Grammar"], English: ["Grammar"] },
  },
  {
    unit: "Public University D Unit (Social Science)",
    subjects: { Bangla: ["Grammar", "Literature"], English: ["Grammar"], "General Knowledge": ["Bangladesh Affairs", "International Affairs"] },
  },
  {
    unit: "GST / Cluster",
    subjects: { Physics: ["Motion", "Electricity"], Chemistry: ["Organic Chemistry"], Math: ["Algebra", "Calculus"], Biology: ["Genetics"], Bangla: ["Grammar"], English: ["Grammar"] },
  },
];
