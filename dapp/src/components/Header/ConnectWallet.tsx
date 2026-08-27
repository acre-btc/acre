import React from "react"
import {
  Button,
  Flex,
  HStack,
  Icon,
  IconButton,
  Menu,
  MenuButton,
  MenuItem,
  MenuList,
  StackDivider,
  Text,
  useClipboard,
  useMultiStyleConfig,
} from "@chakra-ui/react"
import {
  useIsEmbed,
  useMobileMode,
  useModal,
  usePostHogIdentity,
  useWallet,
} from "#/hooks"
import CurrencyBalance from "#/components/shared/CurrencyBalance"
import { BitcoinIcon } from "#/assets/icons"
import { referralProgram, addressUtils } from "#/utils"
import { motion } from "framer-motion"
import { MODAL_TYPES } from "#/types"
import {
  IconCopy,
  IconLogout,
  IconWallet,
  IconUserCode,
  IconChevronDown,
  IconChevronUp,
} from "@tabler/icons-react"
import { useMatch } from "react-router-dom"
import Tooltip from "../shared/Tooltip"

function isChangeAccountFeatureSupported(embeddedApp: string | undefined) {
  return referralProgram.isEmbedApp(embeddedApp)
}

export default function ConnectWallet() {
  const { isEmbed, embeddedApp } = useIsEmbed()
  const { address, balance, onDisconnect } = useWallet()
  const { isOpenGlobalErrorModal, modalType, openModal } = useModal()
  const { hasCopied, onCopy } = useClipboard(address ?? "")
  const styles = useMultiStyleConfig("Button", {
    variant: "card",
    size: "lg",
  })
  const isDashboardPage = useMatch("/dashboard")
  const { resetIdentity } = usePostHogIdentity()
  const isMobile = useMobileMode()

  const handleConnectWallet = (isReconnecting: boolean = false) => {
    openModal(MODAL_TYPES.CONNECT_WALLET, { isReconnecting })
  }

  const handleDisconnectWallet = () => {
    onDisconnect()
    resetIdentity()
  }

  if (!address) {
    return (
      <Button
        size="lg"
        leftIcon={<Icon as={BitcoinIcon} boxSize={6} />}
        onClick={() => handleConnectWallet(false)}
        {...((modalType === MODAL_TYPES.CONNECT_WALLET ||
          isOpenGlobalErrorModal) && {
          pointerEvents: "none",
        })}
        isDisabled={!isDashboardPage}
      >
        {`Connect ${isEmbed ? "account" : "wallet"}`}
      </Button>
    )
  }
  const options = [
    {
      id: "Copy",
      icon: IconCopy,
      label: hasCopied ? "Address copied" : "Copy Address",
      onClick: onCopy,
      isSupported: true,
      closeOnSelect: false,
    },
    {
      id: "Change account",
      icon: IconUserCode,
      label: "Change account",
      onClick: () => handleConnectWallet(true),
      isSupported: isChangeAccountFeatureSupported(embeddedApp),
      closeOnSelect: true,
    },
    {
      id: "Disconnect",
      icon: IconLogout,
      label: "Disconnect",
      onClick: handleDisconnectWallet,
      closeOnSelect: true,
      isSupported: true,
    },
  ]

  return isMobile ? (
    <Menu>
      {({ isOpen }) => (
        <>
          <MenuButton
            as={Button}
            variant="card"
            leftIcon={<Icon as={BitcoinIcon} boxSize={6} color="acre.50" />}
            rightIcon={isOpen ? <IconChevronUp /> : <IconChevronDown />}
          >
            <Text size="md" color="acre.50" data-sensitive>
              {addressUtils.truncateAddress(address)}
            </Text>
          </MenuButton>
          <MenuList bg="surface.3">
            {options.map(
              (option) =>
                option.isSupported && (
                  <MenuItem
                    key={option.id}
                    closeOnSelect={option.closeOnSelect}
                    {...styles}
                    icon={<Icon as={option.icon} boxSize={5} />}
                    onClick={option.onClick}
                  >
                    {option.label}
                  </MenuItem>
                ),
            )}
          </MenuList>
        </>
      )}
    </Menu>
  ) : (
    <HStack spacing={4}>
      <HStack display={{ base: "none", md: "flex" }}>
        <CurrencyBalance currency="bitcoin" amount={balance} />
        <Icon as={IconWallet} boxSize={5} />
      </HStack>

      <Flex
        as={motion.div}
        whileHover="expanded"
        initial="collapsed"
        animate="collapsed"
        overflow="hidden"
        {...styles}
        pr={0}
      >
        <HStack
          as={motion.div}
          variants={{
            expanded: { paddingRight: 4 },
            collapsed: { paddingRight: 16 },
          }}
          spacing={3}
        >
          <Icon as={BitcoinIcon} boxSize={6} color="acre.50" />
          <Text size="md" color="acre.50" data-sensitive>
            {addressUtils.truncateAddress(address)}
          </Text>
        </HStack>

        <HStack
          as={motion.div}
          variants={{
            expanded: { width: "auto" },
            collapsed: { width: 0 },
          }}
          spacing={1}
          divider={<StackDivider borderColor="surface.5" />}
        >
          {options.map(
            (option) =>
              option.isSupported && (
                <Tooltip
                  key={option.id}
                  size="xs"
                  label={option.label}
                  closeOnClick={false}
                >
                  <IconButton
                    variant="ghost"
                    aria-label={option.id}
                    icon={<Icon as={option.icon} boxSize={5} />}
                    px={2}
                    boxSize={5}
                    onClick={option.onClick}
                  />
                </Tooltip>
              ),
          )}
        </HStack>
      </Flex>
    </HStack>
  )
}
