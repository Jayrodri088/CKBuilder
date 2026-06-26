import { createSpore, meltSpore, transferSpore } from "@spore-sdk/core";

const apiSurface = {
  createSpore: typeof createSpore,
  transferSpore: typeof transferSpore,
  meltSpore: typeof meltSpore,
};

const placeholderLock = {
  codeHash: "0x<owner-lock-code-hash>",
  hashType: "type",
  args: "0x<owner-lock-args>",
};

const recipes = {
  create: {
    api: "createSpore",
    shape: {
      data: {
        contentType: "application/json",
        content: "Uint8Array(DOB payload)",
      },
      toLock: placeholderLock,
      fromInfos: ["ckt1<capacity-sponsor-address>"],
      capacityMargin: "1 CKB default margin, adjustable",
    },
  },
  transfer: {
    api: "transferSpore",
    shape: {
      outPoint: {
        txHash: "0x<spore-creation-or-last-transfer-tx>",
        index: "0x0",
      },
      toLock: {
        ...placeholderLock,
        args: "0x<recipient-lock-args>",
      },
    },
  },
  melt: {
    api: "meltSpore",
    shape: {
      outPoint: {
        txHash: "0x<live-spore-cell-tx>",
        index: "0x0",
      },
      fromInfo: "ckt1<current-owner-address>",
      changeAddress: "ckt1<current-owner-address>",
    },
  },
};

for (const [name, type] of Object.entries(apiSurface)) {
  if (type !== "function") {
    throw new Error(`Expected @spore-sdk/core ${name} export to be a function.`);
  }
}

console.log("Spore SDK recipe surface is available.");
console.log(JSON.stringify(recipes, null, 2));
