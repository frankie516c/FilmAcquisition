/**
 * X3 — 도메인 오류 타입과 HTTP 매핑의 단일 지점.
 *
 * "계정 존재 여부를 노출하지 않는 동일 메시지" 같은 규칙을 한 곳에서 통제한다.
 * 설계 근거: business-rules.md 5절
 */

export interface FieldIssue {
  path: string;
  code: string;
  message: string;
}

export class ValidationError extends Error {
  readonly fields: FieldIssue[];
  constructor(fields: FieldIssue[], message = "입력값을 확인해주세요.") {
    super(message);
    this.name = "ValidationError";
    this.fields = fields;
  }
}

/**
 * 로그인 실패 시에는 원인(계정 없음 / 비밀번호 불일치)을 절대 구분하지 않는다 (BR-U1-002).
 * 기본 메시지가 그 용도이며, 로그인 경로는 인자를 넘기지 않는다.
 *
 * 세션이 없거나 만료된 경우는 원인 노출 문제가 아니라 단순 안내이므로
 * requireContext가 별도 메시지를 넘긴다.
 */
export class AuthenticationError extends Error {
  constructor(message = "이메일 또는 비밀번호가 올바르지 않습니다.") {
    super(message);
    this.name = "AuthenticationError";
  }
}

/** 세션 없음·만료. 로그인 실패와 구분되는 안내 문구를 쓴다. */
export const SESSION_REQUIRED = "로그인이 필요합니다.";

export class ForbiddenError extends Error {
  constructor(message = "이 작업을 수행할 권한이 없습니다.") {
    super(message);
    this.name = "ForbiddenError";
  }
}

export class NotFoundError extends Error {
  constructor(message = "요청한 리소스를 찾을 수 없습니다.") {
    super(message);
    this.name = "NotFoundError";
  }
}

export class ConflictError extends Error {
  readonly code: string;
  constructor(message: string, code = "CONFLICT") {
    super(message);
    this.name = "ConflictError";
    this.code = code;
  }
}

export interface ErrorBody {
  error: {
    code: string;
    message: string;
    fields?: FieldIssue[];
  };
}

export interface HttpErrorResponse {
  status: number;
  body: ErrorBody;
}

export function toHttpResponse(error: unknown): HttpErrorResponse {
  if (error instanceof ValidationError) {
    return {
      status: 400,
      body: {
        error: { code: "VALIDATION_FAILED", message: error.message, fields: error.fields },
      },
    };
  }
  if (error instanceof AuthenticationError) {
    return {
      status: 401,
      body: { error: { code: "AUTHENTICATION_FAILED", message: error.message } },
    };
  }
  if (error instanceof ForbiddenError) {
    return { status: 403, body: { error: { code: "FORBIDDEN", message: error.message } } };
  }
  if (error instanceof NotFoundError) {
    return { status: 404, body: { error: { code: "NOT_FOUND", message: error.message } } };
  }
  if (error instanceof ConflictError) {
    return { status: 409, body: { error: { code: error.code, message: error.message } } };
  }

  // 예상하지 못한 예외는 스택·내부 메시지·SQL을 응답에 담지 않는다 (BR-U1-017).
  // 서버 로그에만 기록한다.
  console.error("[unhandled]", error);
  return {
    status: 500,
    body: { error: { code: "INTERNAL_ERROR", message: "요청을 처리하지 못했습니다." } },
  };
}
