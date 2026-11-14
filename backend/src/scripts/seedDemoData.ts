import "dotenv/config";
import { prisma } from "../config/db.js";
import bcrypt from "bcryptjs";
import { Position } from "../types/index.js";

// Safety check: Explicitly reject production database URLs if pointed to production without DEMO_SEED flag
const isProdDb = process.env.DATABASE_URL?.includes("supabase.co") && process.env.ALLOW_PROD_DEMO_SEED !== "true";
if (isProdDb) {
  console.error("❌ Refusing to run seed script against production database without ALLOW_PROD_DEMO_SEED=true");
  process.exit(1);
}

// 20 Fictional demo managers
export const DEMO_MANAGERS = [
  { username: "stanbiz_united", name: "Stanley Obimma", email: "demo_stanbiz@fantasyxi.test", teamName: "Stanbiz United", isFeatured: true },
  { username: "weekend_warriors", name: "Chinedu Eze", email: "demo_warriors@fantasyxi.test", teamName: "Weekend Warriors FC" },
  { username: "nsukka_strikers", name: "Emeka Okonkwo", email: "demo_nsukka@fantasyxi.test", teamName: "Nsukka Strikers" },
  { username: "campus_galacticos", name: "Ibrahim Musa", email: "demo_galacticos@fantasyxi.test", teamName: "Campus Galacticos" },
  { username: "enugu_legends", name: "Adaeze Nwosu", email: "demo_legends@fantasyxi.test", teamName: "Enugu Legends" },
  { username: "pressing_machines", name: "Oluwaseun Adeyemi", email: "demo_machines@fantasyxi.test", teamName: "The Pressing Machines" },
  { username: "lion_den_fc", name: "Kelechi Nnamani", email: "demo_lionden@fantasyxi.test", teamName: "Lion Den FC" },
  { username: "unn_all_stars", name: "Somtochukwu Obi", email: "demo_unnstars@fantasyxi.test", teamName: "UNN All Stars" },
  { username: "blockchain_xi", name: "Tariq Bello", email: "demo_blockchainxi@fantasyxi.test", teamName: "Blockchain XI" },
  { username: "crypto_strikers", name: "Zainab Abubakar", email: "demo_cryptostrikers@fantasyxi.test", teamName: "Crypto Strikers" },
  { username: "super_eagles_unn", name: "Victor Umeh", email: "demo_supereagles@fantasyxi.test", teamName: "Super Eagles UNN" },
  { username: "golden_boot_fc", name: "Ngozi Adeleke", email: "demo_goldenboot@fantasyxi.test", teamName: "Golden Boot FC" },
  { username: "tiki_taka_unn", name: "Femi Balogun", email: "demo_tikitaka@fantasyxi.test", teamName: "Tiki Taka UNN" },
  { username: "apex_predators", name: "Damilola Alabi", email: "demo_apex@fantasyxi.test", teamName: "Apex Predators" },
  { username: "coastal_flyers", name: "Efe Edosomwan", email: "demo_coastal@fantasyxi.test", teamName: "Coastal Flyers" },
  { username: "savannah_kings", name: "Usman Danjuma", email: "demo_savannah@fantasyxi.test", teamName: "Savannah Kings" },
  { username: "metropolis_fc", name: "Folake Bakare", email: "demo_metropolis@fantasyxi.test", teamName: "Metropolis FC" },
  { username: "vanguard_united", name: "Babatunde Lawal", email: "demo_vanguard@fantasyxi.test", teamName: "Vanguard United" },
  { username: "red_devils_unn", name: "Chidiebere Ani", email: "demo_reddevils@fantasyxi.test", teamName: "Red Devils UNN" },
  { username: "invincible_eleven", name: "Amarachi Kalu", email: "demo_invincible@fantasyxi.test", teamName: "Invincible Eleven" },
];

export const DEMO_LEAGUES = [
  {
    name: "Campus Champions Cup",
    description: "The flagship Blockchain UNN Conference 5.0 championship featuring top campus fantasy managers.",
    inviteCode: "CAMPUS-CHAMP-2026",
    maxMembers: 20,
    entryFee: 10.0,
    prizePool: 200.0,
    memberCount: 20,
    isPrivate: false,
  },
  {
    name: "UNN Fantasy League",
    description: "Official University of Nigeria Nsukka student & faculty division.",
    inviteCode: "UNN-FANTASY-2026",
    maxMembers: 20,
    entryFee: 5.0,
    prizePool: 60.0,
    memberCount: 12,
    isPrivate: false,
  },
  {
    name: "Weekend Rivalry",
    description: "High-stakes 8-manager private clash for the weekend bragging rights.",
    inviteCode: "WEEKEND-RIVAL-26",
    maxMembers: 10,
    entryFee: 0.0,
    prizePool: 0.0,
    memberCount: 8,
    isPrivate: true,
  },
];

async function seed() {
  console.log("==================================================");
  console.log("🌱 Starting FantasyXI Demo Database Seeding");
  console.log("==================================================");

  // 1. Password hashing for demo users (shared secure password)
  const DEMO_PASSWORD = process.env.DEMO_USER_PASSWORD || "FantasyXI@2026";
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  // 2. Fetch Gameweeks
  const currentGw = await prisma.gameweek.findFirst({ where: { isCurrent: true } });
  const startGwId = 1;
  const endGwId = 38;
  const currentGwId = currentGw ? currentGw.id : 10;
  console.log(`📅 Current active gameweek is GW${currentGwId}`);

  // 3. Upsert Demo Users
  console.log(`\n👥 Upserting ${DEMO_MANAGERS.length} demo managers...`);
  const createdUsers: Record<string, any> = {};

  for (const m of DEMO_MANAGERS) {
    const user = await prisma.user.upsert({
      where: { email: m.email },
      update: {
        name: m.name,
        username: m.username,
        passwordHash,
      },
      create: {
        email: m.email,
        username: m.username,
        name: m.name,
        passwordHash,
        countryCode: "NG",
        role: "USER",
      },
    });
    createdUsers[m.username] = { ...user, teamName: m.teamName };
  }
  console.log(`✅ ${DEMO_MANAGERS.length} demo users ready.`);

  // 4. Fetch available players from DB to build valid squads
  console.log("\n⚽ Fetching real Premier League players from database...");
  const allPlayers = await prisma.player.findMany({
    orderBy: { totalPoints: "desc" },
    include: { team: true },
  });

  if (allPlayers.length < 50) {
    throw new Error(`Not enough players in database (found ${allPlayers.length}). Run importFplData.ts first.`);
  }

  const gkps = allPlayers.filter((p) => p.position === Position.GKP);
  const defs = allPlayers.filter((p) => p.position === Position.DEF);
  const mids = allPlayers.filter((p) => p.position === Position.MID);
  const fwds = allPlayers.filter((p) => p.position === Position.FWD);

  console.log(`📊 Available player pool: ${gkps.length} GKPs, ${defs.length} DEFs, ${mids.length} MIDs, ${fwds.length} FWDs.`);

  // 5. Create or update a valid fantasy squad for each demo manager
  console.log("\n🛡️ Generating valid squads (15 players, budget <= £100m, max 3/team)...");
  const createdSquads: Record<string, any> = {};

  for (let idx = 0; idx < DEMO_MANAGERS.length; idx++) {
    const m = DEMO_MANAGERS[idx];
    const user = createdUsers[m.username];

    // Pick players with varied seeds so each squad is unique
    const squadPlayers: Array<{ playerId: number; isStarter: boolean; isCaptain: boolean; isViceCaptain: boolean; positionOrder: number; price: number }> = [];
    const teamCounts: Record<number, number> = {};
    let totalBudget = 0;

    const tryPick = (playerList: typeof allPlayers, count: number, startOrder: number, isStarting: boolean) => {
      let picked = 0;
      // offset selection by manager index to create team variety
      const offset = (idx * 3) % playerList.length;
      for (let i = 0; i < playerList.length && picked < count; i++) {
        const p = playerList[(offset + i) % playerList.length];
        const currentCount = teamCounts[p.teamId] || 0;
        const priceNum = Number(p.price);

        // Keep budget reasonable: average player <= 6.6m
        if (currentCount < 3 && !squadPlayers.some((sp) => sp.playerId === p.id) && (totalBudget + priceNum + (15 - squadPlayers.length - 1) * 4.5 <= 100.0)) {
          teamCounts[p.teamId] = currentCount + 1;
          totalBudget += priceNum;
          squadPlayers.push({
            playerId: p.id,
            isStarter: isStarting,
            isCaptain: false,
            isViceCaptain: false,
            positionOrder: startOrder + picked,
            price: priceNum,
          });
          picked++;
        }
      }

      // If budget was tight, fallback to cheapest players
      if (picked < count) {
        const cheapest = [...playerList].sort((a, b) => Number(a.price) - Number(b.price));
        for (const p of cheapest) {
          if (picked >= count) break;
          const currentCount = teamCounts[p.teamId] || 0;
          if (currentCount < 3 && !squadPlayers.some((sp) => sp.playerId === p.id)) {
            teamCounts[p.teamId] = currentCount + 1;
            totalBudget += Number(p.price);
            squadPlayers.push({
              playerId: p.id,
              isStarter: isStarting,
              isCaptain: false,
              isViceCaptain: false,
              positionOrder: startOrder + picked,
              price: Number(p.price),
            });
            picked++;
          }
        }
      }
    };

    // Standard 4-4-2 starting lineup:
    // Starters: 1 GKP (pos 1), 4 DEF (pos 2..5), 4 MID (pos 6..9), 2 FWD (pos 10..11)
    tryPick(gkps, 1, 1, true);
    tryPick(defs, 4, 2, true);
    tryPick(mids, 4, 6, true);
    tryPick(fwds, 2, 10, true);

    // Bench: 1 GKP (pos 12), 1 DEF (pos 13), 1 MID (pos 14), 1 FWD (pos 15)
    tryPick(gkps, 1, 12, false);
    tryPick(defs, 1, 13, false);
    tryPick(mids, 1, 14, false);
    tryPick(fwds, 1, 15, false);

    // Assign captain & vice-captain among starters
    if (squadPlayers.length >= 2) {
      squadPlayers[0].isCaptain = true;
      squadPlayers[1].isViceCaptain = true;
    }

    // Calculate score points (varied by manager so standings have realistic variance)
    // Range between 420 and 680 points across the 10 completed gameweeks
    const basePoints = 400 + ((idx * 37) % 280);

    // Upsert squad
    let squad = await prisma.squad.findFirst({
      where: { userId: user.id },
    });

    if (!squad) {
      squad = await prisma.squad.create({
        data: {
          userId: user.id,
          name: m.teamName,
          budgetRemaining: Math.max(0, Math.round((100.0 - totalBudget) * 10) / 10),
          totalPoints: basePoints,
        },
      });
    } else {
      squad = await prisma.squad.update({
        where: { id: squad.id },
        data: {
          name: m.teamName,
          budgetRemaining: Math.max(0, Math.round((100.0 - totalBudget) * 10) / 10),
          totalPoints: basePoints,
        },
      });
      // Clear old squad players before re-inserting
      await prisma.squadPlayer.deleteMany({ where: { squadId: squad.id } });
    }

    // Insert squad players
    await prisma.squadPlayer.createMany({
      data: squadPlayers.map((sp) => ({
        squadId: squad!.id,
        playerId: sp.playerId,
        isStarter: sp.isStarter,
        isCaptain: sp.isCaptain,
        isViceCaptain: sp.isViceCaptain,
        positionOrder: sp.positionOrder,
        purchasePrice: sp.price,
      })),
      skipDuplicates: true,
    });

    // Populate gameweek scores for completed gameweeks (GW1 through currentGwId)
    // Distributed points per GW that sum up to basePoints
    const gwCount = currentGwId;
    const avgPerGw = Math.floor(basePoints / gwCount);
    let remaining = basePoints;

    for (let gw = 1; gw <= gwCount; gw++) {
      const gwPoints = gw === gwCount ? remaining : Math.max(25, avgPerGw + ((idx * 7 + gw * 13) % 31) - 15);
      remaining -= gwPoints;

      await prisma.squadGameweekScore.upsert({
        where: {
          squadId_gameweekId: {
            squadId: squad.id,
            gameweekId: gw,
          },
        },
        update: { points: gwPoints },
        create: {
          squadId: squad.id,
          gameweekId: gw,
          points: gwPoints,
          captainPoints: Math.floor(gwPoints * 0.3),
          benchPoints: Math.floor(gwPoints * 0.15),
        },
      });
    }

    createdSquads[m.username] = squad;
  }
  console.log(`✅ 20 squads created and scored across GW1-GW${currentGwId}.`);

  // 6. Create the 3 Leagues and populate memberships
  console.log("\n🏆 Setting up the 3 Demo Leagues...");
  const adminUser = createdUsers[DEMO_MANAGERS[0].username]; // Stanbiz United is the league creator

  for (const l of DEMO_LEAGUES) {
    console.log(`Creating league: ${l.name} (${l.memberCount} members, entry fee: $${l.entryFee})...`);
    const league = await prisma.league.upsert({
      where: { inviteCode: l.inviteCode },
      update: {
        name: l.name,
        description: l.description,
        maxMembers: l.maxMembers,
        entryFee: l.entryFee,
        prizePool: l.prizePool,
        currentMembers: l.memberCount,
        status: "ACTIVE",
        isPrivate: l.isPrivate,
        startGameweekId: startGwId,
        endGameweekId: endGwId,
      },
      create: {
        name: l.name,
        description: l.description,
        creatorId: adminUser.id,
        inviteCode: l.inviteCode,
        maxMembers: l.maxMembers,
        minMembers: 2,
        currentMembers: l.memberCount,
        entryFee: l.entryFee,
        prizePool: l.prizePool,
        status: "ACTIVE",
        scoringType: "CLASSIC",
        isPrivate: l.isPrivate,
        startGameweekId: startGwId,
        endGameweekId: endGwId,
      },
    });

    // Populate members for this league
    const participants = DEMO_MANAGERS.slice(0, l.memberCount);

    for (let r = 0; r < participants.length; r++) {
      const participant = participants[r];
      const pUser = createdUsers[participant.username];
      const pSquad = createdSquads[participant.username];

      // Distinguish demo payment state clearly:
      // In Campus Champions Cup: illustrative entry fee is $10.
      // Demo entries are ACTIVE memberships with paymentStatus PAYMENT_CONFIRMED for presentation realism,
      // but without fake transaction hashes or escrow claims.
      const hasPaid = l.entryFee > 0;
      const paymentStatus = hasPaid ? "PAYMENT_CONFIRMED" : "PENDING";

      await prisma.leagueMember.upsert({
        where: {
          leagueId_userId: {
            leagueId: league.id,
            userId: pUser.id,
          },
        },
        update: {
          squadId: pSquad.id,
          status: "ACTIVE",
          hasPaid,
          paymentStatus: paymentStatus as any,
          totalPoints: pSquad.totalPoints,
          rank: r + 1,
        },
        create: {
          leagueId: league.id,
          userId: pUser.id,
          squadId: pSquad.id,
          status: "ACTIVE",
          hasPaid,
          paymentStatus: paymentStatus as any,
          totalPoints: pSquad.totalPoints,
          rank: r + 1,
        },
      });
    }

    console.log(`✅ League "${l.name}" seeded with ${l.memberCount} members.`);
  }

  console.log("\n==================================================");
  console.log("🎉 FantasyXI Demonstration Environment Seeded Successfully!");
  console.log("==================================================");
  console.log("🔑 Documented Demo Login Account:");
  console.log("   Username: stanbiz_united");
  console.log("   Email:    demo_stanbiz@fantasyxi.test");
  console.log(`   Password: ${DEMO_PASSWORD}`);
  console.log("==================================================");
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error("❌ Seed failed:", err);
    process.exit(1);
  });
