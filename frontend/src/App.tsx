import { useState } from 'react';
import {
  useAccount,
  useConnect,
  useDisconnect,
  useReadContract,
  useWriteContract,
} from 'wagmi';
import { parseEther, formatEther } from 'viem';
import vaultJson from './abi/SimpleVault.json';

const VAULT_ADDRESS = '0x5FbDB2315678afecb367f032d93F642f64180aa3';
const vaultAbi = (vaultJson as any).abi;

function App() {
  const [depositAmount, setDepositAmount] = useState('0.01');
  const [withdrawAmount, setWithdrawAmount] = useState('0.005');

  const { address, isConnected } = useAccount();

  const {
    connect,
    connectors,
    isPending: isConnecting,
    error: connectError,
  } = useConnect();

  const { disconnect } = useDisconnect();

  const { data: balance, refetch } = useReadContract({
    address: VAULT_ADDRESS as `0x${string}`,
    abi: vaultAbi,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
    query: {
      enabled: !!address,
    } as any,
  });

  const { writeContract, isPending } = useWriteContract();

  const handleConnect = () => {
    if (!connectors || connectors.length === 0) return;
    // Usamos el primer connector disponible (MetaMask inyectado)
    connect({ connector: connectors[0] });
  };

  const handleDeposit = async () => {
    if (!depositAmount) return;
    await writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: vaultAbi,
      functionName: 'deposit',
      value: parseEther(depositAmount),
    });
    await refetch();
  };

  const handleWithdraw = async () => {
    if (!withdrawAmount) return;
    await writeContract({
      address: VAULT_ADDRESS as `0x${string}`,
      abi: vaultAbi,
      functionName: 'withdraw',
      args: [parseEther(withdrawAmount)],
    });
    await refetch();
  };

  const balEth = balance ? formatEther(balance as bigint) : '0';

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui, sans-serif' }}>
      <h1>SimpleVault</h1>

      {!isConnected ? (
        <div>
          <button onClick={handleConnect} disabled={isConnecting}>
            {isConnecting ? 'Connecting...' : 'Connect Wallet'}
          </button>
          {connectError && (
            <p style={{ color: 'red' }}>
              {connectError.message}
            </p>
          )}
        </div>
      ) : (
        <div>
          <p>Connected as: {address}</p>
          <button onClick={() => disconnect()}>Disconnect</button>
        </div>
      )}

      {!isConnected && <p>Connect your wallet to use the vault.</p>}

      {isConnected && (
        <>
          <p>Your vault balance: {balEth} ETH</p>

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Deposit</h3>
            <input
              value={depositAmount}
              onChange={(e) => setDepositAmount(e.target.value)}
              style={{ marginRight: '0.5rem' }}
            />
            ETH
            <button
              style={{ marginLeft: '0.5rem' }}
              onClick={handleDeposit}
              disabled={isPending}
            >
              Deposit
            </button>
          </div>

          <div style={{ marginTop: '1.5rem' }}>
            <h3>Withdraw</h3>
            <input
              value={withdrawAmount}
              onChange={(e) => setWithdrawAmount(e.target.value)}
              style={{ marginRight: '0.5rem' }}
            />
            ETH
            <button
              style={{ marginLeft: '0.5rem' }}
              onClick={handleWithdraw}
              disabled={isPending}
            >
              Withdraw
            </button>
          </div>
        </>
      )}
    </div>
  );
}

export default App;
