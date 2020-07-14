#include "AreaQueryJSON.h"

#include "json.hpp"

#include <fstream>
#include <iomanip>

void AreaQueryJSON::addEntry(Position const& position, size_t id)
{
    entries.push_back({position, id});
}

void to_json(nlohmann::json& j, const AreaQueryJSON::Entry& entry)
{
/*    double* coordVals = (double*)feature.coordinates.data();
    std::vector<double> coords(coordVals, coordVals + feature.coordinates.size()*2);
   */ 
    j = {
        {"id", entry.id},
        {"position", 
            {
                {"lat", entry.position.lat},
                {"lng", entry.position.lng}
            }
        }
    };
}

void AreaQueryJSON::writeToFile(std::string filename)
{
    nlohmann::json j = {
        {"statistical_area_centres", entries}
    };
    
    std::ofstream outStream(filename);
    
    outStream << std::setw(4) << j;
    
    outStream.close();
}
