import { useCallback, useMemo } from "react"
import {
  Connector,
  useAccount,
  useChainId,
  useConfig,
  useConnect,
  useDisconnect,
} from "wagmi"
import { orangeKit } from "#/utils"
import sentry from "#/sentry"
import {
  OnErrorCallback,
  OrangeKitConnector,
  OrangeKitError,
  Status,
} from "#/types"
import { useMutation, useQueryClient } from "@tanstack/react-query"
import { useDispatch } from "react-redux"
import { setAddress } from "#/store/wallet"
import { identifyUser } from "#/amplitude"
import useResetWalletState from "./useResetWalletState"
import useLastUsedBtcAddress from "./useLastUsedBtcAddress"
import useBitcoinBalance from "./useBitcoinBalance"
import { useWalletAddress } from "./store"

const { typeConversionToConnector, typeConversionToOrangeKitConnector } =
  orangeKit

type UseWalletReturn = {
  isConnected: boolean
  address?: string
  ethAddress?: string
  balance?: bigint
  status: Status
  onConnect: (
    connector: OrangeKitConnector,
    options?: {
      isReconnecting?: boolean
      onSuccess?: (connector: OrangeKitConnector) => void
      onError?: OnErrorCallback<OrangeKitError>
    },
  ) => void
  onDisconnect: () => void
}

export default function useWallet(): UseWalletReturn {
  const queryClient = useQueryClient()
  const dispatch = useDispatch()
  const btcAddress = useWalletAddress()
  const resetWalletState = useResetWalletState()
  const { setAddressInLocalStorage, removeAddressFromLocalStorage } =
    useLastUsedBtcAddress()

  const { data: balance } = useBitcoinBalance()

  const chainId = useChainId()
  const config = useConfig()
  // `useAccount` hook returns the Ethereum address
  const { status: accountStatus, address: account } = useAccount()

  // `isConnected` is variable derived from `status` but does not guarantee us a
  // set `address`. When `status` is 'connected' properties like `address` are
  // guaranteed to be defined. Let's use `status` to make sure the account is
  // connected.
  const isConnected = useMemo(
    () => orangeKit.isConnectedStatus(accountStatus),
    [accountStatus],
  )

  const { connect, status } = useConnect({
    mutation: {
      onSuccess: async (_, { connector }) => {
        const connectedConnector = typeConversionToOrangeKitConnector(
          connector as Connector,
        )
        const bitcoinAddress = await connectedConnector.getBitcoinAddress()

        dispatch(setAddress(bitcoinAddress))
        setAddressInLocalStorage(bitcoinAddress)
        sentry.setUser(bitcoinAddress)
        identifyUser(bitcoinAddress)
      },
    },
  })

  const { disconnect } = useDisconnect({
    mutation: {
      onSuccess: () => {
        config.setState((prevState) => ({ ...prevState, current: null }))
        dispatch(setAddress(undefined))
        removeAddressFromLocalStorage()
        resetWalletState()
        sentry.setUser(undefined)
        identifyUser(undefined)
      },
    },
  })

  const { mutate: reconnect, status: reconnectStatus } = useMutation(
    {
      mutationFn: async (selectedConnector: OrangeKitConnector) => {
        if (!selectedConnector.connect) return
        const prevAddress = await selectedConnector.getBitcoinAddress()
        const {
          accounts: [newAccount],
        } = await selectedConnector.connect({ chainId, isReconnecting: true })
        const newAddress = await selectedConnector.getBitcoinAddress()

        if (newAddress !== prevAddress) {
          config.setState((prevState) => ({
            ...prevState,
            status: "connected",
            connections: new Map(prevState.connections).set(
              prevState.current!,
              {
                // Update accounts to force update of wagmi hooks.
                accounts: [newAccount],
                connector:
                  orangeKit.typeConversionToConnector(selectedConnector),
                chainId,
              },
            ),
          }))
          resetWalletState()
        }
      },
      mutationKey: ["reconnect"],
      onSuccess: async (_, selectedConnector) => {
        const bitcoinAddress = await selectedConnector.getBitcoinAddress()

        dispatch(setAddress(bitcoinAddress))
        setAddressInLocalStorage(bitcoinAddress)
        sentry.setUser(bitcoinAddress)
        identifyUser(bitcoinAddress)
      },
    },
    queryClient,
  )

  const onConnect = useCallback(
    (
      selectedConnector: OrangeKitConnector,
      options?: {
        onSuccess?: (connector: OrangeKitConnector) => void
        onError?: OnErrorCallback<OrangeKitError>
        isReconnecting?: boolean
      },
    ) => {
      if (options?.isReconnecting) {
        reconnect(selectedConnector, {
          onSuccess: (_, connectedConnector) =>
            options?.onSuccess?.(connectedConnector),
          onError: options.onError,
        })
        return
      }

      connect(
        { connector: typeConversionToConnector(selectedConnector), chainId },
        {
          onError: (error) => {
            if (options?.onError) options.onError(error)
          },
          onSuccess: (_, variables) => {
            if (
              options?.onSuccess &&
              typeof variables.connector !== "function"
            ) {
              options.onSuccess(
                typeConversionToOrangeKitConnector(variables.connector),
              )
            }
          },
        },
      )
    },
    [connect, chainId, reconnect],
  )

  return useMemo(
    () => ({
      isConnected,
      address: btcAddress,
      ethAddress: account,
      balance,
      status:
        status === "idle" && reconnectStatus !== "idle"
          ? reconnectStatus
          : status,
      onConnect,
      onDisconnect: disconnect,
    }),
    [
      btcAddress,
      balance,
      account,
      isConnected,
      onConnect,
      disconnect,
      status,
      reconnectStatus,
    ],
  )
}
