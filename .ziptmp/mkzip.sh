#!/bin/bash
set -e
OUT="$1"
shift
BODY=/app/.ziptmp/body.bin
CDBLOB=/app/.ziptmp/cd.bin
GZ=/app/.ziptmp/tmp.gz
: > "$BODY"
: > "$CDBLOB"
le16() { printf '\\x%02x\\x%02x' $(( $1 & 255 )) $(( ($1 >> 8) & 255 )); }
le32() { printf '\\x%02x\\x%02x\\x%02x\\x%02x' $(( $1 & 255 )) $(( ($1 >> 8) & 255 )) $(( ($1 >> 16) & 255 )) $(( ($1 >> 24) & 255 )); }
OFFSET=0
COUNT=0
for f in "$@"; do
  name="${f#./}"
  gzip -n -9 -c "$f" > "$GZ"
  gsize=$(stat -c %s "$GZ")
  isize=$(od -An -tu4 -j $((gsize - 4)) -N 4 "$GZ" | tr -d ' ')
  crc=$(od -An -tu4 -j $((gsize - 8)) -N 4 "$GZ" | tr -d ' ')
  csize=$((gsize - 18))
  nlen=${#name}
  {
    printf 'PK\x03\x04'
    printf "$(le16 20)"
    printf "$(le16 0)"
    printf "$(le16 8)"
    printf "$(le16 0)"
    printf "$(le16 33)"
    printf "$(le32 "$crc")"
    printf "$(le32 "$csize")"
    printf "$(le32 "$isize")"
    printf "$(le16 "$nlen")"
    printf "$(le16 0)"
    printf '%s' "$name"
    tail -c +11 "$GZ" | head -c "$csize"
  } >> "$BODY"
  {
    printf 'PK\x01\x02'
    printf "$(le16 20)"
    printf "$(le16 20)"
    printf "$(le16 0)"
    printf "$(le16 8)"
    printf "$(le16 0)"
    printf "$(le16 33)"
    printf "$(le32 "$crc")"
    printf "$(le32 "$csize")"
    printf "$(le32 "$isize")"
    printf "$(le16 "$nlen")"
    printf "$(le16 0)"
    printf "$(le16 0)"
    printf "$(le16 0)"
    printf "$(le16 0)"
    printf "$(le32 0)"
    printf "$(le32 "$OFFSET")"
    printf '%s' "$name"
  } >> "$CDBLOB"
  OFFSET=$((OFFSET + 30 + nlen + csize))
  COUNT=$((COUNT + 1))
done
CDSIZE=$(stat -c %s "$CDBLOB")
{
  cat "$BODY"
  cat "$CDBLOB"
  printf 'PK\x05\x06'
  printf "$(le16 0)"
  printf "$(le16 0)"
  printf "$(le16 "$COUNT")"
  printf "$(le16 "$COUNT")"
  printf "$(le32 "$CDSIZE")"
  printf "$(le32 "$OFFSET")"
  printf "$(le16 0)"
} > "$OUT"
rm -f "$BODY" "$CDBLOB" "$GZ"
echo "created $OUT with $COUNT entries, cd size $CDSIZE"
