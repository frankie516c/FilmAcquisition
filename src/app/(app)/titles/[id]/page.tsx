import Link from "next/link";
import { notFound } from "next/navigation";
import { requireContext } from "@/platform/context";
import { findTitleDetail } from "@/modules/titles/repository";
import { serialize } from "@/platform/authz/serialize";
import { canPerform, canReadEntity, canReadField, ROLE_LABELS } from "@/platform/authz/policy";
import DealForm from "./deal-form";
import CommentForm from "./comment-form";
import EvaluationForm from "./evaluation-form";
import RightsSection from "./rights-section";
import TitleEdit from "./title-edit";
import { prisma } from "@/platform/db";
import { calculateEvaluationScore, calculateOverallScore } from "@/domain/score";
import { calculateFinancials, selectAcquisitionBase } from "@/domain/financials";
import { calculateDwellSegments } from "@/domain/dwell-time";
import { calculateDDay } from "@/domain/deadline";
import { dayIndex, formatDate, formatKrw } from "@/domain/calendar";
import { getStageLabel, type Stage } from "@/domain/pipeline-rules";

type Params = Promise<{ id: string }>;

function Masked({ label }: { label: string }) {
  return (
    <div className="field">
      <span className="fk">{label}</span>
      <span className="masked">
        <em>•••</em> 권한 없음
      </span>
    </div>
  );
}

export default async function TitleDetailPage({ params }: { params: Params }) {
  const { id } = await params;
  const ctx = await requireContext();
  const title = await findTitleDetail(id);
  if (!title) notFound();

  const role = ctx.role;
  const deal = title.deal
    ? (serialize(role, "Deal", title.deal) as Record<string, unknown>)
    : null;

  // 재무는 엔티티 단위로 차단된다 — 관계 필드째로 제거되므로 빈 객체조차 남지 않는다
  const financeVisible = canReadEntity(role, "FinancialModel") && title.financialModel;
  const finance = financeVisible
    ? calculateFinancials({
        offerAmount: selectAcquisitionBase(
          title.deal?.minimumGuarantee,
          title.deal?.offerAmount,
        ),
        paAndBudget: title.financialModel!.paAndBudget,
        otherCosts: title.financialModel!.otherCosts,
        expectedRevenue: title.financialModel!.expectedRevenue,
      })
    : null;

  const segments = calculateDwellSegments(
    title.createdAt,
    title.stageTransitions.map((s) => ({
      fromStage: s.fromStage as Stage | null,
      toStage: s.toStage as Stage,
      occurredAt: s.occurredAt,
    })),
    ctx.now,
  );
  // 불변식 검증에는 전 구간을 쓴다. 표시에서만 걸러낸다.
  const dwellTotal = segments.reduce((sum, s) => sum + s.days, 0);
  const elapsed = dayIndex(ctx.now) - dayIndex(title.createdAt);

  /**
   * 표시용 이력 행.
   *
   * 구간 i(i≥1)의 진입 사건은 transitions[i-1]이다. 구간 0은 작품 생성 시점인데,
   * 최초 이력의 occurredAt이 createdAt과 같으므로 **길이 0의 중복 구간**이 된다.
   * 계산에는 필요하지만 화면에 찍으면 같은 단계가 두 번 나와 혼란스럽다.
   * 진입과 이탈이 정확히 같은 순간인 구간만 걸러낸다.
   */
  const historyRows = segments
    .map((s, i) => {
      const event = i === 0 ? null : title.stageTransitions[i - 1];
      return {
        key: i,
        stage: s.stage,
        enteredAt: s.enteredAt,
        exitedAt: s.exitedAt,
        days: s.days,
        changedBy: event?.changedBy?.name ?? (i === 0 ? "작품 생성" : "(삭제된 사용자)"),
        note: event?.note ?? null,
      };
    })
    .filter((row) => row.exitedAt === null || row.exitedAt.getTime() !== row.enteredAt.getTime());
  const score = calculateOverallScore(title.evaluations);

  const expiry = title.deal?.offerExpiryDate;
  const expiryDDay = expiry ? calculateDDay(ctx.now, expiry) : null;

  // 멘션 대상 후보 — 본인은 제외한다 (알림이 생기지 않으므로 버튼도 두지 않는다)
  const memberNames = (
    await prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } })
  )
    .filter((u) => u.id !== ctx.userId)
    .map((u) => u.name);

  return (
    <>
      <div className="phead">
        <Link href="/titles" className="act">
          ← 목록
        </Link>
        <h1>{title.titleKo}</h1>
        <p>
          {[title.titleOriginal, title.director, title.productionYear]
            .filter(Boolean)
            .join(" · ")}
        </p>
        <span className="pill p-acc" style={{ marginLeft: "auto" }}>
          {getStageLabel(title.stage as Stage)}
        </span>
      </div>

      {/* 수정·삭제는 Scout만. 실제 차단은 서비스 진입에서 일어난다. */}
      {canPerform(role, "title:write") && (
        <section className="card">
          <div className="cbody">
            <TitleEdit
              titleId={title.id}
              initial={{
                titleKo: title.titleKo,
                titleOriginal: title.titleOriginal ?? "",
                director: title.director ?? "",
                productionYear: String(title.productionYear),
                genres: title.genres as string[],
                synopsis: title.synopsis ?? "",
              }}
              hasChildren={
                title.evaluations.length > 0 ||
                title.comments.length > 0 ||
                title.rightsGrants.length > 0 ||
                title.deal !== null
              }
            />
          </div>
        </section>
      )}

      <div className="det">
        <div className="grid" style={{ gap: 14 }}>
          {/* 딜 */}
          <section className="card">
            <header>
              <h3>딜 정보</h3>
              <span className="lbl">
                {canReadField(role, "Deal", "minimumGuarantee") ? "전체 공개" : "부분 마스킹"}
              </span>
            </header>
            <div className="cbody">
              {!title.deal && <p className="note">등록된 딜 정보가 없습니다.</p>}
              {title.deal && (
                <>
                  <div className="field">
                    <span className="fk">오퍼 금액</span>
                    <span className="fv">{formatKrw(deal?.offerAmount as string)}</span>
                  </div>
                  <div className="field">
                    <span className="fk">오퍼 유효기간</span>
                    <span className="fv">
                      {expiry ? formatDate(expiry) : "—"}
                      {expiryDDay !== null && (
                        <span
                          className={`pill ${
                            expiryDDay < 0 ? "p-crit" : expiryDDay <= 7 ? "p-warn" : "p-neut"
                          }`}
                          style={{ marginLeft: 6 }}
                        >
                          {expiryDDay < 0 ? `${-expiryDDay}일 경과` : `D-${expiryDDay}`}
                        </span>
                      )}
                    </span>
                  </div>

                  {canReadField(role, "Deal", "askingPrice") ? (
                    <div className="field">
                      <span className="fk">요청가</span>
                      <span className="fv">{formatKrw(title.deal.askingPrice)}</span>
                    </div>
                  ) : (
                    <Masked label="요청가" />
                  )}

                  {canReadField(role, "Deal", "minimumGuarantee") ? (
                    <div className="field">
                      <span className="fk">MG (최소보증금)</span>
                      <span className="fv">{formatKrw(title.deal.minimumGuarantee)}</span>
                    </div>
                  ) : (
                    <Masked label="MG (최소보증금)" />
                  )}

                  {canReadField(role, "Deal", "runningRoyaltyRate") ? (
                    <div className="field">
                      <span className="fk">러닝 로열티율</span>
                      <span className="fv">{title.deal.runningRoyaltyRate ?? "—"}%</span>
                    </div>
                  ) : (
                    <Masked label="러닝 로열티율" />
                  )}

                  {canReadField(role, "Deal", "contractTerms") ? (
                    <div className="field">
                      <span className="fk">계약 조건</span>
                      <span className="fv" style={{ maxWidth: "52%", fontWeight: 500 }}>
                        {title.deal.contractTerms ?? "—"}
                      </span>
                    </div>
                  ) : (
                    <Masked label="계약 조건" />
                  )}
                </>
              )}
            </div>

            {/* 편집은 Analyst만. 버튼 노출은 편의일 뿐 실제 차단은 서비스 진입에서 일어난다. */}
            {canPerform(role, "deal:update") && (
              <DealForm
                titleId={title.id}
                deal={{
                  askingPrice: title.deal?.askingPrice?.toString() ?? "",
                  offerAmount: title.deal?.offerAmount?.toString() ?? "",
                  offerSubmittedAt: title.deal?.offerSubmittedAt
                    ? formatDate(title.deal.offerSubmittedAt)
                    : "",
                  offerExpiryDate: title.deal?.offerExpiryDate
                    ? formatDate(title.deal.offerExpiryDate)
                    : "",
                  minimumGuarantee: title.deal?.minimumGuarantee?.toString() ?? "",
                  runningRoyaltyRate: title.deal?.runningRoyaltyRate?.toString() ?? "",
                  contractTerms: title.deal?.contractTerms ?? "",
                }}
                financials={{
                  paAndBudget: title.financialModel?.paAndBudget?.toString() ?? "",
                  otherCosts: title.financialModel?.otherCosts?.toString() ?? "",
                  expectedRevenue: title.financialModel?.expectedRevenue?.toString() ?? "",
                }}
              />
            )}
          </section>

          {/* 재무 */}
          <section className="card">
            <header>
              <h3>재무 분석</h3>
              <span className="lbl">단일 산식</span>
            </header>
            <div className="cbody">
              {finance ? (
                <>
                  <div className="field">
                    <span className="fk">총 인수비용</span>
                    <span className="fv">{formatKrw(finance.totalAcquisitionCost)}</span>
                  </div>
                  <div className="field">
                    <span className="fk">예상 매출</span>
                    <span className="fv">
                      {formatKrw(title.financialModel!.expectedRevenue)}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fk">예상 손익</span>
                    <span
                      className="fv"
                      style={{
                        color: finance.expectedProfit < 0n ? "var(--crit)" : "var(--good)",
                      }}
                    >
                      {formatKrw(finance.expectedProfit)}
                    </span>
                  </div>
                  <div className="field">
                    <span className="fk">손익분기 매출</span>
                    <span className="fv">{formatKrw(finance.breakEvenRevenue)}</span>
                  </div>
                  <div className="field">
                    <span className="fk">ROI</span>
                    <span
                      className="fv"
                      style={{
                        color:
                          finance.roiPercent === null
                            ? undefined
                            : finance.roiPercent < 0
                              ? "var(--crit)"
                              : "var(--good)",
                      }}
                    >
                      {finance.roiPercent === null
                        ? "N/A"
                        : `${finance.roiPercent.toFixed(2)}%`}
                    </span>
                  </div>
                </>
              ) : title.financialModel ? (
                <div className="locked">
                  현재 역할({ROLE_LABELS[role]})에게는 <b>FinancialModel</b> 엔티티 전체가
                  차단되어 있습니다. 필드를 하나씩 지우지 않고 관계째로 제거하므로, 빈 객체가
                  남아 &ldquo;재무 데이터가 존재한다&rdquo;는 사실조차 새어 나가지 않습니다.
                </div>
              ) : (
                <p className="note">등록된 재무 정보가 없습니다.</p>
              )}
            </div>
          </section>

          {/* 판권 — 등록은 Analyst만 */}
          <RightsSection
            titleId={title.id}
            canEdit={canPerform(role, "rights:write")}
            rights={title.rightsGrants.map((r) => ({
              id: r.id,
              territories: r.territories as string[],
              contractStartDate: formatDate(r.contractStartDate),
              contractEndDate: formatDate(r.contractEndDate),
              dDay: calculateDDay(ctx.now, r.contractEndDate),
            }))}
          />

          {/* 단계 이력 */}
          <section className="card">
            <header>
              <h3>단계 이력</h3>
              <span className="lbl">append-only</span>
            </header>
            <div className="cbody">
              {historyRows.map((row) => (
                <div className="hrow" key={row.key}>
                  <span className="hs">
                    <b>{getStageLabel(row.stage)}</b>
                    {/* US-008 — 변경자와 사유 메모.
                        사유를 변경자 뒤에 이어 붙이면 11px 회색 한 줄에 묻혀 찾을 수 없다.
                        별도 줄에 따옴표와 좌측 강조선을 주어 눈에 걸리게 한다. */}
                    <span className="hmeta">{row.changedBy}</span>
                    {row.note && <span className="hnote">{row.note}</span>}
                  </span>
                  <span className="hd">
                    {formatDate(row.enteredAt)} →{" "}
                    {row.exitedAt ? formatDate(row.exitedAt) : "진행 중"}
                  </span>
                  <span className="hdays">{row.days}일</span>
                </div>
              ))}
              <div
                className="kv"
                style={{ marginTop: 10, borderTop: "1px solid var(--line)", paddingTop: 10 }}
              >
                <span className="k">체류 일수 총합 / 등록 후 경과</span>
                <b>
                  {dwellTotal}일 / {elapsed}일{" "}
                  <span className={`pill ${dwellTotal === elapsed ? "p-good" : "p-crit"}`}>
                    {dwellTotal === elapsed ? "일치" : "불일치"}
                  </span>
                </b>
              </div>
              <p className="note" style={{ margin: "8px 0 0" }}>
                두 값이 항상 일치하는 것이 속성 기반 테스트로 검증되는 성질입니다.
              </p>
            </div>
          </section>
        </div>

        <div className="grid" style={{ gap: 14 }}>
          {/* 평가 */}
          <section className="card">
            <header>
              <h3>평가</h3>
              <span className="lbl">
                {score ? `${score.count}건 · 평균 ${score.score.toFixed(1)}` : "미평가"}
              </span>
            </header>
            <div className="cbody">
              {title.evaluations.length === 0 && <p className="note">등록된 평가가 없습니다.</p>}
              {title.evaluations.map((e) => (
                <div
                  key={e.id}
                  style={{ padding: "8px 0", borderBottom: "1px solid var(--line-2)" }}
                >
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <b style={{ fontSize: 12.5 }}>{e.evaluator?.name ?? "(삭제된 사용자)"}</b>
                    <span className="pill p-acc">{calculateEvaluationScore(e).toFixed(1)}</span>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      gap: 12,
                      margin: "5px 0",
                      fontSize: 11.5,
                      color: "var(--muted)",
                    }}
                  >
                    <span>작품성 {e.artistry}</span>
                    <span>상업성 {e.commerciality}</span>
                    <span>화제성 {e.buzz}</span>
                    <span>타깃 {e.targetFit}</span>
                  </div>
                  {e.overallComment && (
                    <p className="note" style={{ margin: 0 }}>
                      {e.overallComment}
                    </p>
                  )}
                </div>
              ))}
              {/* 평가 작성은 Scout만. 기존 평가를 덮어쓰지 않고 추가된다. */}
              {canPerform(role, "evaluation:write") && <EvaluationForm titleId={title.id} />}
            </div>
          </section>

          {/* 영화제 */}
          {title.festivalRecords.length > 0 && (
            <section className="card">
              <header>
                <h3>영화제 · 수상</h3>
              </header>
              <div className="cbody">
                {title.festivalRecords.map((f) => (
                  <div className="kv" key={f.id}>
                    <span className="k">
                      {f.festivalName} {f.year}
                    </span>
                    <b>
                      {f.isAward
                        ? (f.awardName ?? "수상")
                        : f.section === "COMPETITION"
                          ? "경쟁 부문 초청"
                          : "초청"}
                    </b>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* 코멘트 — 작성은 전 역할 가능 */}
          <section className="card">
            <header>
              <h3>코멘트</h3>
              <span className="lbl">{title.comments.length}건</span>
            </header>
            <div className="cbody">
              {title.comments.map((c) => (
                <div
                  key={c.id}
                  style={{ padding: "7px 0", borderBottom: "1px solid var(--line-2)" }}
                >
                  <b style={{ fontSize: 12.5 }}>{c.author?.name ?? "(삭제된 사용자)"}</b>
                  <p className="note" style={{ margin: "2px 0 0" }}>
                    {c.body}
                  </p>
                </div>
              ))}
              <CommentForm titleId={title.id} memberNames={memberNames} />
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
