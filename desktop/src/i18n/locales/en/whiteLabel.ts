/** The inactive-licence view of a white-label build (dormant in our own builds). */
export default {
  inactive: {
    head: 'LICENCE CHECK',
    title: 'This licence is not active',
    reason: 'The licence key in this build is revoked or unknown, so the app has stopped here. Nothing on this computer was changed or deleted.',
    verify: 'Check the licence key ↗',
    fine: 'Receipts, reports and settings stay on this computer. The licence holder can renew or correct the key.',
  },
} as const;
