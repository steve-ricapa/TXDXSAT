/** The editor accepts at most 100 questions, and cannot invent source questions. */
export function maxMixQuestionCount(availableQuestions: number): number {
  return Math.min(100, Math.max(0, availableQuestions));
}

export function clampMixQuestionCount(requested: number, selectedSources: number, availableQuestions: number): number {
  const maximum = maxMixQuestionCount(availableQuestions);
  if (selectedSources < 2 || maximum < selectedSources) return requested;
  return Math.min(Math.max(Math.trunc(requested), selectedSources), maximum);
}
