-- CreateTable
CREATE TABLE "zcash_payment_invoices" (
    "id" TEXT NOT NULL,
    "invoice_reference" TEXT NOT NULL,
    "league_id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "member_id" TEXT,
    "transaction_id" TEXT,
    "expected_amount_zat" BIGINT NOT NULL,
    "receiving_address" TEXT NOT NULL,
    "payment_txid" TEXT,
    "output_index" INTEGER,
    "payment_status" "PaymentStatus" NOT NULL DEFAULT 'PENDING',
    "confirmations" INTEGER NOT NULL DEFAULT 0,
    "memo_received" TEXT,
    "expires_at" TIMESTAMP(3) NOT NULL,
    "verified_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "zcash_payment_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "zcash_payment_invoices_invoice_reference_key" ON "zcash_payment_invoices"("invoice_reference");

-- CreateIndex
CREATE UNIQUE INDEX "zcash_payment_invoices_payment_txid_output_index_key" ON "zcash_payment_invoices"("payment_txid", "output_index");

-- CreateIndex
CREATE INDEX "zcash_payment_invoices_league_id_payment_status_idx" ON "zcash_payment_invoices"("league_id", "payment_status");

-- CreateIndex
CREATE INDEX "zcash_payment_invoices_user_id_payment_status_idx" ON "zcash_payment_invoices"("user_id", "payment_status");

-- AddForeignKey
ALTER TABLE "zcash_payment_invoices" ADD CONSTRAINT "zcash_payment_invoices_league_id_fkey" FOREIGN KEY ("league_id") REFERENCES "leagues"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zcash_payment_invoices" ADD CONSTRAINT "zcash_payment_invoices_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zcash_payment_invoices" ADD CONSTRAINT "zcash_payment_invoices_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "league_members"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "zcash_payment_invoices" ADD CONSTRAINT "zcash_payment_invoices_transaction_id_fkey" FOREIGN KEY ("transaction_id") REFERENCES "transactions"("id") ON DELETE SET NULL ON UPDATE CASCADE;
