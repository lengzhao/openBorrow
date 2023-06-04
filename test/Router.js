const {
  time,
  loadFixture,
} = require("@nomicfoundation/hardhat-network-helpers");
// const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");
const { expect } = require("chai");
const { ethers } = require("hardhat");
// const { abiCoder } = require('ethers');

describe("Router", function () {
  // We define a fixture to reuse the same setup in every test.
  // We use loadFixture to run this setup once, snapshot that state,
  // and reset Hardhat Network to that snapshot in every test.
  async function deployFixture() {
    const Token = await ethers.getContractFactory("MyToken");
    const token1 = await Token.deploy("token1", "tk1");
    const token2 = await Token.deploy("token2", "tk2");
    await token1.deployed();
    await token2.deployed();

    const Checker = await ethers.getContractFactory("DefaultChecker");
    const NFT = await ethers.getContractFactory("BorrowNFT");
    const checker = await Checker.deploy();
    const nft = await NFT.deploy();
    await checker.deployed();
    await nft.deployed();

    const Router = await ethers.getContractFactory("Router");
    const router = await Router.deploy(checker.address, nft.address);
    const owner = await router.signer.getAddress();
    await router.deployed();
    await nft.transferOwnership(router.address);
    return { router, owner, token1, token2, checker, nft };
  }

  describe("Deployment", function () {
    it("owner", async function () {
      const { router, owner } = await loadFixture(deployFixture);
      expect(await router.owner()).to.equal(owner);
    });
  });


  describe("router", () => {
    it("borrow", async () => {
      const { router, owner, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];

      await token1.mint(owner, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(owner, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(owner, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(owner, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Lend: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'borrower', type: 'address' },
          ]
        },
        message: {
          id: 10000,
          orderType: 0,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrower: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await lender._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        lender: lender.address,
        id: 10000,
        duration: 30 * 24 * 3600,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        borrowerLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(owner);
      const tx = await router.borrow(record, owner);
      const b2 = await token1.balanceOf(owner);
      expect(b2 - b1).to.equal(1000);

      const b3 = await token2.balanceOf(router.address);
      expect(b3).to.equal(2000);
      const receipt = await tx.wait();
      const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });
      // console.log(events[0].args);

      const data = events[0].args.info;
      const abiCode = new ethers.utils.AbiCoder();
      const rcd = abiCode.decode(["uint256",
        "address", "uint64", "address", "uint256",
        "address", "uint256", "address", "uint256"], data);

      const OrderRecord = {
        orderType: rcd[0],
        borrower: rcd[1],
        expiration: rcd[2],
        token: rcd[3],
        amount: rcd[4],
        depositToken: rcd[5],
        depositAmount: rcd[6],
        interestToken: rcd[7],
        interest: rcd[8],
      };
      // console.log(OrderRecord);

      await router.withdrawal(OrderRecord, 0, { value: OrderRecord.interest * 51 / 50 });

      expect(await token1.balanceOf(owner)).to.equal(100000);
      expect(await token2.balanceOf(owner)).to.equal(100000);

      expect(await token1.balanceOf(lender.address)).to.equal(100000);
      expect(await token2.balanceOf(lender.address)).to.equal(100000);
    });

    it("borrow2", async () => {
      const { router, owner, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];

      await token1.mint(owner, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(owner, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(owner, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(owner, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Lend: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'borrower', type: 'address' },
          ]
        },
        message: {
          id: 10001,
          orderType: 0,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrower: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await lender._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        lender: lender.address,
        id: 10001,
        duration: 30 * 24 * 3600,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        borrowerLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(owner);
      await router.borrow(record, owner);
      const b2 = await token1.balanceOf(owner);
      expect(b2 - b1).to.equal(1000);

      await expect(router.borrow(record, owner)).to.be.revertedWith('used');
    });

    it("borrow3", async () => {
      const { router, owner, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];

      await token1.mint(owner, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(owner, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(owner, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(owner, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Lend: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'borrower', type: 'address' },
          ]
        },
        message: {
          id: 10000,
          orderType: 0,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrower: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await lender._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        lender: lender.address,
        id: 10000,
        duration: 30 * 24 * 3600,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        borrowerLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(owner);
      const tx = await router.borrow(record, owner);
      const b2 = await token1.balanceOf(owner);
      expect(b2 - b1).to.equal(1000);

      const b3 = await token2.balanceOf(router.address);
      expect(b3).to.equal(2000);
      const receipt = await tx.wait();
      const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });
      // console.log(events[0].args);

      const data = events[0].args.info;
      const abiCode = new ethers.utils.AbiCoder();
      const rcd = abiCode.decode(["uint256",
        "address", "uint64", "address", "uint256",
        "address", "uint256", "address", "uint256"], data);

      const OrderRecord = {
        orderType: rcd[0],
        borrower: rcd[1],
        expiration: rcd[2],
        token: rcd[3],
        amount: rcd[4],
        depositToken: rcd[5],
        depositAmount: rcd[6],
        interestToken: rcd[7],
        interest: rcd[8],
      };
      // console.log(OrderRecord);

      await router.withdrawal(OrderRecord, 0, { value: OrderRecord.interest * 2 });

      expect(await token1.balanceOf(owner)).to.equal(100000);
      expect(await token2.balanceOf(owner)).to.equal(100000);

      expect(await token1.balanceOf(lender.address)).to.equal(100000);
      expect(await token2.balanceOf(lender.address)).to.equal(100000);

      await expect(router.withdrawal(OrderRecord, 0, { value: OrderRecord.interest * 2 })).to.be.revertedWith('not found');
    });

    it("borrow4", async () => {
      const { router, owner, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];

      await token1.mint(owner, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(owner, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(owner, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(owner, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      for (var i = 0; i < 5; i++) {
        const td1 = {
          domain: {
            name: "openBorrow",
            version: "v1.0.0",
            chainId: await router.signer.getChainId(),
            verifyingContract: vc
          },
          types: {
            Lend: [
              { name: 'id', type: 'uint64' },
              { name: 'orderType', type: 'uint64' },
              { name: 'duration', type: 'uint64' },
              { name: 'deadline', type: 'uint64' },
              { name: 'token', type: 'address' },
              { name: 'amount', type: 'uint256' },
              { name: 'depositToken', type: 'address' },
              { name: 'depositAmount', type: 'uint256' },
              { name: 'interestToken', type: 'address' },
              { name: 'interest', type: 'uint256' },
              { name: 'borrower', type: 'address' },
            ]
          },
          message: {
            id: 100 + i,
            orderType: 0,
            duration: 30 * 24 * 3600,
            deadline: await time.latest() + 10000,
            token: token1.address,
            amount: 1000,
            depositToken: token2.address,
            depositAmount: 2000,
            interestToken: "0x0000000000000000000000000000000000000000",
            interest: 100,
            borrower: "0x0000000000000000000000000000000000000000",
          }
        }

        const flatSig = await lender._signTypedData(td1.domain, td1.types, td1.message);

        const record = {
          orderType: 0,
          lender: lender.address,
          id: 100 + i,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrowerLimit: "0x0000000000000000000000000000000000000000",
          sign: flatSig,
        };
        const tx = await router.borrow(record, owner);
        const receipt = await tx.wait();
        const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });
        // console.log(events[0].args);
        expect(events[0].args.id).to.equal(i);
      }

      const td2 = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Lend: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'borrower', type: 'address' },
          ]
        },
        message: {
          id: 11001,
          orderType: 0,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrower: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig2 = await lender._signTypedData(td2.domain, td2.types, td2.message);

      const record2 = {
        orderType: 0,
        lender: lender.address,
        id: 11001,
        duration: 30 * 24 * 3600,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        borrowerLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig2,
      };
      const tx = await router.borrow(record2, owner);

      const receipt = await tx.wait();
      const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });
      expect(events[0].args.id).to.equal(5);
      const data = events[0].args.info;
      const abiCode = new ethers.utils.AbiCoder();
      const rcd = abiCode.decode(["uint256",
        "address", "uint64", "address", "uint256",
        "address", "uint256", "address", "uint256"], data);

      const OrderRecord = {
        orderType: rcd[0],
        borrower: rcd[1],
        expiration: rcd[2],
        token: rcd[3],
        amount: rcd[4],
        depositToken: rcd[5],
        depositAmount: rcd[6],
        interestToken: rcd[7],
        interest: rcd[8],
      };

      await router.withdrawal(OrderRecord, events[0].args.id, { value: OrderRecord.interest * 51 / 50 });

    });

    it("lend", async () => {
      const { router, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];
      const borrower = (await ethers.getSigners())[2];

      await token1.mint(borrower.address, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(borrower.address, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(borrower.address, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(borrower.address, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Borrow: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'lender', type: 'address' },
          ]
        },
        message: {
          id: 10000,
          orderType: 0,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          lender: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await borrower._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        borrower: borrower.address,
        id: 10000,
        duration: 30 * 24 * 3600,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        lenderLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(lender.address);
      const tx = await router.connect(lender).lend(record, lender.address);
      const b2 = await token1.balanceOf(lender.address);
      expect(b1 - b2).to.equal(1000);

      const b3 = await token2.balanceOf(router.address);
      expect(b3).to.equal(2000);
      const receipt = await tx.wait();
      const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });
      // console.log(events[0].args);

      const data = events[0].args.info;
      const abiCode = new ethers.utils.AbiCoder();
      const rcd = abiCode.decode(["uint256",
        "address", "uint64", "address", "uint256", "address",
        "uint256", "address", "uint256"], data);

      const OrderRecord = {
        // rid: rcd[0],
        orderType: rcd[0],
        borrower: rcd[1],
        expiration: rcd[2],
        token: rcd[3],
        amount: rcd[4],
        depositToken: rcd[5],
        depositAmount: rcd[6],
        interestToken: rcd[7],
        interest: rcd[8],
      };
      // console.log(OrderRecord);

      await router.connect(borrower).withdrawal(OrderRecord, 0, { value: OrderRecord.interest * 51 / 50 });

      expect(await token1.balanceOf(borrower.address)).to.equal(100000);
      expect(await token2.balanceOf(borrower.address)).to.equal(100000);

      expect(await token1.balanceOf(lender.address)).to.equal(100000);
      expect(await token2.balanceOf(lender.address)).to.equal(100000);
    });

    it("lend2", async () => {
      const { router, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];
      const borrower = (await ethers.getSigners())[2];

      await token1.mint(borrower.address, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(borrower.address, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(borrower.address, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(borrower.address, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Borrow: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'lender', type: 'address' },
          ]
        },
        message: {
          id: 10003,
          orderType: 0,
          duration: 30 * 24 * 3600,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          lender: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await borrower._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        borrower: borrower.address,
        id: 10003,
        duration: 30 * 24 * 3600,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        lenderLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(lender.address);
      await router.connect(lender).lend(record, lender.address);
      const b2 = await token1.balanceOf(lender.address);
      expect(b1 - b2).to.equal(1000);

      await expect(router.connect(lender).lend(record, lender.address)).to.be.revertedWith('used');
    });

    it("liquidate", async () => {
      const { router, owner, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];

      await token1.mint(owner, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(owner, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(owner, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(owner, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Lend: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'borrower', type: 'address' },
          ]
        },
        message: {
          id: 10005,
          orderType: 0,
          duration: 0,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrower: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await lender._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        lender: lender.address,
        id: 10005,
        duration: 0,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        borrowerLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(owner);
      const tx = await router.borrow(record, owner);
      const b2 = await token1.balanceOf(owner);
      expect(b2 - b1).to.equal(1000);

      const b3 = await token2.balanceOf(router.address);
      expect(b3).to.equal(2000);
      const receipt = await tx.wait();
      const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });

      const data = events[0].args.info;
      const abiCode = new ethers.utils.AbiCoder();
      const rcd = abiCode.decode(["uint256",
        "address", "uint64", "address", "uint256",
        "address", "uint256", "address", "uint256"], data);

      const OrderRecord = {
        orderType: rcd[0],
        borrower: rcd[1],
        expiration: rcd[2],
        token: rcd[3],
        amount: rcd[4],
        depositToken: rcd[5],
        depositAmount: rcd[6],
        interestToken: rcd[7],
        interest: rcd[8],
      };
      // console.log(OrderRecord);

      await router.liquidate(OrderRecord, 0);

      expect(await token1.balanceOf(owner)).to.equal(101000);
      expect(await token2.balanceOf(owner)).to.equal(98000);

      expect(await token1.balanceOf(lender.address)).to.equal(99000);
      expect(await token2.balanceOf(lender.address)).to.equal(102000);

      // try to liquidate twice
      await expect(router.liquidate(OrderRecord, 0)).to.be.revertedWith('not found');

    });

    it("liquidate2", async () => {
      const { router, owner, token1, token2 } = await loadFixture(deployFixture);
      const lender = (await ethers.getSigners())[1];

      await token1.mint(owner, 100000);
      await token1.mint(lender.address, 100000);
      await token1.approve1(owner, router.address, 100000);
      await token1.approve1(lender.address, router.address, 100000);
      await token2.mint(owner, 100000);
      await token2.mint(lender.address, 100000);
      await token2.approve1(owner, router.address, 100000);
      await token2.approve1(lender.address, router.address, 100000);
      const vc = await router.checkers(0);

      const td = {
        domain: {
          name: "openBorrow",
          version: "v1.0.0",
          chainId: await router.signer.getChainId(),
          verifyingContract: vc
        },
        types: {
          Lend: [
            { name: 'id', type: 'uint64' },
            { name: 'orderType', type: 'uint64' },
            { name: 'duration', type: 'uint64' },
            { name: 'deadline', type: 'uint64' },
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint256' },
            { name: 'depositToken', type: 'address' },
            { name: 'depositAmount', type: 'uint256' },
            { name: 'interestToken', type: 'address' },
            { name: 'interest', type: 'uint256' },
            { name: 'borrower', type: 'address' },
          ]
        },
        message: {
          id: 10006,
          orderType: 0,
          duration: 1000,
          deadline: await time.latest() + 10000,
          token: token1.address,
          amount: 1000,
          depositToken: token2.address,
          depositAmount: 2000,
          interestToken: "0x0000000000000000000000000000000000000000",
          interest: 100,
          borrower: "0x0000000000000000000000000000000000000000",
        }
      }

      const flatSig = await lender._signTypedData(td.domain, td.types, td.message);

      const record = {
        orderType: 0,
        lender: lender.address,
        id: 10006,
        duration: 1000,
        deadline: await time.latest() + 10000,
        token: token1.address,
        amount: 1000,
        depositToken: token2.address,
        depositAmount: 2000,
        interestToken: "0x0000000000000000000000000000000000000000",
        interest: 100,
        borrowerLimit: "0x0000000000000000000000000000000000000000",
        sign: flatSig,
      };
      const b1 = await token1.balanceOf(owner);
      const tx = await router.borrow(record, owner);
      const b2 = await token1.balanceOf(owner);
      expect(b2 - b1).to.equal(1000);

      const b3 = await token2.balanceOf(router.address);
      expect(b3).to.equal(2000);
      const receipt = await tx.wait();
      const events = receipt.events?.filter((x) => { return x.event == "NewRecord" });

      const data = events[0].args.info;
      const abiCode = new ethers.utils.AbiCoder();
      const rcd = abiCode.decode(["uint256",
        "address", "uint64", "address", "uint256",
        "address", "uint256", "address", "uint256"], data);

      const OrderRecord = {
        orderType: rcd[0],
        borrower: rcd[1],
        expiration: rcd[2],
        token: rcd[3],
        amount: rcd[4],
        depositToken: rcd[5],
        depositAmount: rcd[6],
        interestToken: rcd[7],
        interest: rcd[8],
      };
      // console.log(OrderRecord);

      // Tried to liquidate but it didn't time out
      await expect(router.liquidate(OrderRecord, 0)).to.be.revertedWith('ck');
    });
  });

});
