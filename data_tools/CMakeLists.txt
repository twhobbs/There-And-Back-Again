cmake_minimum_required(VERSION 3.10)

project(DataTools)

set(CMAKE_CXX_STANDARD 17)

add_executable(data_processor main.cpp GeoJSON.cpp SHPFile.cpp AreaQueryJSON.cpp PolySimplifier.cpp generated/there_and_back_again.pb.cc)

target_link_libraries(data_processor PRIVATE shp proj protobuf) 

file(MAKE_DIRECTORY ${CMAKE_CURRENT_BINARY_DIR}/statistical_area/)
