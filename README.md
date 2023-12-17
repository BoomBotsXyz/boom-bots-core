# boom-bots-core
Smart contracts for the core of the Boom Bots protocol.

### Install Dependencies

`npm i`

### Compile Contracts

`npx hardhat compile`

### Run Tests

```sh
npx hardhat test
npx hardhat test test/filename.test.ts
npx hardhat coverage
npx hardhat coverage --testfiles test/filename.test.ts
```

### Deployment and Executing Scripts

`npx hardhat run scripts/ethereum/deploy.ts --network ethereum`
