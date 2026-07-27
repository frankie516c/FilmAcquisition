/**
 * X4 — 검증 스키마의 단일 정의. 서버 API 경계와 클라이언트 폼이 같은 스키마를 공유한다.
 *
 * 설계 근거: business-rules.md 4절
 */

import { z } from "zod";
import { ValidationError, type FieldIssue } from "@/platform/errors";

const CURRENT_YEAR = new Date().getFullYear();

/** 앞뒤 공백 제거 후 빈 문자열이면 미입력으로 간주한다 (BR-U1-013) */
const requiredString = (max: number, label: string) =>
  z
    .string()
    .transform((s) => s.trim())
    .pipe(z.string().min(1, `${label}을(를) 입력해주세요.`).max(max, `${max}자 이내로 입력해주세요.`));

/** 선택 필드의 빈 문자열은 null로 정규화한다 */
const optionalString = (max: number) =>
  z
    .string()
    .transform((s) => {
      const t = s.trim();
      return t.length === 0 ? null : t;
    })
    .pipe(z.string().max(max).nullable());

export const emailSchema = z
  .string()
  .transform((s) => s.trim().toLowerCase())
  .pipe(z.string().email("이메일 형식이 올바르지 않습니다.").max(254));

export const passwordSchema = z
  .string()
  .min(8, "비밀번호는 8자 이상이어야 합니다.");

export const roleSchema = z.enum(["SCOUT", "ANALYST", "EXECUTIVE"], {
  errorMap: () => ({ message: "역할 값이 올바르지 않습니다." }),
});

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "비밀번호를 입력해주세요."),
});

export const userCreateSchema = z.object({
  email: emailSchema,
  name: requiredString(50, "이름"),
  password: passwordSchema,
  role: roleSchema,
});

export const userRoleUpdateSchema = z.object({ role: roleSchema });

/** 금액 — 비음수 정수. 8바이트 정수 범위를 상한으로 둔다. */
const MAX_MONEY = 9_223_372_036_854_775_807n;
export const moneySchema = z
  .union([z.string(), z.number(), z.bigint()])
  .transform((v, ctx) => {
    try {
      const value = typeof v === "bigint" ? v : BigInt(String(v).replace(/,/g, ""));
      if (value < 0n) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "금액은 0 이상이어야 합니다." });
        return z.NEVER;
      }
      if (value > MAX_MONEY) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: "금액이 허용 범위를 넘었습니다." });
        return z.NEVER;
      }
      return value;
    } catch {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "금액은 정수여야 합니다." });
      return z.NEVER;
    }
  });

const scoreSchema = z
  .number()
  .int("점수는 정수여야 합니다.")
  .min(1, "점수는 1 이상이어야 합니다.")
  .max(5, "점수는 5 이하여야 합니다.");

export const evaluationSchema = z.object({
  artistry: scoreSchema,
  commerciality: scoreSchema,
  buzz: scoreSchema,
  targetFit: scoreSchema,
  overallComment: optionalString(5000).optional(),
  screeningVenue: optionalString(200).optional(),
  screeningAttendees: optionalString(500).optional(),
  targetAudience: optionalString(500).optional(),
});

export const yearSchema = z
  .number()
  .int()
  .min(1888, "제작연도는 1888년 이후여야 합니다.")
  .max(CURRENT_YEAR + 10, `제작연도는 ${CURRENT_YEAR + 10}년 이전이어야 합니다.`);

export const titleCreateSchema = z.object({
  titleKo: requiredString(200, "제목"),
  titleOriginal: optionalString(200).optional(),
  director: optionalString(100).optional(),
  genres: z.array(z.string()).min(1, "장르를 하나 이상 선택해주세요."),
  productionYear: yearSchema,
  runtimeMinutes: z.number().int().min(1).max(600).nullable().optional(),
  synopsis: optionalString(5000).optional(),
});

/** 오퍼는 당일 제출·당일 만료가 실무상 가능하므로 같은 날을 허용한다 */
export const dealSchema = z
  .object({
    askingPrice: moneySchema.nullable().optional(),
    offerAmount: moneySchema.nullable().optional(),
    offerSubmittedAt: z.coerce.date().nullable().optional(),
    offerExpiryDate: z.coerce.date().nullable().optional(),
    minimumGuarantee: moneySchema.nullable().optional(),
    runningRoyaltyRate: z.number().min(0).max(100).nullable().optional(),
    contractTerms: optionalString(5000).optional(),
  })
  .refine(
    (d) =>
      !d.offerSubmittedAt ||
      !d.offerExpiryDate ||
      d.offerExpiryDate.getTime() >= d.offerSubmittedAt.getTime(),
    { message: "오퍼 유효기간은 제출일 이후여야 합니다.", path: ["offerExpiryDate"] },
  );

/** 계약 기간이 0일인 판권은 의미가 없으므로 같은 날을 거부한다 */
export const rightsGrantSchema = z
  .object({
    territories: z.array(z.string()).min(1, "영토를 하나 이상 선택해주세요."),
    contractStartDate: z.coerce.date(),
    contractEndDate: z.coerce.date(),
  })
  .refine((r) => r.contractEndDate.getTime() > r.contractStartDate.getTime(), {
    message: "계약 종료일은 시작일보다 이후여야 합니다.",
    path: ["contractEndDate"],
  });

export const financialInputSchema = z.object({
  paAndBudget: moneySchema,
  otherCosts: moneySchema,
  expectedRevenue: moneySchema,
});

/**
 * 딜과 재무를 한 번에 받는 스키마.
 *
 * 검증이 트랜잭션보다 먼저 일어나므로, 재무가 검증에 걸리면 **딜도 저장되지 않는다.**
 * 두 API로 나뉘어 있을 때는 딜이 이미 저장된 뒤 재무가 실패할 수 있었다.
 */
export const dealWithFinancialsSchema = z.object({
  deal: dealSchema,
  financials: financialInputSchema.optional(),
});

/**
 * 여러 필드가 동시에 실패하면 전부 수집해 한 번에 반환한다.
 * 첫 실패에서 중단하지 않는다 (BR-U1-016).
 */
export function validate<TOut, TIn>(
  // 입력·출력 타입을 분리해야 변환 스키마(문자열 → bigint)가 통과한다.
  // z.ZodType<T> 한 개만 쓰면 입력 타입까지 T로 고정돼 변환 스키마가 거부된다.
  schema: z.ZodType<TOut, z.ZodTypeDef, TIn>,
  input: unknown,
): TOut {
  const result = schema.safeParse(input);
  if (result.success) return result.data;

  const fields: FieldIssue[] = result.error.issues.map((issue) => ({
    path: issue.path.join(".") || "_",
    code: mapIssueCode(issue),
    message: issue.message,
  }));
  throw new ValidationError(fields);
}

function mapIssueCode(issue: z.ZodIssue): string {
  switch (issue.code) {
    case "too_small":
      return issue.minimum === 1 ? "REQUIRED" : "TOO_SMALL";
    case "too_big":
      return "TOO_BIG";
    case "invalid_type":
      return "INVALID_TYPE";
    case "invalid_enum_value":
      return "INVALID_ENUM";
    case "invalid_string":
      return issue.validation === "email" ? "INVALID_EMAIL" : "INVALID_STRING";
    default:
      return "INVALID";
  }
}
