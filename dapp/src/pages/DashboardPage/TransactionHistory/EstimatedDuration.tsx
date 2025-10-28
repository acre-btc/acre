import React from "react"
import { Box, Tag, TagLabel, Flex, TagLeftIcon } from "@chakra-ui/react"
import Spinner from "#/components/shared/Spinner"
import { activitiesUtils } from "#/utils"
import { Activity } from "#/types"

export default function EstimatedDuration({
  activity,
}: {
  activity: Activity
}) {
  if (
    activitiesUtils.isActivityCompleted(activity) ||
    activitiesUtils.isActivityMigrated(activity)
  )
    return null

  return (
    <Flex gap={3} flexWrap="wrap">
      <Tag variant="solid">
        <TagLeftIcon
          as={Spinner}
          variant="filled"
          color="acre.50"
          mr={2}
          borderWidth={3}
          boxSize={6}
        />
        <TagLabel>In progress...</TagLabel>
      </Tag>
      <Tag variant="solid">
        <TagLabel display="flex" gap={1}>
          Est. duration
          <Box as="span" color="acre.50">
            {activitiesUtils.getEstimatedDuration(
              activity.amount,
              activity.type,
            )}
          </Box>
        </TagLabel>
      </Tag>
    </Flex>
  )
}
