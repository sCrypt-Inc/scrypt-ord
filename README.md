# sCrypt 1Sat Ordinals SDK

`scrypt-ord` is the official sCrypt 1Sat Ordinals SDK. With it, you can effortlessly develop smart contracts integrated with 1Sat Ordinals, covering both non-fungible tokens (NFTs) and fungible tokens (FTs).

## Install

```sh
npm i scrypt-ord
```


## `OrdProvider`

When you use sCrypt 1Sat Ordinals SDK, we recommend that you use `OrdProvider` to create `Signer`. This allows your transactions to be indexed faster.


```ts
export function getDefaultSigner(): TestWallet {
    return new TestWallet(
        myPrivateKey,
        new OrdProvider(bsv.Networks.mainnet)
    )
}
```

## NFT

To lock a `1sat` NFT via a smart contract, have your smart contract extend the `OrdinalNFT` class:

```ts
import { method, prop, assert, ByteString, sha256, Sha256 } from "scrypt-ts";

import { OrdinalNFT } from "scrypt-ord";

export class HashLockNFT extends OrdinalNFT {
  @prop()
  hash: Sha256;

  constructor(hash: Sha256) {
    super();
    // Important: Call `init` after the `super()` statement.
    this.init(...arguments);
    this.hash = hash;
  }

  @method()
  public unlock(message: ByteString) {
    assert(this.hash === sha256(message), "hashes are not equal");
  }
}
```

### Inscribe and Transfer an NFT

To inscribe an NFT within a contract:

```ts
HashLockNFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const instance = new HashLockNFT(hash);
await instance.connect(getDefaultSigner());
const inscriptionTx = await instance.inscribeText(text);
console.log("Inscribed NFT: ", inscriptionTx.id);

const recipientAddress = bsv.Address.fromString("your bitcoin address");

const { tx: transferTx } = await instance.methods.unlock(message, {
  transfer: new OrdiNFTP2PKH(Addr(recipientAddress.toByteString())),
});

console.log("Transferred NFT: ", transferTx.id);
```

#### Inscribe a Text NFT

```ts
const inscriptionTx = await instance.inscribeText("hello world!");
console.log("Inscribed NFT: ", inscriptionTx.id);
```

#### Inscribe an Image NFT

```ts
const bb = readFileSync(join(__dirname, "..", "..", "logo.png")).toString(
  "base64"
);
const tx = await instance.inscribeImage(bb, ContentType.PNG);
console.log("Inscribed NFT: ", tx.id);
```

#### Inscribe NFT of Another Type

```ts
const tx = await instance.inscribe({
  content: `your content`,
  contentType: `your contentType`,
});
console.log("Inscribed NFT: ", tx.id);
```

### Transfer Existing NFT to a Smart Contract

To transfer an existing NFT, typically secured by a `P2PKH` lock, to a contract:

```ts
HashLockNFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const recipient = new HashLockNFT(hash);
await recipient.connect(getDefaultSigner());

// Create a P2PKH object from a UTXO
const p2pkh = OrdiNFTP2PKH.fromUTXO(`your UTXO`);
// Alternatively, create a P2PKH from an origin
const p2pkh = await OrdiNFTP2PKH.getLatestInstance(`origin TXID`);

await p2pkh.connect(getDefaultSigner());

const { tx: transferTx } = await p2pkh.methods.unlock(
  (sigResps) => findSig(sigResps, `yourPubKey`),
  PubKey(`yourPubKey`.toByteString()),
  {
    transfer: recipient,
    pubKeyOrAddrToSign: `yourPubKey`,
  } as MethodCallOptions<OrdiNFTP2PKH>
);

console.log("Transferred NFT: ", transferTx.id);
```

To transfer an NFT from one `HashLockNFT` contract to another:

```ts
HashLockNFT.loadArtifact();

// Retrieve `HashLockNFT` instance holding the NFT
const nft = await HashLockNFT.getLatestInstance(`origin TXID`);
await nft.connect(getDefaultSigner());

const hash = sha256(toByteString("Hello sCrypt and 1Sat Ordinals", true));
const recipient = new HashLockNFT(hash);
await recipient.connect(getDefaultSigner());

// Send NFT to recipient
const { tx: transferTx } = await nft.methods.unlock(
  toByteString(`unlock message`, true),
  {
    transfer: recipient,
  }
);

console.log("Transferred NFT: ", transferTx.id);
```

## Fungible Tokens - FT

### Deploy FT

```ts
HashLockFT.loadArtifact();

const tick = toByteString("DOGE", true);
const max = 100000n;
const lim = max / 10n;
const dec = 0;

const hashLock = new HashLockFT(
  tick,
  max,
  lim,
  dec,
  sha256(toByteString("hello, sCrypt!:0", true))
);
await hashLock.connect(getDefaultSigner());
await hashLock.deployToken();
```

### Mint and Transfer FT

```ts
// Minting
const amt = 1000n;
const mintTx = await hashLock.mint(amt);
console.log("Minted tx: ", mintTx.id);

// Transfer
for (let i = 0; i < 3; i++) {
  const receiver = new HashLockFT(
    tick,
    max,
    lim,
    dec,
    sha256(toByteString(`hello, sCrypt!:${i + 1}`, true))
  );

  const recipients: Array<FTReceiver> = [
    {
      instance: receiver,
      amt: 10n,
    },
  ];

  const { tx } = await hashLock.methods.unlock(
    toByteString(`hello, sCrypt!:${i}`, true),
    {
      transfer: recipients,
    }
  );

  hashLock = recipients[0].instance as HashLockFT;

  console.log("Transfer tx: ", tx.id);
}
```

### Transfer Existing FT to a Smart Contract (Single Input)

```ts
HashLockFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const recipient = new HashLockFT(hash);

// create p2pkh from a utxo
// NOTE: You can not use BSV20V1P2PKH.getLatestInstance for bsv20, it only works for NFT
const p2pkh = BSV20V1P2PKH.fromUTXO(`your utxo`);

await p2pkh.connect(getDefaultSigner());

const { tx: transferTx } = await p2pkh.methods.unlock(
  (sigResps) => findSig(sigResps, `yourPubKey`),
  PubKey(`yourPubKey`.toByteString()),
  {
    transfer: recipient,
    pubKeyOrAddrToSign: `yourPubKey`,
  } as MethodCallOptions<BSV20V1P2PKH>
);

console.log("Transferred FT: ", transferTx.id);
```

### Transfer Existing FT to a Contract (Multiple Inputs)

```ts
HashLockFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const recipient = new HashLockFT(hash);

// create p2pkh from a utxo
// NOTE: you can not use BSV20V1P2PKH.getLatestInstance for bsv20, it only works for NFT
const bsv20V1P2PKHs = await BSV20V1P2PKH.getBSV20(
  "DOGE",
  `your ordinal address`
);

await Promise.all(bsv20V1P2PKHs.map((p) => p.connect(signer)));
const recipients: Array<FTReceiver> = [
  {
    instance: new HashLockFT(tick, max, lim, dec, sha256(message)),
    amt: 6n,
  },
];

const { tx, nexts } = await BSV20V1P2PKH.transfer(
  bsv20V1P2PKHs,
  signer,
  recipients
);

console.log("Transferred FT: ", transferTx.id);
```
