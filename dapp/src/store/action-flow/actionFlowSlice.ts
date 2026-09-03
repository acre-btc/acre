import {
  ACTION_FLOW_TYPES,
  ActionFlowType,
  PROCESS_STATUSES,
  ProcessStatus,
  TokenAmount,
  WithdrawalDestination,
} from "#/types"
import { PayloadAction, createSlice } from "@reduxjs/toolkit"

type ActionFlowState = {
  type: ActionFlowType
  activeStep: number
  status: ProcessStatus
  tokenAmount?: TokenAmount
  txHash?: string
  withdrawalDestination?: WithdrawalDestination
}

const initialState: ActionFlowState = {
  type: ACTION_FLOW_TYPES.STAKE,
  activeStep: 1,
  status: PROCESS_STATUSES.IDLE,
  tokenAmount: undefined,
  txHash: undefined,
  withdrawalDestination: undefined,
}

export const actionFlowSlice = createSlice({
  name: "action-flow",
  initialState,
  reducers: {
    setType(state, action: PayloadAction<ActionFlowType>) {
      state.type = action.payload
    },
    setActiveStep(state, action: PayloadAction<number>) {
      state.activeStep = action.payload
    },
    setStatus(state, action: PayloadAction<ProcessStatus>) {
      state.status = action.payload
    },
    setTokenAmount(state, action: PayloadAction<TokenAmount | undefined>) {
      state.tokenAmount = action.payload
    },
    setTxHash(state, action: PayloadAction<string | undefined>) {
      state.txHash = action.payload
    },
    setWithdrawalDestination(
      state,
      action: PayloadAction<WithdrawalDestination | undefined>,
    ) {
      state.withdrawalDestination = action.payload
    },
    goNextStep(state) {
      state.activeStep += 1
    },
    resetState: () => initialState,
  },
})

export const {
  setType,
  setStatus,
  setTokenAmount,
  setTxHash,
  setWithdrawalDestination,
  goNextStep,
  resetState,
} = actionFlowSlice.actions
