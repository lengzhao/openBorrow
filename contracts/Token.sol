// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";
import "@openzeppelin/contracts/access/Ownable.sol";

// token for test
contract MyToken is ERC20, Ownable {
    constructor(string memory name, string memory symbol) ERC20(name,symbol) {}

    function mint(address to, uint256 amount) public {
        _mint(to, amount);
    }

    function approve1(address owner,address spender, uint256 amount) public  returns (bool) {
        _approve(owner, spender, amount);
        return true;
    }
}