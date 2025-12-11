// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

contract SimpleVault {
    uint256 private _status;
    bool private _paused;
    address public immutable owner;

    event Paused(address indexed by);
    event Unpaused(address indexed by);

    modifier nonReentrant() {
        require(_status != 2, "reentrancy");
        _status = 2;
        _;
        _status = 1;
    }

    modifier onlyOwner() {
        require(msg.sender == owner, "not owner");
        _;
    }

    modifier whenNotPaused() {
        require(!_paused, "paused");
        _;
    }

    mapping(address => uint256) private _balances;
    uint256 public totalDeposits;

    event Deposit(address indexed user, uint256 amount);
    event Withdraw(address indexed user, uint256 amount);

    constructor() {
        owner = msg.sender;
        _status = 1;
        _paused = false;
    }

    function pause() external onlyOwner {
        _paused = true;
        emit Paused(msg.sender);
    }

    function unpause() external onlyOwner {
        _paused = false;
        emit Unpaused(msg.sender);
    }

    function paused() external view returns (bool) {
        return _paused;
    }

    function deposit() public payable whenNotPaused {
        require(msg.value > 0, "zero value");
        _balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    receive() external payable {
        require(!_paused, "paused");
        require(msg.value > 0, "zero value");
        _balances[msg.sender] += msg.value;
        totalDeposits += msg.value;
        emit Deposit(msg.sender, msg.value);
    }

    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "zero amount");
        uint256 bal = _balances[msg.sender];
        require(bal >= amount, "insufficient balance");
        _balances[msg.sender] = bal - amount;
        totalDeposits -= amount;

        (bool ok, ) = msg.sender.call{value: amount}("");
        require(ok, "transfer failed");

        emit Withdraw(msg.sender, amount);
    }

    function balanceOf(address user) external view returns (uint256) {
        return _balances[user];
    }
}
