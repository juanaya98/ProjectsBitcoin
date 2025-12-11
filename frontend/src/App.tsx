import { useEffect, useState } from "react";
import {
  useAccount,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useWriteContract,
} from "wagmi";
import { formatEther, parseAbiItem, parseEther } from "viem";

// Asegúrate de que este path existe y es el ABI actualizado de SimpleVault
import vaultJson from "./abi/SimpleVault.json";

const VAULT_ADDRESS = "0x5FbDB2315678afecb367f032d93F642f64180aa3" as `0x${string}`;

// Si TypeScript se queja, puedes ajustar este cast.
const vaultAbi = (vaultJson as any).abi;

type HistoryEntry = {
  txType: "DEPOSIT" | "WITHDRAW";
  amountEth: string;
  txHash: string;
  blockNumber: bigint;
};

function App() {
  const { address, isConnected } = useAccount();

  // Usamos los connectors ya configurados en tu wagmi config (main.tsx)
  const {
    connect,
    connectors,
    isPending: isConnecting,
  } = useConnect();
  const { disconnect } = useDisconnect();

  const publicClient = usePublicClient();

  const [depositAmount, setDepositAmount] = useState("0.01");
  const [withdrawAmount, setWithdrawAmount] = useState("0.005");
  const [txMessage, setTxMessage] = useState<string | null>(null);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [historyError, setHistoryError] = useState<string | null>(null);

  // Balance del vault para el usuario conectado
  const {
    data: rawBalance,
    refetch: refetchBalance,
    isLoading: isLoadingBalance,
  } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "balanceOf",
    args: address ? [address as `0x${string}`] : undefined,
    query: {
      enabled: !!address,
    },
  });

  // lockPeriod (en segundos)
  const { data: rawLockPeriod } = useReadContract({
    address: VAULT_ADDRESS,
    abi: vaultAbi,
    functionName: "lockPeriod",
  });

  const { data: rawLastDepositTime } = useReadContract({
  address: VAULT_ADDRESS,
  abi: vaultAbi,
  functionName: "lastDepositTime",
  args: address ? [address as `0x${string}`] : undefined,
  query: {
    enabled: !!address,
  },
});

  const {
    writeContractAsync,
    isPending: isWriting,
  } = useWriteContract();

  const balanceEth =
    rawBalance !== undefined ? formatEther(rawBalance as bigint) : "0.0";

  const lockPeriodSeconds =
    rawLockPeriod !== undefined ? Number(rawLockPeriod) : null;

  // Cargar historial desde logs (Deposited / Withdrawn)
  useEffect(() => {
    const loadHistory = async () => {
      if (!publicClient || !address) return;

      try {
        setIsLoadingHistory(true);
        setHistoryError(null);

        const depositEvent = parseAbiItem(
          "event Deposited(address indexed user, uint256 amount)"
        );
        const withdrawEvent = parseAbiItem(
          "event Withdrawn(address indexed user, uint256 amount)"
        );

        const depositLogs = await publicClient.getLogs({
          address: VAULT_ADDRESS,
          event: depositEvent,
          args: {
            user: address as `0x${string}`,
          },
          fromBlock: 0n,
          toBlock: "latest",
        });

        const withdrawLogs = await publicClient.getLogs({
          address: VAULT_ADDRESS,
          event: withdrawEvent,
          args: {
            user: address as `0x${string}`,
          },
          fromBlock: 0n,
          toBlock: "latest",
        });

        const depositEntries: HistoryEntry[] = depositLogs.map((log) => ({
          txType: "DEPOSIT",
          amountEth: formatEther(log.args.amount as bigint),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber ?? 0n,
        }));

        const withdrawEntries: HistoryEntry[] = withdrawLogs.map((log) => ({
          txType: "WITHDRAW",
          amountEth: formatEther(log.args.amount as bigint),
          txHash: log.transactionHash,
          blockNumber: log.blockNumber ?? 0n,
        }));

        const merged = [...depositEntries, ...withdrawEntries].sort(
          (a, b) => Number(a.blockNumber - b.blockNumber)
        );

        setHistory(merged);
      } catch (err: any) {
        setHistoryError(err?.message ?? "Error loading history");
      } finally {
        setIsLoadingHistory(false);
      }
    };

    loadHistory();
  }, [publicClient, address]);

  const handleDeposit = async () => {
    if (!depositAmount) return;
    setTxMessage(null);

    try {
      const value = parseEther(depositAmount);
      const txHash = await writeContractAsync({
        address: VAULT_ADDRESS,
        abi: vaultAbi,
        functionName: "deposit",
        value,
      });
      setTxMessage(`Deposit transaction sent: ${txHash}`);
      await refetchBalance();
    } catch (err: any) {
      const msg =
        err?.shortMessage || err?.message || "Error sending deposit transaction";
      setTxMessage(msg);
    }
  };

  const handleWithdraw = async () => {
  if (!withdrawAmount) return;
  setTxMessage(null);

  try {
    if (!rawBalance) {
      setTxMessage("Unable to read vault balance.");
      return;
    }

    const amountWei = parseEther(withdrawAmount);
    const currentBalance = rawBalance as bigint;

    // 1) Verificar que haya balance suficiente
    if (amountWei <= 0n) {
      setTxMessage("Withdraw amount must be greater than 0.");
      return;
    }

    if (amountWei > currentBalance) {
      setTxMessage("Insufficient vault balance.");
      return;
    }

    // 2) Verificar que no esté dentro del lockPeriod
    if (rawLastDepositTime && lockPeriodSeconds !== null) {
      const lastDepTs = Number(rawLastDepositTime);
      if (lastDepTs > 0) {
        const nowSec = Math.floor(Date.now() / 1000);
        const unlockTime = lastDepTs + lockPeriodSeconds;

        if (nowSec <= unlockTime) {
          const remaining = unlockTime - nowSec;
          setTxMessage(
            `Funds are still locked. Try again in ~${remaining} seconds.`
          );
          return;
        }
      }
    }

    // Si pasa los checks, ahora sí llamamos al contrato
    const txHash = await writeContractAsync({
      address: VAULT_ADDRESS,
      abi: vaultAbi,
      functionName: "withdraw",
      args: [amountWei],
    });

    setTxMessage(`Withdraw transaction sent: ${txHash}`);
    await refetchBalance();
  } catch (err: any) {
    console.error(err);
    const msg =
      err?.shortMessage || err?.message || "Error sending withdraw transaction";
    setTxMessage(msg);
  }
};

  const handleConnectClick = () => {
    const connector = connectors[0];
    if (connector) {
      connect({ connector });
    } else {
      console.warn("No connectors available");
    }
  };

  return (
    <div style={{ padding: "2rem", fontFamily: "system-ui, sans-serif" }}>
      <h1>SimpleVault – Proyecto 2</h1>

      {!isConnected && (
        <button
          onClick={handleConnectClick}
          disabled={isConnecting || connectors.length === 0}
        >
          {isConnecting ? "Connecting..." : "Connect Wallet"}
        </button>
      )}

      {isConnected && (
        <>
          <p>Connected as: {address}</p>
          <button onClick={() => disconnect()}>Disconnect</button>

          <hr style={{ margin: "1.5rem 0" }} />

          {lockPeriodSeconds !== null && (
            <p>
              Lock period: {lockPeriodSeconds} seconds after the last deposit.
            </p>
          )}

          <p>
            Your vault balance:{" "}
            {isLoadingBalance ? "Loading..." : `${balanceEth} ETH`}
          </p>

          <div style={{ marginTop: "1rem" }}>
            <h3>Deposit</h3>
            <input
              type="text"
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              style={{ marginRight: "0.5rem" }}
            />
            <button onClick={handleDeposit} disabled={isWriting}>
              {isWriting ? "Sending tx..." : "Deposit"}
            </button>
          </div>

          <div style={{ marginTop: "1rem" }}>
            <h3>Withdraw</h3>
            <input
              type="text"
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{ marginRight: "0.5rem" }}
            />
            <button onClick={handleWithdraw} disabled={isWriting}>
              {isWriting ? "Sending tx..." : "Withdraw"}
            </button>
          </div>

          {txMessage && (
            <p style={{ marginTop: "0.75rem" }}>
              {txMessage}
            </p>
          )}

          <div style={{ marginTop: "2rem" }}>
            <h3>Transaction History</h3>

            {isLoadingHistory && <p>Loading history...</p>}
            {historyError && (
              <p style={{ color: "red" }}>{historyError}</p>
            )}

            {!isLoadingHistory &&
              history.length === 0 &&
              !historyError && (
                <p>No transactions found for this account.</p>
              )}

            {history.length > 0 && (
              <table
                style={{
                  marginTop: "0.5rem",
                  borderCollapse: "collapse",
                  width: "100%",
                  maxWidth: "700px",
                }}
              >
                <thead>
                  <tr>
                    <th
                      style={{
                        borderBottom: "1px solid #ccc",
                        textAlign: "left",
                        padding: "4px",
                      }}
                    >
                      Type
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #ccc",
                        textAlign: "left",
                        padding: "4px",
                      }}
                    >
                      Amount (ETH)
                    </th>
                    <th
                      style={{
                        borderBottom: "1px solid #ccc",
                        textAlign: "left",
                        padding: "4px",
                      }}
                    >
                      Tx Hash
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {history.map((entry, idx) => (
                    <tr key={idx}>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "4px",
                        }}
                      >
                        {entry.txType}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "4px",
                        }}
                      >
                        {entry.amountEth}
                      </td>
                      <td
                        style={{
                          borderBottom: "1px solid #eee",
                          padding: "4px",
                          maxWidth: "260px",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={entry.txHash}
                      >
                        {entry.txHash}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default App;
