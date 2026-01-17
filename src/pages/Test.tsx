import { useEffect, useState } from "react";
// import { SUI_RPC_URL } from "../chain/config";

const SUI_RPC_URL = "https://fullnode.mainnet.sui.io:443";

export default function TestPage() {
  async function rpc(url: string, method: string, params: any[] = []) {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: Date.now(), method, params }),
    });

    console.log("[RPC]", method, "status", res.status, res.statusText);

    const text = await res.text();
    console.log("[RPC]", method, "raw", text.slice(0, 2000));

    // nếu response không phải JSON hợp lệ thì sẽ văng ở đây
    const json = JSON.parse(text);
    if (json.error) throw new Error(JSON.stringify(json.error));
    return json.result;
  }

  const [data, setData] = useState<any>(null);
  const [metrics, setMetrics] = useState<{
    cps: number;
    tps: number;
    windowSize: number;
    latestCheckpoint: string;
  } | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let isActive = true;
    const windowSize = 10;

    const load = async () => {
      setLoading(true);
      try {
        const latest = await rpc(SUI_RPC_URL, "sui_getCheckpoint", []);
        const latestSeq = Number(latest.sequenceNumber ?? 0);
        const latestTs = Number(latest.timestampMs ?? 0);
        const latestTx = BigInt(latest.networkTotalTransactions ?? 0);

        const prevSeq = Math.max(0, latestSeq - windowSize);
        const prev = await rpc(SUI_RPC_URL, "sui_getCheckpoint", [
          { id: { sequenceNumber: String(prevSeq) } },
        ]);
        const prevTs = Number(prev.timestampMs ?? 0);
        const prevTx = BigInt(prev.networkTotalTransactions ?? 0);

        const deltaMs = Math.max(1, latestTs - prevTs);
        const deltaSec = deltaMs / 1000;
        const deltaTx = Number(latestTx - prevTx);
        const tps = deltaTx / deltaSec;
        const cps = windowSize / deltaSec;

        if (!isActive) return;
        setMetrics({
          cps,
          tps,
          windowSize,
          latestCheckpoint: String(latest.sequenceNumber ?? ""),
        });
        setData({ latest, prev });
        setError(null);
      } catch (err) {
        if (!isActive) return;
        setError(err instanceof Error ? err.message : String(err));
        setData(null);
        setMetrics(null);
      } finally {
        if (isActive) setLoading(false);
      }
    };

    void load();
    return () => {
      isActive = false;
    };
  }, []);

  return (
    <div className="landing">
      <h2>Test Page</h2>
      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "red" }}>Error: {error}</p>}
      {metrics && (
        <div style={{ textAlign: "left", marginBottom: 12 }}>
          <div>RPC: {SUI_RPC_URL}</div>
          <div>Checkpoint: {metrics.latestCheckpoint}</div>
          <div>CPS Current: {metrics.cps.toFixed(2)}</div>
          <div>TPS Current: {metrics.tps.toFixed(2)}</div>
          <div>Window: last {metrics.windowSize} checkpoints</div>
        </div>
      )}
      {data && (
        <pre
          style={{
            textAlign: "left",
            background: "#f4f4f4",
            padding: 12,
            borderRadius: 6,
          }}
        >
          {JSON.stringify(data, null, 2)}
        </pre>
      )}
    </div>
  );
}
