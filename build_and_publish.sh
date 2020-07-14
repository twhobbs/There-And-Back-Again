#!/bin/sh

yarn build

AWS_PROFILE=thereandbackagaindeploy aws s3 sync --content-type application/protobuf build/data/ s3://twhobbs-there-and-back-again/data/ --acl public-read
AWS_PROFILE=thereandbackagaindeploy aws s3 sync build/ s3://twhobbs-there-and-back-again/ --acl public-read
