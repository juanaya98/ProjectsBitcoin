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
import "./App.css";

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
    <div className="app-container">
      <div className="header">
        <h1>SimpleVault</h1>
        <p>Secure Ethereum Vault DApp</p>
      </div>

      <div className="content-wrapper">
        {!isConnected && (
          <div className="connect-section">
            <div className="glass-card">
              <h2>Connect Your Wallet</h2>
              <p>Connect your MetaMask wallet to start using SimpleVault</p>
              <button
                className="btn btn-primary"
                onClick={handleConnectClick}
                disabled={isConnecting || connectors.length === 0}
              >
                {isConnecting ? "Connecting..." : "Connect Wallet"}
              </button>
            </div>
          </div>
        )}

        {isConnected && (
          <>
          <div className="wallet-info">
            <div className="wallet-info-content">
              <div className="wallet-label">Connected Wallet</div>
              <div className="address-badge">{address}</div>
            </div>
            <button className="btn btn-secondary" onClick={() => disconnect()}>Disconnect</button>
          </div>

          <div className="balance-display">
            <div className="balance-label">Your Balance in Vault</div>
            <div className="balance-amount">
              {isLoadingBalance ? "Loading..." : `${balanceEth} ETH`}
            </div>
            {lockPeriodSeconds !== null && (
              <div className="lock-info">
                🔒 Lock period: {lockPeriodSeconds} seconds after deposit
              </div>
            )}
          </div>

          <div className="actions-grid">
            <div className="action-card">
              <h3>Deposit ETH</h3>
              <div className="input-wrapper">
                <label className="input-label">Amount (ETH)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="0.0"
                  value={depositAmount}
                  onChange={(e) => setDepositAmount(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleDeposit} disabled={isWriting}>
                {isWriting ? "Sending tx..." : "Deposit"}
              </button>
            </div>

            <div className="action-card">
              <h3>Withdraw ETH</h3>
              <div className="input-wrapper">
                <label className="input-label">Amount (ETH)</label>
                <input
                  type="text"
                  className="input-field"
                  placeholder="0.0"
                  value={withdrawAmount}
                  onChange={(e) => setWithdrawAmount(e.target.value)}
                />
              </div>
              <button className="btn btn-primary" onClick={handleWithdraw} disabled={isWriting}>
                {isWriting ? "Sending tx..." : "Withdraw"}
              </button>
            </div>
          </div>

          {txMessage && (
            <div className="message success">
              {txMessage}
            </div>
          )}

          <div className="history-section">
            <h2>Transaction History</h2>

            {isLoadingHistory && <div className="loading">Loading history...</div>}
            {historyError && (
              <div className="message error">{historyError}</div>
            )}

            {!isLoadingHistory &&
              history.length === 0 &&
              !historyError && (
                <div className="empty-state">No transactions found for this account.</div>
              )}

            {history.length > 0 && (
              <div className="table-wrapper">
                <table className="history-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Amount (ETH)</th>
                      <th>Tx Hash</th>
                    </tr>
                  </thead>
                  <tbody>
                    {history.map((entry, idx) => (
                      <tr key={idx}>
                        <td>
                          <span className={`tx-badge ${entry.txType.toLowerCase()}`}>
                            {entry.txType}
                          </span>
                        </td>
                        <td>{entry.amountEth}</td>
                        <td className="tx-hash" title={entry.txHash}>
                          {entry.txHash}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </>
      )}
      </div>
    </div>
  );
}

export default App;
