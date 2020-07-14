#pragma once

#include "Position.h"
#include "Bounds.h"

#include <string>
#include <vector>
#include <map>

struct StatisticalArea
{
    struct Input
    {
        StatisticalArea* source;
        bool isEducation;
        
        std::map<int, int> transportStatistics;
    };
    
    size_t id;
    std::string name;
    
    std::vector<std::vector<Position>> partPoints;
    
    Position centre;
  
    Bounds bounds;
    
    std::vector<Input> travelInputs;
};
