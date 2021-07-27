const {
  assert,
  expect,
  oz,
  MatchStages,
  BN,
  toWei,
  getBalance,
} = require("../helper");
const TournamentV1 = artifacts.require("TournamentV1");

const MATCH_ID = new BN(1);
const URI = "QmcDJjWppxWrsQ9FQaP3kp8DqewkCc5cpPbjACn8GTfx3s";
const MIN_SCORE = new BN(100);
const SCORE_MULTIPLE = new BN(10);
const DEADLINE = new BN(60 * 60); //3 days

//In order of players
const BETS = ["320", "320", "290", "360", "290"];
const BET_AMOUNTS = [toWei(20), toWei(15), toWei(10), toWei(11), toWei(2)];

const TOTAL_AMOUNT = BET_AMOUNTS.reduce((total, b) => total.add(b), new BN(0));

const WINNING_SCORE = new BN(320);

let TOTAL_RATE = new BN(100),
  REWARD_RATE = new BN(90),
  TREASURY_RATE = new BN(10);

const TOTAL_REWARD_AMOUNT = TOTAL_AMOUNT.sub(
  BET_AMOUNTS[0].add(BET_AMOUNTS[1])
);
const REWARD_AMOUNT = TOTAL_REWARD_AMOUNT.mul(REWARD_RATE).div(TOTAL_RATE),
  TREASURY_AMOUNT = TOTAL_REWARD_AMOUNT.mul(TREASURY_RATE).div(TOTAL_RATE);

const AMOUNT_AT_WINNING_SCORE = BET_AMOUNTS[0].add(BET_AMOUNTS[1]);

const CLAIMED = [
  BET_AMOUNTS[0].add(
    BET_AMOUNTS[0].mul(REWARD_AMOUNT).div(AMOUNT_AT_WINNING_SCORE)
  ), //Player1
  BET_AMOUNTS[1].add(
    BET_AMOUNTS[1].mul(REWARD_AMOUNT).div(AMOUNT_AT_WINNING_SCORE)
  ), //Player2
];

module.exports = (tournament, [president, umpire, ...players]) => {
  const [player1, player2, player3, player4, player5] = players;

  before(async () => {
    tournament = await TournamentV1.new(president);
    await tournament.grantRole(await tournament.UMPIRE_ROLE(), umpire);
  });
  it("should create match1", async () => {
    const tx = await tournament.createMatch(
      URI,
      MIN_SCORE,
      SCORE_MULTIPLE,
      DEADLINE,
      {
        from: umpire,
      }
    );

    expect(await tournament.getMatchCount()).to.eq.BN(MATCH_ID);

    const { timestamp: blockTimeStamp } = await web3.eth.getBlock(
      tx.receipt.blockNumber
    );

    const match = await tournament.matches(MATCH_ID);
    match.uri.should.equal(URI);
    expect(match.minScore).to.eq.BN(MIN_SCORE);
    expect(match.scoreMultiple).to.eq.BN(SCORE_MULTIPLE);
    expect(match.stage).to.eq.BN(MatchStages.CREATED);
    expect(match.deadline).to.eq.BN(new BN(blockTimeStamp).add(DEADLINE));

    //Event
    const { event: eventName, args: eventArgs } = tx.logs[0];
    eventName.should.equal("MatchCreated");
    expect(eventArgs.matchId).to.eq.BN(MATCH_ID);
    eventArgs.umpire.should.equal(umpire);
    eventArgs.uri.should.equal(URI);
    expect(eventArgs.minScore).to.eq.BN(MIN_SCORE);
    expect(eventArgs.scoreMultiple).to.eq.BN(SCORE_MULTIPLE);
    expect(eventArgs.deadline).to.eq.BN(new BN(blockTimeStamp).add(DEADLINE));
  });

  it("umpire should be able to update deadline", async () => {
    const newDeadLine = DEADLINE.add(new BN(5));
    const tx = await tournament.updateDeadline(MATCH_ID, newDeadLine, {
      from: umpire,
    });

    const { timestamp: blockTimeStamp } = await web3.eth.getBlock(
      tx.receipt.blockNumber
    );

    const match = await tournament.matches(MATCH_ID);
    expect(match.deadline).to.eq.BN(new BN(blockTimeStamp).add(newDeadLine));

    //Event
    const { event: eventName, args: eventArgs } = tx.logs[0];
    eventName.should.equal("DeadlineUpdated");
    expect(eventArgs.matchId).to.eq.BN(MATCH_ID);
    eventArgs.umpire.should.equal(umpire);
    expect(eventArgs.deadline).to.eq.BN(
      new BN(blockTimeStamp).add(newDeadLine)
    );
  });

  it("player1 should be able to place bet", async () => {
    const tx = await tournament.betScore(MATCH_ID, BETS[0], {
      from: player1,
      value: BET_AMOUNTS[0],
    });

    const match = await tournament.matches(MATCH_ID, { from: player1 });
    expect(match.totalAmount).to.eq.BN(BET_AMOUNTS[0]);

    const { event: eventName, args: eventArgs } = tx.logs[0];
    eventName.should.equal("BetScore");
    expect(eventArgs.matchId).to.eq.BN(MATCH_ID);
    eventArgs.sender.should.equal(player1);
    expect(eventArgs.score).to.eq.BN(BETS[0]);
    expect(eventArgs.amount).to.eq.BN(BET_AMOUNTS[0]);
  });

  it("should revert if player bets with 0 ether", () =>
    tournament.betScore(MATCH_ID, BETS[1], {
      from: player2,
      value: toWei(0),
    }).should.be.rejected);

  it("non-umpire & non-presidet should not be able to pause the tournament", () =>
    tournament.pause({ from: player1 }).should.be.rejected);

  it("umpire/president should be able to pause the tournament", async () => {
    const tx = await tournament.pause({ from: umpire });
    const { event: eventName, args: eventArgs } = tx.logs[0];
    eventName.should.equal("Paused");
    eventArgs.account.should.equal(umpire);
  });

  it("players should not be able to place bets when tournament is paused", () =>
    tournament.betScore(MATCH_ID, BETS[1], {
      from: player2,
    }).should.be.rejected);

  it("non-umpire & non-president should not be able to unpause the tournament", () =>
    tournament.unpause({ from: player2 }).should.be.rejected);

  it("umpire/president should be able to unpause the tournament", async () => {
    const tx = await tournament.unpause({ from: president });
    const { event: eventName, args: eventArgs } = tx.logs[0];
    eventName.should.equal("Unpaused");
    eventArgs.account.should.equal(president);
  });

  it("other players should be able to place their bets", () => {
    for (let i = 1; i < BETS.length; i++) {
      tournament.betScore(MATCH_ID, BETS[i], {
        from: players[i],
        value: BET_AMOUNTS[i],
      }).should.be.fulfilled;
    }
  });

  it("should revert if players tries to place bet again", async () => {
    tournament.betScore(MATCH_ID, BETS[0], {
      from: player1,
    }).should.be.rejected;
  });

  it("should revert if player tries to place bet after deadline", async () => {
    await oz.time.increase(DEADLINE.add(new BN(10)));

    tournament.betScore(MATCH_ID, BETS[0], {
      from: players[6],
      value: BET_AMOUNTS[0],
    }).should.be.rejected;
  });

  it("getBetsAtScore should return successfully", async () =>
    expect(await tournament.getBetsAtScore(MATCH_ID, BETS[0])).to.eq.BN(
      AMOUNT_AT_WINNING_SCORE
    ));

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

      const { event: eventName, args: eventArgs } = tx.logs[0];
      eventName.should.equal("MatchCompleted");
      expect(eventArgs.matchId).to.eq.BN(MATCH_ID);
      eventArgs.scorer.should.equal(umpire);
      expect(eventArgs.winningScore).to.eq.BN(WINNING_SCORE);
    } catch (e) {
      console.log(e);
      assert.isOk(false, "umpire unable to end match");
    }
  });

  it("player1 & player2 should be claimable", () => {
    tournament.claimable(MATCH_ID, player1).should.eventually.be.true;
    tournament.claimable(MATCH_ID, player2).should.eventually.be.true;
  });

  it("player3,player4 & player5 should not be claimable", () => {
    tournament.claimable(MATCH_ID, player3).should.eventually.be.false;
    tournament.claimable(MATCH_ID, player4).should.eventually.be.false;
    tournament.claimable(MATCH_ID, player5).should.eventually.be.false;
  });

  it("player1 should be able to claim", async () => {
    try {
      const balance = await getBalance(player1);
      const tx = await tournament.claim(MATCH_ID, { from: player1 });
      // expect(await getBalance(player1)).to.eq.BN(balance.add(CLAIMED[0]));
      const { event: eventName, args: eventArgs } = tx.logs[0];
      eventName.should.equal("Claim");
      expect(eventArgs.matchId).to.eq.BN(MATCH_ID);
      eventArgs.sender.should.equal(player1);
      expect(eventArgs.amount).to.eq.BN(CLAIMED[0]);
      console.log("Bet placed by player1 = ", BET_AMOUNTS[0].toString() / 1e18);
      console.log("Claimed by player1 =  ", eventArgs.amount.toString() / 1e18);
    } catch (e) {
      console.log(e);
      assert.isOk(false, "player1 unable to claim");
    }
  });

  it("player1 should not be able to claim again", () =>
    tournament.claim(MATCH_ID, { from: player1 }).should.be.rejected);

  it("player2 should be able to claim", async () => {
    try {
      const tracker = await oz.balance.tracker(player2);
      tracker.get();
      const tx = await tournament.claim(MATCH_ID, { from: player2 });
      // console.log(tx);
      // expect(await tracker.delta()).to.eq.BN(CLAIMED[1]);  //Include gas price (from tx) in calculation
      const { event: eventName, args: eventArgs } = tx.logs[0];
      eventName.should.equal("Claim");
      expect(eventArgs.matchId).to.eq.BN(MATCH_ID);
      eventArgs.sender.should.equal(player2);
      expect(eventArgs.amount).to.eq.BN(CLAIMED[1]);
      console.log("Bet placed by player2 = ", BET_AMOUNTS[1].toString() / 1e18);
      console.log("Claimed by player2 = ", eventArgs.amount.toString() / 1e18);
    } catch (e) {
      console.log(e);
      assert.isOk(false, "player2 unable to claim");
    }
  });

  it("player3,player4,player5 should not be able to claim", () => {
    tournament.claim(MATCH_ID, { from: player3 }).should.be.rejected;
    tournament.claim(MATCH_ID, { from: player4 }).should.be.rejected;
    tournament.claim(MATCH_ID, { from: player5 }).should.be.rejected;
  });

  it("players should not be able to get any refund", () => {
    for (let i = 0; i < players.length; i++) {
      tournament.refund(MATCH_ID, { from: players[i] }).should.be.rejected;
    }
  });

  it("umpire should not be able to forfeit match after updating final score", () =>
    tournament.forfeitMatch(MATCH_ID, { from: umpire }).should.be.rejected);

  it("non-president should not be able to claim treasury amount", () =>
    tournament.claimTreasury({ from: player1 }).should.be.rejected);

  it("president should be able to claim treasury amount", async () => {
    console.log(
      "===TREASURY AMOUNT=== ",
      (await tournament.treasuryAmount()).toString() / 1e18
    );
    tournament.claimTreasury(await tournament.treasuryAmount(), {
      from: president,
    }).should.be.fulfilled;
  });

  it("should revert if president tries to claim more than treasury amount", () =>
    tournament.claimTreasury(new BN(10), {
      from: president,
    }).should.be.rejected);

  //TODO: Residual balance issue
  it("contract balance should be zero", async () => {
    const balance = await oz.balance.current(tournament.address);
    console.log("Contract Balance = ", balance.toString());
    expect(balance).to.eq.BN(new BN(0));
  });
};
