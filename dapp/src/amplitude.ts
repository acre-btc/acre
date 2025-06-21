import * as amplitude from "@amplitude/analytics-browser"
import env from "#/constants/env"

type WalletType = "okx" | "unisat" | "xverse"

export interface AnalyticsEventData {
  wallet_connection_clicked: Record<string, never>
  wallet_connection_started: { wallet_type: WalletType; is_embed: boolean }
  wallet_connection_completed: { wallet_type: WalletType }

  deposit_btc_started: Record<string, never>
  deposit_btc_completed: Record<string, never>
  deposit_btc_failed: Record<string, never>

  withdraw_btc_started: Record<string, never>
  withdraw_btc_completed: Record<string, never>
  withdraw_btc_failed: Record<string, never>

  mezo_mats_clicked: Record<string, never>
  footer_faq_clicked: Record<string, never>
  footer_docs_clicked: Record<string, never>
  footer_blog_clicked: Record<string, never>
}

export type AnalyticsEvent = keyof AnalyticsEventData

export const initializeAmplitude = () => {
  amplitude.init(env.AMPLITUDE_API_KEY, undefined, {
    autocapture: true,
  })
}

export const trackEvent = <T extends AnalyticsEvent>(
  eventName: T,
  eventData?: AnalyticsEventData[T],
) => {
  if (env.AMPLITUDE_API_KEY) {
    amplitude.track(eventName, eventData)
  }
}
