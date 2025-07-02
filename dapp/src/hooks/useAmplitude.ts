import { env } from "#/constants"
import * as amplitude from "@amplitude/analytics-browser"
import { LogLevel } from "@amplitude/analytics-browser/lib/esm/types"
import { sessionReplayPlugin } from "@amplitude/plugin-session-replay-browser"
import { useEffect, useRef } from "react"

const useAmplitude = () => {
  const inited = useRef(false)

  useEffect(() => {
    if (inited.current) return // Avoid re-initialization with React Strict Mode
    inited.current = true

    amplitude.add(
      sessionReplayPlugin({
        privacyConfig: {
          maskSelector: ["[data-sensitive]"],
        },
      }),
    )

    amplitude.init(env.AMPLITUDE_API_KEY, undefined, {
      autocapture: true,

      // Disable tracking during development, but log events
      optOut: !env.PROD,
      logLevel: env.PROD ? undefined : LogLevel.Verbose,
    })
  }, [])
}

export default useAmplitude
