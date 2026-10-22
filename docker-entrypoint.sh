#!/bin/sh
set -e

mkdir -p /root/.config/jellypull

if [ ! -f /root/.config/jellypull/config.toml ]; then
    if [ -f /app/config.toml.example ]; then
        cp /app/config.toml.example /root/.config/jellypull/config.toml
    fi
fi

exec "$@"
