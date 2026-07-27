/**
 * C7 DataIOComponent — CSV 가져오기.
 *
 * 2단계로 나눈다: 미리보기(아무것도 저장하지 않음) → 반영.
 * 사용자가 오류 행을 확인하고 "정상 행만 반영"을 고를 수 있어야 하기 때문이다 (US-021).
 *
 * 트랜잭션 T5: 선택된 행 집합을 원자적으로 반영한다. 부분 반영 중간 상태를 만들지 않는다.
 */

import { parseCsv, serializeToCsv, type CsvColumn, type CsvRowError } from "@/domain/csv";
import { runInTransaction } from "@/platform/db";
import { requireRole, type Ctx } from "@/platform/context";
import { titleCreateSchema, validate } from "@/platform/validation/schemas";
import { ValidationError } from "@/platform/errors";

/** 가져오기 템플릿 컬럼 — 내보내기보다 좁다. 계산값·마스킹 대상은 입력받지 않는다. */
export const IMPORT_COLUMNS: CsvColumn[] = [
  { key: "titleKo", header: "제목" },
  { key: "titleOriginal", header: "원제" },
  { key: "director", header: "감독" },
  { key: "productionYear", header: "제작연도" },
  { key: "genres", header: "장르" },
  { key: "synopsis", header: "시놉시스" },
];

const GENRE_BY_LABEL: Record<string, string> = {
  드라마: "DRAMA", 스릴러: "THRILLER", 코미디: "COMEDY", 액션: "ACTION",
  로맨스: "ROMANCE", 공포: "HORROR", SF: "SF", 판타지: "FANTASY",
  애니메이션: "ANIMATION", 다큐멘터리: "DOCUMENTARY", 미스터리: "MYSTERY", 전쟁: "WAR",
};

export interface ImportRowIssue {
  rowNumber: number;
  column: string;
  message: string;
}

export interface ParsedRow {
  rowNumber: number;
  titleKo: string;
  titleOriginal: string | null;
  director: string | null;
  productionYear: number;
  genres: string[];
  synopsis: string | null;
}

export interface ImportPreview {
  validRows: ParsedRow[];
  issues: ImportRowIssue[];
  totalRows: number;
}

export function getTemplate(): { filename: string; content: string } {
  // 예시 행을 한 줄 넣어 형식을 보여준다
  const sample = [
    {
      titleKo: "예시 작품",
      titleOriginal: "Sample Title",
      director: "홍길동",
      productionYear: "2025",
      genres: "드라마;스릴러",
      synopsis: "쉼표, 따옴표\" 줄바꿈이 들어가도 됩니다",
    },
  ];
  return {
    filename: "title-import-template.csv",
    content: serializeToCsv(sample, IMPORT_COLUMNS),
  };
}

export function previewImport(ctx: Ctx, content: string): ImportPreview {
  requireRole(ctx, "SCOUT", "ANALYST");

  const parsed = parseCsv(content, IMPORT_COLUMNS);
  const issues: ImportRowIssue[] = parsed.errors.map(toIssue);
  const validRows: ParsedRow[] = [];

  parsed.rows.forEach((row, i) => {
    const rowNumber = i + 2; // 헤더가 1행
    const genres = (row.genres ?? "")
      .split(/[;,|]/)
      .map((g) => g.trim())
      .filter(Boolean)
      .map((g) => GENRE_BY_LABEL[g] ?? g.toUpperCase());

    try {
      const checked = validate(titleCreateSchema, {
        titleKo: row.titleKo ?? "",
        titleOriginal: row.titleOriginal ?? "",
        director: row.director ?? "",
        productionYear: Number(row.productionYear),
        genres,
        synopsis: row.synopsis ?? "",
      });

      const unknown = genres.filter((g) => !Object.values(GENRE_BY_LABEL).includes(g));
      if (unknown.length > 0) {
        issues.push({
          rowNumber,
          column: "장르",
          message: `알 수 없는 장르: ${unknown.join(", ")}`,
        });
        return;
      }

      validRows.push({
        rowNumber,
        titleKo: checked.titleKo,
        titleOriginal: checked.titleOriginal ?? null,
        director: checked.director ?? null,
        productionYear: checked.productionYear,
        genres,
        synopsis: checked.synopsis ?? null,
      });
    } catch (error) {
      if (error instanceof ValidationError) {
        for (const f of error.fields) {
          issues.push({ rowNumber, column: f.path, message: f.message });
        }
        return;
      }
      throw error;
    }
  });

  return { validRows, issues, totalRows: parsed.rows.length };
}

export interface ImportResult {
  imported: number;
  skipped: number;
}

/**
 * 미리보기에서 확인한 행을 반영한다.
 * 클라이언트가 되돌려 보낸 행을 다시 검증하지 않고 신뢰하면 검증 우회가 되므로,
 * 원본 파일을 다시 파싱해 서버가 스스로 판정한 결과만 반영한다.
 */
export async function commitImport(
  ctx: Ctx,
  content: string,
  mode: "ALL" | "VALID_ONLY",
): Promise<ImportResult> {
  requireRole(ctx, "SCOUT", "ANALYST");

  const preview = previewImport(ctx, content);

  if (mode === "ALL" && preview.issues.length > 0) {
    throw new ValidationError(
      preview.issues.map((i) => ({
        path: `행 ${i.rowNumber}`,
        code: "ROW_INVALID",
        message: `${i.column}: ${i.message}`,
      })),
      "오류 행이 있어 전체 반영할 수 없습니다. '정상 행만 반영'을 선택하세요.",
    );
  }

  await runInTransaction(async (tx) => {
    for (const row of preview.validRows) {
      const title = await tx.title.create({
        data: {
          titleKo: row.titleKo,
          titleOriginal: row.titleOriginal,
          director: row.director,
          genres: row.genres as never,
          productionYear: row.productionYear,
          synopsis: row.synopsis,
          assigneeId: ctx.userId,
          createdAt: ctx.now,
        },
      });
      // 최초 이력 — 개별 등록(T3)과 동일하게 남긴다
      await tx.stageTransition.create({
        data: {
          titleId: title.id,
          fromStage: null,
          toStage: "DISCOVERY",
          changedById: ctx.userId,
          occurredAt: ctx.now,
          note: "CSV 가져오기",
        },
      });
    }
  });

  return {
    imported: preview.validRows.length,
    skipped: preview.totalRows - preview.validRows.length,
  };
}

function toIssue(e: CsvRowError): ImportRowIssue {
  return { rowNumber: e.rowNumber, column: e.column, message: e.reason };
}
