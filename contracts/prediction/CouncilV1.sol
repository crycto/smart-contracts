// SPDX-License-Identifier: MIT
pragma solidity ^0.8.4;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

abstract contract CouncilV1 is Context, AccessControlEnumerable, Pausable{
    using Address for address;
    
    bytes32 public constant UMPIRE_ROLE = keccak256("UMPIRE_ROLE");
    bytes32 public constant SCORER_ROLE = keccak256("SCORER_ROLE");
    address public president;
    address private nextPresident;
    
    constructor(address _president){
        president = _president;
        _setupRole(DEFAULT_ADMIN_ROLE, _president);
        _setupRole(UMPIRE_ROLE, _president);
        _setupRole(SCORER_ROLE, _president);
    }

    function offerPresidency(address _account) external onlyPresident{
        require(president!=_account,"Council : ALREADY_PRESIDENT");
        nextPresident = _account;
    }

    function acceptPresidency() external{
        require(msg.sender==nextPresident,"Council : UNAUTHOURIZED");
        president = nextPresident;
        nextPresident = address(0);
    }

    modifier notContract() {
        require(!msg.sender.isContract(), "Council : CONTRACT_NOT_ALLOWED");
        require(msg.sender == tx.origin, "Council : PROXY_CONTRACT_NOT_ALLOWED");
        _;
    }

    modifier onlyPresident() {
        require(president==_msgSender(),"Council : MUST_BE_PRESIDENT");
        _;
    }

    modifier onlyUmpire() {
        require(hasRole(UMPIRE_ROLE, _msgSender()),"Council : MUST_BE_UMPIRE");
        _;
    }

    modifier onlyScorer() {
        require(hasRole(SCORER_ROLE, _msgSender()),"Council : MUST_BE_SCORER");
        _;
    }
    
}