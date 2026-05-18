#!/usr/bin/env bash
set -euo pipefail

: "${SOURCE_DIR:?SOURCE_DIR is required}"

mapfile -t encrypted_files < <(find "$SOURCE_DIR" -maxdepth 2 -type f -name '*.enc' | sort)

if [[ "${#encrypted_files[@]}" -eq 0 ]]; then
  printf '%s\n' "$SOURCE_DIR"
  exit 0
fi

: "${DB_ARTIFACT_ENCRYPTION_PASSPHRASE:?DB_ARTIFACT_ENCRYPTION_PASSPHRASE is required}"

for encrypted_file in "${encrypted_files[@]}"; do
  output_path="${encrypted_file%.enc}"
  openssl enc -d -aes-256-cbc -pbkdf2 \
    -in "$encrypted_file" \
    -out "$output_path" \
    -pass env:DB_ARTIFACT_ENCRYPTION_PASSPHRASE
done

printf '%s\n' "$SOURCE_DIR"
