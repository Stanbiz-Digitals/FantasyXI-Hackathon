import { prisma } from "../config/db.js";

async function check() {
  const teams = await prisma.team.count();
  const gameweeks = await prisma.gameweek.count();
  const players = await prisma.player.count();
  const fixtures = await prisma.fixture.count();
  console.log("Current DB Counts:", { teams, gameweeks, players, fixtures });
  const samplePlayers = await prisma.player.findMany({
    take: 5,
    include: { team: true },
  });
  console.log("Sample players:", samplePlayers.map(p => ({
    name: p.displayName,
    team: p.team?.name,
    position: p.position,
    price: p.price.toString(),
  })));
}

check().then(() => process.exit(0)).catch(err => {
  console.error(err);
  process.exit(1);
});
