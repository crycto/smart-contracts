// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

import "@openzeppelin/contracts/utils/Context.sol";
import "@openzeppelin/contracts/access/AccessControlEnumerable.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/utils/Address.sol";

abstract contract CouncilV1 is Context, AccessControlEnumerable, Pausable{
    using Address for address;
    
    bytes32 public constant UMPIRE_ROLE = keccak256("UMPIRE_ROLE");
    address public president;
    
    constructor(address _president){
        _setupRole(DEFAULT_ADMIN_ROLE, _president);
        _setupRole(UMPIRE_ROLE, _president);
        president = _president;
    }

    function setPresident(address _president) external onlyRole(DEFAULT_ADMIN_ROLE){
        president = _president;
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
    
}