import { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";
import { ethers, fhevm } from "hardhat";
import { LinkMatch, LinkMatch__factory } from "../types";
import { expect } from "chai";
import { FhevmType } from "@fhevm/hardhat-plugin";

type Signers = {
  deployer: HardhatEthersSigner;
  alice: HardhatEthersSigner;
  bob: HardhatEthersSigner;
};

async function deployFixture() {
  const factory = (await ethers.getContractFactory("LinkMatch")) as LinkMatch__factory;
  const linkMatchContract = (await factory.deploy()) as LinkMatch;
  const linkMatchContractAddress = await linkMatchContract.getAddress();

  return { linkMatchContract, linkMatchContractAddress };
}

describe("LinkMatch", function () {
  let signers: Signers;
  let linkMatchContract: LinkMatch;
  let linkMatchContractAddress: string;

  before(async function () {
    const ethSigners: HardhatEthersSigner[] = await ethers.getSigners();
    signers = { deployer: ethSigners[0], alice: ethSigners[1], bob: ethSigners[2] };
  });

  beforeEach(async function () {
    // Check whether the tests are running against an FHEVM mock environment
    if (!fhevm.isMock) {
      console.warn(`This hardhat test suite cannot run on Sepolia Testnet`);
      this.skip();
    }

    ({ linkMatchContract, linkMatchContractAddress } = await deployFixture());
  });

  it("should allow player to submit encrypted game result", async function () {
    const matches = 10;
    const timeSeconds = 120;

    // Encrypt game result
    const encryptedMatches = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.alice.address)
      .add32(matches)
      .encrypt();

    const encryptedTime = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.alice.address)
      .add32(timeSeconds)
      .encrypt();

    // Submit game result
    const tx = await linkMatchContract
      .connect(signers.alice)
      .submitGameResult(
        encryptedMatches.handles[0],
        encryptedTime.handles[0],
        encryptedMatches.inputProof,
        encryptedTime.inputProof
      );
    await tx.wait();

    // Verify submission
    expect(await linkMatchContract.hasSubmitted(signers.alice.address)).to.be.true;
    expect(await linkMatchContract.getPlayerCount()).to.eq(1);
  });

  it("should prevent duplicate submissions", async function () {
    const matches = 10;
    const timeSeconds = 120;

    const encryptedMatches = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.alice.address)
      .add32(matches)
      .encrypt();

    const encryptedTime = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.alice.address)
      .add32(timeSeconds)
      .encrypt();

    // First submission
    await linkMatchContract
      .connect(signers.alice)
      .submitGameResult(
        encryptedMatches.handles[0],
        encryptedTime.handles[0],
        encryptedMatches.inputProof,
        encryptedTime.inputProof
      );

    // Second submission should fail
    await expect(
      linkMatchContract
        .connect(signers.alice)
        .submitGameResult(
          encryptedMatches.handles[0],
          encryptedTime.handles[0],
          encryptedMatches.inputProof,
          encryptedTime.inputProof
        )
    ).to.be.revertedWith("Player has already submitted a result");
  });

  it("should allow multiple players to submit results", async function () {
    const aliceMatches = 10;
    const aliceTime = 120;
    const bobMatches = 15;
    const bobTime = 100;

    // Alice submits
    const aliceEncryptedMatches = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.alice.address)
      .add32(aliceMatches)
      .encrypt();

    const aliceEncryptedTime = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.alice.address)
      .add32(aliceTime)
      .encrypt();

    await linkMatchContract
      .connect(signers.alice)
      .submitGameResult(
        aliceEncryptedMatches.handles[0],
        aliceEncryptedTime.handles[0],
        aliceEncryptedMatches.inputProof,
        aliceEncryptedTime.inputProof
      );

    // Bob submits
    const bobEncryptedMatches = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.bob.address)
      .add32(bobMatches)
      .encrypt();

    const bobEncryptedTime = await fhevm
      .createEncryptedInput(linkMatchContractAddress, signers.bob.address)
      .add32(bobTime)
      .encrypt();

    await linkMatchContract
      .connect(signers.bob)
      .submitGameResult(
        bobEncryptedMatches.handles[0],
        bobEncryptedTime.handles[0],
        bobEncryptedMatches.inputProof,
        bobEncryptedTime.inputProof
      );

    // Verify both players are registered
    expect(await linkMatchContract.getPlayerCount()).to.eq(2);
    expect(await linkMatchContract.hasSubmitted(signers.alice.address)).to.be.true;
    expect(await linkMatchContract.hasSubmitted(signers.bob.address)).to.be.true;
  });
});

