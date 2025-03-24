import React, { useCallback } from "react"
import {
  Link,
  ModalBody,
  ModalFooter,
  ModalHeader,
  Text,
} from "@chakra-ui/react"
import { externalHref } from "#/constants"
import { BaseModalProps } from "#/types"
import { useAccessCode } from "#/hooks"
import withBaseModal from "./ModalRoot/withBaseModal"
import PasswordForm from "./PasswordForm"
import { PasswordFormValues } from "./PasswordForm/PasswordFormBase"

export function GateModalBase({ closeModal }: BaseModalProps) {
  const { saveAccessCode } = useAccessCode()

  const onSubmitForm = useCallback(
    (values: PasswordFormValues) => {
      const { password } = values
      if (!password) return

      closeModal()
      saveAccessCode(password)
    },
    [closeModal, saveAccessCode],
  )

  return (
    <>
      <ModalHeader>Enter password</ModalHeader>
      <ModalBody>
        <PasswordForm submitButtonText="Connect" onSubmitForm={onSubmitForm} />
      </ModalBody>
      <ModalFooter pt={0}>
        <Text size="sm">
          Don’t have a password? Contact us on{" "}
          <Link
            fontWeight="bold"
            textDecoration="underline"
            href={externalHref.DISCORD}
            isExternal
          >
            Discord
          </Link>
        </Text>
      </ModalFooter>
    </>
  )
}

const GateModal = withBaseModal(GateModalBase, { closeOnEsc: false })
export default GateModal
