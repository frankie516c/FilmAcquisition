/**
 * X2 — 단일 직렬화 게이트. 시스템 밖으로 나가는 모든 데이터가 반드시 통과한다.
 *
 * 이 게이트를 우회해 데이터를 외부로 내보내는 경로는 존재하지 않는다.
 * 직렬화되지 않은 도메인 객체를 API 경계 밖으로 내보내는 것은 설계 위반이다 (판정 기준 #3).
 *
 * 설계 근거: business-logic-model.md 6.3절
 */

import type { CsvColumn } from "@/domain/csv";
import { canReadEntity, canReadField, RELATION_MAP, type Role } from "./policy";

/**
 * 차단된 필드는 결과 객체에서 키 자체를 제거한다.
 * null이나 빈 문자열로 대체하지 않는다 — US-014의 수용 기준이
 * "값이 null인 것이 아니라 키 자체가 없다"고 명시한다.
 *
 * BigInt와 Date는 JSON으로 직접 직렬화되지 않으므로 여기서 변환한다.
 * 모든 응답이 이 게이트를 통과하므로 변환 지점이 한 곳뿐이다.
 */
export function serialize<T>(role: Role, entity: string, data: T): unknown {
  if (Array.isArray(data)) {
    return data.map((item) => serialize(role, entity, item));
  }
  if (data === null || data === undefined) return data;
  if (typeof data !== "object") return convertScalar(data);
  if (data instanceof Date) return data.toISOString();

  const relations = RELATION_MAP[entity] ?? {};
  const result: Record<string, unknown> = {};

  for (const [key, value] of Object.entries(data as Record<string, unknown>)) {
    const childEntity = relations[key];

    if (childEntity !== undefined) {
      // 중첩 엔티티 — 엔티티 단위로 차단되면 관계 필드째로 제거한다
      if (!canReadEntity(role, childEntity)) continue;
      result[key] = serialize(role, childEntity, value);
      continue;
    }

    // 관계처럼 보이지만 RELATION_MAP에 없는 "객체"는 차단한다.
    // 등록을 잊은 관계가 미검증 상태로 노출되는 것을 막는다.
    //
    // 다만 원시값 배열(genres, territories, cast 같은 enum·문자열 배열)은
    // 관계가 아니라 필드다. 이것까지 차단하면 정상 필드가 응답에서 조용히 사라진다.
    if (isRelationLike(value)) continue;

    if (!canReadField(role, entity, key)) continue;
    result[key] = Array.isArray(value) ? value.map(convertScalar) : convertScalar(value);
  }

  return result;
}

export function serializeMany<T>(role: Role, entity: string, data: readonly T[]): unknown[] {
  return data.map((item) => serialize(role, entity, item));
}

export interface ExportPayload {
  rows: Record<string, unknown>[];
  columns: CsvColumn[];
}

/**
 * 내보내기용 변형. 제거된 필드는 컬럼 목록에서도 빠지므로 CSV 헤더에 빈 열이 남지 않는다.
 *
 * ⚠️ 호출 순서: serializeForExport → serializeToCsv.
 * 역순이면 마스킹 대상 값이 이미 문자열에 포함된 뒤 제거를 시도하게 된다.
 */
export function serializeForExport(
  role: Role,
  entity: string,
  rows: readonly Record<string, unknown>[],
  columns: readonly CsvColumn[],
): ExportPayload {
  const allowedColumns = columns.filter((c) => canReadField(role, entity, c.key));
  const serialized = rows.map((row) => serialize(role, entity, row) as Record<string, unknown>);
  return { rows: serialized, columns: allowedColumns };
}

/** 내보내기 컬럼 — 어느 엔티티의 필드인지 함께 선언해야 정책을 적용할 수 있다 */
export interface ExportColumn extends CsvColumn {
  entity: string;
}

/**
 * 여러 엔티티의 필드를 한 행으로 합치는 내보내기(작품 + 딜 + 재무)용 게이트.
 *
 * 컬럼마다 소속 엔티티가 다르므로 컬럼 단위로 정책을 판정한다.
 * 차단된 컬럼은 헤더에서도 빠지므로 파일에 빈 열이 남지 않는다.
 */
export function gateExportRows(
  role: Role,
  columns: readonly ExportColumn[],
  rows: readonly Record<string, unknown>[],
): { columns: CsvColumn[]; rows: Record<string, string>[] } {
  const allowed = columns.filter((c) =>
    canReadEntity(role, c.entity) && canReadField(role, c.entity, c.key),
  );

  return {
    columns: allowed.map(({ key, header }) => ({ key, header })),
    rows: rows.map((row) => {
      const out: Record<string, string> = {};
      for (const c of allowed) {
        const v = row[c.key];
        out[c.key] = v === null || v === undefined ? "" : String(convertScalar(v));
      }
      return out;
    }),
  };
}

function convertScalar(value: unknown): unknown {
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  return value;
}

/**
 * 관계로 볼 수 있는 값인가 — 즉 RELATION_MAP 등록을 요구해야 하는 값인가.
 *
 * 객체는 관계다. 배열은 원소가 객체일 때만 관계로 본다.
 * 원시값 배열(`["DRAMA","THRILLER"]`)은 필드이지 관계가 아니다.
 * 빈 배열은 원소를 볼 수 없으므로 필드로 취급한다 — 관계였다면 RELATION_MAP에
 * 등록되어 이 함수에 도달하기 전에 처리된다.
 */
function isRelationLike(value: unknown): boolean {
  if (value === null || value === undefined) return false;
  if (value instanceof Date) return false;

  if (Array.isArray(value)) {
    const first = value[0];
    return (
      first !== null &&
      first !== undefined &&
      typeof first === "object" &&
      !(first instanceof Date)
    );
  }
  return typeof value === "object";
}
