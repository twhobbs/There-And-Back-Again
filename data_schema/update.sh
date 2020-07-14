#!/bin/bash

protoc --cpp_out=../data_tools/generated/ there_and_back_again.proto

../node_modules/.bin/pbjs -t json there_and_back_again.proto > ../src/schema.json
