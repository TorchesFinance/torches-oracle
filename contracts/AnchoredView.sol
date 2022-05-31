// SPDX-License-Identifier: MIT
pragma solidity ^0.7.0;

import "./interfaces/IMojitoOracle.sol";
import "./interfaces/IERC2362.sol";
import "./OwnerIsCreator.sol";
import "./SafeMath.sol";

contract AnchoredView is OwnerIsCreator {
  using SafeMath for uint256;

  bool public validateAnswerEnabled;

  uint256 public immutable answerBaseUint;

  struct MojitoConfig {
    bool available;
    address tokenA;
    address tokenB;
    address tokenC;
    uint256 tokenABaseUnit;
    uint256 tokenCBaseUnit;
  }

  MojitoConfig internal mojitoConfig;

  /// @notice emitted when mojito config are set
  event MojitoConfigSet(
    bool available,
    address tokenA,
    address tokenB,
    address tokenC,
    uint256 tokenABaseUnit,
    uint256 tokenCBaseUnit
  );

  /// @notice emitted when mojito config are set
  struct WitnetConfig {
    bool available;
    bytes32 pairA;
    bytes32 pairB;
    uint256 pairABaseUint;
    uint256 pairBBaseUint;
  }

  WitnetConfig internal witnetConfig;

  /// @notice emitted when witnet config are set
  event WitnetConfigSet(bool available, bytes32 pairA, bytes32 pairB, uint256 pairABaseUint, uint256 pairBBaseUint);

  // The price oracle
  IMojitoOracle public mojitoOracle;
  IERC2362 public witnetOracle;

  /**
   * @notice emitted when a new mojito oracle contract is set
   * @param old the address prior to the current setting
   * @param current the address of the new mojito oracle contract
   */
  event MojitoOracleSet(IMojitoOracle old, IMojitoOracle current);
  /**
   * @notice emitted when a new witnet oracle contract is set
   * @param old the address prior to the current setting
   * @param current the address of the new witnet oracle contract
   */
  event WitnetOracleSet(IERC2362 old, IERC2362 current);

  event ValidateAnswerEnabled();
  event ValidateAnswerDisabled();

  constructor(
    address _mojitoOracle,
    address _witnetOracle,
    uint256 _answerBaseUint,
    bool _validateAnswerEnabled
  ) {
    _setMojitoOracle(IMojitoOracle(_mojitoOracle));
    _setWitnetOracle(IERC2362(_witnetOracle));

    answerBaseUint = _answerBaseUint;
    validateAnswerEnabled = _validateAnswerEnabled;
  }

  /**
   * @notice sets the mojito twap oracle
   * @param _oracle the address of the mojito oracle contract
   */
  function setMojitoOracle(IMojitoOracle _oracle) external onlyOwner {
    _setMojitoOracle(_oracle);
  }

  function _setMojitoOracle(IMojitoOracle _oracle) internal {
    IMojitoOracle oldOracle = mojitoOracle;
    if (_oracle != oldOracle) {
      mojitoOracle = _oracle;
      emit MojitoOracleSet(oldOracle, _oracle);
    }
  }

  /**
   * @notice sets the witnet oracle
   * @param _oracle the address of the witnet oracle contract
   */
  function setWitnetOracle(IERC2362 _oracle) external onlyOwner {
    _setWitnetOracle(_oracle);
  }

  function _setWitnetOracle(IERC2362 _oracle) internal {
    IERC2362 oldOracle = witnetOracle;
    if (_oracle != oldOracle) {
      witnetOracle = _oracle;
      emit WitnetOracleSet(oldOracle, _oracle);
    }
  }

  function _getMojitoPriceInternal() internal view returns (uint256) {
    if (mojitoConfig.available) {
      if (mojitoConfig.tokenB == address(0)) {
        uint256 twapPrice = mojitoOracle.consult(mojitoConfig.tokenA, mojitoConfig.tokenABaseUnit, mojitoConfig.tokenC);
        return twapPrice.mul(answerBaseUint).div(mojitoConfig.tokenCBaseUnit);
      } else {
        uint256 tokenABAmount = mojitoOracle.consult(
          mojitoConfig.tokenA,
          mojitoConfig.tokenABaseUnit,
          mojitoConfig.tokenB
        );
        uint256 twapPrice = mojitoOracle.consult(mojitoConfig.tokenB, tokenABAmount, mojitoConfig.tokenC);
        return twapPrice.mul(answerBaseUint).div(mojitoConfig.tokenCBaseUnit);
      }
    }
    return 0;
  }

  function _getWitnetPriceInternal() internal view returns (uint256) {
    if (witnetConfig.available) {
      int256 pairAPrice;
      (pairAPrice, , ) = witnetOracle.valueFor(witnetConfig.pairA);
      if (witnetConfig.pairB == "") {
        return uint256(pairAPrice).mul(answerBaseUint).div(witnetConfig.pairABaseUint);
      } else {
        int256 pairBPrice;
        (pairBPrice, , ) = witnetOracle.valueFor(witnetConfig.pairB);
        return
          uint256(pairAPrice).mul(uint256(pairBPrice)).mul(answerBaseUint).div(witnetConfig.pairABaseUint).div(
            witnetConfig.pairBBaseUint
          );
      }
    }
    return 0;
  }

  /**
   * @notice sets mojito parameters
   * @param _available is the price available
   * @param _tokenABaseUnit the number of wei in 1 tokenA
   * @param _tokenA underlying asset contract address
   * @param _tokenB address of token bridge you wish to use, optimal exchange rate when used
   * @param _tokenC underlying asset contract address
   * @param _tokenCBaseUnit the number of wei in 1 tokenC
   * @dev must be called by owner
   */
  function setMojitoConfig(
    bool _available,
    address _tokenA,
    address _tokenB,
    address _tokenC,
    uint256 _tokenABaseUnit,
    uint256 _tokenCBaseUnit
  ) external onlyOwner {
    mojitoConfig.available = _available;
    mojitoConfig.tokenA = _tokenA;
    mojitoConfig.tokenB = _tokenB;
    mojitoConfig.tokenC = _tokenC;
    mojitoConfig.tokenABaseUnit = _tokenABaseUnit;
    mojitoConfig.tokenCBaseUnit = _tokenCBaseUnit;
    emit MojitoConfigSet(_available, _tokenA, _tokenB, _tokenC, _tokenABaseUnit, _tokenCBaseUnit);
  }

  /*
   * @notice gets the mojito config
   * @return The config object
   */
  function getMojitoConfig()
    external
    view
    returns (
      bool available,
      address tokenA,
      address tokenB,
      address tokenC,
      uint256 tokenABaseUnit,
      uint256 tokenCBaseUnit
    )
  {
    return (
      mojitoConfig.available,
      mojitoConfig.tokenA,
      mojitoConfig.tokenB,
      mojitoConfig.tokenC,
      mojitoConfig.tokenABaseUnit,
      mojitoConfig.tokenCBaseUnit
    );
  }

  /**
   * @notice sets winet parameters
   * @param _available is the price available
   * @param _pairA pairA erc2362 asset id
   * @param _pairB pair of token bridge you wish to use, optimal exchange rate when used
   * @param _pairABaseUint pairA decimals
   * @param _pairBBaseUint pairB decimals
   * @dev must be called by owner
   */
  function setWitnetConfig(
    bool _available,
    bytes32 _pairA,
    bytes32 _pairB,
    uint256 _pairABaseUint,
    uint256 _pairBBaseUint
  ) external onlyOwner {
    witnetConfig.available = _available;
    witnetConfig.pairA = _pairA;
    witnetConfig.pairB = _pairB;
    witnetConfig.pairABaseUint = _pairABaseUint;
    witnetConfig.pairBBaseUint = _pairBBaseUint;
    emit WitnetConfigSet(_available, _pairA, _pairB, _pairABaseUint, _pairBBaseUint);
  }

  /*
   * @notice gets the witnet config
   * @return The config object
   */
  function getWitnetConfig()
    external
    view
    returns (
      bool available,
      bytes32 pairA,
      bytes32 pairB,
      uint256 pairABaseUint,
      uint256 pairBBaseUint
    )
  {
    return (
      witnetConfig.available,
      witnetConfig.pairA,
      witnetConfig.pairB,
      witnetConfig.pairABaseUint,
      witnetConfig.pairBBaseUint
    );
  }

  /**
   * @notice Get the mojito oracle twap for a underlying
   * @return Price denominated in USD, with 8 decimals
   */
  function getMojitoPrice() external view returns (uint256) {
    return _getMojitoPriceInternal();
  }

  /**
   * @notice Get the witnet oracle price for a underlying
   * @return Price denominated in USD, with 8 decimals
   */
  function getWitnetPrice() external view returns (uint256) {
    return _getWitnetPriceInternal();
  }

  /**
   * @notice makes the answer validate enforced
   */
  function enableAnswerValidate() external onlyOwner {
    if (!validateAnswerEnabled) {
      validateAnswerEnabled = true;

      emit ValidateAnswerEnabled();
    }
  }

  /**
   * @notice makes the answer validate unenforced
   */
  function disableAnswerValidate() external onlyOwner {
    if (validateAnswerEnabled) {
      validateAnswerEnabled = false;

      emit ValidateAnswerDisabled();
    }
  }
}
