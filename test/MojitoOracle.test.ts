import { ethers } from 'hardhat'
import { numToBytes32, publicAbi } from './test-helpers/helpers'
import { assert, expect } from 'chai'
import { BigNumber, constants, Contract, ContractFactory, Signer } from 'ethers'
import { Personas, getUsers } from './test-helpers/setup'
import { bigNumEquals, evmRevert } from './test-helpers/matchers'

let personas: Personas
let defaultAccount: Signer

let mojitoOracleFactory: ContractFactory
let mockMojitoOracleFactoryFactory: ContractFactory

before(async () => {
  const users = await getUsers()

  personas = users.personas
  defaultAccount = users.roles.defaultAccount

  mojitoOracleFactory = await ethers.getContractFactory(
    'contracts/mojito/MojitoOracle.sol:MojitoOracle',
    defaultAccount,
  )

  mockMojitoOracleFactoryFactory = await ethers.getContractFactory(
    'contracts/tests/MockMojitoFactory.sol:MockMojitoFactory',
    defaultAccount,
  )
})

describe('MojitoOracle', () => {
  let mojitoOracle: Contract
  let mockMojitoFactory: Contract

  const caption = 'Price-KCS/USDT-18'
  const decimals = 18
  const base = 'KCS'
  const quote = 'USDT'
  const tokenA = '0x75AA60668aDcbC064049a496B70caAEfa1d272d5'
  const tokenB = constants.AddressZero
  const tokenC = '0xcB9489180A08273Bb93e8162B3f2A5D7A343372F'
  const tokenABaseUnit = constants.WeiPerEther
  const tokenCBaseUnit = constants.WeiPerEther

  beforeEach(async () => {
    mockMojitoFactory = await mockMojitoOracleFactoryFactory
      .connect(defaultAccount)
      .deploy()

    mojitoOracle = await mojitoOracleFactory
      .connect(defaultAccount)
      .deploy(mockMojitoFactory.address)
  })

  it('has a limited public interface [ @skip-coverage ]', () => {
    publicAbi(mojitoOracle, [
      'consult',
      'currencyPairId',
      'factory',
      'getMojitoConfig',
      'getMojitoTwap',
      'GRANULARITY',
      'lookupERC2362ID',
      'pairObservations',
      'PERIOD',
      'setMojitoConfig',
      'update',
      'EXP_SCALE',
      // Ownable methods:
      'acceptOwnership',
      'owner',
      'transferOwnership',
    ])
  })

  describe('constructor', () => {
    it('sets the proxy phase and aggregator', async () => {
      assert.equal(mockMojitoFactory.address, await mojitoOracle.factory())
    })
  })

  describe('#setMojitoConfig', () => {
    it('when called by a owner', async () => {
      const tx = await mojitoOracle
        .connect(defaultAccount)
        .setMojitoConfig(
          decimals,
          base,
          quote,
          tokenA,
          tokenB,
          tokenC,
          tokenABaseUnit,
          tokenCBaseUnit,
        )
      await expect(tx)
        .to.emit(mojitoOracle, 'MojitoConfigSet')
        .withArgs(
          await mojitoOracle.currencyPairId(caption),
          decimals,
          base,
          quote,
          tokenA,
          tokenB,
          tokenC,
          tokenABaseUnit,
          tokenCBaseUnit,
        )
      const mojitoConfig = await mojitoOracle.getMojitoConfig(
        await mojitoOracle.currencyPairId(caption),
      )
      assert.equal('KCS', mojitoConfig.base)
      assert.equal(tokenA, mojitoConfig.tokenA)
      assert.equal(tokenC, mojitoConfig.tokenC)
      bigNumEquals(tokenABaseUnit, mojitoConfig.tokenABaseUnit)
      bigNumEquals(tokenCBaseUnit, mojitoConfig.tokenCBaseUnit)

      const _caption = await mojitoOracle.lookupERC2362ID(
        await mojitoOracle.currencyPairId(caption),
      )
      assert.equal(_caption, caption)
    })

    describe('when called by a non-owner', () => {
      it('does not update', async () => {
        await evmRevert(
          mojitoOracle
            .connect(personas.Neil)
            .setMojitoConfig(
              decimals,
              base,
              quote,
              tokenA,
              tokenB,
              tokenC,
              tokenABaseUnit,
              tokenCBaseUnit,
            ),
          'Only callable by owner',
        )
      })
    })
  })

  describe('#consult', () => {
    describe('missing historical observation', async () => {
      await evmRevert(
        mojitoOracle
          .connect(personas.Neil)
          .mojitoOracle._consult(tokenA, tokenABaseUnit, tokenB),
        'Missing historical observation',
      )
    })
  })

  describe('#getMojitoTwap', () => {
    describe('unsupported currency pair', async () => {
      const pairId = await mojitoOracle.currencyPairId(caption)
      await evmRevert(
        mojitoOracle.connect(personas.Neil).getMojitoTwap(pairId),
        'Unsupported currency pair',
      )
    })
  })
})
