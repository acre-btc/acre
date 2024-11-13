import { Pathname } from "#/router/path"

export type ModalProps = Record<string, unknown>

export type BaseModalProps = {
  closeModal: () => void
  withCloseButton?: boolean
  closeOnEsc?: boolean
  navigateToOnClose?: Pathname
}

export const MODAL_TYPES = {
  STAKE: "STAKE",
  UNSTAKE: "UNSTAKE",
  WELCOME: "WELCOME",
  MEZO_BEEHIVE: "MEZO_BEEHIVE",
  CONNECT_WALLET: "CONNECT_WALLET",
  UNEXPECTED_ERROR: "UNEXPECTED_ERROR",
  ACRE_POINTS_CLAIM: "ACRE_POINTS_CLAIM",
  GATE: "GATE",
} as const

export type ModalType = (typeof MODAL_TYPES)[keyof typeof MODAL_TYPES]
