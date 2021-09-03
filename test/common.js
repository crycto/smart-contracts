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
  eqBN: (val1, val2) => expect(val1).to.eq.BN(val2),
  toWei: (amount) => new BN(web3.utils.toWei(amount + "")),
  isAddress: (address) => {
    should.exist(address);
    assert.notEqual(address, oz.ZERO_ADDRESS);
    assert.notEqual(address, oz.ZERO_BYTES32);
  },
  gasCost: ({ gasUsed }) => new BN(gasUsed * 20000000000),
  logBalance: async (address, message = "") =>
    console.log(
      `     ${message} => `,
      (await oz.balance.current(address)).toString() / 1e18
    ),
  MatchStages: {
    CREATED: new BN(1),
    COMPLETED: new BN(2),
    FORFEITED: new BN(3),
  },
};
