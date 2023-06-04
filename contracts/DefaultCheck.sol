// SPDX-License-Identifier: MIT
pragma solidity ^0.8.9;

import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";
import "./Borrow.sol";

contract DefaultChecker is IChecker, EIP712 {
    bytes32 constant BORROW_TYPEHASH =
        keccak256(
            "Borrow(uint64 id,uint64 orderType,uint64 duration,uint64 deadline,address token,uint256 amount,address depositToken,uint256 depositAmount,address interestToken,uint256 interest,address lender)"
        );
    bytes32 constant LEND_TYPEHASH =
        keccak256(
            "Lend(uint64 id,uint64 orderType,uint64 duration,uint64 deadline,address token,uint256 amount,address depositToken,uint256 depositAmount,address interestToken,uint256 interest,address borrower)"
        );

    constructor() EIP712("openBorrow", "v1.0.0") {}

    function checkBorrow(
        address,
        address lender,
        uint256,
        BorrowRecord calldata record
    ) public view returns (bool) {
        require(
            record.lenderLimit != address(0x0) || lender != record.lenderLimit
        );
        require(record.duration < 366 days);
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    BORROW_TYPEHASH,
                    record.id,
                    record.orderType,
                    record.duration,
                    record.deadline,
                    record.token,
                    record.amount,
                    record.depositToken,
                    record.depositAmount,
                    record.interestToken,
                    record.interest,
                    record.lenderLimit
                )
            )
        );
        address account = ECDSA.recover(digest, record.sign);
        return account == record.borrower;
    }

    function checkLend(
        address,
        address borrower,
        uint256,
        LendRecord calldata record
    ) public view returns (bool) {
        require(
            record.borrowerLimit != address(0x0) ||
                borrower != record.borrowerLimit
        );
        require(record.duration < 366 days);
        bytes32 digest = _hashTypedDataV4(
            keccak256(
                abi.encode(
                    LEND_TYPEHASH,
                    record.id,
                    record.orderType,
                    record.duration,
                    record.deadline,
                    record.token,
                    record.amount,
                    record.depositToken,
                    record.depositAmount,
                    record.interestToken,
                    record.interest,
                    record.borrowerLimit
                )
            )
        );
        address account = ECDSA.recover(digest, record.sign);
        return account == record.lender;
    }

    function withdrawalCb(
        address,
        uint256,
        OrderRecord calldata
    ) public pure returns (bool) {
        return true;
    }

    function liquidateCb(
        address,
        uint256,
        OrderRecord calldata record
    ) public view returns (bool) {
        return (block.timestamp >= record.expiration);
    }
}
