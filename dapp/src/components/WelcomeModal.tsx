import React from "react"
import {
  Button,
  ModalBody,
  ModalHeader,
  Box,
  Stepper,
  Step,
  StepIndicator,
  ModalFooter,
  useSteps,
  SimpleGrid,
  StepIndicatorProps,
  UseStepsReturn,
  Highlight,
  Text,
} from "@chakra-ui/react"
import { BaseModalProps } from "#/types"
import { useMobileMode } from "#/hooks"
import {
  step1Video,
  step2Video,
  step3Video,
} from "#/assets/videos/welcome-steps"
import withBaseModal from "./ModalRoot/withBaseModal"

const steps = [
  {
    id: 0,
    title: (
      <Text size="5xl" fontWeight="semibold">
        Compound your bitcoin,{" "}
        <Box as="span" display="block" color="orange.30">
          earn rewards
        </Box>
      </Text>
    ),
    content: () => (
      <>
        When you deposit BTC, Acre&apos;s dispatcher routes it into audited,
        risk-reviewed vaults run by independent risk managers. Your bitcoin
        stays under your control while it compounds on-chain. Simple, secure,
        transparent.
      </>
    ),
    video: step1Video,
  },
  {
    id: 1,
    title: (
      <Text size="5xl" fontWeight="semibold">
        <Box as="span" display="block" color="orange.30">
          Battle-tested{" "}
        </Box>
        in the market
      </Text>
    ),
    content: () => (
      <Highlight query="tBTC">
        Acre is powered by a trusted, decentralized Bitcoin bridge (tBTC). No
        centralized custodians, everything is fully on-chain.
      </Highlight>
    ),
    video: step2Video,
  },
  {
    id: 2,
    title: (
      <Text size="5xl" fontWeight="semibold">
        One dashboard,{" "}
        <Box as="span" display="block" color="orange.30">
          endless rewards
        </Box>
      </Text>
    ),
    content: () => (
      <Highlight query="Acre Points Program">
        Deposit BTC to start earning. Monitor your position, review the vaults,
        earn with the Acre Points Program automatically, and redeem back into
        Bitcoin at any time. Your bitcoin, on-chain, working for you.
      </Highlight>
    ),
    video: step3Video,
  },
]

const stepIndicatorStyleProps: StepIndicatorProps = {
  sx: {
    "[data-status=active] &": {
      opacity: 1,
    },
    "&[data-status=complete], [data-status=incomplete] &": {
      bgColor: "orange.50",
    },
  },
  border: "none",
  w: "2.5",
  h: "2.5",
  rounded: "50%",
  bgColor: "orange.50",
  opacity: "0.15",
  _hover: {
    cursor: "pointer",
  },
}

function WelcomeModalBase({ closeModal }: BaseModalProps) {
  // Cast to fix eslint error: `unbound-method`.
  const { activeStep, goToNext, setActiveStep } = useSteps({
    index: 0,
    count: steps.length,
  }) as UseStepsReturn & { goToNext: () => void }
  const isMobileMode = useMobileMode()

  const isLastStep = activeStep + 1 === steps.length
  const activeStepData = steps[activeStep]

  return (
    <SimpleGrid columns={2} templateColumns="1fr auto">
      <Box>
        <ModalHeader gap={3} pb={8}>
          <Text size="sm" mb={{ base: 4, md: 12 }} color="text.tertiary">
            Welcome to Acre,
          </Text>
          {activeStepData.title}
        </ModalHeader>
        <ModalBody textAlign="left" display="block" color="text.secondary">
          {activeStepData.content()}
        </ModalBody>
        <ModalFooter
          display="flex"
          flexDirection="row"
          justifyContent="space-between"
          mt={{ base: 0, md: 14 }}
        >
          <Stepper index={activeStep} gap="3">
            {steps.map((step) => (
              <Step key={step.id} onClick={() => setActiveStep(step.id)}>
                <StepIndicator {...stepIndicatorStyleProps} />
              </Step>
            ))}
          </Stepper>
          <Button
            variant={isLastStep ? undefined : "outline"}
            onClick={isLastStep ? closeModal : goToNext}
          >
            {isLastStep ? "Get started" : "Next"}
          </Button>
        </ModalFooter>
      </Box>
      {!isMobileMode && (
        <Box
          as="video"
          src={activeStepData.video}
          width="24rem"
          height="full"
          autoPlay
          muted
          loop
          objectFit="cover"
          roundedRight="md"
          outline="1px solid #f6ead5"
          outlineOffset="-1px"
        />
      )}
    </SimpleGrid>
  )
}

const WelcomeModal = withBaseModal(WelcomeModalBase, {
  size: "xl",
})
export default WelcomeModal
