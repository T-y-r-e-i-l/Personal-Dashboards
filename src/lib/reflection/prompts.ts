export type ReflectionPrompt = {
  id: string;
  text: string;
};

/** Curated journaling + philosophical prompts for the Reflection panel. */
export const REFLECTION_PROMPTS: ReflectionPrompt[] = [
  { id: "gratitude-three", text: "What three things am I grateful for right now?" },
  { id: "energy-now", text: "How is my energy, and what is feeding or draining it?" },
  { id: "hard-thing", text: "What is one hard thing I am carrying today?" },
  { id: "avoiding", text: "What am I avoiding, and what would facing it require?" },
  { id: "enough-today", text: "What would make today enough?" },
  { id: "body-says", text: "What is my body trying to tell me?" },
  { id: "kind-to-self", text: "Where could I be gentler with myself?" },
  { id: "proud-small", text: "What small thing am I quietly proud of?" },
  { id: "need-ask", text: "What do I need that I have not asked for?" },
  { id: "tension", text: "Where do I feel tension between who I am and who I am performing?" },
  { id: "learn-yesterday", text: "What did yesterday teach me that I almost ignored?" },
  { id: "relationship", text: "Who do I want to show up for more fully?" },
  { id: "fear-underneath", text: "What fear is underneath my current frustration?" },
  { id: "joy-permission", text: "Where am I waiting for permission to enjoy something?" },
  { id: "boundary", text: "What boundary would protect my attention today?" },
  { id: "finish-line", text: "If today had one finish line, what would it be?" },
  { id: "story-telling", text: "What story am I telling myself that may not be true?" },
  { id: "rest-shape", text: "What would real rest look like for me tonight?" },
  { id: "courage-small", text: "What is one brave thing I could do in the next hour?" },
  { id: "release", text: "What am I ready to put down?" },
  {
    id: "permanent-not",
    text: "What am I treating as permanent that is not?",
  },
  {
    id: "comfort-meaning",
    text: "Where am I mistaking comfort for meaning?",
  },
  {
    id: "trust-hour",
    text: "What would I do if I trusted myself for one hour?",
  },
  {
    id: "control-illusion",
    text: "What am I trying to control that was never mine to hold?",
  },
  {
    id: "enough-being",
    text: "When do I feel most like myself—and when do I abandon that?",
  },
  {
    id: "silence-says",
    text: "What have I been too busy to hear in the silence?",
  },
  {
    id: "virtue-today",
    text: "Which virtue am I practicing today, and which am I neglecting?",
  },
  {
    id: "mortality-lens",
    text: "If time were shorter than I assume, what would matter this afternoon?",
  },
  {
    id: "desire-vs-duty",
    text: "Where does desire conflict with duty—and which is asking for honesty?",
  },
  {
    id: "freedom-cost",
    text: "What freedom am I trading, and is the price still fair?",
  },
  {
    id: "other-minds",
    text: "Whose perspective am I refusing to take seriously?",
  },
  {
    id: "good-life",
    text: "What does a good life look like in concrete terms this week?",
  },
  {
    id: "shadow",
    text: "What part of myself am I most tempted to disown?",
  },
  {
    id: "attention-altar",
    text: "What am I worshiping with my attention?",
  },
  {
    id: "change-accept",
    text: "What must I change, and what must I accept?",
  },
  {
    id: "presence",
    text: "Where am I living in the past or future instead of this moment?",
  },
  {
    id: "absurd-courage",
    text: "In the face of uncertainty, what small act of courage is still available?",
  },
  {
    id: "love-as-verb",
    text: "How am I practicing love as an action, not a feeling?",
  },
  {
    id: "truth-cost",
    text: "What truth would be costly to admit—and costly to keep denying?",
  },
  {
    id: "enough-already",
    text: "Where am I already enough, and refusing to believe it?",
  },
];

export function getPromptById(id: string): ReflectionPrompt | undefined {
  return REFLECTION_PROMPTS.find((prompt) => prompt.id === id);
}
