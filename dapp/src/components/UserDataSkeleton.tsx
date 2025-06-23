import React from "react"
import { SkeletonProps } from "@chakra-ui/react"
import { useIsFetchedWalletData } from "#/hooks"
import Skeleton from "./Skeleton"

export default function UserDataSkeleton({ ...props }: SkeletonProps) {
  const isFetchedWalletData = useIsFetchedWalletData()

  return <Skeleton isLoaded={isFetchedWalletData} {...props} />
}
