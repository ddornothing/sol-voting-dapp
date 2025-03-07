import { ActionGetResponse, ActionPostRequest, ACTIONS_CORS_HEADERS, createPostResponse } from "@solana/actions";
import { Connection, PublicKey, Transaction } from "@solana/web3.js";
import { Voting } from "@/../anchor/target/types/voting";
import { BN, Program } from "@coral-xyz/anchor";

const IDL = require('@/../anchor/target/idl/voting.json');

// Define the required headers for Solana Actions
const ACTION_HEADERS = {
  ...ACTIONS_CORS_HEADERS,
  'X-Action-Version': '1',
  'X-Blockchain-Ids': 'solana:EtWTRABZaYq6iMfeYKouRu166VU2xqa1'
};

export const OPTIONS = GET;

export async function GET(
  request: Request,
  { params }: { params: { pollId: string } }
) {
  // Use environment variable for RPC URL
  const connection = new Connection(process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const program: Program<Voting> = new Program(IDL, {connection});

  try {
    // Try to find the poll by public key first
    let pollData;
    let pollAccount;
    
    try {
      // First try to interpret pollId as a public key
      pollAccount = new PublicKey(params.pollId);
      pollData = await program.account.pollAccount.fetch(pollAccount);
    } catch (error) {
      // If that fails, try to find by numeric poll ID
      console.log("Not a valid public key, trying to find by numeric ID");
      
      // Convert pollId to a number and then to BN
      const pollIdNum = parseInt(params.pollId);
      if (isNaN(pollIdNum)) {
        return new Response("Invalid poll ID format", { 
          status: 400, 
          headers: ACTION_HEADERS 
        });
      }
      
      const pollIdBN = new BN(pollIdNum);
      
      // Derive the PDA for the poll account
      const [pollPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("poll"),
          Buffer.from(pollIdBN.toArray("le", 8))
        ],
        program.programId
      );
      
      try {
        pollData = await program.account.pollAccount.fetch(pollPda);
        pollAccount = pollPda;
      } catch (error) {
        return new Response("Poll not found", { 
          status: 404, 
          headers: ACTION_HEADERS 
        });
      }
    }
    
    // Fetch candidates for this poll using the poll account
    const candidatesData = await program.account.candidateAccount.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: pollAccount.toBase58()
        }
      }
    ]);

    // Generate a dynamic image based on poll title and description
    let imageUrl = '';
    try {
      // Use absolute URL instead of relying on origin header
      const host = request.headers.get('host') || 'localhost:3000';
      const protocol = host.includes('localhost') ? 'http' : 'https';
      const baseUrl = `${protocol}://${host}`;
      
      const imageApiUrl = new URL('/api/generate-image', baseUrl);
      imageApiUrl.searchParams.append('title', pollData.pollName);
      imageApiUrl.searchParams.append('description', pollData.pollDescription);
      imageApiUrl.searchParams.append('pollId', params.pollId.toString());
      
      const imageResponse = await fetch(imageApiUrl.toString(), {
        method: 'GET',
        headers: {
          'Accept': 'application/json'
        }
      });
      
      if (!imageResponse.ok) {
        throw new Error(`Image API responded with status: ${imageResponse.status}`);
      }
      
      const imageData = await imageResponse.json();
      imageUrl = imageData.imageUrl;
    } catch (error) {
      console.error('Error fetching generated image:', error);
      // Fallback to a default image if generation fails
      imageUrl = 'https://picsum.photos/400/300';
    }

    const actionMetdata: ActionGetResponse = {
      type: "action",
      icon: imageUrl,
      title: pollData.pollName,
      description: pollData.pollDescription,
      label: "Vote on this poll",
      links: {
        actions: candidatesData.map(candidate => ({
          label: `Vote for ${candidate.account.candidateName}`,
          href: `/api/vote/${params.pollId}?candidate=${candidate.account.candidateName}`,
          type: "transaction",       
        }))
      }
    };

    return Response.json(actionMetdata, { headers: ACTION_HEADERS });
  } catch (error) {
    console.error("Error fetching poll data:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to fetch poll data",
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 400, 
      headers: ACTION_HEADERS 
    });
  }
}

export async function POST(
  request: Request,
  { params }: { params: { pollId: string } }
) {
  const url = new URL(request.url);
  const candidateName = url.searchParams.get("candidate");
  const pollId = params.pollId;

  if (!candidateName) {
    return new Response(JSON.stringify({ error: "Candidate parameter is required" }), {
      status: 400,
      headers: ACTION_HEADERS
    });
  }

  // Use environment variable for RPC URL
  const connection = new Connection(process.env.HELIUS_RPC_URL || "https://api.devnet.solana.com", "confirmed");
  const program: Program<Voting> = new Program(IDL, {connection});

  try {
    // Try to find the poll by public key first
    let pollAccount;
    let pollIdBN;
    
    try {
      // First try to interpret pollId as a public key
      pollAccount = new PublicKey(params.pollId);
      
      // Try to fetch the poll data to verify it exists
      const pollData = await program.account.pollAccount.fetch(pollAccount);
      pollIdBN = pollData.pollId;
    } catch (error) {
      // If that fails, try to find by numeric poll ID
      console.log("Not a valid public key, trying to find by numeric ID");
      
      // Convert pollId to a number and then to BN
      const pollIdNum = parseInt(params.pollId);
      if (isNaN(pollIdNum)) {
        return new Response(JSON.stringify({ error: "Invalid poll ID format" }), { 
          status: 400, 
          headers: ACTION_HEADERS 
        });
      }
      
      pollIdBN = new BN(pollIdNum);
      
      // Derive the PDA for the poll account
      const [pollPda] = PublicKey.findProgramAddressSync(
        [
          Buffer.from("poll"),
          Buffer.from(pollIdBN.toArray("le", 8))
        ],
        program.programId 
      );
      
      try {
        await program.account.pollAccount.fetch(pollPda);
        pollAccount = pollPda;
      } catch (fetchError) {
        console.error("Error fetching poll account:", fetchError);
        return new Response(JSON.stringify({ error: "Poll not found" }), { 
          status: 404, 
          headers: ACTION_HEADERS 
        });
      }
    }

    // Verify the candidate exists in this poll
    const candidatesData = await program.account.candidateAccount.all([
      {
        memcmp: {
          offset: 8, // Skip discriminator
          bytes: pollAccount.toBase58()
        }
      }
    ]);

    const candidateAccount = candidatesData.find(
      c => c.account.candidateName === candidateName
    );

    if (!candidateAccount) {
      return new Response(JSON.stringify({ error: "Invalid candidate" }), { 
        status: 400, 
        headers: ACTION_HEADERS 
      });
    }

    const body: ActionPostRequest = await request.json(); 
    let voter;
    try {
      voter = new PublicKey(body.account);
    } catch (error) {
      return new Response(JSON.stringify({ error: "Invalid account" }), { 
        status: 400, 
        headers: ACTION_HEADERS 
      });
    }

    // Derive the vote account PDA
    const [voteAccount] = PublicKey.findProgramAddressSync(
      [
        Buffer.from("vote"),
        pollAccount.toBuffer(),
        voter.toBuffer()
      ],
      program.programId
    );

    const instruction = await program.methods
      .vote(pollIdBN, candidateName)
      .accounts({
        signer: voter,
      })
      .instruction();

    const blockhash = await connection.getLatestBlockhash('confirmed');
    const transaction = new Transaction({
      feePayer: voter,
      blockhash: blockhash.blockhash,
      lastValidBlockHeight: blockhash.lastValidBlockHeight,
    }).add(instruction);

    const response = await createPostResponse({
      fields: {
        type: "transaction",
        transaction,
        message: "Vote for " + candidateName
      }
    });

    return Response.json(response, { headers: ACTION_HEADERS });
  } catch (error) {
    console.error("Error processing vote:", error);
    return new Response(JSON.stringify({ 
      error: "Failed to process vote",
      details: error instanceof Error ? error.message : String(error)
    }), { 
      status: 400, 
      headers: ACTION_HEADERS 
    });
  }
}
