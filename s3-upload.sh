#!/bin/bash
set -x

s3_assets_access_key=$1
s3_assets_access_secret=$2

upload() {
  node uploadToS3.js scratch build "${s3_assets_access_key}" "${s3_assets_access_secret}"
}

upload
