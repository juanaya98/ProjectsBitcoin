// SPDX-License-Identifier: MIT
pragma solidity ^0.8.28;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/utils/Pausable.sol";

contract SimpleVault is Ownable, ReentrancyGuard, Pausable {
    // Balance interno de cada usuario
    mapping(address => uint256) private _balances;

    // Tiempo del último depósito de cada usuario
    mapping(address => uint256) public lastDepositTime;

    // Periodo de bloqueo en segundos (por ejemplo, 60s)
    uint256 public lockPeriod = 60;

    event Deposited(address indexed user, uint256 amount);
    event Withdrawn(address indexed user, uint256 amount);
    event LockPeriodUpdated(uint256 oldLockPeriod, uint256 newLockPeriod);

    constructor() Ownable(msg.sender) {}

    // Consultar balance interno
    function balanceOf(address user) external view returns (uint256) {
        return _balances[user];
    }

    // Actualizar el lock period (solo owner)
    function setLockPeriod(uint256 newLockPeriod) external onlyOwner {
        emit LockPeriodUpdated(lockPeriod, newLockPeriod);
        lockPeriod = newLockPeriod;
    }

    // Depósito de ETH a la bóveda
    function deposit() external payable nonReentrant whenNotPaused {
        require(msg.value > 0, "Deposit amount must be > 0");

        _balances[msg.sender] += msg.value;
        lastDepositTime[msg.sender] = block.timestamp;

        emit Deposited(msg.sender, msg.value);
    }

    // Retiro de ETH desde la bóveda
    function withdraw(uint256 amount) external nonReentrant whenNotPaused {
        require(amount > 0, "Withdraw amount must be > 0");
        require(_balances[msg.sender] >= amount, "Insufficient vault balance");

        // Nueva condicion de bloqueo
        require(
            block.timestamp > lastDepositTime[msg.sender] + lockPeriod,
            "Funds are still locked"
        );

        _balances[msg.sender] -= amount;

        (bool success, ) = msg.sender.call{value: amount}("");
        require(success, "ETH transfer failed");

        emit Withdrawn(msg.sender, amount);
    }

    // Funciones administrativas

    function pause() external onlyOwner {
        _pause();
    }

    function unpause() external onlyOwner {
        _unpause();
    }
}
