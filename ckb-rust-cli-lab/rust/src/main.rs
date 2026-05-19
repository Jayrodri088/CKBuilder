use std::str::FromStr;

use ckb_sdk::rpc::CkbRpcClient;
use ckb_sdk::types::{Address, AddressPayload, NetworkType};
use clap::{Parser, Subcommand};
use rand::Rng;

const DEFAULT_RPC: &str = "http://127.0.0.1:28114";

#[derive(Parser)]
#[command(
    name = "ckb-rust-cli-lab",
    about = "Nervos CKB Rust SDK exercises (docs.nervos.org/sdk-and-devtool/rust)"
)]
struct Cli {
    /// CKB JSON-RPC URL (OffCKB devnet proxy default: 28114)
    #[arg(long, env = "CKB_RPC_URL", default_value = DEFAULT_RPC)]
    rpc: String,

    #[command(subcommand)]
    command: Commands,
}

#[derive(Subcommand)]
enum Commands {
    /// RPC: get_tip_block_number (connectivity proof)
    Tip,
    /// RPC: get_block_by_number(0) and print summary JSON
    Block {
        #[arg(long, default_value_t = 0)]
        number: u64,
    },
    /// Generate a new secp256k1 address (tutorial: Generate a New Address)
    GenAddress {
        #[arg(long, default_value = "testnet")]
        network: String,
    },
    /// Parse bech32 address -> network + lock script fields
    ParseAddress {
        #[arg(long)]
        address: String,
    },
    /// Print which SDK capabilities this lab exercises
    Capabilities,
}

fn network_from_str(s: &str) -> Result<NetworkType, String> {
    match s.to_lowercase().as_str() {
        "mainnet" | "ckb" => Ok(NetworkType::Mainnet),
        "testnet" | "ckt" => Ok(NetworkType::Testnet),
        _ => Err(format!("unsupported network: {s} (use mainnet or testnet)")),
    }
}

fn main() {
    if let Err(e) = run() {
        eprintln!("FAIL: {e}");
        std::process::exit(1);
    }
}

fn run() -> Result<(), String> {
    let cli = Cli::parse();
    println!("RPC endpoint: {}", cli.rpc);

    match cli.command {
        Commands::Capabilities => {
            println!("=== CKB Rust SDK capabilities (this lab) ===");
            println!("1. RPC access        -> Tip, Block");
            println!("2. Data structures   -> block/cell types via ckb-sdk");
            println!("3. Tx assembly      -> see docs transfer example (not sent here)");
            println!("4. Script unlocking -> SecpSighash via ckb-sdk traits (full tx in SDK docs)");
            println!("\nReference: https://docs.nervos.org/docs/sdk-and-devtool/rust");
            Ok(())
        }
        Commands::Tip => {
            let mut client = CkbRpcClient::new(&cli.rpc);
            let tip = client
                .get_tip_block_number()
                .map_err(|e| format!("get_tip_block_number: {e}"))?;
            println!("tip_block_number: {tip}");
            println!("PASS: Rust SDK RPC client connected.");
            Ok(())
        }
        Commands::Block { number } => {
            let mut client = CkbRpcClient::new(&cli.rpc);
            let block = client
                .get_block_by_number(number.into())
                .map_err(|e| format!("get_block_by_number: {e}"))?
                .ok_or_else(|| format!("block {number} not found"))?;
            let json = serde_json::to_string_pretty(&block)
                .map_err(|e| format!("serialize block: {e}"))?;
            println!("{json}");
            println!("PASS: fetched block {number} via ckb-sdk.");
            Ok(())
        }
        Commands::GenAddress { network } => {
            let net = network_from_str(&network)?;
            let mut rng = rand::thread_rng();
            let privkey_bytes: [u8; 32] = rng.gen();
            let secp_secret_key =
                secp256k1::SecretKey::from_slice(&privkey_bytes).map_err(|e| e.to_string())?;
            let pubkey = secp256k1::PublicKey::from_secret_key(
                &ckb_crypto::secp::SECP256K1,
                &secp_secret_key,
            );
            let payload = AddressPayload::from_pubkey(&pubkey);
            let address = Address::new(net, payload, true);
            println!("network: {network}");
            println!("address: {}", address);
            println!("PASS: address derived from fresh secp256k1 key (demo only).");
            Ok(())
        }
        Commands::ParseAddress { address } => {
            let addr = Address::from_str(&address).map_err(|e| e.to_string())?;
            let script = ckb_types::packed::Script::from(addr.payload());
            println!("network: {:?}", addr.network());
            println!(
                "lock.code_hash: 0x{}",
                hex::encode(script.code_hash().raw_data())
            );
            println!("lock.hash_type: {:?}", script.hash_type());
            println!("lock.args: 0x{}", hex::encode(script.args().raw_data()));
            println!("PASS: parsed address into lock script fields.");
            Ok(())
        }
    }
}
