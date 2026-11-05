import React from "react";
import { ProposalConfirmationGate } from "./ProposalConfirmationGate";

/**
 * CardHost:
 * Per user instruction, unnecessary read-only cards are suppressed.
 * Only interactive proposal confirmation cards are rendered when a consequential action requires confirmation.
 */
export function CardHost({ card, onConfirmProposal, onRejectProposal }) {
  if (!card) return null;

  if (card.cardType === "proposal_confirmation_card") {
    return (
      <ProposalConfirmationGate
        card={card}
        onConfirm={onConfirmProposal}
        onReject={onRejectProposal}
      />
    );
  }

  return null;
}

export default CardHost;
