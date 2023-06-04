// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/Address.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "@openzeppelin/contracts/security/Pausable.sol";
import "@openzeppelin/contracts/proxy/Proxy.sol";
import "@openzeppelin/contracts/proxy/ERC1967/ERC1967Upgrade.sol";
import "./NFT.sol";

struct LendRecord {
    uint256 orderType;
    address lender;
    uint64 id;
    uint64 duration;
    uint64 deadline;
    address token;
    uint256 amount;
    address depositToken;
    uint256 depositAmount;
    address interestToken;
    uint256 interest;
    address borrowerLimit;
    bytes sign;
}

struct BorrowRecord {
    uint256 orderType;
    address borrower;
    uint64 id;
    uint64 duration;
    uint64 deadline;
    address token;
    uint256 amount;
    address depositToken;
    uint256 depositAmount;
    address interestToken;
    uint256 interest;
    address lenderLimit;
    bytes sign;
}

struct OrderRecord {
    uint256 orderType;
    address borrower;
    uint64 expiration;
    address token;
    uint256 amount;
    address depositToken;
    uint256 depositAmount;
    address interestToken;
    uint256 interest;
}

interface IChecker {
    function checkBorrow(
        address initiator,
        address lender,
        uint256 sid,
        BorrowRecord calldata record
    ) external returns (bool);

    function checkLend(
        address initiator,
        address borrower,
        uint256 sid,
        LendRecord calldata record
    ) external returns (bool);

    function withdrawalCb(
        address initiator,
        uint256 sid,
        OrderRecord calldata record
    ) external returns (bool);

    function liquidateCb(
        address initiator,
        uint256 sid,
        OrderRecord calldata record
    ) external returns (bool);
}

interface ICaller {
    /**
     * @dev Receive a flash loan.
     * @param initiator The initiator of the loan.
     * @param token The loan currency.
     * @param amount The amount of tokens lent.
     * @param data Arbitrary data structure, intended to contain user-defined parameters.
     * @return hope success
     */
    function callback(
        address initiator,
        address token,
        uint256 amount,
        bytes calldata data
    ) external returns (bool);
}

interface IBorrowNFT is IERC721 {
    function safeMint(address to, bytes32 key) external returns (uint256);

    function getKey(uint256 tokenId) external view returns (bytes32);

    function clearKey(uint256 tokenId) external returns (bytes32);

    function ownerOf(uint256 tokenId) external view returns (address);
}

contract Router is Ownable, Pausable, Proxy, ERC1967Upgrade {
    address[] public checkers;
    mapping(address => uint256) public idLimit;
    mapping(address => mapping(uint64 => bool)) public usedID;

    IBorrowNFT public nft;

    uint256 public swapFee = 0.01 ether;

    event InvalidID(address indexed user, uint256 indexed id);
    event NewRecord(uint256 indexed id, bytes info);
    event FinishRecord(uint256 indexed id);

    constructor(address defaultCK, IBorrowNFT nftAddr) {
        setChecker(defaultCK);
        nft = nftAddr;
    }

    function setChecker(address _new) public onlyOwner {
        require(_new != address(0x0));
        checkers.push(_new);
    }

    function disableChecker(uint256 orderType) public onlyOwner {
        checkers[orderType] = address(0x0);
    }

    function numberOfChecker() public view returns (uint256) {
        return checkers.length;
    }

    function borrow(LendRecord calldata lr, address borrower) public {
        require(idLimit[lr.lender] < lr.id);
        require(!usedID[lr.lender][lr.id], "used");
        usedID[lr.lender][lr.id] = true;
        address ck = checkers[lr.orderType];
        require(ck != address(0x0));
        OrderRecord memory record;
        record.orderType = lr.orderType;
        record.borrower = borrower;
        record.expiration = uint64(block.timestamp) + lr.duration;
        record.token = lr.token;
        record.amount = lr.amount;
        record.depositToken = lr.depositToken;
        record.depositAmount = lr.depositAmount;
        record.interestToken = lr.interestToken;
        record.interest = lr.interest;
        bytes memory info = abi.encode(record);
        bytes32 key = keccak256(info);
        uint256 sid = nft.safeMint(lr.lender, key);

        require(lr.lender != address(this));
        require(IChecker(ck).checkLend(msg.sender, borrower, sid, lr));
        IERC20 t1 = IERC20(lr.token);
        require(t1.transferFrom(lr.lender, borrower, lr.amount));
        IERC20 t2 = IERC20(lr.depositToken);
        require(t2.transferFrom(msg.sender, address(this), lr.depositAmount));
        emit NewRecord(sid, info);
        emit InvalidID(lr.lender, lr.id);
    }

    function borrowAndCall(
        LendRecord calldata lr,
        address borrower,
        ICaller cb,
        bytes calldata data
    ) public {
        borrow(lr, borrower);
        require(cb.callback(msg.sender, lr.token, lr.amount, data), "cb");
    }

    function lend(BorrowRecord calldata br, address lender) public {
        require(idLimit[br.borrower] < br.id);
        require(!usedID[br.borrower][br.id], "used");
        usedID[br.borrower][br.id] = true;
        address ck = checkers[br.orderType];
        require(ck != address(0x0));
        OrderRecord memory record;
        record.orderType = br.orderType;
        record.borrower = br.borrower;
        record.expiration = uint64(block.timestamp) + br.duration;
        record.token = br.token;
        record.amount = br.amount;
        record.depositToken = br.depositToken;
        record.depositAmount = br.depositAmount;
        record.interestToken = br.interestToken;
        record.interest = br.interest;
        bytes memory info = abi.encode(record);
        bytes32 key = keccak256(info);
        uint256 sid = nft.safeMint(lender, key);

        require(msg.sender != address(this));
        require(IChecker(ck).checkBorrow(msg.sender, lender, sid, br));
        IERC20 t1 = IERC20(br.token);
        require(t1.transferFrom(msg.sender, br.borrower, br.amount));
        IERC20 t2 = IERC20(br.depositToken);
        require(t2.transferFrom(br.borrower, address(this), br.depositAmount));

        emit NewRecord(sid, info);
        emit InvalidID(br.borrower, br.id);
    }

    function lendAndCall(
        BorrowRecord calldata br,
        address lender,
        ICaller cb,
        bytes calldata data
    ) public {
        lend(br, lender);
        require(cb.callback(msg.sender, br.token, br.amount, data), "cb");
    }

    function withdrawal(
        OrderRecord calldata record,
        uint256 sid
    ) public payable {
        bytes32 h = keccak256(abi.encode(record));
        require(nft.clearKey(sid) == h, "not found");
        IERC20 t1 = IERC20(record.token);
        address lender = nft.ownerOf(sid);
        require(t1.transferFrom(msg.sender, lender, record.amount));
        IERC20 t2 = IERC20(record.depositToken);
        require(t2.transfer(record.borrower, record.depositAmount));
        if (record.interestToken == address(0)) {
            require(msg.value >= (record.interest * 51) / 50, "fee");
            payable(lender).transfer(record.interest);
            payable(owner()).transfer(msg.value - record.interest);
        } else {
            IERC20 t3 = IERC20(record.interestToken);
            t3.transferFrom(msg.sender, lender, record.interest);
            t3.transferFrom(msg.sender, owner(), record.interest / 50);
        }

        address ck = checkers[record.orderType];
        require(msg.sender != address(this));
        require(IChecker(ck).withdrawalCb(msg.sender, sid, record), "ck");
        emit FinishRecord(sid);
    }

    function withdrawalAndCall(
        OrderRecord calldata record,
        uint256 sid,
        ICaller cb,
        bytes calldata data
    ) public payable {
        withdrawal(record, sid);
        require(
            cb.callback(msg.sender, record.token, record.amount, data),
            "cb"
        );
    }

    function liquidate(OrderRecord calldata record, uint256 sid) public {
        bytes32 h = keccak256(abi.encode(record));
        require(nft.clearKey(sid) == h, "not found");
        address ck = checkers[record.orderType];
        IERC20 t = IERC20(record.depositToken);
        require(t.transfer(nft.ownerOf(sid), record.depositAmount));
        require(IChecker(ck).liquidateCb(msg.sender, sid, record), "ck");
        emit FinishRecord(sid);
    }

    function liquidateAndCall(
        OrderRecord calldata record,
        uint256 sid,
        ICaller cb,
        bytes calldata data
    ) public {
        liquidate(record, sid);
        require(
            cb.callback(msg.sender, record.token, record.amount, data),
            "cb"
        );
    }

    function changeFee(uint256 newFee)public onlyOwner{
        swapFee = newFee;
    }

    function swap(LendRecord calldata lr, address borrower) public payable {
        require(idLimit[lr.lender] < lr.id);
        require(!usedID[lr.lender][lr.id], "used");
        usedID[lr.lender][lr.id] = true;
        require(msg.value >= swapFee, "fee");
        address ck = checkers[lr.orderType];
        require(ck != address(0x0));
        require(lr.duration == 0);
        require(lr.lender != address(this));
        require(IChecker(ck).checkLend(msg.sender, borrower, 0, lr));
        IERC20 t1 = IERC20(lr.token);
        require(t1.transferFrom(lr.lender, borrower, lr.amount));
        IERC20 t2 = IERC20(lr.depositToken);
        require(t2.transferFrom(msg.sender, lr.lender, lr.depositAmount));
        payable(owner()).transfer(msg.value);
        emit InvalidID(lr.lender, lr.id);
    }

    function _implementation()
        internal
        view
        virtual
        override
        returns (address impl)
    {
        return ERC1967Upgrade._getImplementation();
    }

    function upgradeTo(
        address newImplementation,
        bytes memory data,
        bool forceCall
    ) public onlyOwner {
        _upgradeToAndCall(newImplementation, data, forceCall);
    }
}
