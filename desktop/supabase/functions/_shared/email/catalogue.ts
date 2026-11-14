/**
 * Every email string, keyed by meaning. Voice: docs/story (calm and precise, en-GB): say what
 * was checked and what happened, no disk-space promises, no exclamation marks. Products speak
 * as the team. The words follow the approved click dummy's email page.
 */
export const EMAIL_COPY = {
  welcome: {
    subject: 'Your linux-cleanup account is ready',
    eyebrow: 'Account ready',
    heading: 'Your account is ready.',
    intro: (extra: number, device: number) =>
      `You now have ${extra} more real runs each month, on top of the ${device} each computer gets. Dry runs stay unlimited and remove nothing.`,
    facts: { account: 'Account', runs: 'Real runs this month', previews: 'Dry runs', unlimited: 'Unlimited' },
    button: 'Open linux-cleanup',
  },
  receipt: {
    subject: (plan: string) => `Your linux-cleanup ${plan} receipt`,
    eyebrow: 'Payment receipt',
    heading: (plan: string) => `${plan} is active.`,
    intro: 'Real runs have no monthly limit now, and synced receipts, schedules and exports are switched on.',
    facts: { plan: 'Plan', amount: 'Amount', period: 'Period', seats: 'Seats', paidWith: 'Paid with' },
    paidWith: 'Polar',
    button: 'View your plan',
  },
  returned: {
    subject: 'A linux-cleanup payment was returned',
    eyebrow: 'Payment returned',
    heading: 'Your payment was returned to you.',
    intro: (plan: string) =>
      `Your bank or the payment provider returned the payment for the period below, so that period of ${plan} has ended. Your local reports and settings are unchanged.`,
    facts: { plan: 'Plan', amount: 'Amount returned', planNow: 'Plan now' },
    button: 'See plans',
  },
  referral: {
    subject: 'A friend’s linux-cleanup account is confirmed',
    eyebrow: 'Referral confirmed',
    heading: 'Your invite counted.',
    intro: (confirmed: number, threshold: number, rewarded: boolean) =>
      rewarded
        ? `A friend’s account is confirmed. You now have ${confirmed} confirmed friends, so one month of Pro is added to your account.`
        : `A friend’s account is confirmed. You now have ${confirmed} confirmed friends; every ${threshold} add one month of Pro.`,
    facts: { points: 'Points', confirmed: 'Confirmed friends', reward: 'Reward' },
    rewardYes: '1 month of Pro',
    rewardNotYet: 'Not yet',
    button: 'See your account',
  },
  invite: {
    subject: 'You are invited to a linux-cleanup team',
    eyebrow: 'Team invite',
    heading: (team: string) => `Join ${team} on linux-cleanup.`,
    intro: 'Your seat includes Pro and adds your computer to the team report. Only run numbers are shared; file paths stay on your machine.',
    facts: { team: 'Team', invitedBy: 'Invited by', seat: 'Seat' },
    seatMember: 'Member',
    button: 'Accept the invite',
  },
  schedule: {
    subject: (name: string) => `${name} finished`,
    eyebrow: 'Scheduled run',
    heading: 'Your scheduled run finished.',
    intro: (name: string, time: string) => `“${name}” ran at ${time}. The receipt in the app lists what was removed and what was kept.`,
    facts: { sections: 'Steps', freeSpace: 'Free space', nextRun: 'Next run' },
    sectionCounts: (attempted: number, completed: number) => `${attempted} attempted · ${completed} completed`,
    button: 'Open the receipt',
  },
  confirmNews: {
    subject: 'Confirm linux-cleanup release emails',
    eyebrow: 'Release emails',
    heading: 'Confirm to start release emails.',
    intro: 'Someone asked for linux-cleanup release notes at this address. Confirm below to start. If it was not you, ignore this email and nothing more arrives.',
    facts: { list: 'List', listName: 'linux-cleanup releases', often: 'How often', oftenValue: 'About one email per release', stop: 'Stop any time', stopValue: 'Unsubscribe link in every email' },
    button: 'Confirm release emails',
    footer: 'You get this email because this address was entered on linux-cleanup.aoneahsan.com.',
  },
  intervals: { month: 'monthly', year: 'yearly' } as Record<string, string>,
} as const;
