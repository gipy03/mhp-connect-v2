{ pkgs }: {
  deps = [
    pkgs.nodejs_20
    pkgs.python3
    pkgs.gnumake
    pkgs.gcc
  ];

  env = {
    # Allow node-gyp to find Python for native module compilation (bcrypt, etc.)
    npm_config_python = "${pkgs.python3}/bin/python3";
  };
}
