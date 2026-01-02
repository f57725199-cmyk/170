
import { Subject } from './types';
// @ts-ignore
import { COMPETITION_DATA } from './competition_syllabus';

export const ADMIN_EMAIL = "admin@iic.com";
export const SUPPORT_EMAIL = "support@iic.com";

// Default Subjects (Restricted List)
export const DEFAULT_SUBJECTS = {
  // CORE SCIENCES
  physics: { id: 'physics', name: 'Physics', icon: 'physics', color: 'bg-blue-50 text-blue-600' },
  chemistry: { id: 'chemistry', name: 'Chemistry', icon: 'flask', color: 'bg-purple-50 text-purple-600' },
  biology: { id: 'biology', name: 'Biology', icon: 'bio', color: 'bg-green-50 text-green-600' },
  math: { id: 'math', name: 'Mathematics', icon: 'math', color: 'bg-emerald-50 text-emerald-600' },
  
  // ARTS / COMMERCE
  history: { id: 'history', name: 'History', icon: 'history', color: 'bg-rose-50 text-rose-600' },
  geography: { id: 'geography', name: 'Geography', icon: 'geo', color: 'bg-indigo-50 text-indigo-600' },
  polity: { id: 'polity', name: 'Political Science', icon: 'gov', color: 'bg-amber-50 text-amber-600' },
  economics: { id: 'economics', name: 'Economics', icon: 'social', color: 'bg-cyan-50 text-cyan-600' },
  business: { id: 'business', name: 'Business Studies', icon: 'business', color: 'bg-blue-50 text-blue-600' },
  accounts: { id: 'accounts', name: 'Accountancy', icon: 'accounts', color: 'bg-emerald-50 text-emerald-600' },

  // JUNIOR CORE
  science: { id: 'science', name: 'Science', icon: 'science', color: 'bg-blue-50 text-blue-600' },
  sst: { id: 'sst', name: 'Social Science', icon: 'geo', color: 'bg-orange-50 text-orange-600' },

  // LANGUAGES & EXTRAS
  english: { id: 'english', name: 'English', icon: 'english', color: 'bg-sky-50 text-sky-600' },
  hindi: { id: 'hindi', name: 'Hindi', icon: 'hindi', color: 'bg-orange-50 text-orange-600' },
  sanskrit: { id: 'sanskrit', name: 'Sanskrit', icon: 'book', color: 'bg-yellow-50 text-yellow-600' },
  computer: { id: 'computer', name: 'Computer Science', icon: 'computer', color: 'bg-slate-50 text-slate-600' }
};

// Helper to get subjects - NOW DYNAMIC
export const getSubjectsList = (classLevel: string, stream: string | null): Subject[] => {
  const isSenior = ['11', '12'].includes(classLevel);

  // 1. Try to load Custom Subjects from LocalStorage
  let pool = { ...DEFAULT_SUBJECTS };
  try {
      const stored = localStorage.getItem('nst_custom_subjects_pool');
      if (stored) {
          pool = JSON.parse(stored);
      }
  } catch (e) {
      console.error("Error loading dynamic subjects", e);
  }

  const allKeys = Object.keys(pool);
  const coreKeys = Object.keys(DEFAULT_SUBJECTS);
  const customKeys = allKeys.filter(k => !coreKeys.includes(k)); 

  let selectedSubjects: Subject[] = [];
  const commonSubjects = [pool.english, pool.hindi, pool.computer];

  // --- COMPETITION ---
  if (classLevel === 'COMPETITION') {
      selectedSubjects = [
          pool.history,
          pool.polity,
          pool.geography,
          pool.economics,
          pool.physics,
          pool.chemistry,
          pool.biology,
          pool.math
      ].filter(Boolean);
  }
  // --- JUNIOR CLASSES (6-10) ---
  else if (!isSenior) {
      selectedSubjects = [
          pool.math,
          pool.science,
          pool.sst,
          pool.english,
          pool.hindi,
          pool.sanskrit,
          pool.computer
      ].filter(Boolean); 
  } 
  // --- SENIOR CLASSES (11/12) ---
  else {
      if (stream === 'Science') {
          selectedSubjects = [pool.physics, pool.chemistry, pool.math, pool.biology, ...commonSubjects];
      } else if (stream === 'Commerce') {
          selectedSubjects = [pool.accounts, pool.business, pool.economics, pool.math, ...commonSubjects];
      } else if (stream === 'Arts') {
          selectedSubjects = [pool.history, pool.geography, pool.polity, pool.economics, ...commonSubjects];
      }
      selectedSubjects = selectedSubjects.filter(Boolean);
  }

  // 3. APPEND CUSTOM SUBJECTS
  customKeys.forEach(key => {
      if (pool[key]) selectedSubjects.push(pool[key]);
  });

  return selectedSubjects;
};

// --- STATIC SYLLABUS DATA (COMPLETE LIST) ---

const CBSE_6_MATH = ["Knowing Our Numbers", "Whole Numbers", "Playing with Numbers", "Basic Geometrical Ideas", "Understanding Elementary Shapes", "Integers", "Fractions", "Decimals", "Data Handling", "Mensuration", "Algebra", "Ratio and Proportion", "Symmetry", "Practical Geometry"];
const CBSE_6_SCI = ["Food: Where Does It Come From?", "Components of Food", "Fibre to Fabric", "Sorting Materials into Groups", "Separation of Substances", "Changes Around Us", "Getting to Know Plants", "Body Movements", "The Living Organisms and Their Surroundings", "Motion and Measurement of Distances", "Light, Shadows and Reflections", "Electricity and Circuits", "Fun with Magnets", "Water", "Air Around Us", "Garbage In, Garbage Out"];
const CBSE_6_SST = ["What, Where, How and When?", "From Hunting–Gathering to Growing Food", "In the Earliest Cities", "What Books and Burials Tell Us", "Kingdoms, Kings and an Early Republic", "New Questions and Ideas", "Ashoka, The Emperor Who Gave Up War", "Vital Villages, Thriving Towns", "Traders, Kings and Pilgrims", "New Empires and Kingdoms", "Buildings, Paintings and Books", "The Earth in the Solar System", "Globe: Latitudes and Longitudes", "Motions of the Earth", "Maps", "Major Domains of the Earth", "Major Landforms of the Earth", "Our Country – India", "India: Climate, Vegetation and Wildlife"];

const CBSE_7_MATH = ["Integers", "Fractions and Decimals", "Data Handling", "Simple Equations", "Lines and Angles", "The Triangle and its Properties", "Congruence of Triangles", "Comparing Quantities", "Rational Numbers", "Practical Geometry", "Perimeter and Area", "Algebraic Expressions", "Exponents and Powers", "Symmetry", "Visualising Solid Shapes"];
const CBSE_7_SCI = ["Nutrition in Plants", "Nutrition in Animals", "Fibre to Fabric", "Heat", "Acids, Bases and Salts", "Physical and Chemical Changes", "Weather, Climate and Adaptations", "Winds, Storms and Cyclones", "Soil", "Respiration in Organisms", "Transportation in Animals and Plants", "Reproduction in Plants", "Motion and Time", "Electric Current and its Effects", "Light", "Water: A Precious Resource", "Forests: Our Lifeline", "Wastewater Story"];
const CBSE_7_SST = ["Tracing Changes Through a Thousand Years", "New Kings and Kingdoms", "The Delhi Sultans", "The Mughal Empire", "Rulers and Buildings", "Towns, Traders and Craftspersons", "Tribes, Nomads and Settled Communities", "Devotional Paths to the Divine", "The Making of Regional Cultures", "Eighteenth-Century Political Formations", "Environment", "Inside Our Earth", "Our Changing Earth", "Air", "Water", "Natural Vegetation and Wildlife"];

const CBSE_8_MATH = ["Rational Numbers", "Linear Equations in One Variable", "Understanding Quadrilaterals", "Practical Geometry", "Data Handling", "Squares and Square Roots", "Cubes and Cube Roots", "Comparing Quantities", "Algebraic Expressions and Identities", "Visualising Solid Shapes", "Mensuration", "Exponents and Powers", "Direct and Inverse Proportions", "Factorisation", "Introduction to Graphs", "Playing with Numbers"];
const CBSE_8_SCI = ["Crop Production and Management", "Microorganisms: Friend and Foe", "Synthetic Fibres and Plastics", "Materials: Metals and Non-Metals", "Coal and Petroleum", "Combustion and Flame", "Conservation of Plants and Animals", "Cell - Structure and Functions", "Reproduction in Animals", "Reaching the Age of Adolescence", "Force and Pressure", "Friction", "Sound", "Chemical Effects of Electric Current", "Some Natural Phenomena", "Light", "Stars and The Solar System", "Pollution of Air and Water"];
const CBSE_8_SST = ["How, When and Where", "From Trade to Territory", "Ruling the Countryside", "Tribals, Dikus and the Vision of a Golden Age", "When People Rebel", "Weavers, Iron Smelters and Factory Owners", "Civilising the 'Native', Educating the Nation", "Women, Caste and Reform", "The Making of the National Movement", "India After Independence", "Resources", "Land, Soil, Water, Natural Vegetation and Wildlife", "Mineral and Power Resources", "Agriculture", "Industries", "Human Resources", "The Indian Constitution", "Understanding Secularism"];

const CBSE_9_MATH = ["Number Systems", "Polynomials", "Coordinate Geometry", "Linear Equations in Two Variables", "Introduction to Euclid’s Geometry", "Lines and Angles", "Triangles", "Quadrilaterals", "Circles", "Heron’s Formula", "Surface Areas and Volumes", "Statistics"];
const CBSE_9_SCI = ["Matter in Our Surroundings", "Is Matter Around Us Pure", "Atoms and Molecules", "Structure of the Atom", "The Fundamental Unit of Life", "Tissues", "Motion", "Force and Laws of Motion", "Gravitation", "Work and Energy", "Sound", "Improvement in Food Resources"];
const CBSE_9_SST = ["The French Revolution", "Socialism in Europe and the Russian Revolution", "Nazism and the Rise of Hitler", "Forest Society and Colonialism", "Pastoralists in the Modern World", "India – Size and Location", "Physical Features of India", "Drainage", "Climate", "Natural Vegetation and Wildlife", "Population", "What is Democracy? Why Democracy?", "Constitutional Design", "Electoral Politics", "Working of Institutions", "Democratic Rights"];

const CBSE_10_MATH = ["Real Numbers", "Polynomials", "Pair of Linear Equations in Two Variables", "Quadratic Equations", "Arithmetic Progressions", "Triangles", "Coordinate Geometry", "Introduction to Trigonometry", "Some Applications of Trigonometry", "Circles", "Areas Related to Circles", "Surface Areas and Volumes", "Statistics", "Probability"];
const CBSE_10_SCI = ["Chemical Reactions and Equations", "Acids, Bases and Salts", "Metals and Non-Metals", "Carbon and its Compounds", "Life Processes", "Control and Coordination", "How do Organisms Reproduce?", "Heredity", "Light – Reflection and Refraction", "The Human Eye and the Colourful World", "Electricity", "Magnetic Effects of Electric Current", "Our Environment"];
const CBSE_10_SST = ["The Rise of Nationalism in Europe", "Nationalism in India", "The Making of a Global World", "The Age of Industrialisation", "Print Culture and the Modern World", "Resources and Development", "Forest and Wildlife Resources", "Water Resources", "Agriculture", "Minerals and Energy Resources", "Manufacturing Industries", "Lifelines of National Economy", "Power Sharing", "Federalism", "Gender, Religion and Caste", "Political Parties", "Outcomes of Democracy", "Development", "Sectors of the Indian Economy"];

const CBSE_11_PHY = ["Physical World", "Units and Measurements", "Motion in a Straight Line", "Motion in a Plane", "Laws of Motion", "Work, Energy and Power", "System of Particles and Rotational Motion", "Gravitation", "Mechanical Properties of Solids", "Mechanical Properties of Fluids", "Thermal Properties of Matter", "Thermodynamics", "Kinetic Theory", "Oscillations", "Waves"];
const CBSE_11_CHEM = ["Some Basic Concepts of Chemistry", "Structure of Atom", "Classification of Elements and Periodicity in Properties", "Chemical Bonding and Molecular Structure", "States of Matter", "Thermodynamics", "Equilibrium", "Redox Reactions", "Hydrogen", "The s-Block Elements", "The p-Block Elements", "Organic Chemistry – Some Basic Principles and Techniques", "Hydrocarbons", "Environmental Chemistry"];
const CBSE_11_MATH = ["Sets", "Relations and Functions", "Trigonometric Functions", "Principle of Mathematical Induction", "Complex Numbers and Quadratic Equations", "Linear Inequalities", "Permutations and Combinations", "Binomial Theorem", "Sequences and Series", "Straight Lines", "Conic Sections", "Introduction to Three Dimensional Geometry", "Limits and Derivatives", "Mathematical Reasoning", "Statistics", "Probability"];
const CBSE_11_BIO = ["The Living World", "Biological Classification", "Plant Kingdom", "Animal Kingdom", "Morphology of Flowering Plants", "Anatomy of Flowering Plants", "Structural Organisation in Animals", "Cell: The Unit of Life", "Biomolecules", "Cell Cycle and Cell Division", "Transport in Plants", "Mineral Nutrition", "Photosynthesis in Higher Plants", "Respiration in Plants", "Plant Growth and Development", "Digestion and Absorption", "Breathing and Exchange of Gases", "Body Fluids and Circulation", "Excretory Products and their Elimination", "Locomotion and Movement", "Neural Control and Coordination", "Chemical Coordination and Integration"];

const CBSE_12_PHY = ["Electric Charges and Fields", "Electrostatic Potential and Capacitance", "Current Electricity", "Moving Charges and Magnetism", "Magnetism and Matter", "Electromagnetic Induction", "Alternating Current", "Electromagnetic Waves", "Ray Optics and Optical Instruments", "Wave Optics", "Dual Nature of Radiation and Matter", "Atoms", "Nuclei", "Semiconductor Electronics", "Communication Systems"];
const CBSE_12_CHEM = ["The Solid State", "Solutions", "Electrochemistry", "Chemical Kinetics", "Surface Chemistry", "General Principles and Processes of Isolation of Elements", "The p-Block Elements", "The d- and f- Block Elements", "Coordination Compounds", "Haloalkanes and Haloarenes", "Alcohols, Phenols and Ethers", "Aldehydes, Ketones and Carboxylic Acids", "Amines", "Biomolecules", "Polymers", "Chemistry in Everyday Life"];
const CBSE_12_MATH = ["Relations and Functions", "Inverse Trigonometric Functions", "Matrices", "Determinants", "Continuity and Differentiability", "Application of Derivatives", "Integrals", "Application of Integrals", "Differential Equations", "Vector Algebra", "Three Dimensional Geometry", "Linear Programming", "Probability"];
const CBSE_12_BIO = ["Reproduction in Organisms", "Sexual Reproduction in Flowering Plants", "Human Reproduction", "Reproductive Health", "Principles of Inheritance and Variation", "Molecular Basis of Inheritance", "Evolution", "Human Health and Disease", "Strategies for Enhancement in Food Production", "Microbes in Human Welfare", "Biotechnology: Principles and Processes", "Biotechnology and its Applications", "Organisms and Populations", "Ecosystem", "Biodiversity and Conservation", "Environmental Issues"];


export const STATIC_SYLLABUS: Record<string, string[]> = {
    // === COMPETITION ===
    ...COMPETITION_DATA,

    // === CLASS 10 CBSE ===
    "CBSE-10-Mathematics": CBSE_10_MATH,
    "CBSE-10-Science": CBSE_10_SCI,
    "CBSE-10-Social Science": CBSE_10_SST,

    // === CLASS 9 CBSE ===
    "CBSE-9-Mathematics": CBSE_9_MATH,
    "CBSE-9-Science": CBSE_9_SCI,
    "CBSE-9-Social Science": CBSE_9_SST,

    // === CLASS 6-8 (COMPLETE) ===
    "CBSE-6-Mathematics": CBSE_6_MATH, "CBSE-6-Science": CBSE_6_SCI, "CBSE-6-Social Science": CBSE_6_SST,
    "CBSE-7-Mathematics": CBSE_7_MATH, "CBSE-7-Science": CBSE_7_SCI, "CBSE-7-Social Science": CBSE_7_SST,
    "CBSE-8-Mathematics": CBSE_8_MATH, "CBSE-8-Science": CBSE_8_SCI, "CBSE-8-Social Science": CBSE_8_SST,

    // === CLASS 11-12 (COMPLETE) ===
    "CBSE-11-Physics": CBSE_11_PHY, "CBSE-11-Chemistry": CBSE_11_CHEM, "CBSE-11-Mathematics": CBSE_11_MATH, "CBSE-11-Biology": CBSE_11_BIO,
    "CBSE-12-Physics": CBSE_12_PHY, "CBSE-12-Chemistry": CBSE_12_CHEM, "CBSE-12-Mathematics": CBSE_12_MATH, "CBSE-12-Biology": CBSE_12_BIO,

    // === BSEB MAPPINGS (Using Hindi Titles where available, fallback to English structure) ===
    // BSEB 10
    "BSEB-10-Mathematics": ["वास्तविक संख्याएँ", "बहुपद", "दो चर वाले रैखिक समीकरण युग्म", "द्विघात समीकरण", "समांतर श्रेढियाँ", "त्रिभुज", "निर्देशांक ज्यामिति", "त्रिकोणमिति का परिचय", "त्रिकोणमिति के कुछ अनुप्रयोग", "वृत्त", "रचनाएँ", "वृत्तों से संबंधित क्षेत्रफल", "पृष्ठीय क्षेत्रफल और आयतन", "सांख्यिकी", "प्रायिकता"],
    "BSEB-10-Science": ["रासायनिक अभिक्रियाएँ एवं समीकरण", "अम्ल, क्षारक एवं लवण", "धातु एवं अधातु", "कार्बन एवं उसके यौगिक", "तत्वों का आवर्त वर्गीकरण", "जैव प्रक्रम", "नियंत्रण एवं समन्वय", "जीव जनन कैसे करते हैं?", "आनुवंशिकता एवं जैव विकास", "प्रकाश – परावर्तन तथा अपवर्तन", "मानव नेत्र तथा रंगबिरंगा संसार", "विद्युत", "विद्युत धारा के चुंबकीय प्रभाव", "ऊर्जा के स्रोत", "हमारा पर्यावरण", "प्राकृतिक संसाधनों का संपोषित प्रबंधन"],
    "BSEB-10-Social Science": ["यूरोप में राष्ट्रवाद", "समाजवाद एवं साम्यवाद", "हिन्द-चीन में राष्ट्रवादी आंदोलन", "भारत में राष्ट्रवाद", "अर्थव्यवस्था और आजीविका", "शहरीकरण एवं शहरी जीवन", "व्यापार और भूमंडलीकरण", "प्रेस-संस्कृति एवं राष्ट्रवाद", "भारत: संसाधन एवं उपयोग", "कृषि", "निर्माण उद्योग", "परिवहन, संचार एवं व्यापार", "बिहार: कृषि एवं वन संसाधन", "मानचित्र अध्ययन", "लोकतंत्र में सत्ता की साझेदारी", "लोकतंत्र की चुनौतियाँ", "अर्थव्यवस्था एवं इसके विकास का इतिहास", "मुद्रा, बचत एवं साख", "वैश्वीकरण", "उपभोक्ता जागरण एवं संरक्षण", "आपदा प्रबंधन"],
    
    // BSEB 9
    "BSEB-9-Mathematics": ["संख्या पद्धति", "बहुपद", "निर्देशांक ज्यामिति", "दो चरों वाले रैखिक समीकरण", "यूक्लिड की ज्यामिति का परिचय", "रेखाएँ और कोण", "त्रिभुज", "चतुर्भुज", "समांतर चतुर्भुजों और त्रिभुजों के क्षेत्रफल", "वृत्त", "रचनाएँ", "हीरोन का सूत्र", "पृष्ठीय क्षेत्रफल और आयतन", "सांख्यिकी", "प्रायिकता"],
    "BSEB-9-Science": ["हमारे आस-पास के पदार्थ", "क्या हमारे आस-पास के पदार्थ शुद्ध हैं", "परमाणु एवं अणु", "परमाणु की संरचना", "जीवन की मौलिक इकाई", "ऊतक", "जीवों में विविधता", "गति", "बल तथा गति के नियम", "गुरुत्वाकर्षण", "कार्य तथा ऊर्जा", "ध्वनि", "हम बीमार क्यों होते हैं", "प्राकृतिक संपदा", "खाद्य संसाधनों में सुधार"],
    "BSEB-9-Social Science": ["भौगोलिक खोजें", "अमेरिकी स्वतंत्रता संग्राम", "फ्रांस की क्रांति", "विश्वयुद्धों का इतिहास", "नाजीवाद", "वन्य समाज और उपनिवेशवाद", "शांति के प्रयास", "कृषि और खेतिहर समाज", "स्थिति और विस्तार", "भौतिक स्वरूप: संरचना और उच्चावच", "अपवाह स्वरूप", "जलवायु", "प्राकृतिक वनस्पति एवं वन्य प्राणी", "जनसंख्या", "लोकतंत्र का क्रमिक विकास", "संविधान निर्माण", "चुनावी राजनीति", "संसदीय लोकतंत्र की संस्थाएँ", "लोकतांत्रिक अधिकार", "बिहार के एक गाँव की कहानी", "मानव एक संसाधन", "गरीबी: एक चुनौती", "भारत में खाद्य सुरक्षा"],

    // Fallback Mappings for other BSEB classes (Map to CBSE English for now to ensure content availability)
    "BSEB-6-Mathematics": CBSE_6_MATH, "BSEB-6-Science": CBSE_6_SCI, "BSEB-6-Social Science": CBSE_6_SST,
    "BSEB-7-Mathematics": CBSE_7_MATH, "BSEB-7-Science": CBSE_7_SCI, "BSEB-7-Social Science": CBSE_7_SST,
    "BSEB-8-Mathematics": CBSE_8_MATH, "BSEB-8-Science": CBSE_8_SCI, "BSEB-8-Social Science": CBSE_8_SST,
    
    "BSEB-11-Physics": CBSE_11_PHY, "BSEB-11-Chemistry": CBSE_11_CHEM, "BSEB-11-Mathematics": CBSE_11_MATH, "BSEB-11-Biology": CBSE_11_BIO,
    "BSEB-12-Physics": CBSE_12_PHY, "BSEB-12-Chemistry": CBSE_12_CHEM, "BSEB-12-Mathematics": CBSE_12_MATH, "BSEB-12-Biology": CBSE_12_BIO,
};
