#define EXPOSE_JSON 1
#include "GeoJSON.h"

#include <fstream>
#include <iomanip>

const double DETAIL = 0.00001;
const double DECIMATION = 1.0 / DETAIL;

void to_json(nlohmann::json& j, const Position& position)
{
    auto lng = DETAIL * std::round(position.lng * DECIMATION);
    auto lat = DETAIL * std::round(position.lat * DECIMATION);
    
    j = nlohmann::json::array({lng, lat});
}

void to_json(nlohmann::json& j, const GeoJSON::Polygon& polygon)
{
/*    double* coordVals = (double*)feature.coordinates.data();
    std::vector<double> coords(coordVals, coordVals + feature.coordinates.size()*2);
   */ 
    j = {
        {"type", "Feature"},
        {"geometry", 
            {
                {"type", "Polygon"},
                {"coordinates", polygon.coordinates}
            }
        }
    };
}

nlohmann::json GeoJSON::toJson()
{
    return {
        {"type", "FeatureCollection"},
        {"features", polygons}
    };
}

void GeoJSON::writeToFile(std::string filename)
{
    std::ofstream outStream(filename);
    
    outStream << std::setw(4) << toJson();
    
    outStream.close();
    
}
