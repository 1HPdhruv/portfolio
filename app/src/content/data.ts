// The single authoritative content source for Dhruva's World.
// Sources: Dhruva's résumé (owner-supplied PDF) and his public GitHub repositories (READMEs + metadata, read 2026-10-22).
// Rules: no invented metrics, links, awards or results. Where something is not evidenced it is flagged, not asserted.
import type { Achievement, Education, Link, Milestone, Profile, Project, ResearchLine, SkillGroup, Source } from './types';

const RESUME: Source = { kind: 'resume' };
const CHECKED = '2026-10-22';
const gh = (repo: string): Link => ({ kind: 'repo', label: `GitHub · ${repo}`, href: `https://github.com/1HPdhruv/${repo}`, check: 'ok', checkedOn: CHECKED });
const repoSrc = (repo: string, note?: string): Source => ({ kind: 'repo', url: `https://github.com/1HPdhruv/${repo}`, note });
const demo = (href: string): Link => ({ kind: 'demo', label: 'Live demo', href, check: 'ok', checkedOn: CHECKED });

export const profile: Profile = {
  name: 'Dhruva Mishra',
  role: 'AI/ML Engineer — AI agents & intelligent systems',
  location: 'Chennai, India',
  intro: [
    'I build machine-learning systems that do something concrete: diagnose an EV fault from a description, recommend a crop and spot a leaf disease, turn a trading idea into a backtested strategy, or flag network intrusions.',
    'I study Computer Science and Engineering (AI & ML) at SRM Institute of Science and Technology, and I am working on two research lines: real-time depth completion for AR/VR digital twins, and deep-learning approaches to early-onset Alzheimer’s classification and progression.',
  ],
  focus: ['Machine learning & deep learning', 'Generative AI / LLMs and AI agents', 'Computer vision', 'NLP & retrieval (RAG)', 'Full-stack ML applications and IoT systems'],
  languages: ['English', 'Hindi', 'German'],
  leadership: ['Hyperloop Club — Traction / Levitation member', 'Hackathon team lead across multiple events, including Smart India Hackathon (SIH)'],
  links: [
    { kind: 'email', label: 'mishradhruva19@gmail.com', href: 'mailto:mishradhruva19@gmail.com', check: 'unverified' },
    { kind: 'profile', label: 'GitHub · 1HPdhruv', href: 'https://github.com/1HPdhruv', check: 'ok', checkedOn: CHECKED },
    { kind: 'profile', label: 'LinkedIn · in/1hpdhruv', href: 'https://www.linkedin.com/in/1hpdhruv', check: 'unverified' },
  ],
  resume: { href: '/resume.pdf', note: 'Résumé PDF — published only when the owner adds public/resume.pdf (see docs/DEPLOYMENT.md).' },
  sources: [RESUME],
};

export const projects: Project[] = [
  {
    id: 'agrisaarthi', title: 'AgriSaarthi', year: 2025, status: 'prototype',
    summary: 'A multilingual crop-recommendation and plant-disease assistant for Indian farmers.',
    description: [
      'AgriSaarthi (“Saarthi” means guide) is a Streamlit application that combines crop recommendation with plant-disease detection from a leaf photo, aimed at farmers who may not read English.',
      'Disease detection uses a Keras CNN and reports a confidence-based diagnosis; crop suggestions are made per state, soil and season. Farmer history is stored so past diagnoses can be revisited.',
    ],
    domains: ['applied-ml', 'vision'],
    tech: ['Python', 'TensorFlow / Keras', 'Streamlit', 'Pandas', 'SQLite'],
    highlights: ['Five interface languages: English, Hindi, Tamil, Telugu, Malayalam — selected by the farmer’s state', 'Keras CNN plant-disease detection with confidence-based diagnosis', 'Per-farmer diagnosis history'],
    links: [gh('AgriSaarthi')],
    sources: [RESUME, repoSrc('AgriSaarthi')],
  },
  {
    id: 'evdoctor', title: 'evDOCTOR — EV fault diagnosis', year: 2025, status: 'prototype',
    summary: 'Describe an EV symptom in plain English; get a diagnosed fault, a calibrated confidence and troubleshooting steps.',
    description: [
      'A full-stack application that maps a free-text symptom description to an EV fault using an ensemble of three scikit-learn classifiers — Logistic Regression, SGD and Naive Bayes — combined by weighted averaging.',
      'Out-of-domain input is rejected through keyword validation and a confidence threshold, and confidence scores are temperature-scaled. Users can rate a diagnosis, and recent searches are kept.',
    ],
    domains: ['applied-ml'],
    tech: ['Python', 'scikit-learn', 'FastAPI', 'SQLAlchemy', 'SQLite', 'React', 'Vite'],
    highlights: ['127+ fault codes across 16 EV subsystems', 'Weighted LR + SGD + Naive Bayes ensemble', 'Confidence thresholding and temperature scaling', 'Feedback and search-history features'],
    links: [gh('evDOCTOR'), demo('https://ev-troubleshooter.netlify.app')],
    sources: [RESUME, repoSrc('evDOCTOR')],
  },
  {
    id: 'strategyai', title: 'StrategyAI', year: 2026, status: 'prototype',
    summary: 'From a trading idea in plain English to parsed code, a backtest, optimised parameters and suggestions.',
    description: [
      'StrategyAI turns a natural-language trading idea into executable Python (using Claude and vectorbt), backtests it on historical OHLCV data from Yahoo Finance, searches parameters with Optuna, and asks the model to analyse the results and suggest improvements.',
      'The repository describes paper or live execution through Alpaca or Zerodha adapters, with pre-trade risk controls. This page describes the design in the repository; it makes no claim about trading performance.',
    ],
    domains: ['agents', 'llm'],
    tech: ['Python', 'FastAPI', 'Celery', 'Claude API', 'vectorbt', 'Optuna', 'JavaScript'],
    highlights: ['Pipeline: describe → parse → backtest → optimise → suggest → deploy (paper / live adapters)', 'Bayesian parameter search with Optuna', 'Pre-trade risk manager module'],
    links: [gh('strategyai'), demo('https://strategyai.netlify.app')],
    sources: [repoSrc('strategyai')],
  },
  {
    id: 'sev-guardian', title: 'SEV Guardian', year: 2026, status: 'prototype', statusNote: 'Built for the AMD Slingshot Hackathon 2026.',
    summary: 'An ML intrusion-detection API and SOC dashboard built for the AMD Slingshot Hackathon 2026.',
    description: [
      'SEV Guardian classifies network traffic with an ensemble of an MLP and XGBoost trained on the CIC-IDS2017 dataset, exports the model to ONNX Runtime with ROCm GPU support, and serves it through FastAPI to a Streamlit SOC dashboard.',
      'The README also describes SEV-SNP confidential-compute compatibility. A hosted API is mentioned in the repository; it did not respond when this site was built, so no live link is shown.',
    ],
    domains: ['security', 'applied-ml'],
    tech: ['Python', 'XGBoost', 'MLP', 'ONNX Runtime', 'ROCm', 'FastAPI', 'Streamlit'],
    highlights: ['Pipeline: traffic → preprocessing → ensemble → ONNX → ROCm/CPU → FastAPI → dashboard', 'Dataset: CIC-IDS2017 (Canadian Institute for Cybersecurity)'],
    links: [gh('Sev-Guardian')],
    sources: [repoSrc('Sev-Guardian')],
  },
  {
    id: 'financial-csi', title: 'Financial CSI — AI risk manager', year: 2026, status: 'prototype',
    summary: 'Finds payment-loss patterns nobody wrote a rule for, explains them from evidence, and simulates whether fixing them is worth it.',
    description: [
      'Financial CSI reconstructs payment lifecycles into categorical event sequences, mines them with Apriori to surface event combinations over-represented in losses, and asks an LLM to explain each pattern only from a deterministic evidence pack.',
      'Each candidate fix goes through a Monte Carlo counterfactual simulation weighing prevented loss against false-positive cost. Razorpay integration runs in Test Mode only, with HMAC-SHA256 verified webhooks and a strict train/test evaluation.',
    ],
    domains: ['llm', 'applied-ml'],
    tech: ['Python', 'FastAPI', 'Next.js', 'TypeScript', 'Apriori', 'Monte Carlo simulation', 'LLM'],
    highlights: ['Unsupervised, combinatorial pattern discovery (Apriori)', 'Evidence-grounded LLM explanations', 'Monte Carlo counterfactuals for proposed interventions', 'Razorpay Test Mode only'],
    links: [gh('Razorpay'), demo('https://razorpay-swart.vercel.app')],
    sources: [RESUME, repoSrc('Razorpay')],
  },
  {
    id: 'smart-parking', title: 'Smart Parking System', year: 2026, status: 'in-progress', statusNote: 'Phase 1 (SRMIST KTR) is in development; later phases are planned.',
    summary: 'IoT parking with live slot availability, automated gates, and a conversational Driver Agent and Ops Agent.',
    description: [
      'ESP32 sensors publish slot occupancy over MQTT (HiveMQ Cloud); Node-RED moves the data into Supabase, and a web dashboard shows live availability and gate control.',
      'A conversational Driver Agent helps find and manage parking, and an Ops Agent handles pricing, anomalies and gate exceptions with tool use, server-side policy controls and audit logging.',
    ],
    domains: ['iot', 'agents'],
    tech: ['ESP32', 'MQTT', 'Node-RED', 'Supabase', 'TypeScript', 'Claude API'],
    highlights: ['Sensor-driven slot availability and automated gate workflows', 'Driver and Ops agents with tool use, policy controls and audit logging'],
    links: [gh('Smart_Parking_System'), demo('https://parker-os.netlify.app')],
    sources: [RESUME, repoSrc('Smart_Parking_System')],
  },
  {
    id: 'vocalvitals', title: 'VocalVitals', year: 2026, status: 'prototype', statusNote: 'Research prototype — not a medical device.',
    summary: 'A browser-based screening prototype that classifies cough, breath and background audio and tracks drift from a personal baseline.',
    description: [
      'Acoustic features are extracted in the browser and passed to a Keras LSTM exported to TensorFlow.js; the model is trained offline on public respiratory-audio datasets. Instead of population thresholds, the prototype compares each session with the user’s own baseline.',
      'It is an early-stage research prototype. It is not a medical device and does not provide a diagnosis.',
    ],
    domains: ['applied-ml', 'research'],
    tech: ['Python', 'Librosa', 'Keras LSTM', 'TensorFlow.js', 'Web Audio API'],
    highlights: ['Winner — Techformers 1.0, HackerRank Club (2026)', 'Personal-baseline drift detection'],
    links: [gh('VocalVitals')],
    sources: [RESUME, repoSrc('VocalVitals')],
  },
  {
    id: 'amazon-ml-challenge', title: 'Amazon ML Challenge 2026 — business entity resolution', year: 2026, status: 'prototype',
    statusNote: 'Built without the official dataset: every number in the repository is from a synthetic benchmark, and no competition submission was made.',
    summary: 'A tested entity-resolution pipeline — retrieval, pair features, XGBoost and calibration — prepared for the challenge’s official data.',
    description: [
      'Candidate pairs are retrieved with exact keys, character and word TF-IDF, and rarity-weighted address keys; a calibrated XGBoost pair classifier decides matches, with the official validator as a hard gate.',
      'The repository states plainly that the official dataset was unavailable, that its numbers come from a synthetic benchmark labelled as such, and that no submission was generated. This page repeats that, and claims no leaderboard result.',
    ],
    domains: ['competition', 'applied-ml'],
    tech: ['Python', 'XGBoost', 'TF-IDF retrieval', 'isotonic calibration', 'pytest'],
    highlights: ['38 automated tests in the repository', 'Schema validation that fails loudly; output asserted to be a subset of the candidates'],
    links: [gh('AmazonMLchallenge')],
    sources: [repoSrc('AmazonMLchallenge')],
  },
  {
    id: 'driver-vigilance', title: 'Driver Vigilance System', year: 2026, status: 'prototype',
    summary: 'Real-time drowsiness and distraction detection from a camera, with physical alerts.',
    description: [
      'YOLOv8 detects face, eyes, yawns and phone use; MediaPipe landmarks feed eye-aspect-ratio / PERCLOS fatigue analysis, mouth-aspect-ratio yawn detection and head-pose gaze tracking. Alerts go to an Arduino, and a Streamlit dashboard shows the telemetry.',
    ],
    domains: ['vision', 'iot'],
    tech: ['Python', 'YOLOv8', 'MediaPipe', 'OpenCV', 'Arduino', 'Streamlit'],
    highlights: ['EAR / PERCLOS fatigue analysis', 'Phone-use detection and head-pose gaze tracking'],
    links: [gh('Driver-Vigiliance-System')],
    sources: [repoSrc('Driver-Vigiliance-System')],
  },
  {
    id: 'competitive-programming', title: 'Competitive programming', year: 2026, status: 'prototype',
    summary: 'Contest solutions in Java.',
    description: ['A repository of solutions to programming contests.'],
    domains: ['competition'],
    tech: ['Java'],
    highlights: [],
    links: [gh('Competetive-Programming')],
    sources: [repoSrc('Competetive-Programming', 'description: “Solutions of Contests”')],
  },
  {
    id: 'maze-robot', title: 'The maze-solving robot', status: 'planned', statusNote: 'Documentation not yet published.',
    summary: 'The small maze-solving robot that ROVER-02 descends from in this world.',
    description: [
      'Dhruva built a maze-solving robot before the projects above; the Hedge Maze in the Basin is its tribute, and ROVER-02 is drawn as its descendant.',
      'There is no public build log, repository or video for it yet, so this page makes no claims about how it worked.',
    ],
    domains: ['iot'],
    tech: [],
    highlights: [],
    links: [],
    sources: [{ kind: 'owner', note: 'Listed on Dhruva’s earlier portfolio and in the project design specification.' }],
    needsEvidence: 'Build log, photos, video or repository.',
  },
];

export const research: ResearchLine[] = [
  {
    id: 'depth-completion', title: 'Real-time AI depth completion for digital twins in AR/VR', stage: 'ongoing',
    question: 'Can sparse or noisy depth from commodity sensors be completed in real time, well enough to keep an AR/VR digital twin geometrically consistent?',
    description: ['Ongoing research. It sits in the Computer Vision laboratory of the Research Station.'],
    boundaries: ['No results, datasets or publications are claimed here.', 'Methods and findings will be added once they can be shown.'],
    sources: [RESUME],
  },
  {
    id: 'alzheimers', title: 'Early-onset Alzheimer’s disease: classification and progression prediction with deep learning', stage: 'ongoing',
    question: 'How well can deep-learning approaches classify early-onset Alzheimer’s disease and predict its progression?',
    description: ['Ongoing research. It sits in the Medical AI laboratory of the Research Station.'],
    boundaries: ['No clinical validation, diagnostic use or performance figure is claimed.', 'No participant-level or derived clinical data is published on this site.', 'Methods and findings will be added once they can be shown responsibly.'],
    sources: [RESUME],
  },
];

export const skills: SkillGroup[] = [
  { id: 'fundamentals', title: 'Fundamentals', note: 'Headwaters: languages and computer-science foundations.', sources: [RESUME], skills: [
    { name: 'Python', usedIn: ['agrisaarthi', 'evdoctor', 'strategyai', 'sev-guardian', 'financial-csi', 'vocalvitals', 'amazon-ml-challenge', 'driver-vigilance'] },
    { name: 'Java', usedIn: ['competitive-programming'] }, { name: 'C++', usedIn: [] }, { name: 'JavaScript', usedIn: ['evdoctor', 'strategyai'] }, { name: 'TypeScript', usedIn: ['smart-parking', 'financial-csi'] },
    { name: 'Data structures & algorithms (NPTEL)', usedIn: ['competitive-programming'] } ] },
  { id: 'ml', title: 'Machine learning', note: 'The main river.', sources: [RESUME], skills: [
    { name: 'scikit-learn', usedIn: ['evdoctor'] }, { name: 'TensorFlow / Keras', usedIn: ['agrisaarthi', 'vocalvitals'] }, { name: 'PyTorch', usedIn: [] },
    { name: 'XGBoost', usedIn: ['sev-guardian', 'amazon-ml-challenge'] }, { name: 'NumPy · Pandas · Matplotlib', usedIn: ['agrisaarthi'] }, { name: 'MLflow', usedIn: [] }, { name: 'Model evaluation & calibration', usedIn: ['evdoctor', 'amazon-ml-challenge', 'financial-csi'] } ] },
  { id: 'vision', title: 'Computer vision', note: 'A tributary that joins the main river.', sources: [RESUME], skills: [
    { name: 'OpenCV', usedIn: ['driver-vigilance'] }, { name: 'YOLOv8', usedIn: ['driver-vigilance'] }, { name: 'CNN image classification', usedIn: ['agrisaarthi'] } ] },
  { id: 'agents', title: 'LLMs, agents & retrieval', note: 'A tributary that joins the main river.', sources: [RESUME], skills: [
    { name: 'LLM integration & tool/function calling', usedIn: ['strategyai', 'smart-parking', 'financial-csi'] }, { name: 'Hugging Face Transformers · DistilBERT', usedIn: [] },
    { name: 'LangChain · Pydantic', usedIn: [] }, { name: 'RAG · FAISS', usedIn: [] }, { name: 'Conversational AI', usedIn: ['smart-parking'] } ] },
  { id: 'systems', title: 'Systems, data & deployment', note: 'The channel the work is delivered through.', sources: [RESUME], skills: [
    { name: 'FastAPI · REST APIs', usedIn: ['evdoctor', 'strategyai', 'sev-guardian', 'financial-csi'] }, { name: 'React · Node.js · Express.js', usedIn: ['evdoctor'] },
    { name: 'Streamlit', usedIn: ['agrisaarthi', 'sev-guardian', 'driver-vigilance'] }, { name: 'MongoDB · SQLite', usedIn: ['agrisaarthi', 'evdoctor'] },
    { name: 'Docker · Kubernetes', usedIn: [] }, { name: 'AWS · Google Cloud / Vertex AI · Snowflake', usedIn: [] }, { name: 'Apache Spark · dbt · Apache Airflow', usedIn: [] },
    { name: 'MQTT · ESP32 · Node-RED', usedIn: ['smart-parking'] } ] },
];

export const education: Education[] = [
  { id: 'srm', title: 'B.Tech — Computer Science and Engineering (Artificial Intelligence & Machine Learning)', institution: 'SRM Institute of Science and Technology, Kattankulathur (Chennai)', period: '2024 – 2028 (expected)', detail: 'CGPA 9.35 / 10', sources: [RESUME] },
  { id: 'xii', title: 'Class XII (ICSE)', institution: 'St. Xavier’s School, Bokaro', period: '2024', detail: '78.25%', sources: [RESUME] },
  { id: 'x', title: 'Class X (ICSE)', institution: 'St. Xavier’s School, Bokaro', period: '2022', detail: '91.2%', sources: [RESUME] },
];

/** Benchmark Ridge holds the first six; BM-07..09 are deliberately empty sockets. Proof links are not yet supplied. */
export const achievements: Achievement[] = [
  { id: 'techformers', title: 'Winner — Techformers 1.0, HackerRank Club', year: 2026, detail: 'Won with VocalVitals.', proof: null, sources: [RESUME] },
  { id: 'schneider-hmi', title: 'Winner — Schneider Electric HMI Hackathon', year: 2026, detail: 'Smart HMI Doctor: context-aware AI troubleshooting using OPC UA, RAG, explainable AI and an edge gateway.', proof: null, sources: [RESUME] },
  { id: 'ideathon', title: 'Winner — Ideathon', detail: 'Skill Exchange Website.', proof: null, sources: [RESUME] },
  { id: 'hackathons', title: '30+ hackathons, team lead', detail: 'Participated in more than 30 hackathons and led teams across several, including Smart India Hackathon (SIH).', proof: null, sources: [RESUME] },
  { id: 'oracle', title: 'Oracle Cloud Infrastructure certifications (2025)', year: 2025, detail: 'OCI 2025 Certified Data Science Professional; Oracle AI Vector Search Certified Professional; OCI 2025 Certified AI Foundations Associate.', proof: null, sources: [RESUME] },
  { id: 'nptel', title: 'NPTEL certifications', detail: 'Machine Learning; Data Structures & Algorithms; DBMS; Java; Object-Oriented Programming.', proof: null, sources: [RESUME] },
];

/** The Strata, read from the bottom (oldest) layer up. */
export const timeline: Milestone[] = [
  { id: 'S-01', year: '2022', title: 'Class X', detail: 'St. Xavier’s School, Bokaro (ICSE).', sources: [RESUME] },
  { id: 'S-02', year: '2024', title: 'Class XII', detail: 'St. Xavier’s School, Bokaro (ICSE).', sources: [RESUME] },
  { id: 'S-03', year: '2024', title: 'B.Tech begins', detail: 'Computer Science and Engineering (AI & ML), SRM Institute of Science and Technology.', sources: [RESUME] },
  { id: 'S-04', year: '2025', title: 'First applied-ML systems', detail: 'evDOCTOR and AgriSaarthi (repositories created August–September 2025).', sources: [repoSrc('evDOCTOR'), repoSrc('AgriSaarthi')] },
  { id: 'S-05', year: '2026', title: 'Agents, IoT and hackathon wins', detail: 'SEV Guardian, StrategyAI, Smart Parking, VocalVitals, Financial CSI; wins at Techformers 1.0 and the Schneider Electric HMI Hackathon.', sources: [RESUME] },
  { id: 'S-06', year: '2026 →', title: 'Research', detail: 'Two ongoing research lines: depth completion for AR/VR digital twins, and early-onset Alzheimer’s classification and progression.', sources: [RESUME] },
];

export const featuredProjectIds = ['evdoctor', 'agrisaarthi', 'strategyai'] as const;
