import { selectActionFlowWithdrawalDestination } from "#/store/action-flow"
import useAppSelector from "./useAppSelector"

export default function useActionFlowWithdrawalDestination() {
  return useAppSelector(selectActionFlowWithdrawalDestination)
}
