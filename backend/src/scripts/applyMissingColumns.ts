import "dotenv/config";
import pg from "pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("No DATABASE_URL found");
  process.exit(1);
}

const pool = new pg.Pool({ connectionString, ssl: { rejectUnauthorized: false } });

async function run() {
  const client = await pool.connect();
  try {
    console.log("Applying missing migration columns & tables...");

    // 1. TeamVisibility Enum & team_visibility column
    await client.query(`
      DO $$ BEGIN
        CREATE TYPE "TeamVisibility" AS ENUM ('PUBLIC', 'PRIVATE');
      EXCEPTION
        WHEN duplicate_object THEN null;
      END $$;
    `);

    await client.query(`
      ALTER TABLE "leagues" 
      ADD COLUMN IF NOT EXISTS "team_visibility" "TeamVisibility" NOT NULL DEFAULT 'PUBLIC';
    `);
    console.log("✅ Applied team_visibility column to leagues.");

    // 2. zcash_payment_invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS "zcash_payment_invoices" (
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
    `);

    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS "zcash_payment_invoices_invoice_reference_key" ON "zcash_payment_invoices"("invoice_reference");
    `);

    console.log("✅ Applied zcash_payment_invoices table.");
  } finally {
    client.release();
    await pool.end();
  }
}

run().then(() => process.exit(0)).catch((err) => {
  console.error(err);
  process.exit(1);
});
