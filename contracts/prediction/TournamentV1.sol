// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/math/SafeMath.sol";
import "@openzeppelin/contracts/utils/Counters.sol";
import "@openzeppelin/contracts/utils/structs/EnumerableSet.sol";
import "./CouncilV1.sol";

contract TournamentV1 is CouncilV1{
    using SafeMath for uint256;
    using Counters for Counters.Counter;
    using EnumerableSet for EnumerableSet.UintSet;
    
    enum MatchStage{
        INVALID,
        CREATED,
        COMPLETED,
        FORFEITED
    }

    struct Match{
        string uri;
        uint32 minScore;
        uint32 scoreMultiple;
        uint32 winningScore;
        uint8 rewardRate;
        MatchStage stage;
        uint256 deadline;
        uint256 totalAmount;
        uint256 rewardAmount;
        mapping(uint256 => uint256) betsAtScores;
    }

    struct Bet{
        bool claimed;
        uint32 score;
        uint256 amount;
    }

    mapping(uint256=>Match) public matches;
    Counters.Counter private matchCounter;

    mapping(uint256 => mapping(address => Bet)) private ledger;
    mapping(address => EnumerableSet.UintSet) private userMatches;

    uint8 public constant TOTAL_RATE = 100; 
    uint8 public rewardRate = 90; 
    uint128 public constant MIN_BET_AMOUNT = 0.01 ether;

    uint256 public treasuryAmount;

    event MatchCreated(uint256 indexed matchId, address indexed umpire, string uri, uint32 minScore,uint32 scoreMultiple,uint256 deadline);
    event DeadlineUpdated(uint256 indexed matchId, address indexed umpire, uint256 deadline);
    event MatchForfeited(uint256 indexed matchId, address indexed umpire);
    event MatchCompleted(uint256 indexed matchId, address indexed umpire, uint32 winningScore, uint256 rewardAmount, uint256 treasuryAmount);
    event BetScore(uint256 indexed matchId, address indexed sender, uint32 score, uint256 amount);
    event Claim(uint256 indexed matchId, address indexed sender, uint256 amount);
    event Refund(uint256 indexed matchId, address indexed sender, uint256 amount);
    event ClaimTreasury(uint256 amount);
    event RewardRateUpdated(uint256 indexed matchId, uint256 rewardRate);

    constructor(address _president) 
    CouncilV1(_president)
    {}
    
    function createMatch(string calldata _uri,uint32 _minScore,uint32 _scoreMultiple,uint256 _deadline) 
    external onlyUmpire returns(uint256) {
        
        require(bytes(_uri).length>0,"Council : URI_SHOULD_NOT_BE_EMPTY");
        require(_scoreMultiple>0,"Council : SCORE_MULTIPLE_SHOULD_BE_NON_ZERO");
        require(_deadline>0,"Council : DEADLINE_SHOULD_BE_NON_ZERO");

        matchCounter.increment();
        uint256 matchId = matchCounter.current();
        Match storage m = matches[matchId];
        m.uri = _uri;
        m.minScore = _minScore;
        m.scoreMultiple = _scoreMultiple;
        m.deadline = block.timestamp+_deadline;
        m.stage = MatchStage.CREATED;
        m.rewardRate = rewardRate;
        emit MatchCreated(matchId, _msgSender(), m.uri, m.minScore, m.scoreMultiple, m.deadline);
        return matchId;
    }

    function updateDeadline(uint256 _matchId,uint256 _deadline) 
    external onlyUmpire atStage(_matchId,MatchStage.CREATED) {
        Match storage m = matches[_matchId];
        m.deadline = block.timestamp+_deadline;
        emit DeadlineUpdated(_matchId, _msgSender(), m.deadline);
    }

    function forfeitMatch(uint256 _matchId) 
    external onlyUmpire atStage(_matchId,MatchStage.CREATED) {
        matches[_matchId].stage = MatchStage.FORFEITED;
        emit MatchForfeited(_matchId, _msgSender());
    }

    function endMatch(uint256 _matchId,uint32 _winningScore) 
    external onlyUmpire atStage(_matchId,MatchStage.CREATED) 
    {
        require(_winningScore>0,"Council : INVALID_SCORE");
        Match storage m = matches[_matchId];
        require(block.timestamp > m.deadline, "Council : DEADLINE_NOT_PASSED");
        m.winningScore = _winningScore;
        m.stage = MatchStage.COMPLETED;
        uint256 treasuryAmt=0;
        if(isHouseWin(_matchId)){
            treasuryAmt = m.totalAmount;
        }else{
            uint256 rewards = m.totalAmount.sub(m.betsAtScores[_winningScore]);
            m.rewardAmount = rewards.mul(m.rewardRate).div(TOTAL_RATE);
            treasuryAmt = rewards.mul(TOTAL_RATE-m.rewardRate).div(TOTAL_RATE);
        }
        treasuryAmount = treasuryAmount.add(treasuryAmt);
        emit MatchCompleted(_matchId, _msgSender(), _winningScore, m.rewardAmount, treasuryAmt);
    }

    function betScore(uint256 _matchId,uint32 _score) 
    external 
    payable
    whenNotPaused 
    notContract 
    atStage(_matchId,MatchStage.CREATED) 
    validBet(_matchId,_score) 
    {
        Bet storage b = ledger[_matchId][_msgSender()];
        b.score = _score;
        b.amount = msg.value;
        
        Match storage m = matches[_matchId];
        m.totalAmount = m.totalAmount.add(msg.value);
        m.betsAtScores[_score] = m.betsAtScores[_score].add(msg.value);

        userMatches[_msgSender()].add(_matchId);

        emit BetScore(_matchId, _msgSender(), _score, msg.value);
    }

    function claim(uint256 _matchId) external notContract validMatchId(_matchId) atStage(_matchId,MatchStage.COMPLETED){  
        Bet storage b = ledger[_matchId][_msgSender()];
        require(!b.claimed, "Council : REWARDS_CLAIMED");
        require(claimable(_matchId, _msgSender()), "Council : NOT_ELIGIBLE_FOR_CLAIM");
        Match storage m = matches[_matchId];
        uint256 claimedAmount = b.amount.add(b.amount.mul(m.rewardAmount).div(m.betsAtScores[m.winningScore]));
        b.claimed = true;
        payable(_msgSender()).transfer(claimedAmount);
        emit Claim(_matchId, _msgSender(), claimedAmount);
    }

    function claimable(uint256 _matchId,address _user) public view returns(bool) {
        Match storage m = matches[_matchId];
        Bet storage b = ledger[_matchId][_user];
        return b.amount>0 && b.score == m.winningScore;
    }

    function getRewardMultiplier(uint256 _matchId,uint32 _score) public view validMatchId(_matchId) returns(uint256) {
        Match storage m = matches[_matchId];
        uint256 rewards = m.totalAmount.sub(m.betsAtScores[_score]);
        uint256 rewardAmount = rewards.mul(m.rewardRate).div(TOTAL_RATE);
        return rewardAmount.mul(10000).div(m.betsAtScores[_score]);
    }
    
    /**
     * @notice House wins when no participant had bet on the final score
     */
    function isHouseWin(uint256 _matchId) public view returns(bool){
        Match storage m = matches[_matchId];
        return m.stage==MatchStage.COMPLETED && m.betsAtScores[m.winningScore]==0;
    }

    function refund(uint256 _matchId) external notContract validMatchId(_matchId) atStage(_matchId,MatchStage.FORFEITED){  
        Bet storage b = ledger[_matchId][_msgSender()];
        require(b.amount>0, "Council : DID_NOT_PARTICIPATE");
        require(!b.claimed, "Council : ALREADY_REFUNDED");
        b.claimed=true;
        payable(_msgSender()).transfer(b.amount);
        emit Refund(_matchId, _msgSender(), b.amount);
    }

    function getMatchCount() external view returns(uint){
        return matchCounter.current();
    }

    function getBetsAtScore(uint256 _matchId,uint256 _score) external view returns (uint256){
        return matches[_matchId].betsAtScores[_score];
    }

    function isDeadlinePassed(uint256 _matchId) external validMatchId(_matchId) view returns(bool) {
        return block.timestamp>matches[_matchId].deadline;
    }

    function getUserMatches(address _user,uint256 _cursor,uint256 _size) external view returns (uint256[] memory, uint256) {
        uint256 numOfMatches = userMatches[_user].length();
        uint256 length = _size;
        if (_size > numOfMatches - _cursor) {
            length = numOfMatches - _cursor;
        }
        uint256[] memory matchIds = new uint256[](length);
        for (uint256 i = 0; i < length; i++) {
            matchIds[i] = userMatches[_user].at(_cursor + i);
        }
        return (matchIds, _cursor + length);
    }

    function setRewardRate(uint8 _rewardRate) external onlyPresident {
        require(_rewardRate >= 90 && _rewardRate <= TOTAL_RATE, "Council : REWARD_RATE_OUT_OF_RANGE");
        rewardRate = _rewardRate;
        emit RewardRateUpdated(matchCounter.current().add(1), rewardRate);
    }

    function claimTreasury(uint256 _amount) external onlyPresident {
        require(treasuryAmount>=_amount,"Council : INSUFFICIENT_TREASURY_AMOUNT");
        treasuryAmount = treasuryAmount.sub(_amount);
        payable(president).transfer(_amount);
        emit ClaimTreasury(_amount);
    }

    function pause() external onlyUmpire whenNotPaused {
        super._pause();
    }

    function unpause() external onlyUmpire whenPaused {
        super._unpause();
    }

    modifier validMatchId(uint256 _matchId){
        require(_matchId>0 && _matchId<=matchCounter.current(),"Council : UNKNOWN_MATCH_ID");
        _;
    }

    modifier validBet(uint256 _matchId,uint256 _score){
        require(msg.value > MIN_BET_AMOUNT, "Council : BET_AMOUNT_TOO_LOW");
        Match storage m = matches[_matchId];
        Bet storage b = ledger[_matchId][_msgSender()];
        require(m.deadline > block.timestamp, "Council : DEADLINE_PASSED");
        require(_score >= m.minScore , "Council : INVALID_SCORE");
        require(_score.mod(m.scoreMultiple)==0, "Council : INVALID_SCORE_MULTIPLE");
        require(b.amount==0, "Council : BET_PLACED_ALREADY");
        _;
    }

    modifier atStage(uint256 _matchId, MatchStage _stage){
        require(matches[_matchId].stage==_stage,"Council : AT_INVALID_STAGE");
        _;
    }
    
}