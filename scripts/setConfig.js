const hre = require("hardhat");
const aggregators = require("../config/network.json");

async function main() {

    let chainId = await hre.getChainId()
    for (let index = 0; index < aggregators.length; index++) {
        const aggregator = aggregators[index]
        if (aggregator.chainid.toString() === chainId) {
            console.log(`${index + 1} setConfig ${aggregator.description} module`);
            const ocrAggregator = await hre.ethers.getContractFactory("AccessControlledOffchainAggregator");
            const ocrInstance = ocrAggregator.attach(aggregator.ocr_address);
            let signer = [
                '0xC48ec77Fe358284bc4F70172BDb09CB891b86532',
                '0x1ef2e6ca56E0621E1145c910fe3E4a62EBFa7E3B',
                '0xFA40FE626A31b751BF5e19CEAda46B2b925e7e1b'
            ]
            let transmitter = [
                '0xF5cb89A64BD49d88cf05819dc232103A15400EA1',
                '0x977ab71E93E75e25e4D13a5e11bcd1ad01516cA2',
                '0x93E06cb6B4C51132A98616f226aAe91578FEB6A3'
            ]
            console.log("setConfig ", signer, transmitter);
            const setConfigTx = await ocrInstance.setConfig(signer, transmitter);
            await setConfigTx.wait();
        }
    }
}

main()
    .then(() => process.exit(0))
    .catch((error) => {
        console.error(error);
        process.exit(1);
    });