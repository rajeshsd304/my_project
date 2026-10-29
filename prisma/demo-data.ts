// Demo content so the platform can be tried immediately after `npm run setup`.
import type { Language, Difficulty } from "../src/lib/question-content";

type Bi = { bn?: string; en?: string };
export type DemoQuestion = {
  unit: string;
  subject: string;
  topic: string;
  language: Language;
  difficulty: Difficulty;
  text: Bi;
  options: (Bi & { correct?: boolean })[];
  explanation?: Bi;
  tags: string[];
};

export const DEMO_QUESTIONS: DemoQuestion[] = [
  {
    unit: "Engineering", subject: "Physics", topic: "Work, Energy & Power", language: "BOTH", difficulty: "EASY", tags: ["energy"],
    text: { bn: "$m$ ভরের একটি বস্তু $v$ বেগে চললে এর গতিশক্তি কত?", en: "A body of mass $m$ moves with speed $v$. What is its kinetic energy?" },
    options: [{ bn: "$mv$", en: "$mv$" }, { bn: "$\\frac{1}{2}mv^2$", en: "$\\frac{1}{2}mv^2$", correct: true }, { bn: "$mv^2$", en: "$mv^2$" }, { bn: "$2mv^2$", en: "$2mv^2$" }],
    explanation: { bn: "গতিশক্তি $E_k = \\frac{1}{2}mv^2$।", en: "Kinetic energy is $E_k = \\frac{1}{2}mv^2$." },
  },
  {
    unit: "Engineering", subject: "Physics", topic: "Work, Energy & Power", language: "BN", difficulty: "MEDIUM", tags: ["energy"],
    text: { bn: "কোনো বস্তুর বেগ দ্বিগুণ করলে এর গতিশক্তি কতগুণ হবে?" },
    options: [{ bn: "২ গুণ" }, { bn: "৪ গুণ", correct: true }, { bn: "৮ গুণ" }, { bn: "অপরিবর্তিত থাকবে" }],
    explanation: { bn: "$E_k \\propto v^2$, তাই বেগ দ্বিগুণ হলে গতিশক্তি $2^2 = 4$ গুণ হয়।" },
  },
  {
    unit: "Engineering", subject: "Physics", topic: "Work, Energy & Power", language: "EN", difficulty: "EASY", tags: ["units"],
    text: { en: "What is the SI unit of power?" },
    options: [{ en: "Joule" }, { en: "Watt", correct: true }, { en: "Newton" }, { en: "Pascal" }],
    explanation: { en: "$1\\,\\text{W} = 1\\,\\text{J/s}$." },
  },
  {
    unit: "Engineering", subject: "Physics", topic: "Electricity", language: "BOTH", difficulty: "EASY", tags: ["ohm's law"],
    text: { bn: "$R$ রোধের মধ্য দিয়ে $I$ তড়িৎপ্রবাহ চললে বিভব পার্থক্য কত?", en: "If current $I$ flows through a resistance $R$, what is the potential difference?" },
    options: [{ bn: "$V = IR$", en: "$V = IR$", correct: true }, { bn: "$V = I/R$", en: "$V = I/R$" }, { bn: "$V = R/I$", en: "$V = R/I$" }, { bn: "$V = I^2R$", en: "$V = I^2R$" }],
    explanation: { bn: "ওহমের সূত্র অনুযায়ী $V = IR$।", en: "By Ohm's law, $V = IR$." },
  },
  {
    unit: "Engineering", subject: "Chemistry", topic: "Qualitative Chemistry", language: "BN", difficulty: "EASY", tags: ["formula"],
    text: { bn: "পানির রাসায়নিক সংকেত কোনটি?" },
    options: [{ bn: "$H_2O$", correct: true }, { bn: "$H_2O_2$" }, { bn: "$CO_2$" }, { bn: "$NaCl$" }],
    explanation: { bn: "পানির প্রতিটি অণুতে দুটি হাইড্রোজেন ও একটি অক্সিজেন পরমাণু থাকে।" },
  },
  {
    unit: "Engineering", subject: "Chemistry", topic: "Periodic Properties", language: "EN", difficulty: "EASY", tags: ["noble gas"],
    text: { en: "Which of the following is a noble gas?" },
    options: [{ en: "Nitrogen" }, { en: "Oxygen" }, { en: "Argon", correct: true }, { en: "Chlorine" }],
  },
  {
    unit: "Engineering", subject: "Chemistry", topic: "Chemical Changes", language: "BOTH", difficulty: "MEDIUM", tags: ["ph"],
    text: { bn: "২৫°C তাপমাত্রায় বিশুদ্ধ পানির pH কত?", en: "What is the pH of pure water at 25°C?" },
    options: [{ bn: "৫", en: "5" }, { bn: "৬", en: "6" }, { bn: "৭", en: "7", correct: true }, { bn: "৮", en: "8" }],
    explanation: { bn: "বিশুদ্ধ পানিতে $[H^+] = 10^{-7}$ মোল/লিটার, তাই $pH = 7$।", en: "In pure water $[H^+] = 10^{-7}$ mol/L, so $pH = 7$." },
  },
  {
    unit: "Engineering", subject: "Higher Math", topic: "Differentiation", language: "EN", difficulty: "EASY", tags: ["calculus"],
    text: { en: "What is $\\dfrac{d}{dx}\\left(x^3\\right)$?" },
    options: [{ en: "$x^2$" }, { en: "$3x^2$", correct: true }, { en: "$3x^3$" }, { en: "$\\frac{x^4}{4}$" }],
    explanation: { en: "Power rule: $\\frac{d}{dx}x^n = nx^{n-1}$." },
  },
  {
    unit: "Engineering", subject: "Higher Math", topic: "Integration", language: "BOTH", difficulty: "MEDIUM", tags: ["calculus"],
    text: { bn: "$\\displaystyle\\int_0^1 2x\\,dx$ এর মান কত?", en: "Evaluate $\\displaystyle\\int_0^1 2x\\,dx$." },
    options: [{ bn: "$0$", en: "$0$" }, { bn: "$\\frac{1}{2}$", en: "$\\frac{1}{2}$" }, { bn: "$1$", en: "$1$", correct: true }, { bn: "$2$", en: "$2$" }],
    explanation: { bn: "$\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$।", en: "$\\int_0^1 2x\\,dx = [x^2]_0^1 = 1$." },
  },
  {
    unit: "Engineering", subject: "Higher Math", topic: "Trigonometry", language: "BN", difficulty: "EASY", tags: ["trigonometry"],
    text: { bn: "$\\sin^2\\theta + \\cos^2\\theta$ এর মান কত?" },
    options: [{ bn: "$0$" }, { bn: "$1$", correct: true }, { bn: "$2$" }, { bn: "$\\tan\\theta$" }],
  },
  {
    unit: "Engineering", subject: "English", topic: "Vocabulary", language: "EN", difficulty: "MEDIUM", tags: ["synonym"],
    text: { en: "Choose the word closest in meaning to “abundant”." },
    options: [{ en: "Scarce" }, { en: "Plentiful", correct: true }, { en: "Hidden" }, { en: "Fragile" }],
  },
  {
    unit: "Medical", subject: "Biology", topic: "Cell & Cell Division", language: "BOTH", difficulty: "EASY", tags: ["cell"],
    text: { bn: "কোষের শক্তিঘর বলা হয় কোনটিকে?", en: "Which organelle is called the powerhouse of the cell?" },
    options: [{ bn: "রাইবোজোম", en: "Ribosome" }, { bn: "মাইটোকন্ড্রিয়া", en: "Mitochondria", correct: true }, { bn: "গলগি বস্তু", en: "Golgi body" }, { bn: "লাইসোজোম", en: "Lysosome" }],
    explanation: { bn: "মাইটোকন্ড্রিয়ায় শ্বসনের মাধ্যমে ATP তৈরি হয়।", en: "Mitochondria produce ATP through respiration." },
  },
  {
    unit: "Medical", subject: "General Knowledge", topic: "Bangladesh Affairs", language: "BN", difficulty: "EASY", tags: ["bangladesh"],
    text: { bn: "বাংলাদেশের জাতীয় ফুল কোনটি?" },
    options: [{ bn: "শাপলা", correct: true }, { bn: "গোলাপ" }, { bn: "রজনীগন্ধা" }, { bn: "জবা" }],
  },
];

export const DEMO_NOTE_BODY = `গতিবিদ্যার গুরুত্বপূর্ণ সূত্র (Key formulas of motion)

১. সমত্বরণে গতি: $v = u + at$
২. অতিক্রান্ত দূরত্ব: $s = ut + \\frac{1}{2}at^2$
৩. $v^2 = u^2 + 2as$
৪. গতিশক্তি: $E_k = \\frac{1}{2}mv^2$, বিভবশক্তি: $E_p = mgh$
৫. ক্ষমতা: $P = \\dfrac{W}{t}$

Tip: Always write units — বিজ্ঞানে একক ছাড়া উত্তর অসম্পূর্ণ।`;
