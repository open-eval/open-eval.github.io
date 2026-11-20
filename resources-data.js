/*
 * Open Eval Commons — resource catalog.
 *
 * This is the single source for the Research & Tools page (papers + tools),
 * the Blog Posts page, and the Events page (workshops, competitions). To add a resource, append an object to the matching
 * array below. No build step is needed.
 *
 * Fields
 *   title     (required) Display title, exactly as published.
 *   url       (required) Canonical link.
 *   authors   Paper/blog authors, or the maintaining organization for tools.
 *   year      Publication year (number). Papers and blog posts sort by this.
 *   venue     Papers: conference/journal. Blog posts: the site or outlet.
 *   summary   One or two sentences on why it matters for evaluation.
 *   tags      Short topic labels; used for the filter chips on each page.
 *   added     Date added to the commons, "YYYY-MM-DD".
 *   Tools only:
 *   language  Primary language, e.g. "Python".
 *   license   SPDX-style license name.
 *   paper     Optional link to an accompanying paper.
 */
/*
 * Example entry:
 *   {
 *     title: 'Paper title',
 *     url: 'https://arxiv.org/abs/xxxx.xxxxx',
 *     authors: 'First Author, Second Author, et al.',
 *     year: 2026,
 *     venue: 'NeurIPS 2026',
 *     summary: 'Why it matters for evaluation.',
 *     tags: ['Psychometrics'],
 *     added: '2026-11-13',
 *   },
 */
window.OEC_RESOURCES = {
  papers: [
    {
      title: "AI Evaluation Should Require Standardized Item-Level Data Releases",
      url: "https://arxiv.org/abs/2604.03244",
      authors: "Han Jiang, Susu Zhang, Dongyao Zhu, Yuzhuo Bai, Sang T. Truong, Xiaoyuan Yi, Sanmi Koyejo, Xing Xie, Ziang Xiao",
      year: 2026,
      venue: "NeurIPS 2026 (Position)",
      summary: "Position paper arguing that AI evaluations should release standardized item-level data, the motivation behind OpenEval.",
      tags: ["Evaluation methodology", "Item-level data"],
      added: "2026-11-19",
    },
    {
      title: "Can We Trust Item Response Theory for AI Evaluation?",
      url: "https://arxiv.org/abs/2607.15190",
      authors: "Han Jiang, Sunbeom Kwon, Jinwen Luo, Ziang Xiao, Susu Zhang",
      year: 2026,
      venue: "NeurIPS 2026",
      summary: "Examines when item response theory can be relied on as a tool for evaluating AI models.",
      tags: ["Psychometrics", "Item response theory"],
      added: "2026-11-19",
    },
    {
      title: "Diagnosing Model–Item Interactions in Language Model Benchmarks with LSIRM",
      url: "https://arxiv.org/abs/2611.02432",
      authors: "Jinwen Luo, Han Jiang, Ziang Xiao, Susu Zhang",
      year: 2026,
      venue: "arXiv preprint",
      summary: "Uses a latent space item response model to diagnose how models and benchmark items interact.",
      tags: ["Psychometrics", "Item response theory", "Benchmark design"],
      added: "2026-11-19",
    },
    {
      title: "Results-Actionability Gap: Understanding How Practitioners Evaluate LLM Products in the Wild",
      url: "https://arxiv.org/abs/2604.16304",
      authors: "Willem van der Maden, Malak Sadek, Ziang Xiao, Aske Mottelson, Q. Vera Liao, Jichen Zhu",
      year: 2026,
      venue: "CHI 2026",
      summary: "Studies how practitioners evaluate LLM products in practice and where results fail to become actionable.",
      tags: ["Human-centered evaluation", "Evaluation practice"],
      added: "2026-11-19",
    },
    {
      title: "Synthetic Users, Real Differences: An Evaluation Framework for User Simulation in Multi-Turn Conversations",
      url: "https://arxiv.org/abs/2605.02624",
      authors: "Yu Lu Liu, Hyokun Yun, Tanya Roosta, Ziang Xiao",
      year: 2026,
      venue: "arXiv preprint",
      summary: "A framework for evaluating how well simulated users match real users in multi-turn conversations.",
      tags: ["Simulation", "Evaluation methodology"],
      added: "2026-11-19",
    },
    {
      title: "Contextualized Evaluation of Vision Language Models through Dynamic, Multi-turn Interactions",
      url: "https://arxiv.org/abs/2607.14499",
      authors: "Yijiang Li, Huiqi Zou, Bingyang Wang, Ziang Xiao",
      year: 2026,
      venue: "NeurIPS 2026",
      summary: "Evaluates vision language models through dynamic, multi-turn interactions rather than static tests.",
      tags: ["Dynamic evaluation", "Multimodal"],
      added: "2026-11-19",
    },
    {
      title: "InterviewPlayground: A Validated Simulation Environment for Evaluating AI Interviewers",
      url: "https://arxiv.org/abs/2610.12023",
      authors: "Jonathan Ivey, Aimee Liang, Arthur Y. S. Wang, Madeline Mandell, Ziang Xiao, Anjalie Field",
      year: 2026,
      venue: "arXiv preprint",
      summary: "A validated simulation environment for evaluating AI interviewers.",
      tags: ["Simulation", "Validity"],
      added: "2026-11-19",
    },
    {
      title: "Raising the Bar: Investigating the Values of Large Language Models via Generative Evolving Testing",
      url: "https://arxiv.org/abs/2406.14230",
      authors: "Han Jiang, Xiaoyuan Yi, Zhihua Wei, Ziang Xiao, Shu Wang, Xing Xie",
      year: 2025,
      venue: "ICML 2025",
      summary: "Assesses LLM values with generative, evolving tests instead of a fixed benchmark.",
      tags: ["Dynamic evaluation", "Values"],
      added: "2026-11-19",
    },
    {
      title: "Can LLM \"Self-report\"?: Evaluating the Validity of Self-report Scales in Measuring Personality Design in LLM-based Chatbots",
      url: "https://arxiv.org/abs/2412.00207",
      authors: "Huiqi Zou, Pengda Wang, Zihan Yan, Tianjun Sun, Ziang Xiao",
      year: 2025,
      venue: "COLM 2025",
      summary: "Tests whether self-report scales validly measure the designed personality of LLM-based chatbots.",
      tags: ["Psychometrics", "Validity"],
      added: "2026-11-19",
    },
    {
      title: "From Queries to Criteria: Understanding How Astronomers Evaluate LLMs",
      url: "https://arxiv.org/abs/2507.15715",
      authors: "Alina Hyk, Kiera McCormick, Mian Zhong, Ioana Ciucă, Sanjib Sharma, John F. Wu, J. E. G. Peek, Kartheik G. Iyer, Ziang Xiao, Anjalie Field",
      year: 2025,
      venue: "COLM 2025",
      summary: "Studies the criteria domain experts in astronomy use when evaluating LLMs.",
      tags: ["Human-centered evaluation", "Evaluation practice"],
      added: "2026-11-19",
    },
    {
      title: "ECBD: Evidence-Centered Benchmark Design for NLP",
      url: "https://arxiv.org/abs/2406.08723",
      authors: "Yu Lu Liu, Su Lin Blodgett, Jackie Chi Kit Cheung, Q. Vera Liao, Alexandra Olteanu, Ziang Xiao",
      year: 2024,
      venue: "ACL 2024",
      summary: "A framework for designing NLP benchmarks around the evidence they provide for claims about model capabilities.",
      tags: ["Benchmark design", "Validity"],
      added: "2026-11-19",
    },
    {
      title: "Evaluating Evaluation Metrics: A Framework for Analyzing NLG Evaluation Metrics using Measurement Theory",
      url: "https://arxiv.org/abs/2305.14889",
      authors: "Ziang Xiao, Susu Zhang, Vivian Lai, Q. Vera Liao",
      year: 2023,
      venue: "EMNLP 2023",
      summary: "Uses measurement theory to analyze the reliability and validity of NLG evaluation metrics.",
      tags: ["Psychometrics", "Validity", "Metrics"],
      added: "2026-11-19",
    },
    {
      title: "Rethinking Model Evaluation as Narrowing the Socio-Technical Gap",
      url: "https://arxiv.org/abs/2306.03100",
      authors: "Q. Vera Liao, Ziang Xiao",
      year: 2023,
      venue: "ICML 2023 Workshop on AI & HCI",
      summary: "Frames model evaluation as narrowing the gap between technical measures and real-world needs.",
      tags: ["Evaluation methodology", "Human-centered evaluation"],
      added: "2026-11-19",
    },
  ],
  tools: [
    {
      title: "MetricEval (metric-eval)",
      url: "https://pypi.org/project/metric-eval/",
      authors: "Ziang Xiao, Susu Zhang",
      year: 2023,
      summary: "A Python package for evaluating evaluation metrics: estimates their reliability (stability, consistency) and validity using measurement theory.",
      tags: ["Metrics", "Psychometrics", "Validity"],
      language: "Python",
      paper: "https://arxiv.org/abs/2305.14889",
      added: "2026-11-19",
    },
    {
      title: "ECBD Worksheet",
      url: "https://github.com/isle-dev/ECBD",
      authors: "Yu Lu Liu, Su Lin Blodgett, Jackie Chi Kit Cheung, Q. Vera Liao, Alexandra Olteanu, Ziang Xiao",
      year: 2024,
      summary: "A template worksheet for documenting a benchmark with Evidence-Centered Benchmark Design: describe, justify, and support each design choice. Includes filled-in worksheets for BoolQ, SuperGLUE, and HELM.",
      tags: ["Benchmark design", "Validity"],
      paper: "https://arxiv.org/abs/2406.08723",
      added: "2026-11-19",
    },
  ],
  blogs: [
    // Placeholder entry for layout; replace with a real post.
    {
      title: 'Sample post: Why item-level evaluation data matters',
      url: 'blog.html',
      authors: 'Open Eval Commons',
      year: 2026,
      venue: 'Open Eval Commons Blog',
      summary: 'A placeholder post showing how blog entries appear on this page. Replace it with a real write-up.',
      tags: ['Placeholder'],
      added: '2026-11-19',
    },
  ],
  events: [
    {
      title: "HEAL: Human-centered Evaluation and Auditing of Language Models",
      url: "https://heal-workshop.github.io/",
      year: 2026,
      venue: "CHI 2026 workshop, Barcelona",
      summary: "Brings HCI and AI researchers together to rethink LLM evaluation and auditing from a human-centered perspective. Now in its third year (after CHI 2024 and 2025), with a 2026 theme of AI agents-in-the-loop.",
      tags: ["Workshop", "Human-centered evaluation"],
      added: "2026-11-19",
    },
    {
      title: "IAB: Interpreting Agent Behavior",
      url: "https://iab-agents.github.io/",
      year: 2026,
      venue: "NeurIPS 2026 workshop, Sydney",
      summary: "The first NeurIPS workshop on interpreting agent behavior: human-centered interpretation for understanding agents, humans, and their interaction.",
      tags: ["Workshop", "Agents"],
      added: "2026-11-19",
    },
    {
      title: "The Predictive AI Evaluation Competition",
      url: "https://competition.measurementdb.org/",
      year: 2026,
      venue: "NeurIPS 2026 competition",
      summary: "Predict whether an AI system answered a benchmark question correctly from partial observations. Submissions are scored across fixed test-time label budgets using Brier ALC.",
      tags: ["Competition", "Predictive evaluation"],
      added: "2026-11-19",
    },
  ],
};
