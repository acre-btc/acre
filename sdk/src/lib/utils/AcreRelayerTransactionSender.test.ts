import AcreRelayerTransactionSender from "./AcreRelayerTransactionSender"

describe("AcreRelayerTransactionSender", () => {
  let fetchSpy: jest.SpyInstance

  beforeEach(() => {
    fetchSpy = jest.spyOn(globalThis, "fetch")
  })

  afterEach(() => {
    jest.restoreAllMocks()
  })

  it("throws if relayerUrl is empty", () => {
    expect(() => new AcreRelayerTransactionSender("")).toThrow()
  })

  it("POSTs the chainId/to/data triple to the relayer and returns the hash", async () => {
    fetchSpy.mockResolvedValue(
      Response.json({ hash: "0xabc" }, { status: 200 }),
    )

    const sender = new AcreRelayerTransactionSender(
      "https://api.acre.fi/api/v2/relay",
    )
    const result = await sender.sendTransaction({
      chainId: 1,
      to: "0x0000000000000000000000000000000000000001",
      data: "0xdeadbeef",
    })

    expect(result).toEqual({ hash: "0xabc" })
    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.acre.fi/api/v2/relay/transactions",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          chainId: 1,
          to: "0x0000000000000000000000000000000000000001",
          data: "0xdeadbeef",
        }),
      }),
    )
  })

  it("strips a trailing slash from relayerUrl", async () => {
    fetchSpy.mockResolvedValue(
      Response.json({ hash: "0xabc" }, { status: 200 }),
    )

    const sender = new AcreRelayerTransactionSender(
      "https://api.acre.fi/api/v2/relay/",
    )
    await sender.sendTransaction({
      chainId: 1,
      to: "0x0000000000000000000000000000000000000001",
      data: "0xdeadbeef",
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      "https://api.acre.fi/api/v2/relay/transactions",
      expect.anything(),
    )
  })

  it("throws on non-2xx response", async () => {
    fetchSpy.mockResolvedValue(
      new Response("bad input", { status: 400, statusText: "Bad Request" }),
    )

    const sender = new AcreRelayerTransactionSender(
      "https://api.acre.fi/api/v2/relay",
    )
    await expect(
      sender.sendTransaction({
        chainId: 1,
        to: "0x0000000000000000000000000000000000000001",
        data: "0xdeadbeef",
      }),
    ).rejects.toThrow(/400/)
  })

  it("throws if response body is missing the hash", async () => {
    fetchSpy.mockResolvedValue(Response.json({}, { status: 200 }))

    const sender = new AcreRelayerTransactionSender(
      "https://api.acre.fi/api/v2/relay",
    )
    await expect(
      sender.sendTransaction({
        chainId: 1,
        to: "0x0000000000000000000000000000000000000001",
        data: "0xdeadbeef",
      }),
    ).rejects.toThrow(/missing hash/)
  })

  it("falls back to '0x' when data is undefined", async () => {
    fetchSpy.mockResolvedValue(
      Response.json({ hash: "0xabc" }, { status: 200 }),
    )

    const sender = new AcreRelayerTransactionSender(
      "https://api.acre.fi/api/v2/relay",
    )
    await sender.sendTransaction({
      chainId: 1,
      to: "0x0000000000000000000000000000000000000001",
    })

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.any(String),
      expect.objectContaining({
        body: JSON.stringify({
          chainId: 1,
          to: "0x0000000000000000000000000000000000000001",
          data: "0x",
        }),
      }),
    )
  })
})
