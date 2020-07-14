#pragma once

#include "Position.h"

#include <cmath>

struct Bounds
{
    Position min = {1000, 1000};
    Position max = {-1000, -1000};
    
    void addPosition(Position const& point)
    {
        min.lat = std::min(min.lat, point.lat);
        min.lng = std::min(min.lng, point.lng);
        max.lat = std::max(max.lat, point.lat);
        max.lng = std::max(max.lng, point.lng);
    }
};
