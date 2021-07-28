const {
  assert,
  expect,
  oz,
  MatchStages,
  BN,
  toWei,
  eqBN,
  gasCost,
  logBalance,
} = require("../common");
const TournamentV1 = artifacts.require("TournamentV1");

const MATCH_ID = new BN(3);
const URI = "QmcDJjWppxWrsQ9FQaP3kp8DqewkCc5cpPbjACn8GTfx3s";
const MIN_SCORE = new BN(100);
const SCORE_MULTIPLE = new BN(10);
const DEADLINE = new BN(60 * 60);

//In order of players
const BETS = ["320", "320", "290", "360", "290"];
const BET_AMOUNTS = [toWei(1), toWei(1.5), toWei(0.1), toWei(0.1), toWei(0.2)];

const TOTAL_AMOUNT = BET_AMOUNTS.reduce((total, b) => total.add(b), new BN(0));

module.exports = ([president, umpire, ...players]) => {
  let tournament;
  before(async () => {
    tournament = await TournamentV1.deployed();
    tournament.createMatch(URI, MIN_SCORE, SCORE_MULTIPLE, DEADLINE, {
      from: umpire,
    });
    for (let i = 0; i < BETS.length; i++) {
      tournament.betScore(MATCH_ID, BETS[i], {
        from: players[i],
        value: BET_AMOUNTS[i],
      }).should.be.fulfilled;
    }
  });

  it("umpire should be able to forfeit match", async () => {
    try {
      const promise = tournament.forfeitMatch(MATCH_ID, {
        from: umpire,
      });

      promise.should.be.fulfilled;

      const tx = await promise;

      const match = await tournament.matches(MATCH_ID);
      expect(match.stage).to.eq.BN(MatchStages.FORFEITED);
      oz.expectEvent(tx, "MatchForfeited", {
        matchId: MATCH_ID,
        umpire,
      });
    } catch (e) {
      console.log(e);
      assert.isOk(false, "umpire unable to end match");
    }
  });

  it("no player should be claimable", () => {
    for (let i = 0; i < players.length; i++) {
      tournament.claimable(MATCH_ID, players[i]).should.eventually.be.false;
    }
  });

  it("player1 - player5 should be able to get refund", async () => {
    for (let i = 0; i < BETS.length; i++) {
      const tracker = await oz.balance.tracker(players[i]);
      await tracker.get();
      const promise = tournament.refund(MATCH_ID, { from: players[i] });
      promise.should.be.fulfilled;
      const tx = await promise;

      eqBN(await tracker.delta(), BET_AMOUNTS[i].sub(gasCost(tx.receipt)));

      oz.expectEvent(tx, "Refund", {
        matchId: MATCH_ID,
        sender: players[i],
        amount: BET_AMOUNTS[i],
      });
    }
  });

  it("should revert if player1-player5 tries to get refund again", () => {
    for (let i = 0; i < players.length; i++) {
      tournament.refund(MATCH_ID, { from: players[i] }).should.be.rejected;
    }
  });

  it("umpire should not be able to update score after forfeiting", () =>
    tournament.endMatch(MATCH_ID, new BN(300), { from: umpire }).should.be
      .rejected);

  it("treasury amount should be zero", async () => {
    eqBN(await tournament.treasuryAmount(), new BN(0));
  });

  after(async () => {
    await logBalance(tournament.address, "contract.balance @ end of match1");
  });
};
