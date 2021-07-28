const { expect, BN, isAddress } = require("./common");
const TournamentV1 = artifacts.require("TournamentV1");

contract("TournamentV1", ([president, umpire, ...players]) => {
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
    });
  });

  context("test : access control", () => {
    it("should grant umpire role", async () => {
      const umpireRole = await tournament.UMPIRE_ROLE();
      await tournament.grantRole(umpireRole, umpire, { from: president }).should
        .be.fulfilled;
      tournament.hasRole(umpireRole, umpire).should.eventually.be.true;
    });
  });

  context("test : reward/treasury rates", () => {
    it("total rate should be 100", async () => {
      expect(await tournament.TOTAL_RATE()).to.eq.BN(new BN(100));
    });
    it("non-president should not be able to set reward rate", () => {
      tournament.setRewardRate(new BN(95), { from: umpire }).should.be.rejected;
      tournament.setRewardRate(new BN(95), { from: players[0] }).should.be
        .rejected;
    });
    it("president should set reward rate successfully", async () => {
      await tournament.setRewardRate(new BN(98), { from: president });
      expect(await tournament.rewardRate()).to.eq.BN(new BN(98));
    });
    it("should revert if reward rate is set < 90 or > 100", async () => {
      tournament.setRewardRate(new BN(10), { from: president }).should.be
        .rejected;
      tournament.setRewardRate(new BN(125), { from: president }).should.be
        .rejected;
    });
  });

  context("test : match creation", () => {
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
