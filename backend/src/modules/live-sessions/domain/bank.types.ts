import type { QuestionType } from "./types.ts";

export const QUESTION_BANK_MODULES = ["PHISHING", "INTERNET_SECURITY", "MALICIOUS_EMAILS"] as const;

export type QuestionBankModule = (typeof QUESTION_BANK_MODULES)[number];

export interface QuestionBankItemInput {
  type: QuestionType;
  text: string;
  options: string[];
  correctIndex?: number | null;
  correctIndices?: number[] | null;
  correctText?: string | null;
  rangeMin?: number | null;
  rangeMax?: number | null;
  correctNumber?: number | null;
  explanation?: string | null;
  imageUrl?: string | null;
  optionImages?: (string | null)[] | null;
  baseScore: number;
  timeSec: number;
}

export interface CreateQuestionBankInput {
  tenantId?: string | null;
  name: string;
  module: QuestionBankModule;
  description?: string | null;
  isShared?: boolean;
  createdById?: string | null;
  items: QuestionBankItemInput[];
}

export interface UpdateQuestionBankInput extends Partial<Omit<CreateQuestionBankInput, "items">> {
  items?: QuestionBankItemInput[];
}

export interface BankSummary {
  id: string;
  tenantId: string | null;
  name: string;
  module: QuestionBankModule;
  description: string | null;
  isShared: boolean;
  itemCount: number;
  createdAt: string;
}

export interface BankDetail extends BankSummary {
  items: Array<QuestionBankItemInput & { id: string; orderIndex: number }>;
}

export interface ComposeMixItem {
  bankId: string;
  count: number;
}

export interface ComposeQuizInput {
  tenantId?: string | null;
  totalMax?: number;
  mix: ComposeMixItem[];
}
