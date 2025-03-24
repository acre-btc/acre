import React from "react"
import {
  ModalHeader,
  ModalBody,
  ModalFooter,
  Button,
  HStack,
  Text,
} from "@chakra-ui/react"
import { PauseIcon } from "#/assets/icons"
import { useActionFlowPause, useActionFlowType } from "#/hooks"
import { ACTION_FLOW_TYPES, BaseModalProps } from "#/types"
import Spinner from "../Spinner"

export default function ResumeModal({ closeModal }: BaseModalProps) {
  const { handleResume } = useActionFlowPause()
  const type = useActionFlowType()

  const btnText =
    type === ACTION_FLOW_TYPES.STAKE ? "Resume deposit" : "Resume withdrawal"

  return (
    <>
      <ModalHeader pb={{ sm: 6 }} textAlign="center">
        Paused
      </ModalHeader>
      <ModalBody textAlign="start" py={6} mx={3} gap={4}>
        <HStack position="relative" justifyContent="center">
          <Spinner size="2xl" variant="filled" />
          <PauseIcon position="absolute" boxSize={6} color="acre.50" />
        </HStack>

        <Text size="md">Are you sure you want to cancel?</Text>
      </ModalBody>
      <ModalFooter flexDirection="column" gap={2}>
        <Button size="lg" width="100%" onClick={handleResume}>
          {btnText}
        </Button>
        <Button size="lg" width="100%" variant="outline" onClick={closeModal}>
          Yes, cancel
        </Button>
      </ModalFooter>
    </>
  )
}
