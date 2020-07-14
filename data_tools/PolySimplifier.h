#pragma once

#include "Position.h"

#include <vector>

namespace PolySimplifier
{
    
std::vector<std::vector<Position>> simplify(std::vector<std::vector<Position>> const& sourcePoints);

}
