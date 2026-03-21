-- CreateTable
CREATE TABLE "Conversation" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL DEFAULT 'New Conversation',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateTable
CREATE TABLE "Message" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "conversationId" TEXT NOT NULL,
    "role" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "hasImage" BOOLEAN NOT NULL DEFAULT false,
    "imageMime" TEXT,
    "imageFilename" TEXT,
    "imageSize" INTEGER,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Message_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "SolveResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "messageId" TEXT NOT NULL,
    "mode" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "adapter" TEXT NOT NULL,
    "chatReply" TEXT,
    "chatSteps" TEXT NOT NULL DEFAULT '[]',
    "symbolStatement" TEXT,
    "symbolExpression" TEXT,
    "symbolLatex" TEXT,
    "symbolGraphExpr" TEXT,
    "symbolSource" TEXT,
    "symbolNotes" TEXT NOT NULL DEFAULT '[]',
    "symbolRaw" TEXT NOT NULL DEFAULT '{}',
    "proofVerified" BOOLEAN NOT NULL DEFAULT false,
    "proofState" TEXT,
    "proofSummary" TEXT,
    "proofDurationMs" INTEGER,
    "graphDesmos" TEXT NOT NULL DEFAULT '{}',
    "graphGeogebra" TEXT NOT NULL DEFAULT '{}',
    "graphLatexBlock" TEXT,
    "timingNlpMs" INTEGER NOT NULL DEFAULT 0,
    "timingSympyMs" INTEGER NOT NULL DEFAULT 0,
    "timingVerifyMs" INTEGER NOT NULL DEFAULT 0,
    "timingGraphMs" INTEGER NOT NULL DEFAULT 0,
    "error" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "SolveResult_messageId_fkey" FOREIGN KEY ("messageId") REFERENCES "Message" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "EngineResult" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "solveResultId" TEXT NOT NULL,
    "engineName" TEXT NOT NULL,
    "toolUseId" TEXT,
    "status" TEXT NOT NULL,
    "result" TEXT NOT NULL DEFAULT '{}',
    "durationMs" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "EngineResult_solveResultId_fkey" FOREIGN KEY ("solveResultId") REFERENCES "SolveResult" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LibraryEntry" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "title" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'formula',
    "tags" TEXT NOT NULL DEFAULT '[]',
    "references" TEXT NOT NULL DEFAULT '[]',
    "source" TEXT NOT NULL DEFAULT 'manual',
    "query" TEXT,
    "body" TEXT NOT NULL DEFAULT '',
    "metadata" TEXT NOT NULL DEFAULT '{}',
    "solveResultId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    "deletedAt" DATETIME
);

-- CreateIndex
CREATE INDEX "Conversation_createdAt_idx" ON "Conversation"("createdAt");

-- CreateIndex
CREATE INDEX "Message_conversationId_createdAt_idx" ON "Message"("conversationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "SolveResult_messageId_key" ON "SolveResult"("messageId");

-- CreateIndex
CREATE INDEX "EngineResult_solveResultId_idx" ON "EngineResult"("solveResultId");

-- CreateIndex
CREATE INDEX "LibraryEntry_category_idx" ON "LibraryEntry"("category");

-- CreateIndex
CREATE INDEX "LibraryEntry_createdAt_idx" ON "LibraryEntry"("createdAt");
