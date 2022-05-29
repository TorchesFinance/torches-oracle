// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

import "../interfaces/IMojitoOracle.sol";

/**
 * @title MockMojitoOracle
 */
contract MockMojitoOracle is IMojitoOracle {
  uint256 public s_amountOut;

  function updateAmountOut(uint256 amountOut) external {
    s_amountOut = amountOut;
  }

  function consult(
    address tokenIn,
    uint256 amountIn,
    address tokenOut
  ) external view override returns (uint256 amountOut) {
    require(tokenIn != address(0));
    require(tokenOut != address(0));
    require(amountIn > 0);
    return s_amountOut;
  }
}
