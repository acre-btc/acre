import React from "react"
import {
  Button,
  ModalBody,
  ModalCloseButton,
  ModalHeader,
  Text,
} from "@chakra-ui/react"
import Spinner from "#/components/Spinner"

export default function BuildTransactionModal({
  onClose,
}: {
  onClose: () => void
}) {
  return (
    <>
      <ModalCloseButton onClick={onClose} />
      <ModalHeader>Preparing withdrawal transaction...</ModalHeader>
      <ModalBody>
        <Spinner size="xl" variant="filled" />
        <Text size="md">This may take a few minutes.</Text>
        <Button size="lg" width="100%" variant="outline" onClick={onClose}>
          Cancel
        </Button>
      </ModalBody>
    </>
  )
}
