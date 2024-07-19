/* eslint-disable no-console */
import React from "react"
import ReactDOM from "react-dom/client"
import DAppProviders from "./DApp"
import { env } from "./constants"

const { NETWORK_TYPE, LATEST_COMMIT_HASH } = env

console.log(`%c🚀 Network: ${NETWORK_TYPE}`, "font-size: 1.5em")
console.log(
  `%c⛓️ Latest commit hash: ${LATEST_COMMIT_HASH}`,
  "font-size: 1.5em",
)

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <DAppProviders />
  </React.StrictMode>,
)
