import React from "react"
import { StackProps, VStack, Image, Text } from "@chakra-ui/react"
import { useActivitiesCount, useIsFetchedWalletData } from "#/hooks"
import UserDataSkeleton from "#/components/shared/UserDataSkeleton"
import { emptyState } from "#/assets/images"
import TransactionTable from "./TransactionTable"

function TransactionHistoryContent() {
  const activitiesCount = useActivitiesCount()
  const isFetchedWalletData = useIsFetchedWalletData()

  if (!isFetchedWalletData)
    return (
      <VStack w="100%" spacing={2}>
        {[...Array(3).keys()].map((key) => (
          <UserDataSkeleton key={key} height={8} w="100%" />
        ))}
      </VStack>
    )

  if (activitiesCount === 0)
    return (
      <VStack w="100%">
        <Image src={emptyState} alt="Stack of paper with magnifying glass" />,
        <Text size="md" color="text.tertiary">
          You have no transactions yet!
        </Text>
      </VStack>
    )

  return <TransactionTable />
}

export default function TransactionHistory(props: StackProps) {
  return (
    <VStack spacing={6} w="full" {...props}>
      <Text size="md" w="full">
        Your Transactions
      </Text>
      <TransactionHistoryContent />
    </VStack>
  )
}
