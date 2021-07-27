require("@openzeppelin/test-helpers/configure")({
  provider: web3.currentProvider,
  singletons: {
    abstraction: "truffle",
  },
});
const oz = require("@openzeppelin/test-helpers");
const BN = web3.utils.BN;
const chai = require("chai");
chai.use(require("chai-as-promised")).use(require("bn-chai")(BN));
const { assert, expect } = chai;
const should = chai.should();

module.exports = {
  assert,
  expect,
  should,
  oz,
  BN,
  toWei: (amount) => new BN(web3.utils.toWei(amount + "")),
  isAddress: (address) => {
    should.exist(address);
    assert.notEqual(address, 0x0);
    assert.notEqual(address, "");
  },
  getBalance: (address) => web3.eth.getBalance(address),
  MatchStages: {
    CREATED: new BN(1),
    COMPLETED: new BN(2),
    FORFEITED: new BN(3),
  },
};
