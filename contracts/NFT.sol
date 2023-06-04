// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Counters.sol";

contract BorrowNFT is ERC721, Ownable {
    using Counters for Counters.Counter;

    Counters.Counter private _tokenIdCounter;
    mapping(uint256 => bytes32) public keys;

    constructor() ERC721("BorrowNFT", "BTK") {}

    function _baseURI() internal pure override returns (string memory) {
        return "https://borrow.govm.club/nft/token";
    }

    function _beforeTokenTransfer(
        address,
        address,
        uint256 firstTokenId,
        uint256
    ) internal view override {
        require(keys[firstTokenId] > 0);
    }

    function safeMint(
        address to,
        bytes32 key
    ) public onlyOwner returns (uint256) {
        uint256 tokenId = _tokenIdCounter.current();
        keys[tokenId] = key;
        _tokenIdCounter.increment();
        _safeMint(to, tokenId);
        return tokenId;
    }

    function getKey(uint256 tokenId) public view returns (bytes32) {
        return keys[tokenId];
    }

    function clearKey(uint256 tokenId) public onlyOwner returns(bytes32){
        bytes32 key = keys[tokenId];
        keys[tokenId] = 0;
        return key;
    }
}
