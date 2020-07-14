#include "PolySimplifier.h"

#include <optional>
#include <cmath>
#include <iostream>

namespace PolySimplifier
{

const double detail = 0.003;
const double invDetail = 1.0/detail;

    
std::vector<std::vector<Position>> simplify(std::vector<std::vector<Position>> const& sourcePolys)
{
    std::vector<std::vector<Position>> ret;
    
    size_t sourcePointCount = 0;
    size_t destPointCount = 0;
    
    for (auto const& points: sourcePolys)
    {
        sourcePointCount += points.size();
        
        std::vector<Position> dstPoints;
     
        std::optional<Position> lastPoint;
        
        for (auto const& point: points)
        {
            Position simplified;
            simplified.lat = detail * std::round(invDetail * point.lat);
            simplified.lng = detail * std::round(invDetail * point.lng);
            
            if (!lastPoint || lastPoint.value().lat != simplified.lat || lastPoint.value().lng != simplified.lng)
            {
                lastPoint = simplified;
                dstPoints.push_back(simplified);
            }
        }
        
        if (dstPoints.size() > 2)
        {
            destPointCount += dstPoints.size();
            ret.push_back(std::move(dstPoints));
        }

    }
    
//     std::cout << "Reduced " << sourcePointCount << " points to " << destPointCount << std::endl;
    
    if (destPointCount == 0)
    {
        std::cout << "----------------------------- Too Much reduction! -----------------------------" << std::endl;
        std::cout << "-----Reduced " << sourcePointCount << " points to " << destPointCount << "-----" << std::endl;
    }
    
    return ret;
}

}
