-- CreateTable
CREATE TABLE "PanelSession" (
    "sid" TEXT NOT NULL PRIMARY KEY,
    "data" JSONB NOT NULL,
    "expiresAt" DATETIME NOT NULL,
    "updatedAt" DATETIME NOT NULL
);

-- CreateIndex
CREATE INDEX "PanelSession_expiresAt_idx" ON "PanelSession"("expiresAt");
