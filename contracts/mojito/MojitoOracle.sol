// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;
pragma abicoder v2;

import "./../ConfirmedOwner.sol";
import "./../interfaces/IMojitoOracle.sol";
import "./MojitoLib.sol";

contract MojitoOracle is IMojitoOracle, ConfirmedOwner {
  using FixedPoint for *;
  using SafeMath for uint256;
  using Strings for uint256;

  struct Observation {
    uint256 timestamp;
    uint256 price0Cumulative;
    uint256 price1Cumulative;
  }

  struct MojitoConfig {
    uint256 decimals;
    string base;
    string quote;
    bytes32 pairId; // the keccak256 hash of the currency pair caption
    address tokenA;
    address tokenB;
    address tokenC;
    uint256 tokenABaseUnit;
    uint256 tokenCBaseUnit;
  }

  // the number of observations stored for each pair
  uint8 public constant GRANULARITY = 2;
  /// @notice A common scaling factor to maintain precision
  uint256 public constant EXP_SCALE = 1e18;
  uint256 public constant PERIOD = 10 minutes;
  address public immutable factory;

  // mapping from pair address to a list of price observations of that pair
  mapping(address => Observation[]) public pairObservations;
  // the latest index of observations
  mapping(address => uint8) internal latestIndex;
  mapping(bytes4 => MojitoConfig) s_mojitoConfig;

  /// @notice emitted when mojito config are set
  event MojitoConfigSet(
    bytes32 pairId,
    uint256 decimals,
    string base,
    string quote,
    address tokenA,
    address tokenB,
    address tokenC,
    uint256 tokenABaseUnit,
    uint256 tokenCBaseUnit
  );

  /**
   * @notice indicates that a new report was transmitted
   * @param pair the pair of tokenA and tokenB
   * @param price0Cumulative cumulative price of token0
   * @param price1Cumulative cumulative price of token1
   * @param observationsTimestamp when were observations
   */
  event NewObservation(
    address indexed pair,
    uint256 price0Cumulative,
    uint256 price1Cumulative,
    uint256 observationsTimestamp
  );

  constructor(address factory_) ConfirmedOwner(msg.sender) {
    factory = factory_;
  }

  function update(address tokenA, address tokenB) external {
    address pair = IMojitoFactory(factory).getPair(tokenA, tokenB);

    // populate the array with empty observations (first call only)
    for (uint256 i = pairObservations[pair].length; i < GRANULARITY; i++) {
      pairObservations[pair].push();
    }

    uint256 s_index = latestIndex[pair];
    Observation memory s_observation = pairObservations[pair][s_index];
    uint256 timeElapsed = block.timestamp - s_observation.timestamp;
    require(timeElapsed >= PERIOD, "Period not elapsed");

    uint8 currentIndex = uint8((s_index + 1) % GRANULARITY);
    Observation storage observation = pairObservations[pair][currentIndex];
    (uint256 price0Cumulative, uint256 price1Cumulative, ) = MojitoOracleLibrary.currentCumulativePrices(pair);
    observation.timestamp = block.timestamp;
    observation.price0Cumulative = price0Cumulative;
    observation.price1Cumulative = price1Cumulative;
    latestIndex[pair] = currentIndex;

    emit NewObservation(pair, price0Cumulative, price1Cumulative, block.timestamp);
  }

  function computeAmountOut(
    uint256 priceCumulativeStart,
    uint256 priceCumulativeEnd,
    uint256 timeElapsed,
    uint256 amountIn
  ) private pure returns (uint256 amountOut) {
    // overflow is desired.
    FixedPoint.uq112x112 memory priceAverage = FixedPoint.uq112x112(
      uint224((priceCumulativeEnd - priceCumulativeStart) / timeElapsed)
    );
    amountOut = priceAverage.mul(amountIn).decode144();
  }

  function consult(
    address tokenIn,
    uint256 amountIn,
    address tokenOut
  ) external view returns (uint256 amountOut) {
    return _consult(tokenIn, amountIn, tokenOut);
  }

  function _consult(
    address tokenIn,
    uint256 amountIn,
    address tokenOut
  ) internal view returns (uint256 amountOut) {
    address pair = IMojitoFactory(factory).getPair(tokenIn, tokenOut);
    uint256 s_index = latestIndex[pair];
    uint256 preIndex = uint8((s_index + 1) % GRANULARITY);
    Observation storage observation = pairObservations[pair][preIndex];
    uint256 timeElapsed = block.timestamp - observation.timestamp;

    // check if another observation has a value (call after first update only)
    require(observation.timestamp != 0, "Missing historical observation");

    (uint256 price0Cumulative, uint256 price1Cumulative, ) = MojitoOracleLibrary.currentCumulativePrices(pair);
    (address token0, ) = MojitoLibrary.sortTokens(tokenIn, tokenOut);

    if (token0 == tokenIn) {
      return computeAmountOut(observation.price0Cumulative, price0Cumulative, timeElapsed, amountIn);
    } else {
      return computeAmountOut(observation.price1Cumulative, price1Cumulative, timeElapsed, amountIn);
    }
  }

  /**
   * @notice Get price from mojito oracle twap
   * @return Price denominated in USD or OtherToken, with 18 decimals
   */
  function getMojitoTwap(bytes32 pairId) external view override returns (uint256) {
    return _getPriceInternal(pairId);
  }

  function _getPriceInternal(bytes32 pairId) internal view returns (uint256) {
    MojitoConfig memory mojitoConfig = s_mojitoConfig[bytes4(pairId)];
    require(address(mojitoConfig.tokenA) != address(0), "Unsupported currency pair");
    if (mojitoConfig.tokenB == address(0)) {
      uint256 twapPrice = _consult(mojitoConfig.tokenA, mojitoConfig.tokenABaseUnit, mojitoConfig.tokenC);
      return twapPrice.mul(EXP_SCALE).div(mojitoConfig.tokenCBaseUnit);
    } else {
      uint256 tokenABAmount = _consult(mojitoConfig.tokenA, mojitoConfig.tokenABaseUnit, mojitoConfig.tokenB);
      uint256 twapPrice = _consult(mojitoConfig.tokenB, tokenABAmount, mojitoConfig.tokenC);
      return twapPrice.mul(EXP_SCALE).div(mojitoConfig.tokenCBaseUnit);
    }
  }

  /*
   * @notice gets the mojito config
   * @return The config object
   */
  function getMojitoConfig(bytes32 _pairId) external view returns (MojitoConfig memory) {
    return (s_mojitoConfig[bytes4(_pairId)]);
  }

  /**
   * @notice sets mojito parameters
   * @param _decimals the number of decimals
   * @param _base first asset denomination (e.g. BTC)
   * @param _quote second asset denomination (e.g. USDT)
   * @param _tokenA underlying asset contract address
   * @param _tokenB underlying asset contract address, optimal exchange rate when used
   * @param _tokenC underlying asset contract address
   * @param _tokenABaseUnit the number of wei in 1 tokenA
   * @param _tokenCBaseUnit the number of wei in 1 tokenC
   * @dev must be called by owner
   */
  function setMojitoConfig(
    uint256 _decimals,
    string calldata _base,
    string calldata _quote,
    address _tokenA,
    address _tokenB,
    address _tokenC,
    uint256 _tokenABaseUnit,
    uint256 _tokenCBaseUnit
  ) external onlyOwner {
    bytes memory _caption = abi.encodePacked("Price-", bytes(_base), "/", bytes(_quote), "-", _decimals.toString());
    bytes32 _pairId = keccak256(_caption);
    MojitoConfig storage mojitoConfig = s_mojitoConfig[bytes4(_pairId)];
    mojitoConfig.decimals = _decimals;
    mojitoConfig.base = _base;
    mojitoConfig.quote = _quote;
    mojitoConfig.pairId = _pairId;
    mojitoConfig.tokenA = _tokenA;
    mojitoConfig.tokenB = _tokenB;
    mojitoConfig.tokenC = _tokenC;
    mojitoConfig.tokenABaseUnit = _tokenABaseUnit;
    mojitoConfig.tokenCBaseUnit = _tokenCBaseUnit;
    emit MojitoConfigSet(
      _pairId,
      _decimals,
      _base,
      _quote,
      _tokenA,
      _tokenB,
      _tokenC,
      mojitoConfig.tokenABaseUnit,
      _tokenCBaseUnit
    );
  }

  /// @notice Returns human-readable caption of the ERC2362-based currency pair identifier, if known.
  function lookupERC2362ID(bytes32 _erc2362id) external view override returns (string memory _caption) {
    MojitoConfig memory _pair = s_mojitoConfig[bytes4(_erc2362id)];
    if (bytes(_pair.base).length > 0 && bytes(_pair.quote).length > 0) {
      _caption = string(abi.encodePacked("Price-", _pair.base, "/", _pair.quote, "-", _pair.decimals.toString()));
    }
  }

  /// @notice Helper pure function: returns hash of the provided ERC2362-compliant currency pair caption (aka ID).
  function currencyPairId(string memory _caption) external pure override returns (bytes32) {
    return keccak256(bytes(_caption));
  }
}
