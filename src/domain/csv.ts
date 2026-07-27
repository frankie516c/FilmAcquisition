/**
 * D4 — CSV 직렬화·역직렬화. RFC 4180 준수.
 *
 * ⚠️ import 금지 구역.
 * 설계 근거: business-logic-model.md 5절
 *
 * 왕복 무손실이 속성 기반 테스트로 검증되는 성질이다:
 *   parseCsv(serializeToCsv(rows, cols), cols).rows === rows
 * 한글·쉼표·큰따옴표·줄바꿈이 포함된 값에서도 성립해야 한다.
 */

export interface CsvColumn {
  key: string;
  header: string;
}

export interface CsvRowError {
  /** 1-based. 헤더가 1행이므로 데이터 첫 행은 2다. */
  rowNumber: number;
  column: string;
  reason: string;
  code: "MISSING_COLUMN" | "COLUMN_COUNT_MISMATCH" | "UNTERMINATED_QUOTE";
}

export interface CsvParseResult {
  rows: Record<string, string>[];
  errors: CsvRowError[];
}

const CRLF = "\r\n";
/**
 * Excel이 UTF-8 CSV를 시스템 인코딩으로 해석해 한글을 깨뜨리는 것을 막는다.
 * 파서는 반드시 이 BOM을 먼저 제거해야 한다 — 그러지 않으면 첫 컬럼 헤더가
 * BOM 문자를 포함해 매칭에 실패하고 왕복 속성이 깨진다.
 */
const BOM = "﻿";

function needsQuoting(value: string): boolean {
  return (
    value.includes(",") ||
    value.includes('"') ||
    value.includes("\r") ||
    value.includes("\n")
  );
}

function escapeField(value: unknown): string {
  if (value === null || value === undefined) return "";
  const s = typeof value === "bigint" ? value.toString() : String(value);
  return needsQuoting(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function serializeToCsv(
  rows: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
): string {
  const header = columns.map((c) => escapeField(c.header)).join(",");
  const body = rows.map((row) =>
    columns.map((c) => escapeField(row[c.key])).join(","),
  );
  return BOM + [header, ...body].join(CRLF);
}

/**
 * 상태 기계 파서.
 * 어떤 경우에도 예외를 던지지 않는다 — 사용자 업로드 파일은 손상되어 있을 수 있고,
 * 가져오기 미리보기가 오류 목록을 보여줘야 하기 때문이다 (US-021).
 */
export function parseCsv(
  content: string,
  columns: readonly CsvColumn[],
): CsvParseResult {
  const errors: CsvRowError[] = [];
  const text = content.startsWith(BOM) ? content.slice(1) : content;

  const { records, unterminated } = tokenize(text);
  if (records.length === 0) {
    return { rows: [], errors };
  }

  const headerRow = records[0]!;
  const indexByKey = new Map<string, number>();
  for (const column of columns) {
    const idx = headerRow.indexOf(column.header);
    if (idx === -1) {
      errors.push({
        rowNumber: 1,
        column: column.header,
        reason: `필수 컬럼 "${column.header}" 이(가) 없습니다.`,
        code: "MISSING_COLUMN",
      });
      continue;
    }
    indexByKey.set(column.key, idx);
  }
  // 헤더가 맞지 않으면 행 단위 처리가 불가능하므로 전체 실패다.
  if (errors.length > 0) return { rows: [], errors };

  if (unterminated) {
    errors.push({
      rowNumber: records.length,
      column: "-",
      reason: "인용부호가 닫히지 않은 채 파일이 끝났습니다.",
      code: "UNTERMINATED_QUOTE",
    });
  }

  const rows: Record<string, string>[] = [];
  for (let i = 1; i < records.length; i++) {
    const record = records[i]!;
    // 마지막 개행으로 생긴 빈 행은 건너뛴다
    if (record.length === 1 && record[0] === "") continue;

    if (record.length !== headerRow.length) {
      errors.push({
        rowNumber: i + 1,
        column: "-",
        reason: `필드 수가 헤더(${headerRow.length}개)와 다릅니다. (${record.length}개)`,
        code: "COLUMN_COUNT_MISMATCH",
      });
      continue;
    }

    const row: Record<string, string> = {};
    for (const column of columns) {
      row[column.key] = record[indexByKey.get(column.key)!] ?? "";
    }
    rows.push(row);
  }

  return { rows, errors };
}

function tokenize(text: string): { records: string[][]; unterminated: boolean } {
  const records: string[][] = [];
  let record: string[] = [];
  let field = "";
  let inQuotes = false;

  for (let i = 0; i < text.length; i++) {
    const ch = text[i]!;

    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += ch; // 인용 안에서는 개행도 값의 일부다
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      record.push(field);
      field = "";
    } else if (ch === "\r" || ch === "\n") {
      // CRLF와 LF를 모두 허용한다 (사용자가 편집한 파일 대응)
      if (ch === "\r" && text[i + 1] === "\n") i++;
      record.push(field);
      records.push(record);
      record = [];
      field = "";
    } else {
      field += ch;
    }
  }

  record.push(field);
  records.push(record);

  return { records, unterminated: inQuotes };
}
