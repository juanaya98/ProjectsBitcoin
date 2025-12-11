# SimpleVault – Proyecto 1

DApp para gestionar depósitos y retiros de ETH mediante un smart contract en Solidity. El proyecto incluye el contrato, deployment con Hardhat Ignition, y un frontend en React que conecta con MetaMask usando wagmi/viem.

**Funcionalidades:**
- Depositar ETH en la bóveda
- Retirar fondos depositados
- Consultar balance del usuario
- Interacción completa con MetaMask

---

## Estructura

```
simplevault-project/
├── contracts/
│   └── SimpleVault.sol
├── ignition/modules/
│   └── SimpleVaultModule.mjs
├── frontend/
│   └── src/
│       ├── App.tsx
│       └── main.tsx
└── hardhat.config.ts
```

---

## El Contrato

`SimpleVault.sol` es una bóveda de ETH con las siguientes funciones:

- **deposit()**: Recibe ETH y actualiza el balance del usuario
- **withdraw(uint256 amount)**: Permite retirar fondos
- **balanceOf(address user)**: Devuelve el balance disponible

**Seguridad:**
- Protección contra reentrancy con `nonReentrant`
- Sistema pausable (onlyOwner)
- Transferencias seguras con `call`

Emite eventos `Deposited` y `Withdrawn` para tracking.

---

## Setup

**1. Iniciar nodo Hardhat**

```bash
npx hardhat node
```

Esto levanta una blockchain local en `http://127.0.0.1:8545` (Chain ID: 31337) con 20 cuentas de 10,000 ETH.

**2. Desplegar el contrato**

```bash
npx hardhat ignition deploy ignition/modules/SimpleVaultModule.mjs --network localhost
```

Copia la dirección del contrato desplegado y actualízala en `frontend/src/App.tsx`:

```typescript
const VAULT_ADDRESS = "0xABC123...";
```

**3. Configurar MetaMask**

Agregar la red local:
- Network Name: Hardhat Localhost
- RPC URL: http://127.0.0.1:8545
- Chain ID: 31337
- Currency: ETH

Importar una cuenta de prueba (Account #0):
```
0xac0974bec39a17e36ba4a6b4d238ff944bacb478cbed5efcae784d7bf4f2ff80
```

**4. Correr el frontend**

```bash
cd frontend
npm run dev
```

Abrir http://localhost:5173

---

## Uso

**Conectar wallet**

Hacer clic en "Connect Wallet" y seleccionar la cuenta importada. Debería verse algo como:
```
Connected as: 0xF39F...
Your vault balance: 0 ETH
```

**Depositar**

1. Ingresar cantidad (ej: 0.02)
2. Click en "Deposit"
3. Confirmar en MetaMask
4. Esperar confirmación

**Retirar**

1. Ingresar cantidad (ej: 0.005)
2. Click en "Withdraw"
3. Confirmar en MetaMask

El balance se actualiza automáticamente después de cada transacción.

---

## Tech Stack

- Solidity 0.8.28
- Hardhat + Hardhat Ignition
- React + TypeScript
- Vite
- wagmi + viem
- MetaMask

## Notas

Este proyecto fue desarrollado como parte del curso de DApps & Smart Contracts. El objetivo era crear un smart contract funcional, desplegarlo localmente y conectarlo a un frontend para realizar transacciones reales.

Las principales dificultades fueron configurar correctamente wagmi con viem y manejar los estados de las transacciones en el frontend. También implementé protecciones básicas contra reentrancy y añadí la funcionalidad pausable por si se necesita en el futuro.
