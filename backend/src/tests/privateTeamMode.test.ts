import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SquadService, SquadPrivateTeamError } from "../services/squad/squadService.js";

describe("Private Team Mode Authorization & Privacy Enforcement", () => {
  const mockPrivateSquad = {
    id: "squad-private-1",
    userId: "user-alice",
    name: "Alice Top Secret XI",
    budgetRemaining: 10.0,
    players: [
      {
        playerId: 101,
        positionOrder: 1,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false,
        purchasePrice: 12.0,
        player: { id: 101, displayName: "Erling Haaland", price: 15.0, team: { shortName: "MCI" } },
      },
    ],
    gameweekScores: [],
    memberships: [
      {
        league: {
          id: "league-shielded-100",
          teamVisibility: "PRIVATE",
        },
      },
    ],
  };

  const mockPublicSquad = {
    id: "squad-public-1",
    userId: "user-bob",
    name: "Bob Open XI",
    budgetRemaining: 5.0,
    players: [
      {
        playerId: 102,
        positionOrder: 1,
        isStarter: true,
        isCaptain: true,
        isViceCaptain: false,
        purchasePrice: 10.0,
        player: { id: 102, displayName: "Bukayo Saka", price: 10.5, team: { shortName: "ARS" } },
      },
    ],
    gameweekScores: [],
    memberships: [
      {
        league: {
          id: "league-classic-200",
          teamVisibility: "PUBLIC",
        },
      },
    ],
  };

  function createMockDb() {
    return {
      squad: {
        findUnique: async ({ where }: any) => {
          if (where.id === "squad-private-1") return mockPrivateSquad;
          if (where.id === "squad-public-1") return mockPublicSquad;
          return null;
        },
        findMany: async ({ where }: any) => {
          if (where.userId === "user-alice") return [mockPrivateSquad];
          return [mockPrivateSquad, mockPublicSquad];
        },
      },
    };
  }

  it("allows a manager to inspect their own squad in a private team league", async () => {
    const service = new SquadService(createMockDb());
    const squad = await service.getSquad("squad-private-1", "user-alice", "USER");
    assert.equal(squad.id, "squad-private-1");
    assert.equal(squad.name, "Alice Top Secret XI");
    assert.equal(squad.players.length, 1);
    assert.equal(squad.players[0].player.displayName, "Erling Haaland");
  });

  it("rejects another competitor from retrieving squad details in a private team league (403)", async () => {
    const service = new SquadService(createMockDb());
    await assert.rejects(
      () => service.getSquad("squad-private-1", "user-charlie", "USER"),
      (err: Error) => {
        assert(err instanceof SquadPrivateTeamError);
        assert.match(err.message, /This manager's team is private/);
        return true;
      }
    );
  });

  it("rejects unauthenticated viewer from inspecting private squad", async () => {
    const service = new SquadService(createMockDb());
    await assert.rejects(
      () => service.getSquad("squad-private-1", undefined, undefined),
      (err: Error) => {
        assert(err instanceof SquadPrivateTeamError);
        return true;
      }
    );
  });

  it("allows competitors to inspect squads in classic (PUBLIC) leagues", async () => {
    const service = new SquadService(createMockDb());
    const squad = await service.getSquad("squad-public-1", "user-charlie", "USER");
    assert.equal(squad.id, "squad-public-1");
    assert.equal(squad.players[0].player.displayName, "Bukayo Saka");
  });

  it("filters private squads out of getUserSquads when called by another user", async () => {
    const service = new SquadService(createMockDb());
    const squads = await service.getUserSquads("user-mixed", "user-charlie", "USER");
    // Only the public squad should be returned
    assert.equal(squads.length, 1);
    assert.equal(squads[0].id, "squad-public-1");
  });

  it("allows admin override to view private squads for operational support", async () => {
    const service = new SquadService(createMockDb());
    const squad = await service.getSquad("squad-private-1", "admin-1", "ADMIN");
    assert.equal(squad.id, "squad-private-1");
  });

  it("denies valuation lookup for another user's private squad", async () => {
    const service = new SquadService(createMockDb());
    await assert.rejects(
      () => service.getSquadValuation("squad-private-1", "user-charlie", "USER"),
      (err: Error) => {
        assert(err instanceof SquadPrivateTeamError);
        return true;
      }
    );
  });
});
