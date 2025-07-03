pragma solidity =0.5.16;

import './interfaces/IUniswapV2Factory.sol';
import './interfaces/IUniswapV2Pair.sol';
import './interfaces/IERC20.sol';
import './libraries/SafeMath.sol';

contract ILPManager {
    using SafeMath for uint;

    event FeeDeposited(address indexed token, uint256 amount);

    IUniswapV2Factory public factory;

    mapping(address => mapping(address => uint256)) public accumulatedILPFees;
    address public ilpManagerOwner;
    address public ilpManagerAdmin;
    address public upkeepCaller;
    address public ilpTreasuryAddress;
    uint public thresholdValue;
    uint public processingFeeRate;

    modifier onlyIlpManagerOwner() {
        require(msg.sender == ilpManagerOwner, "ILPManager: FORBIDDEN");
        _;
    }

    modifier onlyIlpManagerAdmin() {
        require(msg.sender == ilpManagerAdmin, "ILPManager: FORBIDDEN");
        _;
    }

    modifier onlyUpkeepCaller() {
        require(msg.sender == upkeepCaller, "ILPManager: FORBIDDEN");
        _;
    }

    constructor(address _factory) public {
        factory = IUniswapV2Factory(_factory);
        ilpManagerOwner = msg.sender;
    }

    function setIlpManagerAdmin(address _newAdmin) external onlyIlpManagerOwner {
        ilpManagerAdmin = _newAdmin;
    }

    function setIlpTreasuryAddress(address _newAddress) external onlyIlpManagerAdmin {
        ilpTreasuryAddress = _newAddress;
    }

    function setThresholdValue(uint _newThreshold) external onlyIlpManagerAdmin {
        thresholdValue = _newThreshold;
    }

    function setProcessingFeeRate(uint _newRate) external onlyIlpManagerAdmin {
        processingFeeRate = _newRate;
    }

    function setUpkeepCaller(address _newCaller) external onlyIlpManagerAdmin {
        upkeepCaller = _newCaller;
    }

    function depositFee(address token, uint256 amount) external {
        address pair = msg.sender;
        
        // Basic check to ensure it's a contract
        uint32 size;
        assembly {
            size := extcodesize(pair)
        }
        require(size > 0, "ILPManager: SENDER_NOT_PAIR");
        
        // Get token addresses from the pair contract
        address token0 = IUniswapV2Pair(pair).token0();
        address token1 = IUniswapV2Pair(pair).token1();
        
        // Verify the pair exists in the factory
        require(factory.getPair(token0, token1) == pair, "ILPManager: SENDER_NOT_PAIR");
        
        accumulatedILPFees[pair][token] = accumulatedILPFees[pair][token].add(amount);
        emit FeeDeposited(token, amount);
    }

    function performUpkeep(bytes calldata data) external onlyUpkeepCaller {
        address pair = abi.decode(data, (address));
        
        IUniswapV2Pair pairContract = IUniswapV2Pair(pair);
        address token0 = pairContract.token0();
        address token1 = pairContract.token1();

        uint fee0 = accumulatedILPFees[pair][token0];
        uint fee1 = accumulatedILPFees[pair][token1];

        // if we do not have both fee tokens, we cannot proceed to rebalance
        if (fee0 == 0 || fee1 == 0) {
            return;
        }

        (uint reserve0, uint reserve1, ) = pairContract.getReserves();

        // cannot perform rebalance if a reserve is 0
        if (reserve0 == 0 || reserve1 == 0) {
            return;
        }
        
        // check if accumulated fees exceed threshold, value is denominated in token0
        if (fee0.add(fee1.mul(reserve0) / reserve1) < thresholdValue) {
            return;
        }

        (fee0, fee1) = _rebalance(pairContract, token0, token1, fee0, fee1, reserve0, reserve1);

        _provideLiquidityAndPayFees(pairContract, token0, token1, fee0, fee1);

        accumulatedILPFees[address(pairContract)][token0] = 0;
        accumulatedILPFees[address(pairContract)][token1] = 0;
    }

    function _rebalance(IUniswapV2Pair pair, address token0, address token1, uint256 fee0, uint256 fee1, uint256 reserve0, uint256 reserve1) 
        internal returns (uint256 newFee0, uint256 newFee1)
    {
        if (fee0.mul(reserve1) > fee1.mul(reserve0)) {
            // fee0 is in excess
            uint amount0Optimal = fee1.mul(reserve0) / reserve1;
            uint amountToSwap = fee0.sub(amount0Optimal);

            uint amountOut = getAmountOut(amountToSwap, reserve0, reserve1);
            IERC20(token0).approve(address(pair), amountToSwap);
            pair.swap(0, amountOut, address(this), new bytes(0));
            newFee0 = amount0Optimal;
            newFee1 = fee1.add(amountOut);
        } else if (fee1.mul(reserve0) > fee0.mul(reserve1)) {
            // fee1 is in excess
            uint amount1Optimal = fee0.mul(reserve1) / reserve0;
            uint amountToSwap = fee1.sub(amount1Optimal);

            uint amountOut = getAmountOut(amountToSwap, reserve1, reserve0);
            IERC20(token1).approve(address(pair), amountToSwap);
            pair.swap(amountOut, 0, address(this), new bytes(0));
            newFee1 = amount1Optimal;
            newFee0 = fee0.add(amountOut);
        } else {
            newFee0 = fee0;
            newFee1 = fee1;
        }
    }

    function _provideLiquidityAndPayFees(IUniswapV2Pair pair, address token0, address token1, uint256 fee0, uint256 fee1) internal {
        uint processingFee0 = fee0.mul(processingFeeRate) / 10000;
        uint processingFee1 = fee1.mul(processingFeeRate) / 10000;
        
        uint balance0 = fee0.sub(processingFee0);
        uint balance1 = fee1.sub(processingFee1);

        if (processingFee0 > 0) IERC20(token0).transfer(ilpTreasuryAddress, processingFee0);
        if (processingFee1 > 0) IERC20(token1).transfer(ilpTreasuryAddress, processingFee1);

        if (balance0 > 0 && balance1 > 0) {
            IERC20(token0).transfer(address(pair), balance0);
            IERC20(token1).transfer(address(pair), balance1);
            pair.mint(ilpTreasuryAddress);
        }
    }

    function getAmountOut(uint amountIn, uint reserveIn, uint reserveOut) internal pure returns (uint amountOut) {
        require(amountIn > 0, 'UniswapV2Library: INSUFFICIENT_INPUT_AMOUNT');
        require(reserveIn > 0 && reserveOut > 0, 'UniswapV2Library: INSUFFICIENT_LIQUIDITY');
        uint amountInWithFee = amountIn.mul(9964);
        uint numerator = amountInWithFee.mul(reserveOut);
        uint denominator = reserveIn.mul(10000).add(amountInWithFee);
        amountOut = numerator / denominator;
    }
} 