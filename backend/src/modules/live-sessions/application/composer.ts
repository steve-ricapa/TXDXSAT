import { ForbiddenError, NotFoundError } from "../../../shared/errors/app-error.ts";
import type { ComposeQuizInput } from "../domain/bank.types.ts";
import type { QuizQuestionInput } from "../domain/types.ts";
import type { QuestionBankRepo, QuestionComposer } from "./ports.ts";

function shuffle<T>(items: T[]): T[] {
  const result = items.slice();
  for (let index = result.length - 1; index > 0; index--) {
    const next = Math.floor(Math.random() * (index + 1));
    [result[index], result[next]] = [result[next] as T, result[index] as T];
  }
  return result;
}

export class BankQuestionComposer implements QuestionComposer {
  constructor(private readonly banks: QuestionBankRepo) {}

  async compose(input: ComposeQuizInput, tenantId: string | null, isSuperAdmin: boolean): Promise<QuizQuestionInput[]> {
    const totalMax = input.totalMax ?? 20;
    if (!Number.isInteger(totalMax) || totalMax < 1 || totalMax > 100) {
      throw new Error("totalMax must be an integer from 1 to 100");
    }
    if (!input.mix.length || input.mix.length > 20) throw new Error("mix must contain 1 to 20 banks");

    const selected: QuizQuestionInput[] = [];
    for (const entry of input.mix) {
      if (!Number.isInteger(entry.count) || entry.count < 0 || entry.count > 100) {
        throw new Error("Each bank count must be an integer from 0 to 100");
      }
      if (entry.count === 0) continue;
      const bank = await this.banks.getBank(entry.bankId);
      if (!bank) throw new NotFoundError("Question bank not found");
      if (!isSuperAdmin && bank.tenantId !== tenantId && !bank.isShared) throw new ForbiddenError("No tienes acceso a este banco");

      const shuffled = shuffle(bank.items);
      selected.push(...shuffled.slice(0, entry.count).map((item) => ({
        type: item.type,
        text: item.text,
        options: item.options,
        correctIndex: item.correctIndex,
        correctIndices: item.correctIndices,
        correctText: item.correctText,
        rangeMin: item.rangeMin,
        rangeMax: item.rangeMax,
        correctNumber: item.correctNumber,
        explanation: item.explanation,
        imageUrl: item.imageUrl,
        optionImages: item.optionImages,
        baseScore: item.baseScore,
        timeSec: item.timeSec,
      })));
    }
    return shuffle(selected).slice(0, totalMax);
  }
}
