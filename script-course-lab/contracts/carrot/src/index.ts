/**
 * Class 2 "carrot" type script (ckb-js-vm port of script course example).
 * Rejects any output cell whose data begins with the bytes "carrot".
 * @see https://docs.nervos.org/docs/script-course/intro-to-script-2
 */
import * as bindings from "@ckb-js-std/bindings";
import { HighLevel, log } from "@ckb-js-std/core";

/** ASCII "carrot" — forbidden prefix in output cell data (Class 2 example). */
const FORBIDDEN = new Uint8Array([0x63, 0x61, 0x72, 0x72, 0x6f, 0x74]);

function startsWith(data: Uint8Array, prefix: Uint8Array): boolean {
  if (data.length < prefix.length) return false;
  for (let i = 0; i < prefix.length; i++) {
    if (data[i] !== prefix[i]) return false;
  }
  return true;
}

function main(): number {
  log.setLevel(log.LogLevel.Info);
  let index = 0;
  while (true) {
    try {
      const data = new Uint8Array(
        HighLevel.loadCellData(index, bindings.SOURCE_OUTPUT),
      );
      if (startsWith(data, FORBIDDEN)) {
        log.error("output cell data begins with forbidden prefix");
        return -1;
      }
      index++;
    } catch {
      break;
    }
  }
  return 0;
}

bindings.exit(main());
