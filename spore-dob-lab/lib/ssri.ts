export type SsriMethod = {
  signature: string;
  path: string;
  description: string;
  response: string;
};

function fnv1a64(text: string): bigint {
  let hash = 0xcbf29ce484222325n;
  const prime = 0x100000001b3n;
  for (const char of text) {
    hash ^= BigInt(char.codePointAt(0) ?? 0);
    hash = BigInt.asUintN(64, hash * prime);
  }
  return hash;
}

export function demoMethodPath(signature: string): string {
  return `0x${fnv1a64(signature).toString(16).padStart(16, "0")}`;
}

export const ssriMethods: SsriMethod[] = [
  {
    signature: "Spore.version",
    path: demoMethodPath("Spore.version"),
    description: "Returns the script-facing metadata version.",
    response: "spore-dob-lab/0.1.0",
  },
  {
    signature: "Spore.supported_methods",
    path: demoMethodPath("Spore.supported_methods"),
    description: "Lists available script-sourced rich-information methods.",
    response: "Spore.version, Spore.cell_deps, DOB.decode, DOB.render",
  },
  {
    signature: "Spore.cell_deps",
    path: demoMethodPath("Spore.cell_deps"),
    description: "Describes required Spore and DOB-related cell dependencies.",
    response: "spore_type, cluster_type, dob_decoder",
  },
  {
    signature: "DOB.decode",
    path: demoMethodPath("DOB.decode"),
    description: "Decodes object DNA into traits for applications.",
    response: "traits[]",
  },
  {
    signature: "DOB.render",
    path: demoMethodPath("DOB.render"),
    description: "Returns a deterministic render payload derived from DNA.",
    response: "svg+xml",
  },
];

export function callSsriMethod(path: string): SsriMethod {
  const method = ssriMethods.find((item) => item.path.toLowerCase() === path.toLowerCase());
  if (!method) {
    throw new Error("Unknown SSRI demo method path.");
  }
  return method;
}
