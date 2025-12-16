import * as chains from "viem/chains";

export const evmChains = Object.values(chains).reduce((acc, chain) => {
    if (chain && typeof chain === 'object' && 'id' in chain) {
        acc[chain.id] = chain;
    }
    return acc;
}, {} as Record<number, chains.Chain>);
