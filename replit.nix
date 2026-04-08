{ pkgs }: {
  deps = [
    # Node 20 is already provided by modules = ["nodejs-20"] in .replit.
    # We only add pnpm here — the stable-24_11 channel ships pnpm 9.x,
    # which is required by the lockfileVersion:'9.0' in pnpm-lock.yaml.
    pkgs.pnpm
  ];
}
