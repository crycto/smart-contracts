const {
  assert,
  expect,
  oz,
  MatchStages,
  BN,
  toWei,
  logBalance,
} = require("../common");
const TournamentV1 = artifacts.require("TournamentV1");

const MATCH_ID = new BN(2);
const URI = "QmcDJjWppxWrsQ9FQaP3kp8DqewkCc5cpPbjACn8GTfx3s";
const MIN_SCORE = new BN(100);
const SCORE_MULTIPLE = new BN(10);
const DEADLINE = new BN(60 * 60);

//In order of players
const BETS = ["320", "320", "290", "360", "290"];
const BET_AMOUNTS = [toWei(5), toWei(3), toWei(4), toWei(2), toWei(6)];

const TOTAL_AMOUNT = BET_AMOUNTS.reduce((total, b) => total.add(b), new BN(0));

const WINNING_SCORE = new BN(350);

const REWARD_AMOUNT = new BN(0);

const TREASURY_AMOUNT = TOTAL_AMOUNT;

module.exports = ([president, umpire, ...players]) => {
  const [player1, player2, player3, player4, player5] = players;
  let tournament;
  before(async () => {
    tournament = await TournamentV1.deployed();
    await tournament.createMatch(URI, MIN_SCORE, SCORE_MULTIPLE, DEADLINE, {
      from: umpire,
    });
    for (let i = 0; i < BETS.length; i++) {
      await tournament.betScore(MATCH_ID, BETS[i], {
        from: players[i],
        value: BET_AMOUNTS[i],
      }).should.be.fulfilled;
    }
    await oz.time.increase(DEADLINE.add(new BN(1)));
  });

  it("umpire should be able to end match", async () => {
    try {
      const tx = await tournament.endMatch(MATCH_ID, WINNING_SCORE, {
        from: umpire,
      });
      const match = await tournament.matches(MATCH_ID);
      expect(match.stage).to.eq.BN(MatchStages.COMPLETED);
      expect(match.winningScore).to.eq.BN(WINNING_SCORE);
      expect(match.rewardAmount).to.eq.BN(REWARD_AMOUNT);
      expect(await tournament.treasuryAmount()).to.eq.BN(TREASURY_AMOUNT);
      oz.expectEvent(tx, "MatchCompleted", {
        matchId: MATCH_ID,
        umpire,
        winningScore: WINNING_SCORE,
      });
    } catch (e) {
      console.log(e);
      assert.isOk(false, "umpire unable to end match");
    }
  });

  it("houseWin should return true", () =>
    tournament.isHouseWin(MATCH_ID).should.eventually.be.true);

  it("no players should be claimable", () => {
    for (let i = 0; i < players.length; i++) {
      tournament.claimable(MATCH_ID, players[i]).should.eventually.be.false;
    }
  });

  it("should revert if any player tries to claim/refund", async () => {
    for (let i = 0; i < players.length; i++) {
      tournament.claim(MATCH_ID, { from: players[i] }).should.be.rejected;
      tournament.refund(MATCH_ID, { from: players[i] }).should.be.rejected;
    }
  });

  it("president should be able to claim treasury amount", async () => {
    const treasuryAmount = await tournament.treasuryAmount();
    console.log("===TREASURY AMOUNT=== ", treasuryAmount.toString() / 1e18);
    tournament.claimTreasury(treasuryAmount, {
      from: president,
    }).should.be.fulfilled;
  });

  it("should revert if president tries to claim more than treasury amount", () =>
    tournament.claimTreasury(new BN(100), {
      from: president,
    }).should.be.rejected);

  after(async () => {
    await logBalance(tournament.address, "contract.balance @ end of match1");
  });
};
