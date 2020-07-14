# There And Back Again Competition Entry

This is the source code for a visualisation of Commuter data taken from the New Zealand 2018 Census. The visualisation shows a map (using Leaflet), upon which
the Statistical Areas from the census data are shown with animated lines showing travel. Detailed data can be accessed using the Statistics button in the upper-right
corner.

Developed by T W Hobbs.

[Live Application](https://there-and-back-again.twhobbs.com)

Data in the `data` directory is the property of Stats NZ and is released under a Creative Commons license.

## Repository Skeleton
```
├── data : Source Data
├── data_schema : Protobuf Schema/tools for processed data
├── data_tools : C++ Application to process data and pack it tightly for the web Application
├── public : Static content for the Web Application
│   └── data : Processed data ends up here
│       └── statistical_area : Processed Statistical Area data ends up here
└── src : React Web App
```

## Data Tools

The Data Tools are a C++ application which reads the Statistical Area shapefiles and CSV files, processes the data, and packs it into a format ideal for the Web Application.

The steps executed by the Data Tools are:
* Read the input data (shapefiles and CSVs).
* Project the geospatial data from the shapefiles from EPSG:2193 (Northing/Easting Metres) to NZGD2000 (degrees). This makes it easier to place the data on a Leaflet map later.
* Correlate the data between the different files.
* Arrange the data for optimal use by the Web Application, clustering the geospatial data.
* Save the data to protobuf files: One core data file, and one for each cluster.

The data produced by this process has no large loss in fidelity (no points are removed or overly simplified) and can be loaded quickly by the web application. Notably, once compressed
using gzip (which is automatically done by CloudFront and other hosts/servers), the resulting compressed size is 7.5MB down from 20.6MB for the compressed source data. Also, due to clustering,
this data is not loaded all at once - only the data relevant to the clicked areas is loaded.

At this point, only Ubuntu is supported as a build target, though it is likely it will work on other platforms. The non-exhaustive list of packages required to build the Data Tools is:
`cmake libshp-dev libproj-dev libprotobuf-dev protobuf-compiler`

The Data Tools use the shapefile library to read Shapefiles, the PROJ library for converting data between coordinate systems, and the Protobuf library to pack the data for the web application.
Additionally, Niels Lohmann JSON library is used for GeoJSON writing. The Data Tools no longer product any GeoJSON as Protobuffers were found to be much more efficient.

### Building the Data Tools

On an Ubuntu system, install the required packages above, and then:

```
yarn

# Convert Protobuf schema to interface code
cd data_schema
./update.sh
cd ..

# Build the data tools
cd data_tools
mkdir build
cd build
cmake ..
cmake --build .
```

Subsequently, running the freshly built `data_processor` executable will populate the data directories for the Web Application (or whatever is at `../../public/data` relative to the build directory).

## Web Application

The Web Application displays the processed statistical data on a Map. React is used as the application framework, and Leaflet is used for mapping and vector data display.
For the base of the map, OpenStreetMap tiles are used.

Many parts of the Web Application have been designed to resemble road signs from New Zealand. This is all done using CSS styling combined with the Overpass font. Overpass is a typeface based on
Highway Gothic, the typeface used on road signage in New Zealand.

Considerable effort was put into making the data loading speed of the Web Application fast. Combined with the processing from the Data Tools, the data is stored on CloudFront and efforts are made to
ensure it is delivered with gzip compression (handled by the browser, invisible to the Application). Initially, only a core set of data is loaded, containing the statistics and some information
on the acceleration structures used to store the geospatial data. When an area is clicked, the geospatial data for any clusters spanning the click point is loaded, and then the statistical areas
within the relevant clusters are bounds tested. If this results in more than one statistical area, point-in-polygon testing is used with the full poygon set of the statistical areas, resulting in
very accurate area selection.

Within the Application, animations are used to show the direction of commuters, and to ease changes in the map position and modal displays. The loading modal shows an animated car zooming back and forth
to add a bit of fun and to show that the app is busy.

The main dependencies used by the Web Application are: `react leaflet react-leaflet leaflet-ant-path point-in-polygon protobufjs react-switch react-sticky-table react-transition-group`

### Running the Web Application

Assuming the Data Tools have been successfully built and run, and the data files are in the `public/data` directory, run:

```
yarn start
```
