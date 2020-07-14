#pragma once

#include "Position.h"

#include <vector>
#include <string>

class AreaQueryJSON
{
public:
    struct Entry
    {
        Position position;
        size_t id;
    };
private:
    
    std::vector<Entry> entries;
    
public:
    void addEntry(Position const& position, size_t id);
    
    void writeToFile(std::string filename);
};
