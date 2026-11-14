import { prisma } from "../config/db.js";

async function inspect() {
  const users = await prisma.user.count();
  const squads = await prisma.squad.count();
  const leagues = await prisma.league.count();
  const members = await prisma.leagueMember.count();
  const gws = await prisma.gameweek.findMany({
    select: { id: true, fplId: true, name: true, isCurrent: true, isFinished: true },
    orderBy: { id: "asc" },
  });
  console.log("Database Overview:", { users, squads, leagues, members });
  console.log("Current GW:", gws.find((g) => g.isCurrent));
  console.log("Finished GWs:", gws.filter((g) => g.isFinished).map((g) => g.id));
}

inspect()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
