# Torches-Oracle

- install

```
yarn install
```

- compile

```
yarn compile
```

- deploy

```
yarn kt:deploy
```

- flatten

```
mkdir flat
npx hardhat flatten <path-to-contract> >> <flat-contract-name>.sol
npx hardhat flatten contracts/EACAggregatorProxy.sol >> flat/EACAggregatorProxy.sol
npx hardhat flatten contracts/AccessControlledOffchainAggregator.sol >> flat/AccessControlledOffchainAggregator.sol
npx hardhat flatten contracts/mojito/MojitoOracle.sol >> flat/MojitoOracle.sol
npx hardhat flatten contracts/mojito/MojitoOracleProxy.sol >> flat/MojitoOracleProxy.sol
```