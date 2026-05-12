# Acre

Bitcoin Yield Autocompounding

## Development

### pnpm

This project uses [pnpm](https://pnpm.io/) as a package manager.

#### Install

To install pnpm with Homebrew run `brew install pnpm`, for other installation options
please see the [documentation](https://pnpm.io/installation).

#### Package Dependencies

To install the package dependencies run:

```sh
pnpm install
```

### Pre-commit Hooks

Developers are encouraged to use [pre-commit](https://pre-commit.com/) hooks to
automatically discover code issues, before they submit the code.

To setup the hooks follow the steps:

1. Install `pre-commit` tool:

   ```sh
   brew install pre-commit
   ```

2. Install the hooks for the repository:
   ```sh
   pre-commit install
   ```

#### Testing

To test the pre-commit hooks configuration you can invoke them with one of the
commands:

```sh
# Execute hooks for all files:
pre-commit run --all-files

# Execute hooks for specific files (e.g. stBTC.sol):
pre-commit run --files ./solidity/contracts/stBTC.sol
```

### Syncpack

[Syncpack](https://jamiemason.github.io/syncpack/) is a tool that helps manage
multiple package.json files in a monorepo.

#### Usage

To list dependencies from all packages run:

```sh
pnpm syncpack list
```

To update a dependency (e.g. `eslint`) in all packages run:

```sh
pnpm syncpack update --filter eslint
```

### Slither

[Slither](https://github.com/crytic/slither) is a static analysis framework used
for Solidity contracts verification.

#### Install

To install Slither execute:

```sh
pip3 install slither-analyzer
```

#### Usage

To run Slither execute:

```sh
slither .
```
