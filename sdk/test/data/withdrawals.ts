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
        destination: "Bitcoin",
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
        destination: "Bitcoin",
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
      // A withdrawal to tBTC through the withdrawal queue, still waiting for
      // the Midas vault to settle. There is no `Initialized` stage on this
      // path.
      {
        id: "102",
        redeemerOutputScript: null,
        requestedAmount: "14833959404665139",
        bitcoinTransactionId: null,
        amount: null,
        amountToRedeem: "14833959404665139",
        destination: "Ethereum",
        events: [
          {
            id: "0x3c98c97d4194e04f2f043672e6085d864a84d497401354994af7559bf31880d4_RedemptionRequested",
            timestamp: "1760240000",
            type: "Requested",
          },
        ],
      },
      // The same withdrawal once the Midas vault has settled it. The
      // `Finalized` event belongs to Midas' batched settlement transaction, not
      // to the user's.
      {
        id: "103",
        redeemerOutputScript: null,
        requestedAmount: "2469057825000000",
        bitcoinTransactionId: null,
        amount: "2469057825000000",
        amountToRedeem: "2469057825000000",
        destination: "Ethereum",
        events: [
          {
            id: "0x80c242509dab18a5bbf9335d05b54c93add405b92d570e46023e749b430c8c48_RedemptionRequested",
            timestamp: "1760250000",
            type: "Requested",
          },
          {
            id: "0xb383989d30c935ae3d01be27e6be33b48a35ac794e7931cf06c9f28b38f7266c_103_MidasRedeemApproved",
            timestamp: "1760380000",
            type: "Finalized",
          },
        ],
      },
      // A synchronous redemption straight from acreBTC - requested and
      // finalized in one transaction.
      {
        id: "0xe44f54c54d8cef0dd26612a097cdb848a5b1fdb96f81d1a8a7546e4489d1ca50_7",
        redeemerOutputScript: null,
        requestedAmount: "99999999999999",
        bitcoinTransactionId: null,
        amount: "99999999999999",
        amountToRedeem: "99999999999999",
        destination: "Ethereum",
        events: [
          {
            id: "0xe44f54c54d8cef0dd26612a097cdb848a5b1fdb96f81d1a8a7546e4489d1ca50_7_WithdrawRequested",
            timestamp: "1760400000",
            type: "Requested",
          },
          {
            id: "0xe44f54c54d8cef0dd26612a097cdb848a5b1fdb96f81d1a8a7546e4489d1ca50_7_WithdrawFinalized",
            timestamp: "1760400000",
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
    amount: 14947630922693266n,
    requestedAmount: 14985000000000000n,
    destination: "bitcoin" as const,
    ethereumTransactionId:
      "0x1d2980a5e55c9201445da5580aa65c304ea046728ee0def257d30469795bde1f",
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
    destination: "bitcoin" as const,
    ethereumTransactionId:
      "0x943afdf27e2679685e68b6c664c370c558ebdb0842621cb6fb1a997fc67f1ceb",
    requestedAt: 1760089859,
    initializedAt: 1760120447,
    finalizedAt: 1760151839,
  },
  {
    id: "102",
    bitcoinTransactionId: undefined,
    requestedAmount: 14833959404665139n,
    amount: 14833959404665139n,
    destination: "ethereum" as const,
    ethereumTransactionId:
      "0x3c98c97d4194e04f2f043672e6085d864a84d497401354994af7559bf31880d4",
    requestedAt: 1760240000,
    initializedAt: undefined,
    finalizedAt: undefined,
  },
  {
    id: "103",
    bitcoinTransactionId: undefined,
    requestedAmount: 2469057825000000n,
    amount: 2469057825000000n,
    destination: "ethereum" as const,
    ethereumTransactionId:
      "0x80c242509dab18a5bbf9335d05b54c93add405b92d570e46023e749b430c8c48",
    requestedAt: 1760250000,
    initializedAt: undefined,
    finalizedAt: 1760380000,
  },
  {
    id: "0xe44f54c54d8cef0dd26612a097cdb848a5b1fdb96f81d1a8a7546e4489d1ca50_7",
    bitcoinTransactionId: undefined,
    requestedAmount: 99999999999999n,
    amount: 99999999999999n,
    destination: "ethereum" as const,
    ethereumTransactionId:
      "0xe44f54c54d8cef0dd26612a097cdb848a5b1fdb96f81d1a8a7546e4489d1ca50",
    requestedAt: 1760400000,
    initializedAt: undefined,
    finalizedAt: 1760400000,
  },
]
