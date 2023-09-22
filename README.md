# sCrypt 1Sat Ordinals SDK

## Install

```sh
npm i scrypt-ord
```

## NFT

### mint and transfer NFT

```ts
const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

HashPuzzleNFT.loadArtifact();
instance = new HashPuzzleNFT(hash);
await instance.connect(getDefaultSigner());
const mintTx = await instance.mintTextNft(text);
console.log("mint NFT: ", mintTx.id);

const recipientAddress = bsv.Address.fromString("your bitcoin address");

const { tx: transferTx } = await instance.methods.unlock(message, {
  transfer: new OrdP2PKH(Addr(recipientAddress.toByteString())),
});

console.log("transfer NFT: ", transferTx.id);
```

### transfer exists NFT to a contract

```ts
const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

HashPuzzleNFT.loadArtifact();
const recipient = new HashPuzzleNFT(hash);
await recipient.connect(getDefaultSigner());

// create p2pkh from a utxo
const p2pkh = OrdP2PKH.fromP2PKH(`your utxo`);
// or create p2pkh from origin
const p2pkh = OrdP2PKH.getLatestInstance(`origin`);

await p2pkh.connect(getDefaultSigner());

const { tx: transferTx } = await p2pkh.methods.unlock(
  (sigResps) => findSig(sigResps, `yourPubKey`),
  PubKey(`yourPubKey`.toByteString()),
  {
    transfer: recipient,
    pubKeyOrAddrToSign: `yourPubKey`,
  } as MethodCallOptions<OrdP2PKH>
);

console.log("transfer NFT: ", transferTx.id);
```

## FT

### deploy token

```ts
const tick = toByteString("DOGE", true);
const max = 100000n;
const lim = max / 10n;

HashPuzzleFT.loadArtifact();
let hashPuzzle = new HashPuzzleFT(
  tick,
  max,
  lim,
  sha256(toByteString("hello, sCrypt!:0", true))
);
await hashPuzzle.connect(getDefaultSigner());
await hashPuzzle.deployToken();
```

### mint and transfer FT

```ts
// mint
const amt = 1000n;
const mintTx = await hashPuzzle.mint(amt);
console.log("mint tx: ", mintTx.id);

// transfer
for (let i = 0; i < 3; i++) {
  const receiver = new HashPuzzleFT(
    tick,
    max,
    lim,
    sha256(toByteString(`hello, sCrypt!:${i + 1}`, true))
  );

  const recipients: Array<FTReceiver> = [
    {
      instance: receiver,
      amt: 10n,
    },
  ];

  const { tx } = await hashPuzzle.methods.unlock(
    toByteString(`hello, sCrypt!:${i}`, true),
    {
      transfer: recipients,
    }
  );

  hashPuzzle = recipients[0].instance as HashPuzzleFT;

  console.log("transfer tx: ", tx.id);
}
```

### transfer exists FT to a contract

```ts
const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

HashPuzzleFT.loadArtifact();
const recipient = new HashPuzzleFT(hash);
await recipient.connect(getDefaultSigner());

// create p2pkh from a utxo
// NOTE: you can use OrdP2PKH.getLatestInstance for bsv20, it only works for NFT
const p2pkh = OrdP2PKH.fromP2PKH(`your utxo`);

await p2pkh.connect(getDefaultSigner());

const { tx: transferTx } = await p2pkh.methods.unlock(
  (sigResps) => findSig(sigResps, `yourPubKey`),
  PubKey(`yourPubKey`.toByteString()),
  {
    transfer: [
      {
        instance: recipient,
        amt: 10n,
      },
    ],
    pubKeyOrAddrToSign: `yourPubKey`,
  } as MethodCallOptions<OrdP2PKH>
);

console.log("transfer FT: ", transferTx.id);
```
