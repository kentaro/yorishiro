#!/usr/bin/env bash
# Build the yorishiro firmware image (bzImage with embedded initramfs)
# inside Docker. The Buildroot tree and all build output live in a Docker
# volume (the macOS bind mount cannot hold device nodes and root-owned
# skeletons); only the final bzImage is copied back into the repo.
set -euo pipefail
cd "$(dirname "$0")"

BR_VERSION=2025.02

docker build -t yorishiro-fw .
docker volume create yorishiro-build >/dev/null

docker run --rm \
  -v yorishiro-build:/build \
  -v "$(cd .. && pwd)":/work \
  -w /build yorishiro-fw \
  bash -euo pipefail -c "
    if [ ! -d buildroot ]; then
      wget -q https://buildroot.org/downloads/buildroot-${BR_VERSION}.tar.gz
      tar xf buildroot-${BR_VERSION}.tar.gz
      mv buildroot-${BR_VERSION} buildroot
      rm buildroot-${BR_VERSION}.tar.gz
    fi
    make -C buildroot O=/build/output BR2_EXTERNAL=/work/firmware \
      qemu_x86_defconfig
    cat /work/firmware/configs/yorishiro.fragment >> /build/output/.config
    make -C buildroot O=/build/output olddefconfig
    make -C buildroot O=/build/output -j\$(nproc)
    mkdir -p /work/web/public/machine
    cp /build/output/images/bzImage /work/web/public/machine/bzImage
  "

echo 'firmware ready: web/public/machine/bzImage'
