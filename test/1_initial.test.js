const { expect, BN, isAddress, oz, toWei } = require("./common");
const TournamentV1 = artifacts.require("TournamentV1");

contract("TournamentV1", ([president, umpire, scorer, ...players]) => {
  let tournament;
  before(async () => {
    tournament = await TournamentV1.deployed();
  });

  beforeEach(async () => {
    /* before each context */
  });

  context("test : deployment", () => {
    it("check if deployed", () => isAddress(tournament.address));
    it("check if initial variables are set", async () => {
      tournament.president().should.eventually.equal(president);
      expect(await tournament.rewardRate()).to.eq.BN(new BN(90));
      expect(await tournament.minBetAmount()).to.eq.BN(toWei(0.01));
    });
  });

  context("test : access control", () => {
    it("should revert if non-president tries to grant roles", async () => {
      const umpireRole = await tournament.UMPIRE_ROLE();
      tournament.grantRole(umpireRole, umpire, { from: players[1] }).should.be
        .rejected;
    });
    it("should grant umpire role", async () => {
      const umpireRole = await tournament.UMPIRE_ROLE();
      await tournament.grantRole(umpireRole, umpire, { from: president }).should
        .be.fulfilled;
      tournament.hasRole(umpireRole, umpire).should.eventually.be.true;
    });
    it("should revoke umpire role", async () => {
      const umpireRole = await tournament.UMPIRE_ROLE();
      await tournament.revokeRole(umpireRole, umpire, { from: president })
        .should.be.fulfilled;
      tournament.hasRole(umpireRole, umpire).should.eventually.be.false;
    });
    it("should grant scorer role", async () => {
      const umpireRole = await tournament.SCORER_ROLE();
      await tournament.grantRole(umpireRole, umpire, { from: president }).should
        .be.fulfilled;
      tournament.hasRole(umpireRole, umpire).should.eventually.be.true;
    });
    it("should revoke scorer role", async () => {
      const umpireRole = await tournament.SCORER_ROLE();
      await tournament.revokeRole(umpireRole, umpire, { from: president })
        .should.be.fulfilled;
      tournament.hasRole(umpireRole, umpire).should.eventually.be.false;
    });
  });

  context("test : transfer presidency", () => {
    const newPresident = players[0];
    it("offer presidency", () =>
      tournament.offerPresidency(newPresident).should.be.fulfilled);
    it("accept presidency", async () => {
      (await tournament.president()).should.equal(president);
      const promise = tournament.acceptPresidency({ from: newPresident });
      promise.should.be.fulfilled;
      await promise;
      tournament.president().should.eventually.equal(newPresident);
    });
    after(async () => {
      await tournament.offerPresidency(president, { from: newPresident });
      await tournament.acceptPresidency({ from: president });
    });
  });

  context("test : reward rate / min bet amount", () => {
    it("total rate should be 100", async () => {
      expect(await tournament.TOTAL_RATE()).to.eq.BN(new BN(100));
    });
    it("non-president should not be able to set reward rate", () => {
      tournament.setRewardRate(new BN(95), { from: umpire }).should.be.rejected;
      tournament.setRewardRate(new BN(95), { from: players[0] }).should.be
        .rejected;
    });
    it("president should set reward rate successfully", async () => {
      const tx = await tournament.setRewardRate(new BN(98), {
        from: president,
      });
      oz.expectEvent(tx, "RewardRateUpdated", {
        matchId: new BN(1),
        rewardRate: new BN(98),
      });
      expect(await tournament.rewardRate()).to.eq.BN(new BN(98));
    });
    it("should revert if reward rate is set < 90 or > 100", async () => {
      tournament.setRewardRate(new BN(10), { from: president }).should.be
        .rejected;
      tournament.setRewardRate(new BN(125), { from: president }).should.be
        .rejected;
    });
    it("non-president should not be able to set mininum bet amount", () => {
      tournament.setMinBetAmount(toWei(0.00001), { from: umpire }).should.be
        .rejected;
      tournament.setMinBetAmount(toWei(0.00001), { from: players[0] }).should.be
        .rejected;
    });
    it("president should set mininum bet amount successfully", async () => {
      const tx = await tournament.setMinBetAmount(toWei(1), {
        from: president,
      });
      oz.expectEvent(tx, "MinimumBetAmountUpdated", { minBetAmount: toWei(1) });
      expect(await tournament.minBetAmount()).to.eq.BN(toWei(1));
    });
  });

  context("test : match creation", () => {
    before(async () => {
      await tournament.grantRole(await tournament.UMPIRE_ROLE(), umpire);
    });
    it("should revert if non-umpire role tries to create a match", () =>
      tournament.createMatch(
        "Qmc...",
        new BN(50),
        new BN(10),
        new BN(24 * 60 * 60),
        {
          from: players[0],
        }
      ).should.be.rejected);
    it("umpire should be able to create match", () =>
      tournament.createMatch(
        "Qmc...",
        new BN(50),
        new BN(10),
        new BN(24 * 60 * 60),
        {
          from: umpire,
        }
      ).should.be.fulfilled);
    it("should revert for invalid values", () => {
      //Empty URI
      tournament.createMatch("", new BN(50), new BN(10), new BN(24 * 60 * 60), {
        from: umpire,
      }).should.be.rejected;
      //Score multiple is 0
      tournament.createMatch(
        "Qmc..",
        new BN(50),
        new BN(0),
        new BN(24 * 60 * 60),
        {
          from: umpire,
        }
      ).should.be.rejected;
    });
  });
});
