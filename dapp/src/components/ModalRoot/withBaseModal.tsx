import React, { ComponentType, useCallback } from "react"
import { Modal, ModalContent, ModalOverlay, ModalProps } from "@chakra-ui/react"
import { BaseModalProps } from "#/types"
import { useAppNavigate } from "#/hooks"

const MODAL_BASE_SIZE = "md"

function withBaseModal<T extends BaseModalProps>(
  WrappedModalContent: ComponentType<T>,
  modalProps?: Omit<ModalProps, "isOpen" | "onClose" | "children">,
) {
  return function ModalBase(props: T) {
    const { closeModal, closeOnEsc, navigateToOnClose } = props

    const navigate = useAppNavigate()

    const handleCloseModal = useCallback(() => {
      closeModal()

      if (navigateToOnClose) {
        navigate(navigateToOnClose)
      }
    }, [closeModal, navigate, navigateToOnClose])

    return (
      <Modal
        isOpen
        onClose={handleCloseModal}
        closeOnOverlayClick={false}
        size={MODAL_BASE_SIZE}
        closeOnEsc={closeOnEsc}
        {...modalProps}
      >
        <ModalOverlay zIndex="modalOverlay" />
        <ModalContent>
          <WrappedModalContent {...props} closeModal={handleCloseModal} />
        </ModalContent>
      </Modal>
    )
  }
}

export default withBaseModal
