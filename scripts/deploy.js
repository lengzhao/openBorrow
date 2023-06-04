// We require the Hardhat Runtime Environment explicitly here. This is optional
// but useful for running the script in a standalone fashion through `node <script>`.
//
// You can also run a script with `npx hardhat run <script>`. If you do that, Hardhat
// will compile your contracts, add the Hardhat Runtime Environment's members to the
// global scope, and execute the script.
const hre = require("hardhat");

async function main() {
  const Checker = await hre.ethers.getContractFactory("DefaultChecker");
  const NFT = await hre.ethers.getContractFactory("BorrowNFT");
  const checker = await Checker.deploy();
  const nft = await NFT.deploy();
  await checker.deployed();
  await nft.deployed();

  const Router = await hre.ethers.getContractFactory("Router");
  const router = await Router.deploy(checker.address, nft.address);
  await router.deployed();
  await nft.transferOwnership(router.address);

  console.log(
    `nft:${nft.address}; checker:${checker.address};router:${router.address}`
  );
}

// We recommend this pattern to be able to use async/await everywhere
// and properly handle errors.
main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
