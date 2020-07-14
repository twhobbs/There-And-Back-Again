#include "StatisticalArea.h"
#include "Position.h"
#include "SHPFile.h"
#include "PolySimplifier.h"
#include "GeoJSON.h"

#include "generated/there_and_back_again.pb.h"

#include <proj.h>

#include <iostream>
#include <fstream>
#include <set>
#include <unordered_map>
#include <sstream>
#include <map>
#include <array>
#include <vector>
#include <algorithm>
#include <cmath>

void readStatisticsCsv(std::string path, bool isEducation, std::map<int, StatisticalArea*>& statisticalAreas)
{
    std::ifstream inFile(path);
    if (!inFile)
    {
        std::cerr << "Couldn't Load CSV " << path << std::endl;
        exit(1);
    }
    
    std::string line;
    std::getline(inFile, line);
 
    int sourceColumn = -1;
    int destColumn = -1;
    int totalColumn = -1;
    
    std::map<std::string, ::timhobbs::there_and_back_again::TransportStatistics::Type> columnNameTypes = {
        {"Work_at_home", ::timhobbs::there_and_back_again::TransportStatistics_Type_WORK_FROM_HOME},
        {"Drive_a_car_truck_or_van", ::timhobbs::there_and_back_again::TransportStatistics_Type_DRIVE},
        {"Passenger_in_a_car_truck_or_van", ::timhobbs::there_and_back_again::TransportStatistics_Type_PASSENGER},
        {"Public_bus", ::timhobbs::there_and_back_again::TransportStatistics_Type_BUS},
        {"Train", ::timhobbs::there_and_back_again::TransportStatistics_Type_TRAIN},
        {"Bicycle", ::timhobbs::there_and_back_again::TransportStatistics_Type_BICYCLE},
        {"Walk_or_jog", ::timhobbs::there_and_back_again::TransportStatistics_Type_WALK},
        {"Ferry", ::timhobbs::there_and_back_again::TransportStatistics_Type_FERRY},
        {"Other", ::timhobbs::there_and_back_again::TransportStatistics_Type_OTHER},
        {"Total", ::timhobbs::there_and_back_again::TransportStatistics_Type_TOTAL},
    };

    columnNameTypes["Drive_a_company_car_truck_or_van"] = columnNameTypes["Drive_a_car_truck_or_van"];        
    columnNameTypes["Drive_a_private_car_truck_or_van"] = columnNameTypes["Drive_a_car_truck_or_van"];    
    columnNameTypes["Passenger_in_a_car_truck_van_or_company_bus"] = columnNameTypes["Passenger_in_a_car_truck_or_van"];    
    columnNameTypes["Study_at_home"] = columnNameTypes["Work_at_home"];
    columnNameTypes["School_bus"] = columnNameTypes["Public_bus"];
    
    
    std::map<size_t, ::timhobbs::there_and_back_again::TransportStatistics::Type> columnTypes;
    
    std::cout << "Header Line: " << line << std::endl;
    
    std::stringstream headerLine(line);
    int i = 0;
    while (headerLine.good())
    {
        std::string headerName;
        std::getline(headerLine, headerName, ',');
        
        headerName.erase(std::remove_if(headerName.begin(), headerName.end(), [](char c){return c < 32;}), headerName.end());
        headerName = std::string(headerName.c_str());
        
        if (headerName == "SA2_code_usual_residence_address")
        {
            sourceColumn = i;
        }
        else if (headerName == "SA2_code_workplace_address" || headerName == "SA2_code_educational_address")
        {
            destColumn = i;
        }
        else if (columnNameTypes.find(headerName) != columnNameTypes.end())
        {
            columnTypes[i] = columnNameTypes[headerName];
        }
        else
        {
            std::cout << "Unhandled Column: " << headerName << std::endl;
        }
        
        i++;
    }
    
    if (sourceColumn == -1 || destColumn == -1)
    {
        std::cerr << "Couldn't find Columns " << sourceColumn << " " << destColumn << std::endl;
        exit(1);
    }
    
    while (inFile.good())
    {
        std::getline(inFile, line);
        std::stringstream dataLine(line);

        int sourceId = -1;
        int destId = -1;
        
        StatisticalArea::Input input;
        
        int i = 0;
        while (dataLine.good())
        {
            std::string data;
            std::getline(dataLine, data, ',');

            if (!data.empty())
            {
                if (i == sourceColumn)
                {
                    sourceId = std::stoi(data);
                }
                else if (i == destColumn)
                {
                    destId = std::stoi(data);
                }
                else if (columnTypes.find(i) != columnTypes.end())
                {
                    auto value = std::stoi(data);
                    if (value > 0)
                    {
                        input.transportStatistics[(int)columnTypes[i]] += value;
                    }
                }
            }
            i++;
        }
        
        if (sourceId != -1 && destId != -1)
        {
//             std::cout << "Source: " << sourceId << std::endl;
//             std::cout << "Dest: " << destId << std::endl;
//             std::cout << "Total: " << total << std::endl;
            
            auto sourceEntry = statisticalAreas.find(sourceId);
            auto destEntry = statisticalAreas.find(destId);
            
            if (sourceEntry == statisticalAreas.end() || destEntry == statisticalAreas.end())
            {
//                 std::cerr << "Bad Statistical Area for Statistics" << std::endl;
//                 exit(1);
            }
            else
            {
                input.source = sourceEntry->second;
                input.isEducation = isEducation;
                
                destEntry->second->travelInputs.push_back(input);
            }
        }
    }
}

int calculateClusterId(Position const& position)
{
    return (int)std::round(360+position.lat) + 1000 * (int)std::round((360+position.lng));
}

int main (int argc, char* argv[]) 
{   
    auto projContext = proj_context_create();
    auto proj = proj_create_crs_to_crs (projContext, "EPSG:2193", "NZGD2000", NULL);
    
    SHPFile statisticalAreasShp("../../data/statistical-area-2-2018-clipped-generalised.shp", proj);
    SHPFile statisticalAreaCentroidsShp("../../data/statistical-area-2-2018-centroid-true.shp", proj);
      
    std::vector<StatisticalArea> statisticalAreas(statisticalAreasShp.getEntries().size());
    std::map<int, StatisticalArea*> idStatisticalAreas;
    
    for (size_t i = 0; i < statisticalAreas.size(); i++)
    {
        auto& entry = statisticalAreasShp.getEntries()[i];
        
        auto& statisticalArea = statisticalAreas[i];
        
        statisticalArea.id = entry.id;
        statisticalArea.name = entry.name;
        statisticalArea.partPoints = entry.polygonParts;
        
        for (auto const& points: statisticalArea.partPoints)
        {
            for (auto const& point: points)
            {
                statisticalArea.bounds.addPosition(point);
            }
        }
    }
    
    for (auto& statisticalArea: statisticalAreas)
    {
        idStatisticalAreas[statisticalArea.id] = &statisticalArea;
    }

    readStatisticsCsv("../../data/2018-census-main-means-of-travel-to-work-by-statistical-area.csv", false, idStatisticalAreas);
    readStatisticsCsv("../../data/2018-census-main-means-of-travel-to-education-by-statistical.csv", true, idStatisticalAreas);
    
//     for (size_t i = 0; i < statisticalAreas.size(); i++)
//     {
//         auto& statisticalArea = statisticalAreas[i];
//         
//         if (!statisticalArea.partPoints.empty())
//         {
//         
// //             auto& polygon = geoJson.polygons.emplace_back();
// //             polygon.geometryType = "Polygon";
// //             
// //             for (auto const& points: statisticalArea.partPoints)
// //             {
// //                 auto& polyPartPoints = polygon.coordinates.emplace_back();
// //                 
// //                 size_t skip = std::max((size_t)1, points.size() / 10);
// //                 
// //                 //for (auto const& point: points)
// //                 for (size_t j = 0; j < points.size(); j += skip)
// //                 {
// //                     auto const& point = points[j];
// //                     
// //                     polyPartPoints.push_back(point);
// //                 }
// //             }
//         }
//     }
    
    std::cout << "Have " << statisticalAreaCentroidsShp.getEntries().size() << " centroid entries" << std::endl;
        
    ::timhobbs::there_and_back_again::CoreData coreSerialisedData;
    
    for (auto const& entry: statisticalAreaCentroidsShp.getEntries())
    {

        
        if (!entry.polygonParts.empty() && !entry.polygonParts[0].empty())
        {            
            auto& pos = entry.polygonParts[0][0];
            
//             auto newAreaCentrepoint = allSerialisedData.mutable_areaquery()->mutable_areacentrepoints()->Add();
//             
//             newAreaCentrepoint->set_id(entry.id);
//             
//             auto position = newAreaCentrepoint->mutable_position();
//             position->set_lat(pos.lat);
//             position->set_lng(pos.lng);
            
            auto statisticalAreaEntry = idStatisticalAreas.find(entry.id);
            if (statisticalAreaEntry != idStatisticalAreas.end())
            {
                statisticalAreaEntry->second->centre = pos;
            }
        }
    }

    std::map<size_t, std::vector<StatisticalArea const*>> clusteredStatisticalAreas;
    
//     GeoJSON geoJSON;
    
    auto convertBounds = [](Bounds const& bounds, ::timhobbs::there_and_back_again::Bounds* destBounds)
    {
        destBounds->set_minlat(bounds.min.lat);
        destBounds->set_minlng(bounds.min.lng);
        destBounds->set_maxlat(bounds.max.lat);
        destBounds->set_maxlng(bounds.max.lng);
    };
    
    for (auto const& statisticalArea: statisticalAreas)
    {
        auto destStatisticsArea = coreSerialisedData.mutable_statisticalareas()->Add();
        
        size_t clusterId = calculateClusterId(statisticalArea.centre);
        clusteredStatisticalAreas[clusterId].push_back(&statisticalArea);
        
        destStatisticsArea->set_id(statisticalArea.id);
        destStatisticsArea->set_name(statisticalArea.name);
        destStatisticsArea->set_clusterid(clusterId);
        convertBounds(statisticalArea.bounds, destStatisticsArea->mutable_bounds());
        
        auto centroid = destStatisticsArea->mutable_centroid();
        centroid->set_lat(statisticalArea.centre.lat);
        centroid->set_lng(statisticalArea.centre.lng);
        
        for (auto input: statisticalArea.travelInputs)
        {
            auto transitStatistics = destStatisticsArea->mutable_inwardtravelstatistics()->Add();
            
            transitStatistics->set_statisticalareaid(input.source->id);
            transitStatistics->set_iseducation(input.isEducation);

            for (auto& transportStatistic: input.transportStatistics)
            {
                auto destTransportStatistic = transitStatistics->mutable_transportstatistics()->Add();
                
                destTransportStatistic->set_type(static_cast<::timhobbs::there_and_back_again::TransportStatistics::Type>(transportStatistic.first));
                destTransportStatistic->set_count(transportStatistic.second);
            }

        }
        
//         auto simplifiedPoints = PolySimplifier::simplify(statisticalArea.partPoints);
//         
//         auto queryPolygons = allSerialisedData.mutable_areaquery()->mutable_statisticalareapolygons()->Add();
//         queryPolygons->set_statisticalareaid(statisticalArea.id);
//         
// //         geoJSON.polygons.emplace_back().coordinates = simplifiedPoints;
//         
//         for (auto const& points: simplifiedPoints)
//         {
//             auto polygon = queryPolygons->mutable_polygons()->Add();
//             
//             for (auto const& point: points)
//             {
//                 auto pos = polygon->mutable_positions()->Add();
//                 pos->set_lat(point.lat);
//                 pos->set_lng(point.lng);
//             }
//         }
    }
    
//     geoJSON.writeToFile("debug_query.json");


    
    for (const auto& [clusterId, statisticalAreas]: clusteredStatisticalAreas)
    {
        Bounds bounds;
        
        ::timhobbs::there_and_back_again::StatisticalAreaPolygonsCollection saPolygonsCollection;
        
        for (auto& statisticalArea: statisticalAreas)
        {
            auto saPolygons = saPolygonsCollection.mutable_statisticalareapolygons()->Add();
            saPolygons->set_statisticalareaid(statisticalArea->id);
            
            for (auto const& points: statisticalArea->partPoints)
            {
                auto polygon = saPolygons->mutable_polygons()->Add();
                
                for (auto const& point: points)
                {
                    auto pos = polygon->mutable_positions()->Add();
                    pos->set_lat(point.lat);
                    pos->set_lng(point.lng);
                    
                    bounds.addPosition(point);
                }
            }
        }
        
        auto clusterBounds = coreSerialisedData.mutable_areaquery()->mutable_clusterbounds()->Add();
        clusterBounds->set_clusterid(clusterId);
        convertBounds(bounds, clusterBounds->mutable_bounds());
        
//         std::cout << "Cluster " << clusterId << " minLat: " << bounds.min.lat << ", minLng: " << bounds.min.lng << ", maxLat: " << bounds.max.lat << ", maxLng: " << bounds.max.lng << std::endl;
        
        std::string polygonsCollectionStr;
        saPolygonsCollection.SerializeToString(&polygonsCollectionStr);
        std::ofstream dataStream("../../public/data/statistical_area/sapc_" + std::to_string(clusterId) + ".pb");
        dataStream.write(polygonsCollectionStr.data(), polygonsCollectionStr.size());
        dataStream.close();
    }
    
    std::string dataStr;
    auto result = coreSerialisedData.SerializeToString(&dataStr);
    std::cout << "Core Data Serialize Result: " << result << std::endl;
    std::ofstream dataStream("../../public/data/core_data.pb");
    dataStream.write(dataStr.data(), dataStr.size());
    dataStream.close();
    
    proj_destroy(proj);
    proj_context_destroy(projContext);
}
