#![allow(unexpected_cfgs)]
#![allow(clippy::result_large_err)]

use anchor_lang::prelude::*;

declare_id!("HKPV47zxFqezyRWkbDS2vi6X6Lqsm2kB9Neu22fb4e1E");

#[program]
pub mod voting {
    use super::*;

    pub fn initialize_poll(ctx: Context<InitializePoll>, 
                            poll_id: u64, 
                            start_time: u64, 
                            end_time: u64,
                            name: String,
                            description: String) -> Result<()> {
        let poll_account = &mut ctx.accounts.poll_account;
        poll_account.poll_id = poll_id;
        poll_account.poll_name = name;
        poll_account.poll_description = description;
        poll_account.poll_voting_start = start_time;
        poll_account.poll_voting_end = end_time;
        poll_account.poll_option_index = 0;
        poll_account.creator = ctx.accounts.signer.key();
        Ok(())
    }

    pub fn initialize_candidate(ctx: Context<InitializeCandidate>,
                                _poll_id: u64,
                                candidate_name: String,
                                candidate_description: String) -> Result<()> {        
        require!(
            ctx.accounts.poll_account.creator == ctx.accounts.signer.key(),
            ErrorCode::UnauthorizedCandidateModification
        );

        let candidate_account = &mut ctx.accounts.candidate_account;
        candidate_account.candidate_name = candidate_name;
        candidate_account.candidate_description = candidate_description;
        candidate_account.candidate_votes = 0;
        candidate_account.poll_account = ctx.accounts.poll_account.key();
        let poll_account = &mut ctx.accounts.poll_account;
        poll_account.poll_option_index += 1;
        Ok(())
    }

    pub fn vote(ctx: Context<Vote>, _poll_id: u64, _candidate_name: String) -> Result<()> {
        let candidate_account = &mut ctx.accounts.candidate_account;
        let current_time = Clock::get()?.unix_timestamp;

        if current_time > (ctx.accounts.poll_account.poll_voting_end as i64) {
            return Err(ErrorCode::VotingEnded.into());
        }

        if current_time <= (ctx.accounts.poll_account.poll_voting_start as i64) {
            return Err(ErrorCode::VotingNotStarted.into());
        }

        candidate_account.candidate_votes += 1;

        Ok(())
    }
    
}

#[derive(Accounts)]
#[instruction(poll_id: u64)]
pub struct InitializePoll<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        init_if_needed,
        payer = signer,
        space = 8 + PollAccount::INIT_SPACE,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump
    )]
    pub poll_account: Account<'info, PollAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate_name: String)]
pub struct InitializeCandidate<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
      mut,
      seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
      bump,
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        init,
        payer = signer,
        space = 8 + CandidateAccount::INIT_SPACE,
        seeds = [b"candidate".as_ref(), poll_account.key().as_ref(), candidate_name.as_ref()],
        bump,
    )]
    pub candidate_account: Account<'info, CandidateAccount>,

    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
#[instruction(poll_id: u64, candidate_name: String)]
pub struct Vote<'info> {
    #[account(mut)]
    pub signer: Signer<'info>,

    #[account(
        mut,
        seeds = [b"poll".as_ref(), poll_id.to_le_bytes().as_ref()],
        bump,
    )]
    pub poll_account: Account<'info, PollAccount>,

    #[account(
        mut,
        seeds = [b"candidate".as_ref(), poll_account.key().as_ref(), candidate_name.as_ref()],
        bump,
        has_one = poll_account
      )]
    pub candidate_account: Account<'info, CandidateAccount>,
}

#[account]
#[derive(InitSpace)]
pub struct CandidateAccount {
    pub poll_account: Pubkey,
    #[max_len(28)]
    pub candidate_name: String,
    #[max_len(280)]
    pub candidate_description: String,
    pub candidate_votes: u64,    
}

#[account]
#[derive(InitSpace)]
pub struct PollAccount{
    pub creator: Pubkey,
    pub poll_id: u64,
    #[max_len(28)]
    pub poll_name: String,
    #[max_len(280)]
    pub poll_description: String,
    pub poll_voting_start: u64,
    pub poll_voting_end: u64,
    pub poll_option_index: u64,
   
}

#[error_code]
pub enum ErrorCode {
    #[msg("Voting has not started yet")]
    VotingNotStarted,
    #[msg("Voting has ended")]
    VotingEnded,
    #[msg("Only the poll creator can add candidate")]
    UnauthorizedCandidateModification,
}
