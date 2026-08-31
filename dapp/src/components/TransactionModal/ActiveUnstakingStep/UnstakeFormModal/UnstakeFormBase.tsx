import React from "react"
import { FormikProps } from "formik"
import { AlertDescription, AlertIcon, Box, Text } from "@chakra-ui/react"
import {
  TOKEN_AMOUNT_FIELD_NAME,
  TokenAmountFormValues,
} from "#/components/shared/TokenAmountForm/TokenAmountFormBase"
import {
  Form,
  FormSubmitButton,
  FormTokenBalanceInput,
} from "#/components/shared/Form"
import FormInput from "#/components/shared/Form/FormInput"
import FormCheckbox from "#/components/shared/Form/FormCheckbox"
import { Alert } from "#/components/shared/Alert"
import { CurrencyType } from "#/types"
import { activitiesUtils } from "#/utils"
import UnstakeDetails from "./UnstakeDetails"
import ActionDurationEstimation from "../../ActionDurationEstimation"

export const WITHDRAW_TO_TBTC_FIELD_NAME = "withdrawToTbtc"
export const DESTINATION_ADDRESS_FIELD_NAME = "destinationAddress"

export type UnstakeFormValues = TokenAmountFormValues & {
  [WITHDRAW_TO_TBTC_FIELD_NAME]?: boolean
  [DESTINATION_ADDRESS_FIELD_NAME]?: string
}

export type UnstakeFormBaseProps = {
  formId?: string
  tokenBalance: bigint
  tokenBalanceInputPlaceholder: string
  tokenAmountLabel?: string
  currency: CurrencyType
}

export default function UnstakeFormBase({
  formId,
  tokenBalance,
  currency,
  tokenBalanceInputPlaceholder,
  tokenAmountLabel,
  ...formikProps
}: UnstakeFormBaseProps & FormikProps<UnstakeFormValues>) {
  const withdrawToTbtc = Boolean(
    formikProps.values[WITHDRAW_TO_TBTC_FIELD_NAME],
  )

  return (
    <Form id={formId} onSubmit={formikProps.handleSubmit}>
      <FormTokenBalanceInput
        name={TOKEN_AMOUNT_FIELD_NAME}
        tokenBalance={tokenBalance}
        placeholder={tokenBalanceInputPlaceholder}
        tokenAmountLabel={tokenAmountLabel}
        currency={currency}
        // A withdrawal always exits the whole position, so the amount is fixed
        // to the balance and the field is read-only.
        defaultAmount={tokenBalance}
        isDisabled
        autoComplete="off"
      />

      <FormCheckbox
        name={WITHDRAW_TO_TBTC_FIELD_NAME}
        label="Withdraw as tBTC to an Ethereum address"
        helperText="Faster option. Your tBTC lands in the account you choose once the withdrawal is processed, skipping the Bitcoin bridge."
        mt={6}
        onValueChange={(checked) => {
          // Validation only runs on submit, so an address error from a previous
          // attempt would otherwise survive un-ticking the box. `useFormField`
          // clears its own field's error, not this one's.
          formikProps.setFieldError(DESTINATION_ADDRESS_FIELD_NAME, undefined)
          if (!checked)
            formikProps
              .setFieldValue(DESTINATION_ADDRESS_FIELD_NAME, "")
              .catch(() => {})
        }}
      />

      {withdrawToTbtc && (
        // `ModalBody` centres its flex children, so `FormInput`'s own
        // `FormControl` would size to the input's intrinsic width instead of
        // filling the modal. Its props reach the `Input`, not that
        // `FormControl`, so the width has to come from a wrapper.
        <Box w="full">
          <FormInput
            name={DESTINATION_ADDRESS_FIELD_NAME}
            label="Ethereum address"
            placeholder="0x..."
            autoComplete="off"
            spellCheck={false}
            // mt={4}
            // The shared outline variant reserves 5rem on the right for
            // `TokenBalanceInput`'s `Max` button, which cut a full address off
            // here. Match the default left padding instead.
            pr={4}
            helperText="Must be an address you control on Ethereum. Do not use an exchange deposit address."
          />
        </Box>
      )}

      <UnstakeDetails
        currency="bitcoin"
        withdrawalDestination={withdrawToTbtc ? "tbtc" : "bitcoin"}
      />

      <Alert bg="oldPalette.opacity.blue.01" justifyContent="start" mt="10">
        <AlertIcon color="blue.50" w="15px" h="15px" alignSelf="self-start" />
        <AlertDescription>
          {withdrawToTbtc ? (
            <Text size="sm">
              Your tBTC is sent to the address above once the withdrawal is
              processed. You&apos;ll need ETH at that address to move or bridge
              it later.
            </Text>
          ) : (
            <Text size="sm">
              Most withdrawals take{" "}
              {activitiesUtils.getEstimatedDuration(
                // We can use 0 here. The redemption process is not related to
                // amount. The withdraw branch returns before `amount` is read.
                0n,
                "withdraw",
              )}{" "}
              to complete, but in some cases may take up to 24 hours.
            </Text>
          )}
        </AlertDescription>
      </Alert>

      <FormSubmitButton mt={8}>
        {withdrawToTbtc ? "Withdraw tBTC" : "Request Withdraw"}
      </FormSubmitButton>

      <ActionDurationEstimation type="withdraw" />
    </Form>
  )
}
