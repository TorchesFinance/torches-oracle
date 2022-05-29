// SPDX-License-Identifier: MIT

pragma solidity ^0.7.0;

interface IMojitoOracle {
  function consult(
    address tokenIn,
    uint256 amountIn,
    address tokenOut
  ) external view returns (uint256 amountOut);
}
