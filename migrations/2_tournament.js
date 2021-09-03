const TournamentV1 = artifacts.require("TournamentV1");

module.exports = function (deployer, _ , [president]) {
  deployer.deploy(TournamentV1, president);
};
