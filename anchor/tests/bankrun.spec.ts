import { startAnchor } from "solana-bankrun";
import { BankrunProvider } from "anchor-bankrun";
import { PublicKey } from '@solana/web3.js';
import * as anchor from '@coral-xyz/anchor';
import { BN, Program } from "@coral-xyz/anchor";


const IDL = require("../target/idl/voting.json");
import { Voting } from '../target/types/voting';
import NodeWallet from "@coral-xyz/anchor/dist/cjs/nodewallet";

const PUPPET_PROGRAM_ID = new PublicKey(IDL.address);

describe('Create a Poll account', () => {
    const candidate1 = {
        name: "Gold Class Movie",
        description: "Watch Gold Class movie at Crown Casino"
    }
    const candidate2 = {
        name: "Play games",
        description: "Play games at Red Bull Arcade"
    };
    const candidate3 = {
        name: "Buffet",
        description: "Buffet at Crown Towers"
    };
    const candidate4 = {
        name: "Gokarting",
        description: "Gokart at Melbourne Grand Prix Circuit"
    };

    let program: Program<Voting>;
    let nonCreatorProgram: Program<Voting>;
    let provider: BankrunProvider;
    let nonCreatorProvider: BankrunProvider;
    const nonCreator = anchor.web3.Keypair.generate();

    beforeAll(async () => {
        
        const context = await startAnchor("", [{name: "voting", programId: PUPPET_PROGRAM_ID}], [
            {
                address: nonCreator.publicKey,
                info: {
                    lamports: 1_000_000_000,
                    data: Buffer.alloc(0),
                    owner: anchor.web3.SystemProgram.programId,
                    executable: false,
                }
            }
        ]);
        provider = new BankrunProvider(context);

        program = new Program<Voting>(
            IDL,
            provider,
        );

              // Generate a new keypair for the beneficiary
        nonCreatorProvider = new BankrunProvider(context);
        nonCreatorProvider.wallet = new NodeWallet(nonCreator);
        nonCreatorProgram = new Program<Voting>(IDL as Voting, nonCreatorProvider);
    });

  test("initialize poll", async () => {
    const pollIdBuffer = new anchor.BN(1).toArrayLike(Buffer, "le", 8)

    const [pollAddress] = PublicKey.findProgramAddressSync(
      [Buffer.from("poll"), pollIdBuffer],
      program.programId
    );

    await program.methods.initializePoll(
      new anchor.BN(1),
        new anchor.BN(0),
        new anchor.BN(1759508293),
        "test-poll",
        "description",
    ).rpc();

    const pollAccount = await program.account.pollAccount.fetch(pollAddress);
    console.log(pollAccount);

    expect(pollAccount.pollId.toNumber()).toBe(1);
    expect(pollAccount.pollName).toBe("test-poll");
    expect(pollAccount.pollDescription).toBe("description");
    expect(pollAccount.pollVotingStart.toString()).toBe("0");
    expect(pollAccount.pollVotingEnd.toString()).toBe("1759508293");
  });

  test("initialize candidate", async () => {
    const pollIdBuffer = new anchor.BN(1).toArrayLike(Buffer, "le", 8)

    const [pollAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollIdBuffer],
        program.programId
    );

    // Initialize candidate 1
    const [candidate1Address] = PublicKey.findProgramAddressSync(
        [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate1.name)],
        program.programId
    );
    await program.methods.initializeCandidate(        
        new anchor.BN(1),
        candidate1.name,
        candidate1.description,
    ).rpc();

    // Initialize candidate 2
    const [candidate2Address] = PublicKey.findProgramAddressSync(
        [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate2.name)],
        program.programId
    );
    await program.methods.initializeCandidate(
        new anchor.BN(1),           
        candidate2.name,
        candidate2.description,
    ).rpc();
    // Fetch and verify the poll account
    const pollAccount = await program.account.pollAccount.fetch(pollAddress);
    
    // Verify candidates were added correctly
    expect(pollAccount.pollOptionIndex.toNumber()).toBe(2);
    
    // Verify candidate 1
    const candidate1Account = await program.account.candidateAccount.fetch(candidate1Address);
    expect(candidate1Account.candidateName).toBe(candidate1.name);
    expect(candidate1Account.candidateDescription).toBe(candidate1.description);
    
    // Verify candidate 2
    const candidate2Account = await program.account.candidateAccount.fetch(candidate2Address);
    expect(candidate2Account.candidateName).toBe(candidate2.name);
    expect(candidate2Account.candidateDescription).toBe(candidate2.description);


  });

  test("vote for candidate", async () => {
    const pollIdBuffer = new anchor.BN(1).toArrayLike(Buffer, "le", 8)

    const [pollAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollIdBuffer],
        program.programId
    );

    const [candidate1Address] = PublicKey.findProgramAddressSync(
        [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate1.name)],
        program.programId
    );

    await program.methods.vote(
        new anchor.BN(1),
        candidate1.name,
    ).rpc();

    // Fetch and verify the updated accounts
    const candidate1Account = await program.account.candidateAccount.fetch(candidate1Address);

    // Verify vote count increased
    expect(candidate1Account.candidateVotes.toNumber()).toBe(1);
  });

  test("add candidate by non-creator", async () => {
    const pollIdBuffer = new anchor.BN(1).toArrayLike(Buffer, "le", 8)

    const [pollAddress] = PublicKey.findProgramAddressSync(
        [Buffer.from("poll"), pollIdBuffer],
        program.programId
    );
    // Try to initialize a candidate as non-creator
    const [candidate3Address] = PublicKey.findProgramAddressSync(
        [Buffer.from("candidate"), pollAddress.toBuffer(), Buffer.from(candidate3.name)],
        program.programId
    );
  

    try {
        await nonCreatorProgram.methods.initializeCandidate(
            new anchor.BN(1),
            candidate3.name,
            candidate3.description,
        )        
        .rpc();
        
        // If we reach here, the test should fail
        expect(true).toBe(false);
    } catch (error: any) {
        // Verify that the error is due to unauthorized access
        expect(error).toBeDefined();
        expect(error.toString()).toContain("Unauthorized");
    }
  });
});