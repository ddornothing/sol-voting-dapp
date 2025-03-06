'use client'

import { getVotingProgram, getVotingProgramId } from '@project/anchor'
import { useConnection } from '@solana/wallet-adapter-react'
import { Cluster, Keypair, PublicKey } from '@solana/web3.js'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useMemo } from 'react'
import toast from 'react-hot-toast'
import { useCluster } from '../cluster/cluster-data-access'
import { useAnchorProvider } from '../solana/solana-provider'
import { useTransactionToast } from '../ui/ui-layout'
import BN from "bn.js";

interface InitializePollArgs {
  pollId: number;
  startTime: number;
  endTime: number;
  name: string;
  description: string;
}

interface InitializeCandidateArgs { 
  pollId: number;
  candidateName: string;
  candidateDescription: string;
}

interface VoteForCandidateArgs {
  pollId: number;
  candidateName: string;
}

export function useClusterName() {
  const { cluster } = useCluster();
  return cluster.name;
}

export function useVotingProgram4Polls() {
  const { connection } = useConnection()
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const provider = useAnchorProvider()
  const programId = useMemo(() => getVotingProgramId(cluster.network as Cluster), [cluster])
  const program = useMemo(() => getVotingProgram(provider, programId), [provider, programId])

  const getPolls = useQuery({
    queryKey: ['polls', 'all', { cluster }],
    queryFn: () => program.account.pollAccount.all(),
  })

  const getProgramAccount = useQuery({
    queryKey: ['get-program-account', { cluster }],
    queryFn: () => connection.getParsedAccountInfo(programId),
  })

  const initializePoll = useMutation<string, Error, InitializePollArgs>({
    mutationKey: ['poll', 'initialize', { cluster }],
    mutationFn: async ({ pollId, startTime, endTime, name, description }) => {      
      const tx = program.methods
        .initializePoll(new BN(pollId), new BN(startTime), new BN(endTime), name, description)         
        .rpc();

      console.log('Initialize poll successfully, tx:', tx);
      return tx;
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return getPolls.refetch()
    },
    onError: () => toast.error('Failed to initialize poll'),
  })

  return {
    program,
    programId,
    getPolls,
    getProgramAccount,
    initializePoll,
  }
}

export function useVotingProgramPollAccount({ pollAccount }: { pollAccount: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, getPolls } = useVotingProgram4Polls()

  const getPollAccountData = useQuery({
    queryKey: ['poll', 'fetch', { cluster, pollAccount }],
    queryFn: async () => {      
      const pollAccountData = await program.account.pollAccount.fetch(pollAccount);
      return pollAccountData;
    },
  })

  
  const getCandidateAccountsData4Poll = useQuery({
    queryKey: ['all-candidates', 'fetch', { cluster, pollAccount }],
    queryFn: async () => {
      console.log('Fetching all candidates for the poll account:', pollAccount.toString());      
      
      // Get candidates by matching their PDA seeds using poll_account public key
      const candidateAccounts = await program.account.candidateAccount.all([
        {
            memcmp: {
                offset: 8,
                bytes: pollAccount.toBase58()
            }
        }
    ]);

      console.log('Found candidates:', candidateAccounts);
      return candidateAccounts;
    },
  })

  const initializeCandidate = useMutation<string, Error, InitializeCandidateArgs>({
    mutationKey: ['candidate', 'initialize', { cluster }],
    mutationFn: async ({ pollId, candidateName, candidateDescription }) => {
      const tx = program.methods.initializeCandidate(new BN(pollId), candidateName, candidateDescription)      
        .rpc();
      return tx;
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return getPolls.refetch()
    },
    onError: () => toast.error('Failed to initialize candidate'),
  })

  return {
    getPollAccountData,
    initializeCandidate,
    getCandidateAccountsData4Poll
  }
}


export function useVotingProgramCandidateAccount({ candidateAccount }: { candidateAccount: PublicKey }) {
  const { cluster } = useCluster()
  const transactionToast = useTransactionToast()
  const { program, getPolls } = useVotingProgram4Polls()

  const getCandidateAccountData = useQuery({
    queryKey: ['candidate', 'fetch', { cluster, candidateAccount }],
    queryFn: () => program.account.candidateAccount.fetch(candidateAccount),
  })

  const voteForCandidate = useMutation<string, Error, VoteForCandidateArgs>({
    mutationKey: ['candidate', 'initialize', { cluster }],
    mutationFn: async ({ pollId, candidateName }) => {
      const tx = program.methods.vote(new BN(pollId), candidateName)        
        .rpc();
      return tx;
    },
    onSuccess: (signature) => {
      transactionToast(signature)
      return getPolls.refetch()
    },
    onError: () => toast.error('Failed to vote for candidate'),
  })

  return {
    getCandidateAccountData,
    voteForCandidate
  }
}

