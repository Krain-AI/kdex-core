pragma solidity >=0.5.0;

interface IILPManager {
    event FeeDeposited(address indexed token, uint256 amount);
    
    function depositFee(address token, uint256 amount) external;
} 