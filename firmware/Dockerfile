FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
RUN apt-get update && apt-get install -y --no-install-recommends \
    bc bison build-essential ca-certificates cpio file flex git \
    libelf-dev libncurses-dev libssl-dev perl python3 rsync unzip wget \
    && rm -rf /var/lib/apt/lists/*
