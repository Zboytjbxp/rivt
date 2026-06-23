export const recordChecklist = [
  "Signed scope",
  "Legal consent accepted",
  "ID check before post/accept",
  "Completion photos",
  "Payment method note",
  "Review prompt",
];

export const trainingModules = [
  "Ladder and fall protection",
  "Electrical lockout basics",
  "Dust containment",
  "Customer-site conduct",
];


export interface QuizQuestion {
  id: number;
  text: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface SafetyQuiz {
  id: string;
  title: string;
  oshaRef: string;
  description: string;
  questions: QuizQuestion[];
}

export interface SafetyQuizResult {
  quizId: string;
  score: number;
  passed: boolean;
  completedAt: string;
  attempts: number;
}

export const safetyQuizData: SafetyQuiz[] = [
  {
    id: "ladder-safety",
    title: "Ladder Safety",
    oshaRef: "29 CFR 1926.1053",
    description: "Setup angle, 3-point contact, load ratings, and inspection.",
    questions: [
      {
        id: 1,
        text: "OSHA 1926.1053 requires extension ladders to be set up at a pitch of:",
        options: [
          "1 foot out for every 3 feet of height (1:3)",
          "1 foot out for every 4 feet of height (1:4)",
          "1 foot out for every 6 feet of height (1:6)",
          "Flush against the wall (1:10)",
        ],
        correctIndex: 1,
        explanation: "The 4:1 rule — ladder base 1 foot out per 4 feet of height — gives approximately 75° and is required by OSHA 1926.1053(b)(5).",
      },
      {
        id: 2,
        text: "When using a ladder to access a roof or elevated landing, the ladder must extend above the landing by at least:",
        options: ["1 foot", "2 feet", "3 feet", "5 feet"],
        correctIndex: 2,
        explanation: "OSHA 1926.1053(b)(1) requires ladders to extend at least 3 feet above an upper landing surface.",
      },
      {
        id: 3,
        text: "\"3-point contact\" on a ladder means:",
        options: [
          "Three workers may share a ladder simultaneously",
          "Two hands and one foot, or two feet and one hand, always in contact with the ladder",
          "The ladder must have three rungs between each worker",
          "Three separate anchor points secure the ladder top",
        ],
        correctIndex: 1,
        explanation: "3-point contact (two hands + one foot, or two feet + one hand) is the standard for safe climbing — OSHA 1926.1053(b)(22).",
      },
      {
        id: 4,
        text: "A Type IA ladder is rated for a maximum load of:",
        options: ["225 lbs", "250 lbs", "300 lbs", "375 lbs"],
        correctIndex: 2,
        explanation: "Type IA (Extra Heavy Duty) is rated for 300 lbs. Type I is 250 lbs; Type II is 225 lbs. Type IAA is 375 lbs.",
      },
      {
        id: 5,
        text: "On a stepladder, workers are prohibited from:",
        options: [
          "Using one hand on the rails while carrying a tool belt",
          "Standing on the top two rungs or the pail shelf",
          "Climbing while wearing work boots",
          "Descending the ladder facing away from it",
        ],
        correctIndex: 1,
        explanation: "OSHA prohibits standing on the top two rungs of a stepladder or the pail shelf — these are not designed as standing surfaces (1926.1053(b)(13)).",
      },
      {
        id: 6,
        text: "Portable ladders must be inspected:",
        options: [
          "Once a month by a competent person",
          "Annually by a third-party inspector",
          "Before each use",
          "Only after a fall or impact event",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.1053(b)(15) requires ladders to be inspected before each use for defects that could cause injury.",
      },
    ],
  },
  {
    id: "fall-protection",
    title: "Fall Protection",
    oshaRef: "29 CFR 1926.502",
    description: "Harnesses, anchor points, guardrails, and fall distances.",
    questions: [
      {
        id: 1,
        text: "In the construction industry, OSHA requires fall protection when a worker is at or above a height of:",
        options: ["4 feet", "6 feet", "8 feet", "10 feet"],
        correctIndex: 1,
        explanation: "OSHA 1926.501(b)(1) requires fall protection at 6 feet or more in the construction industry.",
      },
      {
        id: 2,
        text: "An anchor point for a personal fall arrest system (PFAS) must be capable of supporting at least:",
        options: ["2,500 lbs per worker", "3,000 lbs per worker", "5,000 lbs per worker", "7,500 lbs per worker"],
        correctIndex: 2,
        explanation: "OSHA 1926.502(d)(15) requires PFAS anchorages to support at least 5,000 lbs per attached worker.",
      },
      {
        id: 3,
        text: "The top rail of a guardrail system must be at a height of:",
        options: ["36 ± 3 inches", "42 ± 3 inches", "48 ± 3 inches", "54 ± 3 inches"],
        correctIndex: 1,
        explanation: "OSHA 1926.502(b)(1) requires the top edge of guardrails to be 42 inches (± 3 inches) above the walking/working surface.",
      },
      {
        id: 4,
        text: "Fall protection equipment (harnesses, lanyards, connectors) must be inspected:",
        options: [
          "Quarterly by a certified rigger",
          "Annually, logged in a maintenance book",
          "Before each use by the user",
          "Only when visible damage is present",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.502(d)(21) requires all fall arrest equipment to be inspected before each use for wear, damage, and deterioration.",
      },
      {
        id: 5,
        text: "When using a self-retracting lifeline (SRL), the device should be positioned:",
        options: [
          "At foot level to maximize free fall distance",
          "Offset 3 feet to one side of the worker",
          "Directly overhead, as close to plumb as possible",
          "At waist level to reduce tension",
        ],
        correctIndex: 2,
        explanation: "SRLs are designed to be used directly overhead. Off-axis use increases swing-fall risk and reduces device effectiveness.",
      },
      {
        id: 6,
        text: "Safety nets used as fall protection must be installed no more than how far below the work surface?",
        options: ["10 feet", "15 feet", "25 feet", "30 feet"],
        correctIndex: 3,
        explanation: "OSHA 1926.502(c)(1) requires safety nets to be installed as close as practicable under the work surface but never more than 30 feet below.",
      },
    ],
  },
  {
    id: "electrical-safety",
    title: "Electrical Safety",
    oshaRef: "29 CFR 1926.416",
    description: "GFCI, lockout/tagout, working clearances, and wet conditions.",
    questions: [
      {
        id: 1,
        text: "At what current level does a GFCI device trip to protect a worker?",
        options: ["4–6 milliamps", "15 milliamps", "20 milliamps", "30 milliamps"],
        correctIndex: 0,
        explanation: "GFCIs trip at 4–6 milliamps — well below the 10 mA threshold that can cause inability to release and 100+ mA that causes ventricular fibrillation.",
      },
      {
        id: 2,
        text: "The minimum safe approach distance for an unqualified worker near energized overhead lines rated 50 kV or less is:",
        options: ["3 feet", "6 feet", "10 feet", "25 feet"],
        correctIndex: 2,
        explanation: "OSHA 1926.416(a)(1) and 1926.1408 set the limit at 10 feet for voltages up to 50 kV for unqualified workers.",
      },
      {
        id: 3,
        text: "Lockout/tagout (LOTO) procedures are used to:",
        options: [
          "Record energy readings from live circuits",
          "Ensure machinery cannot be accidentally energized while being serviced",
          "Replace the function of GFCI protection on outlets",
          "Label circuits over 240 V",
        ],
        correctIndex: 1,
        explanation: "LOTO (29 CFR 1910.147) controls hazardous energy during service/maintenance so equipment cannot be accidentally started.",
      },
      {
        id: 4,
        text: "Extension cords used at construction sites must be:",
        options: [
          "Listed for indoor use only",
          "No longer than 100 feet",
          "3-wire grounded types designed for hard or extra-hard usage",
          "Replaced monthly regardless of condition",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.405(a)(2)(ii)(J) requires extension cords on construction sites to be of the 3-wire grounded type rated for hard or extra-hard service.",
      },
      {
        id: 5,
        text: "The Assured Equipment Grounding Conductor Program (AEGCP) is used as an alternative to:",
        options: [
          "Hard hat requirements",
          "GFCI protection on construction sites",
          "Lockout/tagout procedures",
          "Ladder safety inspections",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.404(b)(1) permits an AEGCP (regular testing/inspection of grounding conductors) as an alternative to GFCI devices at construction sites.",
      },
      {
        id: 6,
        text: "Before a worker contacts any electrical conductor or circuit part, it must be:",
        options: [
          "Rated below 120 V",
          "De-energized, locked out, and tested to verify it is de-energized",
          "Covered with electrical tape rated for that voltage",
          "Tested only if the panel breaker has been off for more than 30 minutes",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.417 requires de-energizing, locking out, and verifying de-energization before contacting conductors. Tape is not a substitute.",
      },
    ],
  },
  {
    id: "ppe-basics",
    title: "PPE Basics",
    oshaRef: "29 CFR 1926.95",
    description: "Employer obligations, head, eye, hand, and respiratory protection.",
    questions: [
      {
        id: 1,
        text: "Under OSHA 1926.95, who is primarily responsible for providing and paying for required PPE?",
        options: ["The worker", "The employer", "OSHA directly", "The general contractor's insurance carrier"],
        correctIndex: 1,
        explanation: "Employers must provide required PPE at no cost to employees — established by OSHA 1926.95 and reinforced by the 2008 final rule on employer payment.",
      },
      {
        id: 2,
        text: "A Class C hard hat provides:",
        options: [
          "High-voltage electrical protection up to 20,000 V",
          "Both impact protection and limited low-voltage protection",
          "Impact protection only — no electrical protection",
          "Full face protection plus head impact protection",
        ],
        correctIndex: 2,
        explanation: "Class C hard hats protect against impact only. Class E provides electrical protection up to 20,000 V; Class G up to 2,200 V.",
      },
      {
        id: 3,
        text: "Safety glasses marked \"Z87+\" indicate they meet:",
        options: [
          "NIOSH respirator standards for splash protection",
          "ANSI/ISEA Z87.1 high-impact certification",
          "UL listing for electrical arc flash",
          "CE marking for European markets only",
        ],
        correctIndex: 1,
        explanation: "The \"+\" in Z87+ denotes high-impact certification under ANSI/ISEA Z87.1. Glasses without \"+\" meet basic impact only.",
      },
      {
        id: 4,
        text: "An N95 respirator filters out at least what percentage of airborne particles ≥ 0.3 microns?",
        options: ["85%", "90%", "95%", "99%"],
        correctIndex: 2,
        explanation: "\"N95\" means it filters out at least 95% of airborne particles when properly fitted. \"N\" = not oil-resistant; \"95\" = efficiency level.",
      },
      {
        id: 5,
        text: "Which glove type provides the best cut resistance for handling sharp sheet metal?",
        options: [
          "Thin latex disposable gloves",
          "Chemical-resistant nitrile gloves",
          "ANSI A4 or higher cut-resistant gloves",
          "Standard leather work gloves",
        ],
        correctIndex: 2,
        explanation: "ANSI cut-level A4 or higher gloves (e.g., HDPE or stainless mesh) are designed for cut hazards like sheet metal edges.",
      },
      {
        id: 6,
        text: "High-visibility (ANSI Class 2 or 3) safety vests are required when working:",
        options: [
          "Any time outdoors after 5 PM",
          "In any confined space",
          "Near vehicle or equipment traffic as set by the project or jurisdiction",
          "Only on federal highway projects",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.201 and MUTCD require high-vis garments near active traffic. Many state and local jurisdictions extend this to any site with moving equipment.",
      },
    ],
  },
  {
    id: "tool-safety",
    title: "Tool Safety",
    oshaRef: "29 CFR 1926.300",
    description: "Guards, powder-actuated tools, abrasive wheels, and hand tool condition.",
    questions: [
      {
        id: 1,
        text: "Portable circular saws and similar rotary tools must be equipped with:",
        options: [
          "A two-hand interlock requiring both hands to operate",
          "A guard that automatically covers the blade when not cutting",
          "An electronic speed control preventing overspeed",
          "A built-in voltage tester",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.304(d) requires portable circular saws to have guards that automatically and instantly return to the covering position when the cut is complete.",
      },
      {
        id: 2,
        text: "Powder-actuated tools (stud drivers, nail guns fired by a cartridge) may be operated only by workers who are:",
        options: [
          "At least 18 years old and hold a general contractor's license",
          "Trained and qualified per the manufacturer's requirements (and OSHA 1926.302(e)(1))",
          "Wearing Class E hard hats and cut-resistant gloves",
          "Supervised by a licensed electrician",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.302(e)(1) limits powder-actuated tool use to trained workers who have demonstrated competence per the manufacturer's training program.",
      },
      {
        id: 3,
        text: "A cracked or chipped abrasive wheel (grinding disc) must be:",
        options: [
          "Marked with a caution tag and used only for light-duty work",
          "Removed from service immediately and replaced",
          "Tested by spinning it freehand before each use",
          "Returned to the manufacturer for regrading",
        ],
        correctIndex: 1,
        explanation: "OSHA 1926.303(b)(1) requires damaged abrasive wheels to be taken out of service immediately. A cracked wheel can fragment at high speed.",
      },
      {
        id: 4,
        text: "Pneumatic tools must be disconnected from the air supply:",
        options: [
          "Only at the end of each shift",
          "When the air pressure exceeds 125 PSI",
          "Before making adjustments, changing attachments, or clearing a jam",
          "Only when stored overnight",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.302(b)(3) requires disconnecting the air supply before any adjustment, attachment change, or repair to prevent accidental actuation.",
      },
      {
        id: 5,
        text: "Hand tools with cracked, broken, or loose handles must be:",
        options: [
          "Wrapped in duct tape and reported within 48 hours",
          "Used only for tasks where torque is minimal",
          "Tagged out and removed from service immediately",
          "Replaced at the end of the job",
        ],
        correctIndex: 2,
        explanation: "OSHA 1926.301(a) requires that hand tools be kept in safe condition. Broken handles cause loss of control and must be taken out of service immediately.",
      },
      {
        id: 6,
        text: "The \"dead man\" (constant-pressure) switch on a power tool is designed to:",
        options: [
          "Lock the tool ON for sustained operation without hand fatigue",
          "Stop the tool automatically when pressure on the trigger is released",
          "Trigger an emergency shutoff accessible from 10 feet",
          "Monitor motor temperature and shut down if overheating occurs",
        ],
        correctIndex: 1,
        explanation: "A dead man or constant-pressure switch requires continuous grip to keep the tool running. Releasing it cuts power — a basic safety feature on power tools.",
      },
    ],
  },
  {
    id: "hazcom",
    title: "Hazard Communication",
    oshaRef: "29 CFR 1910.1200",
    description: "GHS labels, Safety Data Sheets (SDS), pictograms, and worker training.",
    questions: [
      {
        id: 1,
        text: "Under OSHA's HazCom 2012 standard (aligned with GHS), a Safety Data Sheet (SDS) must have:",
        options: ["4 sections", "8 sections", "16 sections", "24 sections"],
        correctIndex: 2,
        explanation: "OSHA's HazCom 2012 requires 16 standardized SDS sections (1910.1200(g)(2)), matching the UN GHS format used globally.",
      },
      {
        id: 2,
        text: "The GHS pictogram that looks like a gas cylinder represents:",
        options: [
          "Compressed or liquefied gases",
          "Flammable gases or aerosols",
          "Asphyxiants that displace oxygen",
          "Products stored under pressure only",
        ],
        correctIndex: 0,
        explanation: "The gas cylinder GHS pictogram (GHS04) is used for gases under pressure: compressed, liquefied, refrigerated liquefied, or dissolved gases.",
      },
      {
        id: 3,
        text: "On a GHS-compliant label, the signal word \"DANGER\" indicates:",
        options: [
          "The product is restricted to licensed applicators",
          "The hazard can cause death or serious injury under normal exposure conditions",
          "The product requires special PPE but poses no acute risk",
          "The container must be stored above 50°F",
        ],
        correctIndex: 1,
        explanation: "\"DANGER\" is used for the more severe hazard categories. \"WARNING\" is used for less severe. \"DANGER\" means the hazard can cause death or serious injury.",
      },
      {
        id: 4,
        text: "Section 8 of an SDS covers:",
        options: [
          "Physical and chemical properties",
          "Ecological information",
          "Exposure controls and personal protection (PPE recommendations)",
          "Disposal considerations",
        ],
        correctIndex: 2,
        explanation: "SDS Section 8 (Exposure Controls/Personal Protection) lists OSHA PELs, ACGIH TLVs, engineering controls, and required PPE for the chemical.",
      },
      {
        id: 5,
        text: "Employers subject to HazCom must provide workers with training on chemical hazards:",
        options: [
          "Annually, regardless of whether new chemicals are introduced",
          "Only when a worker is assigned to handle chemicals for the first time",
          "When new chemical hazards are introduced, and at initial assignment",
          "Within 30 days of a chemical spill incident",
        ],
        correctIndex: 2,
        explanation: "OSHA 1910.1200(h)(1) requires training at initial assignment and whenever a new physical or health hazard is introduced into the work area.",
      },
      {
        id: 6,
        text: "On the NFPA 704 (fire diamond), the BLUE quadrant represents:",
        options: ["Flammability", "Reactivity", "Health hazard", "Special hazard (e.g., radioactive, water-reactive)"],
        correctIndex: 2,
        explanation: "Blue = health hazard (0–4 scale). Red = fire hazard. Yellow = instability/reactivity. White = special hazards like OX (oxidizer) or W (water-reactive).",
      },
    ],
  },
];
