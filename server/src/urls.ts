// To connect to a public cluster, set `export LIVE=1` in your
// environment. By default, `LIVE=1` will connect to the devnet cluster.

import { clusterApiUrl, Cluster } from "@solana/web3.js";

function chooseCluster(): Cluster | undefined {
  if (!process.env.LIVE) return;
  switch (process.env.CLUSTER) {
    case "devnet":
    case "testnet":
    case "mainnet-beta": {
      return process.env.CLUSTER;
    }
  }
  return "devnet";
}

export const cluster = chooseCluster();

export const url =
  process.env.RPC_URL ||
  (process.env.LIVE ? clusterApiUrl(cluster, false) : "https://devnet.helius-rpc.com/?api-key=ff85b650-739a-416c-b02e-002cda578d43");

export const urlTls =
  process.env.RPC_URL ||
  (process.env.LIVE ? clusterApiUrl(cluster, true) : "https://devnet.helius-rpc.com/?api-key=ff85b650-739a-416c-b02e-002cda578d43");
