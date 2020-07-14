#include "SHPFile.h"

#include <shapefil.h>

#include <proj.h>

#include <iostream>

Position project(PJ* proj, Position const& source)
{
    auto coord = proj_coord(source.lng, source.lat, 0, 0);
    auto transformed = proj_trans(proj, PJ_FWD, coord);
    
    return {transformed.lp.lam, transformed.lp.phi};
}

SHPFile::SHPFile(std::string filename, void* vproj)
{
    auto dbf = DBFOpen(filename.c_str(), "rb");
    auto shp = SHPOpen(filename.c_str(), "rb");
    
    if (!dbf || !shp)
    {
        std::cerr << "Bad SHP or DBF" << std::endl;
        return;
    }
    
    int idField = -1;
    int nameField = -1;
    
    auto fieldCount = DBFGetFieldCount(dbf);
    for (int i = 0; i < fieldCount; i++)
    {
        char fieldNameCstr[256];
        int width = 256;
        DBFGetFieldInfo(dbf, i, fieldNameCstr, &width, nullptr);

        std::string fieldName(fieldNameCstr);
        
//         std::cout << "Field " << fieldName << std::endl;
        
        if (fieldName == "SA22018_V1")
        {
            idField = i; 
        }
        else if (fieldName == "SA22018__1")
        {
            nameField = i;
        }
    }
    
    int entityCount, shapeType;
    SHPGetInfo(shp, &entityCount, &shapeType, nullptr, nullptr);
    
    auto recordCount = DBFGetRecordCount(dbf);
    
    if (recordCount != entityCount)
    {
        std::cerr << "Entity/Record count mismatch" << std::endl;
        return;
    }
    
    entries.resize(recordCount);
    
    for (int i = 0; i < recordCount; i++) 
    {
        auto& entry = entries[i];
        
        entry.id = DBFReadIntegerAttribute(dbf, i, idField);
        entry.name = DBFReadStringAttribute(dbf, i, nameField);
    }

    for (size_t i = 0; i < recordCount; i++)
    {
        auto& entry = entries[i];
        
        SHPObject* object = SHPReadObject( shp, i );
        
        readShpPoints(object, entry.polygonParts, vproj);

        SHPDestroyObject(object);
    }

    DBFClose(dbf);
    SHPClose(shp);
}

void SHPFile::readShpPoints(void* vshpObject, std::vector<std::vector<Position>>& partPoints, void* vproj)
{
    auto shpObject = static_cast<SHPObject*>(vshpObject);
    int partIndex = 0;
    std::vector<Position>* currentPoints = nullptr;
 
    auto proj = static_cast<PJ*>(vproj);
    
    if (shpObject->nParts == 0)
    {
        partPoints.emplace_back();
        currentPoints = &partPoints.back();
    }
    
    for (int vertIndex = 0; vertIndex < shpObject->nVertices; vertIndex++)
    {
        if (partIndex < shpObject->nParts && shpObject->panPartStart[partIndex] == vertIndex)
        {
            partPoints.emplace_back();
            currentPoints = &partPoints.back();
            partIndex++;
        }
        
        if (currentPoints)
        {
            currentPoints->push_back(project(proj, {shpObject->padfX[vertIndex], shpObject->padfY[vertIndex]}));
        }
    }
}

std::vector<SHPFile::Entry> const& SHPFile::getEntries() const
{
    return entries;
}
