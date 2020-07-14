#pragma once

#include "Position.h"

#include <string>
#include <vector>

class SHPFile
{
public:
    struct Entry
    {
        int id;
        std::string name;
        std::vector<std::vector<Position>> polygonParts;
    };
private:
    
    std::vector<Entry> entries;
    
    void readShpPoints(void* shpObject, std::vector<std::vector<Position>>& partPoints, void* proj);

public:
    SHPFile(std:: string filename, void* proj);
    
    std::vector<Entry> const& getEntries() const;
};
