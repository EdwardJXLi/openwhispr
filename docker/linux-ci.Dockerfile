FROM node:24-bookworm

ENV DEBIAN_FRONTEND=noninteractive

RUN apt-get update && apt-get install -y --no-install-recommends \
  build-essential \
  ca-certificates \
  git \
  libatspi2.0-dev \
  libglib2.0-dev \
  libx11-dev \
  libxtst-dev \
  pkg-config \
  python3 \
  rpm \
  xz-utils \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /workspace
