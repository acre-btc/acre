import React, { useMemo } from "react"
import {
  StackProps,
  useMultiStyleConfig,
  HStack,
  VStack,
  Grid,
  Box,
  Text,
} from "@chakra-ui/react"
import { useStatistics } from "#/hooks"
import { BitcoinIcon } from "#/assets/icons"
import CurrencyBalance from "#/components/shared/CurrencyBalance"
import ProgressBar from "#/components/shared/ProgressBar"

type AcreTVLProgressProps = StackProps

const STEP_COUNT = 5

export default function AcreTVLProgress(props: AcreTVLProgressProps) {
  const styles = useMultiStyleConfig("AcreTVLProgress")
  const statistics = useStatistics()

  const { tvl } = statistics.data

  const steps = useMemo(
    () =>
      tvl.cap > 0
        ? Array(STEP_COUNT)
            .fill(0)
            .map((_, index) => (index + 1) * Math.floor(tvl.cap / STEP_COUNT))
        : [],
    [tvl.cap],
  )

  return (
    <Box sx={styles.container} {...props}>
      <Box sx={styles.wrapper}>
        <Grid sx={styles.contentWrapper}>
          <BitcoinIcon sx={styles.valueIcon} />

          <CurrencyBalance
            size="3xl"
            amount={tvl.value}
            shouldBeFormatted={false}
            currency="bitcoin"
            desiredDecimals={2}
          />

          <Text size="md">Total value locked</Text>
        </Grid>

        <VStack sx={styles.progressWrapper}>
          <HStack sx={styles.progressLabelsWrapper}>
            {steps.map((value) => (
              <Text size="xs" key={value} sx={styles.progressLabel}>
                {value}
              </Text>
            ))}
          </HStack>

          <ProgressBar value={tvl.progress} withBoltIcon={tvl.progress > 2} />
        </VStack>
      </Box>
    </Box>
  )
}
