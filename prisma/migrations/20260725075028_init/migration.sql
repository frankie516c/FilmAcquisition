-- CreateEnum
CREATE TYPE "Role" AS ENUM ('SCOUT', 'ANALYST', 'EXECUTIVE');

-- CreateEnum
CREATE TYPE "Stage" AS ENUM ('DISCOVERY', 'SCREENING', 'EVALUATION', 'OFFER', 'NEGOTIATION', 'CLOSED_WON', 'REJECTED');

-- CreateEnum
CREATE TYPE "Genre" AS ENUM ('DRAMA', 'THRILLER', 'COMEDY', 'ACTION', 'ROMANCE', 'HORROR', 'SF', 'FANTASY', 'ANIMATION', 'DOCUMENTARY', 'MYSTERY', 'WAR');

-- CreateEnum
CREATE TYPE "Rating" AS ENUM ('ALL', 'TWELVE', 'FIFTEEN', 'ADULT', 'RESTRICTED');

-- CreateEnum
CREATE TYPE "Territory" AS ENUM ('KR', 'US', 'JP', 'CN', 'FR', 'GB', 'DE', 'IN', 'BR', 'ASIA', 'EUROPE', 'NORTH_AMERICA', 'LATIN_AMERICA', 'WORLDWIDE');

-- CreateEnum
CREATE TYPE "ProductionCountry" AS ENUM ('KR', 'US', 'JP', 'CN', 'FR', 'GB', 'DE', 'IN', 'BR');

-- CreateEnum
CREATE TYPE "FestivalSection" AS ENUM ('COMPETITION', 'NON_COMPETITION');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('MENTION', 'OFFER_EXPIRY', 'RIGHTS_EXPIRY');

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "role" "Role" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Session" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Session_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Title" (
    "id" TEXT NOT NULL,
    "titleKo" TEXT NOT NULL,
    "titleOriginal" TEXT,
    "director" TEXT,
    "cast" TEXT[],
    "genres" "Genre"[],
    "runtimeMinutes" INTEGER,
    "productionCountry" "ProductionCountry",
    "productionLanguage" TEXT,
    "productionYear" INTEGER NOT NULL,
    "rating" "Rating",
    "synopsis" TEXT,
    "stage" "Stage" NOT NULL DEFAULT 'DISCOVERY',
    "assigneeId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Title_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "StageTransition" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "fromStage" "Stage",
    "toStage" "Stage" NOT NULL,
    "changedById" TEXT,
    "occurredAt" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StageTransition_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Deal" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "askingPrice" BIGINT,
    "offerAmount" BIGINT,
    "offerSubmittedAt" TIMESTAMP(3),
    "offerExpiryDate" TIMESTAMP(3),
    "minimumGuarantee" BIGINT,
    "runningRoyaltyRate" DOUBLE PRECISION,
    "contractTerms" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Deal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FinancialModel" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "paAndBudget" BIGINT NOT NULL,
    "otherCosts" BIGINT NOT NULL DEFAULT 0,
    "expectedRevenue" BIGINT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FinancialModel_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "RightsGrant" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "territories" "Territory"[],
    "contractStartDate" TIMESTAMP(3) NOT NULL,
    "contractEndDate" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "RightsGrant_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Evaluation" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "evaluatorId" TEXT,
    "artistry" INTEGER NOT NULL,
    "commerciality" INTEGER NOT NULL,
    "buzz" INTEGER NOT NULL,
    "targetFit" INTEGER NOT NULL,
    "overallComment" TEXT,
    "screeningDate" TIMESTAMP(3),
    "screeningVenue" TEXT,
    "screeningAttendees" TEXT,
    "targetAudience" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Evaluation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FestivalRecord" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "festivalName" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "section" "FestivalSection",
    "isAward" BOOLEAN NOT NULL DEFAULT false,
    "awardName" TEXT,
    "criticalResponse" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FestivalRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Comment" (
    "id" TEXT NOT NULL,
    "titleId" TEXT NOT NULL,
    "authorId" TEXT,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Comment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "titleId" TEXT,
    "commentId" TEXT,
    "marker" TEXT NOT NULL,
    "message" TEXT NOT NULL,
    "isRead" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_role_idx" ON "User"("role");

-- CreateIndex
CREATE INDEX "Session_userId_idx" ON "Session"("userId");

-- CreateIndex
CREATE INDEX "Session_expiresAt_idx" ON "Session"("expiresAt");

-- CreateIndex
CREATE INDEX "Title_stage_idx" ON "Title"("stage");

-- CreateIndex
CREATE INDEX "Title_titleOriginal_productionYear_idx" ON "Title"("titleOriginal", "productionYear");

-- CreateIndex
CREATE INDEX "Title_assigneeId_idx" ON "Title"("assigneeId");

-- CreateIndex
CREATE INDEX "Title_productionYear_idx" ON "Title"("productionYear");

-- CreateIndex
CREATE INDEX "Title_productionCountry_idx" ON "Title"("productionCountry");

-- CreateIndex
CREATE INDEX "StageTransition_titleId_occurredAt_idx" ON "StageTransition"("titleId", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "Deal_titleId_key" ON "Deal"("titleId");

-- CreateIndex
CREATE INDEX "Deal_offerExpiryDate_idx" ON "Deal"("offerExpiryDate");

-- CreateIndex
CREATE UNIQUE INDEX "FinancialModel_titleId_key" ON "FinancialModel"("titleId");

-- CreateIndex
CREATE INDEX "RightsGrant_contractEndDate_idx" ON "RightsGrant"("contractEndDate");

-- CreateIndex
CREATE INDEX "RightsGrant_titleId_idx" ON "RightsGrant"("titleId");

-- CreateIndex
CREATE INDEX "Evaluation_titleId_idx" ON "Evaluation"("titleId");

-- CreateIndex
CREATE INDEX "FestivalRecord_titleId_year_idx" ON "FestivalRecord"("titleId", "year");

-- CreateIndex
CREATE INDEX "Comment_titleId_createdAt_idx" ON "Comment"("titleId", "createdAt");

-- CreateIndex
CREATE INDEX "Notification_userId_isRead_idx" ON "Notification"("userId", "isRead");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_userId_type_titleId_marker_key" ON "Notification"("userId", "type", "titleId", "marker");

-- AddForeignKey
ALTER TABLE "Session" ADD CONSTRAINT "Session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Title" ADD CONSTRAINT "Title_assigneeId_fkey" FOREIGN KEY ("assigneeId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "StageTransition" ADD CONSTRAINT "StageTransition_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Deal" ADD CONSTRAINT "Deal_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FinancialModel" ADD CONSTRAINT "FinancialModel_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "RightsGrant" ADD CONSTRAINT "RightsGrant_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Evaluation" ADD CONSTRAINT "Evaluation_evaluatorId_fkey" FOREIGN KEY ("evaluatorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FestivalRecord" ADD CONSTRAINT "FestivalRecord_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Comment" ADD CONSTRAINT "Comment_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_titleId_fkey" FOREIGN KEY ("titleId") REFERENCES "Title"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_commentId_fkey" FOREIGN KEY ("commentId") REFERENCES "Comment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
