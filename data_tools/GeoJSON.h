#pragma once

#include "Position.h"

#include <string>
#include <vector>
#include <map>

#if EXPOSE_JSON
    #include "json.hpp"
#endif

struct GeoJSON
{
    struct Feature
    {
        std::string geometryType;
        std::map<std::string, std::string> properties;
    };
    
    struct Polygon: public Feature
    {
        std::vector<std::vector<Position>> coordinates;
    };

//     std::vector<Feature> features;
    
    std::vector<Polygon> polygons;
    
    void writeToFile(std::string filename);
    
    #if EXPOSE_JSON
        nlohmann::json toJson();
    #endif
};
