import React, { PropsWithChildren } from "react"
import { PostHogProvider as Provider } from "posthog-js/react"
import { PostHogConfig } from "posthog-js"
import { featureFlags, env } from "../constants"

const options: Partial<PostHogConfig> = {
  api_host: env.POSTHOG_API_HOST,
  capture_pageview: false,
  persistence: "memory",
  session_recording: {
    maskTextSelector: "[data-sensitive]",
  },
}

function PostHogProvider(props: PropsWithChildren) {
  const { children } = props

  if (!featureFlags.POSTHOG_ENABLED) {
    return children
  }

  return (
    <Provider apiKey={env.POSTHOG_API_KEY} options={options}>
      {children}
    </Provider>
  )
}

export default PostHogProvider
