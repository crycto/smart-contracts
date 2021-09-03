const TournamentV1 = artifacts.require("TournamentV1");
contract("TournamentV1", ([president, umpire, scorer, ...players]) => {
  let tournament;
  before(async () => {
    tournament = await TournamentV1.deployed();
    await tournament.grantRole(await tournament.UMPIRE_ROLE(), umpire);
    await tournament.grantRole(await tournament.SCORER_ROLE(), umpire);
  });

  context(
    "test : match 1 - completed - winning range is 310-320 - player1 & player2 win",
    () => require("./matches/1")([president, umpire, scorer, ...players])
  );
  context(
    "test : match 2 - completed - winning range is 350-360 - nobody wins - refund",
    () => require("./matches/2")([president, umpire, scorer, ...players])
  );
  context("test : match 3 - forfeited - refund", () =>
    require("./matches/3")([president, umpire, scorer, ...players])
  );
});
