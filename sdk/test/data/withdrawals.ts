export const acreSubgraphWithdrawalsDataResponse = {
  data: {
    withdraws: [
      {
        id: "1",
        redeemerOutputScript: "0x0014e30b33e50bc704a4c620ef180f4c8fbdaa8f6927",
        requestedAmount: "14985000000000000",
        bitcoinTransactionId: null,
        amount: null,
        amountToRedeem: "14947630922693266",
        events: [
          {
            id: "0x1d2980a5e55c9201445da5580aa65c304ea046728ee0def257d30469795bde1f_RedeemAndBridgeRequested",
            timestamp: "1759706723",
            type: "Requested",
          },
        ],
      },
      {
        id: "2",
        redeemerOutputScript:
          "0x1600140eb14f3977a4775418aac9481f73e893ef6fae96",
        requestedAmount: "10000000000000000",
        bitcoinTransactionId:
          "8669000602eee2373124768bebd8751128e861f16fd6f4021eccaf11cba35103",
        amount: "9975062344139650",
        amountToRedeem: "9975062344139650",
        events: [
          {
            id: "0x943afdf27e2679685e68b6c664c370c558ebdb0842621cb6fb1a997fc67f1ceb_RedeemAndBridgeRequested",
            timestamp: "1760089859",
            type: "Requested",
          },
          {
            id: "0x55d75f7b334cfa8222e5bcd1cdddbafb883f5aa6c508e3de68ba3443051274c0_RedemptionRequested",
            timestamp: "1760120447",
            type: "Initialized",
          },
          {
            id: "0x91ad60cf7d824088c117e89f41d42627c02d713e91818362b2c9f8e7af16098a_2_RedemptionCompleted",
            timestamp: "1760151839",
            type: "Finalized",
          },
        ],
      },
    ],
  },
}

export const acreSubgraphApiParsedWithdrawalsData = [
  {
    id: "1",
    bitcoinTransactionId: undefined,
    amount: undefined,
    requestedAmount: 14985000000000000n,
    requestedAt: 1759706723,
    initializedAt: undefined,
    finalizedAt: undefined,
  },
  {
    id: "2",
    bitcoinTransactionId:
      "8669000602eee2373124768bebd8751128e861f16fd6f4021eccaf11cba35103",
    requestedAmount: 10000000000000000n,
    amount: 9975062344139650n,
    requestedAt: 1760089859,
    initializedAt: 1760120447,
    finalizedAt: 1760151839,
  },
]
