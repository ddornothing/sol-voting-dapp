'use client'

import { useWallet } from '@solana/wallet-adapter-react'
import { WalletButton } from '../solana/solana-provider'
import { AppHero, ellipsify } from '../ui/ui-layout'
import { ExplorerLink } from '../cluster/cluster-ui'
import { useVotingProgram4Polls } from './voting-data-access'
import { VotingCreate, VotingList } from './voting-ui'

export default function VotingFeature() {
  const { publicKey } = useWallet()
  const { programId } = useVotingProgram4Polls()

  return publicKey ? (
    <div>
      <AppHero
        title="Voting"
        subtitle={
          'Create a new poll by clicking the "Create" button. The state of a poll is stored on-chain and candidates can be added by the creator.'
        }
      >
        <p className="mb-6">
          <ExplorerLink path={`account/${programId}`} label={ellipsify(programId.toString())} />
        </p>
        <VotingCreate />
      </AppHero>
      <VotingList />
    </div>
  ) : (
    <div className="max-w-4xl mx-auto">
      <div className="hero py-[64px]">
        <div className="hero-content text-center">
          <WalletButton />
        </div>
      </div>
    </div>
  )
}
