import * as anchor from "@coral-xyz/anchor";
import { Program } from "@coral-xyz/anchor";
import { Voting } from "../target/types/voting";
import { PublicKey } from "@solana/web3.js";

const pollId = new anchor.BN(1);
const startTime = new anchor.BN(0);
const endTime = new anchor.BN(1759508293);
const pollName = "Team building activity";
const pollDescription =
  "We are going to have a team building event on Friday. Please vote for your favorite activity.";

const candidate1 = {
  name: "Gold Class Movie",
  description: "Watch Captain America: Brave New World",
};
const candidate2 = {
  name: "Play games",
  description: "Play games at Red Bull Arcade",
};
const candidate3 = {
  name: "Buffet",
  description: "Lobster Buffet at Palms",
};
const candidate4 = {
  name: "Gokarting",
  description: "Gokart at Australian Grand Prix Circuit",
};

describe("Voting", () => {
  // Configure the client to use the local cluster.
  console.log(anchor.AnchorProvider.env());
  anchor.setProvider(anchor.AnchorProvider.env());
  const program = anchor.workspace.Voting as Program<Voting>;

  it("initializePoll", async () => {
    const pollIdBuffer = pollId.toArrayLike(Buffer, "le", 8);
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), pollIdBuffer],
      program.programId
    );

    const tx = await program.methods
      .initializePoll(pollId, startTime, endTime, pollName, pollDescription)
      .rpc();
    console.log("Poll initialized with tx:", tx);

    // Verify the poll account
    const pollAccount = await program.account.pollAccount.fetch(pollAddress);
    console.log(pollAccount);
  });

  it("initialize candidates", async () => {
    const pollIdBuffer = pollId.toArrayLike(Buffer, "le", 8);
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), pollIdBuffer],
      program.programId
    );

    // Initialize and verify candidate 1
    const [candidate1Address] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate1.name)],
      program.programId
    );
    const candidate1Tx = await program.methods
      .initializeCandidate(pollId, candidate1.name, candidate1.description)
      .rpc();
    console.log("Candidate 1 initialized:", candidate1Tx);

    // Initialize and verify candidate 2
    const [candidate2Address] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate2.name)],
      program.programId
    );
    const candidate2Tx = await program.methods
      .initializeCandidate(pollId, candidate2.name, candidate2.description)
      .rpc();
    console.log("Candidate 2 initialized:", candidate2Tx);

    // Initialize and verify candidate 3
    const [candidate3Address] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate3.name)],
      program.programId
    );
    const candidate3Tx = await program.methods
      .initializeCandidate(pollId, candidate3.name, candidate3.description)
      .rpc();
    console.log("Candidate 3 initialized:", candidate3Tx);

    // Initialize and verify candidate 4
    const [candidate4Address] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate4.name)],
      program.programId
    );
    const candidate4Tx = await program.methods
      .initializeCandidate(pollId, candidate4.name, candidate4.description)
      .rpc();
    console.log("Candidate 4 initialized:", candidate4Tx);

    // Verify the poll account
    const pollAccount = await program.account.pollAccount.fetch(pollAddress);
    console.log("Poll option index:", pollAccount.pollOptionIndex.toNumber());
  });

  it("vote", async () => {
    const pollIdBuffer = pollId.toArrayLike(Buffer, "le", 8);
    const [pollAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), pollIdBuffer],
      program.programId
    );

    const [candidate1Address] = PublicKey.findProgramAddressSync(
      [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate1.name)],
      program.programId
    );

    const tx = await program.methods.vote(pollId, candidate1.name).rpc();
    console.log("Your Vote transaction signature", tx);

    // Verify the vote
    const candidate1Account = await program.account.candidateAccount.fetch(candidate1Address);
    console.log("Vote count:", candidate1Account.candidateVotes.toNumber());
  });
});
