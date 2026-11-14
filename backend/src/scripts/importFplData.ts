import { prisma } from "../config/db.js";
import { fplSyncService } from "../services/fpl/fplSyncService.js";

async function main() {
  console.log("==================================================");
  console.log("⚽ Starting Real Premier League Data Import (FPL)");
  console.log("==================================================");

  try {
    const countsBefore = {
      teams: await prisma.team.count(),
      players: await prisma.player.count(),
      gameweeks: await prisma.gameweek.count(),
      fixtures: await prisma.fixture.count(),
    };
    console.log("📊 Database counts before sync:", countsBefore);

    // 1. Sync Bootstrap (Teams, Gameweeks, Players)
    console.log("\n📦 Step 1: Syncing Teams, Gameweeks, and Players from FPL bootstrap-static...");
    const bootstrapResult = await fplSyncService.syncBootstrap();
    console.log("✅ Bootstrap Sync Complete:", bootstrapResult);

    // 2. Sync Fixtures
    console.log("\n📅 Step 2: Syncing Fixtures from FPL /fixtures...");
    const fixturesResult = await fplSyncService.syncFixtures();
    console.log("✅ Fixtures Sync Complete:", fixturesResult);

    const countsAfter = {
      teams: await prisma.team.count(),
      players: await prisma.player.count(),
      gameweeks: await prisma.gameweek.count(),
      fixtures: await prisma.fixture.count(),
    };
    console.log("\n🎉 Final Database counts:", countsAfter);
    console.log("==================================================");
    console.log("🏆 Premier League data import finished successfully!");
    console.log("==================================================");
  } catch (err: unknown) {
    console.error("❌ FPL Sync failed:", err);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
