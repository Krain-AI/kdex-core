### **KDEX V2 Core: Technical Specifications**

This document outlines the required modifications and new components for the KDEX V2 system, a fork of Uniswap V2.

**1.0 Fee Architecture**

This section defines all fees applied during a `swap` operation or subsequent automation.

* **1.1. LP Fee `[MODIFIED]`**  
  * **Description:** The standard fee paid to liquidity providers.  
  * **Specification:** The fee is set to **36 basis points (0.36%)**.  
* **1.2. Protocol Fee `[UNCHANGED]`**  
  * **Description:** The standard, governance-switchable fee mechanism inherent to Uniswap V2. If active, this fee is a fraction of the LP Fee.  
  * **Specification:** This system remains unchanged.  
* **1.3. ILP (Infinite Liquidity Pool) Fee `[NEW]`**  
  * **Description:** A fee collected on swaps to fund automated, protocol-owned liquidity.  
  * **Specification:**  
    * **Per-Pair Toggle:** Each pair has an independent boolean flag (`isIlpFeeActive`) that enables or disables the fee for that pair only. This is controlled by the `pairILPFeeAdmin`.  
    * **Directional Rates:** Each pair has two fee rate variables, defined by the input token's position in the pair (`token0` or `token1`):  
      * `ilpFeeRateToken0In`: The fee rate when `token0` is the input token.  
      * `ilpFeeRateToken1In`: The fee rate when `token1` is the input token.  
    * **Configuration:** Rates are configurable from 0 to 200 basis points (0.0% to 2.00%).  
    * **Execution:** If enabled for the specific pair, the fee is taken from the swap's input token and deposited into the `ILPManager` contract.  
* **1.4. Infinite Liquidity Pool Processing Fee `[NEW]`**  
  * **Description:** A fee taken by the protocol from the total amount of ILP fees being processed into liquidity.  
  * **Specification:** A configurable percentage rate set by the `ilpManagerAdmin`. This fee is transferred to the `ilpTreasuryAddress` during the `provideLiquidityForPair` execution.

**2.0 Smart Contract Architecture & Implementation**

This section details the directory structure and specific contracts required. All new and modified contracts will reside in the `/contracts` directory.

* **2.1. Contract: `UniswapV2Factory.sol` `[MODIFIED]`**  
  * **[NEW] State Variables:**  
    1. `address public ilpManagerAddress;` - The single, authoritative address for the `ILPManager.sol` contract.  
    2. `mapping(address => address) public pairILPFeeAdmins;` - Maps a pair address to its designated fee admin.  
    3. `mapping(address => address) public pairILPFeeManagers;` - Maps a pair address to its designated fee manager.  
  * **[NEW] Admin Functions:**  
    1. `setIlpManagerAddress(address _newManager)` - Callable only by the factory `owner`.  
    2. `setPairILPFeeAdmin(address _pair, address _admin)` - Callable only by the factory `owner`.  
    3. `setPairILPFeeManager(address _pair, address _manager)` - Callable only by the factory `owner`.  
* **2.2. Contract: `UniswapV2Pair.sol` `[MODIFIED]`**  
  * **[NEW] State Variables:**  
    1. `bool public isIlpFeeActive = false;` - Local flag to enable/disable ILP fees for this pair.  
    2. `uint public ilpFeeRateToken0In;`  
    3. `uint public ilpFeeRateToken1In;`  
  * **[NEW] Admin Functions:**  
    1. `toggleIlpFeeStatus(bool _status)` - Callable only by the address stored in `IUniswapV2Factory(factory).pairILPFeeAdmins(address(this))`.  
    2. `setIlpFeeRates(uint _token0InRate, uint _token1InRate)` - Callable only by the address stored in `IUniswapV2Factory(factory).pairILPFeeManagers(address(this))`. Must validate that rates are within the allowed range.  
  * **`_swap()` function:** Modified to perform fee calculations in a strict order:  
    1. Check the local `isIlpFeeActive` flag. If true, calculate the appropriate ILP Fee (`ilpFeeRateToken0In` or `ilpFeeRateToken1In`) based on the input token.  
    2. Deduct the ILP Fee amount from the input amount and transfer it to the `ILPManager` contract by calling `depositFee(...)`.  
    3. The **remaining** input amount is then used for the rest of the swap logic. The 0.36% LP Fee is calculated on this remaining amount. The standard Protocol Fee (if active) is subsequently taken from the LP Fee.  
  * **Constants:** The LP fee constant is updated to 0.36%.  
* **2.3. Contract: `ILPManager.sol` `[NEW]`**  
  * **Description:** The central hub for all automation logic. It accumulates fees and executes the liquidity provision process.  
  * **Functionality:**  
    1. **Fee Accounting:** Maintains the `mapping(address pair => mapping(address token => uint256 amount)) public accumulatedILPFees;` ledger.  
    2. **`depositFee(address token, uint256 amount) external`:** Receives fees from Pair contracts and updates the ledger.  
    3. **`performUpkeep(...) external`:** Checks if `TotalAccumulatedValue >= thresholdValue`. If true, it processes the accumulated fees into liquidity for the relevant pair. This function is callable only by an authorized `upkeepCaller` address.  
* **2.4. Off-Chain Automation `[NEW]`**  
  * **Integration:** External Automation (e.g., Gelato, Chainlink)  
  * **Implementation:** An external automation service is configured to call `ILPManager.performUpkeep()` at regular intervals. To mitigate front-running and other MEV-related risks, the keeper should submit transactions via a private relay (e.g., Flashbots).  
  * **Gas Payment Model:** Transaction gas fees are paid by the automation caller. The protocol maintains any required gas fee balance with the automation provider separately.

**3.0 Role and Address Management**

This section defines where administrative roles are managed and which contract they control.

* **3.1. Managed in `UniswapV2Factory.sol`:**  
  * **`owner`:** Standard Uniswap V2 owner.  
    * **Permissions:** Can assign the `pairILPFeeManager` and `pairILPFeeAdmin` for any pair. Can set the `ilpManagerAddress`.  
  * **`ilpManagerAddress` `[NEW]`:**  
    * **Description:** A state variable (`address public ilpManagerAddress`) that holds the address of the `ILPManager.sol` contract.  
    * **Management:** The address is set and updated by the `owner`.  
* **3.2. Managed in `UniswapV2Pair.sol` (Controlled via Factory):**  
  * **`pairILPFeeAdmin` `[NEW]`:**  
    * **Description:** An address, stored in the Factory's `pairILPFeeAdmins` mapping, with permission to enable or disable ILP fees on a *specific* pair via `toggleIlpFeeStatus`.  
    * **Management:** Assigned on a per-pair basis by the Factory `owner`.  
  * **`pairILPFeeManager` `[NEW]`:**  
    * **Description:** An address, stored in the Factory's `pairILPFeeManagers` mapping, with permission to set the ILP fee rates (`ilpFeeRateToken0In`, `ilpFeeRateToken1In`) on a *specific* pair.  
    * **Management:** Assigned on a per-pair basis by the Factory `owner`.  
* **3.3. Managed in `ILPManager.sol`:**  
  * **`ilpManagerOwner` `[NEW]`:** The deployer/owner of the `ILPManager` contract.  
    * **Permissions:** Can assign the `ilpManagerAdmin` role.  
  * **`ilpManagerAdmin` `[NEW]`:**  
    * **Permissions:** Can set the `ilpTreasuryAddress`, the automation `thresholdValue`, the `processingFeeRate`, and the `upkeepCaller` address.  
  * **`upkeepCaller` `[NEW]`:**  
    * **Description:** The address authorized to call the `performUpkeep` function.  
    * **Management:** The address is set and updated by the `ilpManagerAdmin` role.  
  * **`ilpTreasuryAddress` `[NEW]`:**  
    * **Description:** A state variable (`address public ilpTreasuryAddress`) within the `ILPManager.sol` contract. It is the final destination wallet for both the **Infinite Liquidity Pool Processing Fees** and the protocol-owned **LP tokens**.  
    * **Management:** The address is set and updated by the `ilpManagerAdmin` role.

  