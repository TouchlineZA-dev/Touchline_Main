#!/bin/bash

# Load environment variables from .env
export $(grep -v '^#' .env | xargs)

# Parse the admin URL into Flyway format
# Neon URL: postgresql://user:pass@host/db?sslmode=require
# Flyway URL: jdbc:postgresql://host/db?sslmode=require

FLYWAY_CMD=${1:-migrate}

docker run --rm \
  -v "$PWD/db/migrations:/flyway/sql" \
  flyway/flyway \
  -url="jdbc:postgresql://$(echo $NEON_ADMIN_URL | sed 's|postgresql://[^@]*@||' | sed 's|?.*||')?sslmode=require" \
  -user="$(echo $NEON_ADMIN_URL | sed 's|postgresql://||' | sed 's|:.*||')" \
  -password="$(echo $NEON_ADMIN_URL | sed 's|postgresql://[^:]*:||' | sed 's|@.*||')" \
  -locations="filesystem:/flyway/sql" \
  "$FLYWAY_CMD"