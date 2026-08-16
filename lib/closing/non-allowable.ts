/**
 * Fees a VA borrower may NOT be charged.
 *
 * The lender's 1% flat origination charge is meant to cover these. If a lender
 * charges the 1% flat fee, it cannot also itemise the items below to the
 * veteran — someone else (seller, lender, agent) has to absorb them.
 *
 * Source: VA Lenders Handbook (M26-7) Chapter 8, "Fees and Charges the Veteran-
 * Borrower Cannot Pay". https://www.benefits.va.gov/WARMS/pam26_7.asp
 *
 * LAST_VERIFIED: 2026-08-16
 */
export const LAST_VERIFIED = "2026-08-16";

export const NON_ALLOWABLE_FEES: Array<{ fee: string; note?: string }> = [
  { fee: "Loan application or processing fee" },
  { fee: "Document preparation fee" },
  { fee: "Underwriting fee" },
  { fee: "Escrow / settlement fee charged by the lender", note: "A title company's own settlement fee is allowable." },
  { fee: "Interest rate lock-in fee" },
  { fee: "Tax service fee" },
  { fee: "Prepayment penalty", note: "VA loans may never carry one." },
  { fee: "Attorney fee for the lender's benefit", note: "Your own attorney, hired by you, is fine." },
  { fee: "Trustee fee or charge" },
  { fee: "Loan closing or settlement fee charged by the lender" },
  { fee: "Mortgage broker fee paid by the borrower" },
  { fee: "Photograph or inspection fees beyond those specifically allowed" },
  { fee: "Postage, courier and other overhead", note: "Ordinary cost of doing business." },
  { fee: "Notary fees" },
  {
    fee: "Termite / pest inspection",
    note: "Long restricted on VA purchases and customarily paid by the seller. VA has revised this policy, so confirm the current rule with your lender rather than relying on this list.",
  },
];
