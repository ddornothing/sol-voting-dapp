'use client'

import { Keypair, PublicKey } from '@solana/web3.js'
import { useMemo } from 'react'
import { ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useVotingProgram4Polls, useVotingProgramCandidateAccount, useVotingProgramPollAccount } from './voting-data-access'
import { useWallet } from '@solana/wallet-adapter-react'

export function VotingCreate() {
  const { initializePoll } = useVotingProgram4Polls()

  const handleCreatePoll = async() => {
    const name = window.prompt('Enter poll name:')
    const description = window.prompt('Enter poll description:')
    const startTime = Date.now()
    const endTime = startTime + 7 * 24 * 60 * 60 * 1000 // 7 days from now

    if (!name || !description) return

    initializePoll.mutateAsync({
      pollId: Math.floor(Math.random() * 1000000),
      startTime,
      endTime,
      name,
      description,
    })

  }

  return (
    <button
      className="btn btn-xs lg:btn-md btn-primary"
      onClick={handleCreatePoll}
      disabled={initializePoll.isPending}
    >
      Create Poll {initializePoll.isPending && '...'}
    </button>
  )
}

export function VotingList() {
  const { getPolls, getProgramAccount } = useVotingProgram4Polls()

  if (getProgramAccount.isLoading) {
    return <span className="loading loading-spinner loading-lg"></span>
  }
  if (!getProgramAccount.data?.value) {
    return (
      <div className="alert alert-info flex justify-center">
        <span>Program account not found. Make sure you have deployed the program and are on the correct cluster.</span>
      </div>
    )
  }
  return (
    <div className={'space-y-6'}>
      {getPolls.isLoading ? (
        <span className="loading loading-spinner loading-lg"></span>
      ) : getPolls.data?.length ? (
        <div className="grid md:grid-cols-2 gap-4">
          {getPolls.data?.map((poll) => (
            <PollCard key={poll.publicKey.toString()} account={poll.publicKey} />
          ))}
        </div>
      ) : (
        <div className="text-center">
          <h2 className={'text-2xl'}>No accounts</h2>
          No accounts found. Create one above to get started.
        </div>
      )}
    </div>
  )
}

function PollCard({ account }: { account: PublicKey }) {
  const { publicKey: walletPublicKey } = useWallet()
  const { getPollAccountData, initializeCandidate, getCandidateAccountsData4Poll } = useVotingProgramPollAccount({
    pollAccount: account,
  })

  const handleAddCandidate = async () => {
    const candidateName = window.prompt('Enter candidate name:')
    const candidateDescription = window.prompt('Enter candidate description:')
    
    if (!candidateName || !candidateDescription || !getPollAccountData.data?.pollId) return

    try {
      await  initializeCandidate.mutateAsync({
        pollId: getPollAccountData.data.pollId.toNumber(),
        candidateName,
        candidateDescription,
      })
      // Refresh both the individual candidate and all candidates data
      await Promise.all([
        getPollAccountData.refetch(),
        getCandidateAccountsData4Poll.refetch(),
      ]);
    } catch (error) {
      console.error('Error voting:', error);
    }
  }

  return getPollAccountData.isLoading ? (
    <span className="loading loading-spinner loading-lg"></span>
  ) : (
    <div className="card bg-base-200 shadow-xl">
      <div className="card-body p-6">
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2"><h2 className="card-title text-2xl font-bold text-primary">{getPollAccountData.data?.pollName}</h2><ExplorerLink path={`account/${account}`} label={ellipsify(account.toString())} /></div>
            <p className="text-base mt-2">{getPollAccountData.data?.pollDescription}</p>
            <div className="bg-base-300 rounded-lg p-3 mt-4 text-sm">
              <p className="flex justify-between">
                <span className="font-semibold">Start:</span>
                <span>{new Date((getPollAccountData.data?.pollVotingStart.toNumber() ?? 0)).toLocaleString()}</span>
              </p>
              <p className="flex justify-between mt-1">
                <span className="font-semibold">End:</span>
                <span>{new Date((getPollAccountData.data?.pollVotingEnd.toNumber() ?? 0)).toLocaleString()}</span>
              </p>
            </div>
          </div>

          <div className="divider before:bg-primary/20 after:bg-primary/20">Candidates</div>
          
          <div className="space-y-4">
            {getCandidateAccountsData4Poll.isLoading ? (
              <span className="loading loading-spinner loading-md"></span>
            ) : getCandidateAccountsData4Poll.data && getCandidateAccountsData4Poll.data.length > 0 ? (
              <div className="space-y-3">                
                {getCandidateAccountsData4Poll.data.map((candidate) => (
                  <CandidateCard 
                    key={candidate.publicKey.toString()} 
                    account={candidate.publicKey}
                    data={candidate.account}
                    pollId={getPollAccountData.data?.pollId.toNumber() || 0}
                  />
                ))}
              </div>
            ) : (
              <p className="text-center py-4 bg-base-300 rounded-lg">
                No candidates yet 
                {getCandidateAccountsData4Poll.isError && ` (Error: ${getCandidateAccountsData4Poll.error})`}
              </p>
            )}
            
            {walletPublicKey && getPollAccountData.data?.creator?.equals(walletPublicKey) && (
              <button
                className="btn btn-secondary w-full"
                onClick={handleAddCandidate}
                disabled={initializeCandidate.isPending}
              >
                Add Candidate {initializeCandidate.isPending && '...'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function CandidateCard({ account, data, pollId }: { account: PublicKey; data: any; pollId: number }) {
  const { voteForCandidate, getCandidateAccountData } = useVotingProgramCandidateAccount({ candidateAccount: account })
  const { getCandidateAccountsData4Poll } = useVotingProgramPollAccount({
    pollAccount: new PublicKey(data.pollAccount),
  })

  // Correctly access the properties from the account data
  const candidateName = data.candidateName;
  const candidateDescription = data.candidateDescription;
  const voteCount = data.candidateVotes?.toString() || '0';

  const handleVote = async () => {
    if (!pollId || !candidateName) {
      console.error('Missing required data:', { pollId, candidateName });
      return;
    }
    
    try {
      await voteForCandidate.mutateAsync({
        pollId,
        candidateName,
      });
      // Refresh both the individual candidate and all candidates data
      await Promise.all([
        getCandidateAccountData.refetch(),
        getCandidateAccountsData4Poll.refetch(),
      ]);      
    } catch (error) {
      console.error('Error voting:', error);      
    }
  }

  return (
    <div className="bg-base-100 rounded-lg shadow-md hover:shadow-lg transition-shadow">
      <div className="p-3">
        <div className="flex justify-between items-center gap-2">
          <div className="flex-1">
            <ExplorerLink 
              path={`account/${account}`} 
              label={candidateName}
              className="font-bold text-lg text-primary hover:underline"
            />
            <p className="text-sm text-base-content/70">{candidateDescription}</p>
          </div>
          <div className="flex items-center gap-2">
            <div className="badge badge-primary">
              {getCandidateAccountData.isLoading ? (
                <span className="loading loading-spinner loading-xs"></span>
              ) : (
                `${voteCount}`
              )}
            </div>
            <button
              className="btn btn-primary btn-sm"
              onClick={handleVote}
              disabled={voteForCandidate.isPending || getCandidateAccountData.isLoading}
            >
              {voteForCandidate.isPending ? (
                <span className="loading loading-spinner loading-xs"/>
              ) : (
                'Vote'
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
