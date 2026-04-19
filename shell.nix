{ pkgs ? import <nixpkgs> {} }:
let
  lib = pkgs.lib;
in
pkgs.mkShell {
  packages = with pkgs; [
    nodejs_24
    pkg-config
    gcc
    glib
    at-spi2-core
    xorg.libX11
    xorg.libXext
    xorg.libXi
    xorg.libXtst
    python3
    git
  ];

  shellHook = ''
    export LD_LIBRARY_PATH="${lib.makeLibraryPath [
      pkgs.glib
      pkgs.at-spi2-core
      pkgs.xorg.libX11
      pkgs.xorg.libXext
      pkgs.xorg.libXi
      pkgs.xorg.libXtst
      pkgs.stdenv.cc.cc.lib
    ]}:$LD_LIBRARY_PATH"

    # Set the custom context
    export P10K_CUSTOM_CONTEXT="OpenWhispr Dev"
    export P10K_CUSTOM_COLOR="75"
  '';
}
