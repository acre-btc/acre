import React, { ElementType } from "react"
import { useModal } from "#/hooks"
import { ModalType } from "#/types"
import TransactionModal from "../TransactionModal"
import WelcomeModal from "../WelcomeModal"
import ConnectWalletModal from "../ConnectWalletModal"
import UnexpectedErrorModal from "../UnexpectedErrorModal"
import AcrePointsClaimModal from "../AcrePointsClaimModal"
import GateModal from "../GateModal"
import VaultDetailsModal from "../VaultDetailsModal"

const MODALS: Record<ModalType, ElementType> = {
  STAKE: TransactionModal,
  UNSTAKE: TransactionModal,
  WELCOME: WelcomeModal,
  CONNECT_WALLET: ConnectWalletModal,
  UNEXPECTED_ERROR: UnexpectedErrorModal,
  ACRE_POINTS_CLAIM: AcrePointsClaimModal,
  GATE: GateModal,
  VAULT_DETAILS: VaultDetailsModal,
} as const

export default function ModalRoot() {
  const { modalType, modalProps, closeModal } = useModal()

  if (!modalType) {
    return null
  }
  const SpecificModal = MODALS[modalType]
  return <SpecificModal closeModal={closeModal} {...modalProps} />
}
