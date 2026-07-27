-- 알림 중복 판정 키를 NOT NULL 단일 컬럼으로 명시화한다.
--
-- 이전 제약: @@unique([userId, type, titleId, marker])
--   PostgreSQL에서 NULL은 서로 같지 않으므로, titleId가 NULL인 행은 이 제약이
--   걸리지 않는다. 작품과 무관한 알림(시스템 공지 등)이 추가되면 중복 방지가
--   조용히 무력화되는 구조였다. 현재는 모든 알림에 titleId가 있어 잠복 상태.
--
-- 새 제약: @@unique([userId, dedupeKey]) — 두 컬럼 모두 NOT NULL

-- 1) nullable로 추가 (기존 행이 있으므로 바로 NOT NULL을 걸 수 없다)
ALTER TABLE "Notification" ADD COLUMN "dedupeKey" TEXT;

-- 2) 기존 행 백필 — src/domain/notification-key.ts 의 생성 규칙과 동일해야 한다
--    mentionKey(commentId)                    → 'mention:{commentId}'
--    deadlineKey(kind, subjectId, threshold)  → '{kind소문자}:{subjectId ?? "-"}:D-{n}'
UPDATE "Notification"
SET "dedupeKey" = CASE
    WHEN "type" = 'MENTION'
        THEN 'mention:' || COALESCE("commentId", "marker")
    ELSE lower("type"::text) || ':' || COALESCE("titleId", '-') || ':' || "marker"
END;

-- 3) 이제 NOT NULL을 걸 수 있다
ALTER TABLE "Notification" ALTER COLUMN "dedupeKey" SET NOT NULL;

-- 4) NULL 때문에 무력화되던 기존 제약 제거
DROP INDEX "Notification_userId_type_titleId_marker_key";

-- 5) 새 제약 — NULL이 개입할 여지가 없다
CREATE UNIQUE INDEX "Notification_userId_dedupeKey_key" ON "Notification"("userId", "dedupeKey");
