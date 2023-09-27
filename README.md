# sCrypt 1Sat Ordinals SDK

`scrypt-ord` is the official sCrypt 1Sat Ordinals SDK.

Using it you can easily develop smart contracts integrated with 1Sat Ordinals, including non-fungible token (NFT) and fungible token (FT).

## Install

```sh
npm i scrypt-ord
```

## NFT

If you want to lock `1sat` NFT via smart contract, make your smart contract integrated from `OneSatNFT`.

```ts
import { method, prop, assert, ByteString, sha256, Sha256 } from "scrypt-ts";

import { OneSatNFT } from "scrypt-ord";

export class HashPuzzleNFT extends OneSatNFT {
  @prop()
  hash: Sha256;

  constructor(hash: Sha256) {
    super();
    // Note: must call `init`
    this.init(...arguments);
    this.hash = hash;
  }

  @method()
  public unlock(message: ByteString) {
    assert(this.hash == sha256(message), "hashes are not equal");
  }
}
```

:::note:::

For constructor, `this.init(...arguments)` needs to be called after the `super()` statement.

### inscribe and transfer NFT

you can inscribe an NFT in a contract:

```ts
HashPuzzleNFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

instance = new HashPuzzleNFT(hash);
await instance.connect(getDefaultSigner());
const insciptionTx = await instance.inscribeTextNft(text);
console.log("inscribed NFT: ", mintTx.id);

const recipientAddress = bsv.Address.fromString("your bitcoin address");

const { tx: transferTx } = await instance.methods.unlock(message, {
  transfer: new OneSatNFTP2PKH(Addr(recipientAddress.toByteString())),
});

console.log("transfer NFT: ", transferTx.id);
```

1. inscribe a text NFT

```ts
const inscriptionTx = await instance.inscribeTextNft("hello world!");
console.log("inscribed NFT: ", inscriptionTx.id);
```

2. inscribe an image NFT

```ts
const bb = readFileSync(join(__dirname, "..", "..", "logo.png")).toString(
  "base64"
);
const tx = await instance.inscribeImageNft(bb, ContentType.PNG);
console.log("inscribed NFT: ", tx.id);
```

3. inscribe NFT of another type

```ts
const tx = await instance.inscribe({
  content: `your content`,
  contentType: `your contentType`,
});
console.log("inscribed NFT: ", tx.id);
```

### transfer exists NFT to a contract

you can transfer exists NFT, which is usually held by a P2PKH, to a contract:

```ts
HashPuzzleNFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const recipient = new HashPuzzleNFT(hash);
await recipient.connect(getDefaultSigner());

// create p2pkh from a utxo
const p2pkh = OneSatNFTP2PKH.fromUTXO(`your utxo`);
// or create p2pkh from origin
const p2pkh = await OneSatNFTP2PKH.getLatestInstance(`origin`);

await p2pkh.connect(getDefaultSigner());

const { tx: transferTx } = await p2pkh.methods.unlock(
  (sigResps) => findSig(sigResps, `yourPubKey`),
  PubKey(`yourPubKey`.toByteString()),
  {
    transfer: recipient,
    pubKeyOrAddrToSign: `yourPubKey`,
  } as MethodCallOptions<OneSatNFTP2PKH>
);

console.log("transfer NFT: ", transferTx.id);
```

If the NFT is not locked in a P2PKH, but locked in an sCrypt contract, use the `getLatestInstance` method on the corresponding contract class to obtain the instance.

The following code transfers NFT from one `HashPuzzleNFT` contract to another `HashPuzzleNFT` contract:

```ts
HashPuzzleNFT.loadArtifact();

// get `HashPuzzleNFT` instance that held the NFT
const nft = await HashPuzzleNFT.getLatestInstance(`origin`);
await nft.connect(getDefaultSigner());

const hash = sha256(toByteString("Hello sCrypt and 1Sat Ordinals", true));
const recipient = new HashPuzzleNFT(hash);
await recipient.connect(getDefaultSigner());

// send NFT to recipient
const { tx: transferTx } = await nft.methods.unlock(
  toByteString(`unlock message`, true),
  {
    transfer: recipient,
  }
);

console.log("transfer NFT: ", transferTx.id);
```

## FT

### deploy token

```ts
HashPuzzleFT.loadArtifact();

const tick = toByteString("DOGE", true);
const max = 100000n;
const lim = max / 10n;

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

### transfer exists FT to a contract (one input)

```ts
HashPuzzleFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const recipient = new HashPuzzleFT(hash);
await recipient.connect(getDefaultSigner());

// create p2pkh from a utxo
// NOTE: you can use BSV20P2PKH.getLatestInstance for bsv20, it only works for NFT
const p2pkh = BSV20P2PKH.fromUTXO(`your utxo`);

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
  } as MethodCallOptions<BSV20P2PKH>
);

console.log("transfer FT: ", transferTx.id);
```

### transfer exists FT to a contract (multi inputs)

```ts
HashPuzzleFT.loadArtifact();

const text = "Hello sCrypt and 1Sat Ordinals";
const message = toByteString(text, true);
const hash = sha256(message);

const recipient = new HashPuzzleFT(hash);
await recipient.connect(getDefaultSigner());

// create p2pkh from a utxo
// NOTE: you can use BSV20P2PKH.getLatestInstance for bsv20, it only works for NFT
const bsv20P2PKHs = await BSV20P2PKH.getBSV20("DOGE", `your ordinal address`);

await Promise.all(bsv20P2PKHs.map((p) => p.connect(signer)));
const recipients: Array<FTReceiver> = [
  {
    instance: new HashPuzzleFT(tick, max, lim, sha256(message)),
    amt: 6n,
  },
];

const { tx, nexts } = await BSV20P2PKH.transfer(
  bsv20P2PKHs,
  signer,
  recipients
);

console.log("transfer FT: ", transferTx.id);
```
