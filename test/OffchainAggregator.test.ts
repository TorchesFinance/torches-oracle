import { ethers } from 'hardhat'
import { assert, expect } from 'chai'
import {
  Contract,
  ContractFactory,
  BigNumber,
  Signer,
  ContractTransaction,
} from 'ethers'
import { Personas, getUsers } from './test-helpers/setup'
import { bigNumEquals } from './test-helpers/matchers'
import { publicAbi } from './test-helpers/helpers'

let personas: Personas
let ocrAggregatorFactory: ContractFactory

before(async () => {
  personas = (await getUsers()).personas
  ocrAggregatorFactory = await ethers.getContractFactory(
    'contracts/OffchainAggregator.sol:OffchainAggregator',
  )
})

describe('OffchainAggregator', () => {
  const lowerBoundAnchorRatio = 95
  const upperBoundAnchorRatio = 105
  const decimals = 18
  const description = 'KCS / BTC'
  const typeAndVersion = 'OffchainAggregator 1.0.0'
  const initConfigCount = BigNumber.from(0)

  let aggregator: Contract
  let configBlockNumber: BigNumber

  async function setOCRConfig(
    aggregator: Contract,
    owner: Signer,
    signers: Signer[],
    transmitters: Signer[],
  ): Promise<ContractTransaction> {
    return aggregator.connect(owner).setConfig(
      signers.map(async (_signers) => await _signers.getAddress()),
      transmitters.map(
        async (_transmitters) => await _transmitters.getAddress(),
      ),
    )
  }

  async function transmitOCR(
    aggregator: Contract,
    privateKey: string,
    transmitter: Signer,
    median: number,
    observationsTimestamp: number,
  ): Promise<ContractTransaction> {
    const bytesData = ethers.utils.defaultAbiCoder.encode(
      ['uint192', 'uint32'],
      [median, observationsTimestamp],
    )
    let messageHashBytes = ethers.utils.keccak256(bytesData)

    // https://github.com/ethers-io/ethers.js/issues/555
    // https://github.com/ethers-io/ethers.js/issues/555#issuecomment-509830076
    let wallet = new ethers.utils.SigningKey(privateKey)
    let flatSig = wallet.signDigest(messageHashBytes)

    const sig = ethers.utils.splitSignature(flatSig)

    return await aggregator
      .connect(transmitter)
      .transmit(bytesData, sig.r, sig.s, BigNumber.from(sig.v).sub(27))
  }

  beforeEach(async () => {
    aggregator = await ocrAggregatorFactory
      .connect(personas.Carol)
      .deploy(
        lowerBoundAnchorRatio,
        upperBoundAnchorRatio,
        decimals,
        description,
      )
  })

  it('has a limited public interface [ @skip-coverage ]', () => {
    publicAbi(aggregator, [
      'decimals',
      'description',
      'getAnswer',
      'getRoundData',
      'getTimestamp',
      'getTransmitters',
      'latestAnswer',
      'latestConfigDetails',
      'latestRound',
      'latestRoundData',
      'latestTimestamp',
      'latestTransmissionDetails',
      'upperBoundAnchorRatio',
      'lowerBoundAnchorRatio',
      'owner',
      'setAnchorRatio',
      'setConfig',
      'transmit',
      'transmitWithForce',
      'typeAndVersion',
      'version',
      // Owned methods:
      'acceptOwnership',
      'owner',
      'transferOwnership',
    ])
  })

  describe('#constructor', () => {
    it('sets the lowerBoundAnchorRatio', async () => {
      assert.equal(
        lowerBoundAnchorRatio,
        await aggregator.lowerBoundAnchorRatio(),
      )
    })

    it('sets the upperBoundAnchorRatio', async () => {
      assert.equal(
        upperBoundAnchorRatio,
        await aggregator.upperBoundAnchorRatio(),
      )
    })

    it('sets the decimals', async () => {
      bigNumEquals(BigNumber.from(decimals), await aggregator.decimals())
    })

    it('sets the description', async () => {
      assert.equal(description, await aggregator.description())
    })

    it('sets the version to 1', async () => {
      bigNumEquals(1, await aggregator.version())
    })

    it('sets the typeAndVersion', async () => {
      assert.equal(typeAndVersion, await aggregator.typeAndVersion())
    })

    it('sets the owner', async () => {
      assert.equal(await personas.Carol.getAddress(), await aggregator.owner())
    })
  })

  describe('#setConfig', () => {
    beforeEach(async () => {
      const tx = await aggregator
        .connect(personas.Carol)
        .transferOwnership(await personas.Neil.getAddress())
      await tx.wait()
    })

    describe('first update', () => {
      it('emits a log', async () => {
        configBlockNumber = BigNumber.from(0)
        const tx = await aggregator
          .connect(personas.Carol)
          .setConfig(
            [
              await personas.Eddy.getAddress(),
              await personas.Nancy.getAddress(),
            ],
            [await personas.Ned.getAddress(), await personas.Neil.getAddress()],
          )
        expect(tx)
          .to.emit(aggregator, 'ConfigSet')
          .withArgs(
            configBlockNumber,
            initConfigCount.add(1),
            [
              await personas.Eddy.getAddress(),
              await personas.Nancy.getAddress(),
            ],
            [await personas.Ned.getAddress(), await personas.Neil.getAddress()],
          )
      })
    })

    describe('when called by anyone but the owner', () => {
      it('reverts', async () => {
        await expect(
          aggregator
            .connect(personas.Neil)
            .setConfig(
              [
                await personas.Eddy.getAddress(),
                await personas.Nancy.getAddress(),
              ],
              [
                await personas.Ned.getAddress(),
                await personas.Neil.getAddress(),
              ],
            ),
        ).to.be.revertedWith('Only callable by owner')
      })
    })

    describe('when signers and transmitters length mismatch', () => {
      it('reverts', async () => {
        await expect(
          aggregator
            .connect(personas.Carol)
            .setConfig(
              [
                await personas.Eddy.getAddress(),
                await personas.Nancy.getAddress(),
              ],
              [await personas.Ned.getAddress()],
            ),
        ).to.be.revertedWith('oracle length mismatch')
      })
    })

    describe('When the signer address is duplicated', () => {
      it('reverts', async () => {
        await expect(
          aggregator
            .connect(personas.Carol)
            .setConfig(
              [
                await personas.Eddy.getAddress(),
                await personas.Eddy.getAddress(),
              ],
              [
                await personas.Ned.getAddress(),
                await personas.Neil.getAddress(),
              ],
            ),
        ).to.be.revertedWith('repeated signer address')
      })
    })

    describe('When the transmitter address is duplicated', () => {
      it('reverts', async () => {
        await expect(
          aggregator
            .connect(personas.Carol)
            .setConfig(
              [
                await personas.Eddy.getAddress(),
                await personas.Nancy.getAddress(),
              ],
              [
                await personas.Ned.getAddress(),
                await personas.Ned.getAddress(),
              ],
            ),
        ).to.be.revertedWith('repeated transmitter address')
      })
    })

    describe('second set config', () => {
      beforeEach(async () => {
        await aggregator
          .connect(personas.Carol)
          .setConfig(
            [
              await personas.Eddy.getAddress(),
              await personas.Nancy.getAddress(),
            ],
            [await personas.Ned.getAddress(), await personas.Neil.getAddress()],
          )
        const configDetails = await aggregator.latestConfigDetails()
        configBlockNumber = configDetails.blockNumber
      })

      it('second update emits a log', async () => {
        const tx = await aggregator
          .connect(personas.Carol)
          .setConfig(
            [
              await personas.Eddy.getAddress(),
              await personas.Nancy.getAddress(),
            ],
            [await personas.Ned.getAddress(), await personas.Neil.getAddress()],
          )
        await expect(tx)
          .to.emit(aggregator, 'ConfigSet')
          .withArgs(
            configBlockNumber,
            initConfigCount.add(2),
            [
              await personas.Eddy.getAddress(),
              await personas.Nancy.getAddress(),
            ],
            [await personas.Ned.getAddress(), await personas.Neil.getAddress()],
          )
      })
    })
  })

  describe('#transmit', () => {
    beforeEach(async () => {
      await setOCRConfig(
        aggregator,
        personas.Carol,
        [personas.Eddy, personas.Nancy],
        [personas.Ned, personas.Neil],
      )
      const configDetails = await aggregator.latestConfigDetails()
      configBlockNumber = configDetails.blockNumber
    })
    const observationsTimestamp = BigNumber.from(1645973528).toNumber()
    const median = BigNumber.from(3887649853020).toNumber()
    describe('first transmit', () => {
      it('emits a log', async () => {
        const tx = await transmitOCR(
          aggregator,
          '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
          personas.Ned,
          median,
          observationsTimestamp,
        )
        expect(tx)
          .to.emit(aggregator, 'NewTransmission')
          .withArgs(
            1,
            median,
            await personas.Ned.getAddress(),
            observationsTimestamp,
          )
      })
    })
  })

  describe('#latestRound', () => {
    beforeEach(async () => {
      await setOCRConfig(
        aggregator,
        personas.Carol,
        [personas.Eddy, personas.Nancy],
        [personas.Ned, personas.Neil],
      )
    })
    const observationsTimestamp = BigNumber.from(1645973528).toNumber()
    const median = BigNumber.from(3887649853020).toNumber()
    describe('return latestRound', () => {
      it('emits a log', async () => {
        await transmitOCR(
          aggregator,
          '0x47e179ec197488593b187f80a00eb0da91f1b9d0b13f8733639f19c30a34926a',
          personas.Ned,
          median,
          observationsTimestamp,
        )

        bigNumEquals(1, await aggregator.latestRound())
      })
    })
  })

  describe('#transferOwnership', () => {
    describe('when the admin tries to transfer the admin', () => {
      it('works', async () => {
        await expect(
          aggregator
            .connect(personas.Carol)
            .transferOwnership(await personas.Neil.getAddress()),
        )
          .to.emit(aggregator, 'OwnershipTransferRequested')
          .withArgs(
            await personas.Carol.getAddress(),
            await personas.Neil.getAddress(),
          )
        assert.equal(
          await personas.Carol.getAddress(),
          await aggregator.owner(),
        )
      })
    })

    describe('when the non-admin owner tries to update the admin', () => {
      it('reverts', async () => {
        await expect(
          aggregator
            .connect(personas.Eddy)
            .transferOwnership(await personas.Neil.getAddress()),
        ).to.be.revertedWith('Only callable by owner')
      })
    })
  })

  describe('#acceptOwnership', () => {
    beforeEach(async () => {
      const tx = await aggregator
        .connect(personas.Carol)
        .transferOwnership(await personas.Neil.getAddress())
      await tx.wait()
    })

    describe('when the new admin tries to accept', () => {
      it('works', async () => {
        await expect(aggregator.connect(personas.Neil).acceptOwnership())
          .to.emit(aggregator, 'OwnershipTransferred')
          .withArgs(
            await personas.Carol.getAddress(),
            await personas.Neil.getAddress(),
          )
        assert.equal(await personas.Neil.getAddress(), await aggregator.owner())
      })
    })

    describe('when someone other than the new admin tries to accept', () => {
      it('reverts', async () => {
        await expect(
          aggregator.connect(personas.Eddy).acceptOwnership(),
        ).to.be.revertedWith('Must be proposed owner')
      })
    })
  })
})
