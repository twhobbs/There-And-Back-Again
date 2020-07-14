import React, {useState, useEffect, useRef} from 'react';
import 'leaflet/dist/leaflet.css';
import './App.css';

import { Map, TileLayer, Polygon, ZoomControl, AttributionControl } from 'react-leaflet'
import protobuf from 'protobufjs';
import TransitLayer from './TransitLayer';
import Switch from "react-switch";
import pointInPolygon from 'point-in-polygon';
import { CSSTransition, TransitionGroup,} from 'react-transition-group';
import {StickyTable, Row, Cell} from 'react-sticky-table';

const protobufRoot = protobuf.Root.fromJSON(require('./schema.json'));
const CoreData = protobufRoot.lookupType("timhobbs.there_and_back_again.CoreData");
const StatisticalAreaPolygonsCollection = protobufRoot.lookupType("timhobbs.there_and_back_again.StatisticalAreaPolygonsCollection");

function loadClusters(clusterIds) {
    let promises = clusterIds.map(polygonCollectionId => {
        return fetch('data/statistical_area/sapc_' + polygonCollectionId + '.pb', {
            method: 'GET'
        })
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            var sapcBytes = new Uint8Array(arrayBuffer);
            
            var sapc = StatisticalAreaPolygonsCollection.decode(sapcBytes);
            
            
            return Array.isArray(sapc.statisticalAreaPolygons) ? sapc.statisticalAreaPolygons : [];
        })
        .catch(error => {
            console.log('Error when loading polygonCollection ', polygonCollectionId, ': ', error);
            return [];
        });;
    });
    
    return Promise.all(promises);
}

function testPointInPolygons(polygons, point) {
    var first = true;
    var inPoly = false;
    
    // First polygon is the statistical area, all following are holes in the statistical area
    
    for (let polygon of polygons) {
        let points = polygon.positions.map(position => [position.lat, position.lng]);
        
        if (pointInPolygon([point.lat, point.lng], points)) {
            inPoly = first;
        }
            
        first = false;
    }
    
    return inPoly;
};

function App() {
    const mapRef = useRef(null);
    
    const initialCentre = [-41.212, 171.628];
    
    const [zoom, setZoom] = useState(6);
    const [mapBounds, setMapBounds] = useState();
    const [geojsonVer, setGeoJsonVer] = useState(0);
    const [areaQuery, setAreaQuery] = useState({});
    
    const [statisticalAreas, setStatisticalAreas] = useState({});
    const [statisticalAreaOutputs, setStatisticalAreaOutputs] = useState({});
    const [statisticalArea, setStatisticalArea] = useState();
        
    const [travelStatistics, setTravelStatistics] = useState([]);
        
    const [areaIds, setAreaIds] = useState({residences: [], destinations: [], residenceAbove: false});
    
    const [polygonLayers, setPolygonLayers] = useState([]);
    
    const [otherCentroids, setOtherCentroids] = useState([]);
    
    const [selectedAreaIsDestination, setSelectedAreaIsDestination] = useState(true);
    
    const [modalMode, setModalMode] = useState('help');
    
    const [showTravelLines, setShowTravelLines] = useState(true);
    const [shouldAutoZoom, setShouldAutoZoom] = useState(true);
        
    const [loading, setLoading] = useState(true);
    
    const [screenIsSmall, setScreenIsSmall] = useState()
    
    useEffect(() => {
        let mql = window.matchMedia('(max-width: 600px)');

        setScreenIsSmall(mql.matches);
        
        if (mql.addEventListener) {
            let mqlChange = (e) => {            
                setScreenIsSmall(e.matches);
            }

            
            mql.addEventListener('change', mqlChange);
            return () => mql.removeEventListener('change', mqlChange);
        }
    }, []);
    
    useEffect(() => {
        fetch('data/core_data.pb', {
            method: 'GET'
        })
        .then(response => response.arrayBuffer())
        .then(arrayBuffer => {
            
            var coreDataBytes = new Uint8Array(arrayBuffer);
            
            var message = CoreData.decode(coreDataBytes);
            setAreaQuery(message.areaQuery);
            
            if (Array.isArray(message.statisticalAreas)) {
                let statisticalAreaDict = {};
                let nextStatisticalAreaOutputs = {};
                
                for (let statisticalArea of message.statisticalAreas) {
                    statisticalAreaDict[statisticalArea.id] = statisticalArea;
                    
                    for (let inwardStat of statisticalArea.inwardTravelStatistics) {
                        var destArray = nextStatisticalAreaOutputs[inwardStat.statisticalAreaId];
                        if (!destArray) {
                            destArray = [];
                            nextStatisticalAreaOutputs[inwardStat.statisticalAreaId] = destArray;
                        }
                        if (!destArray.includes(statisticalArea.id)) {
                            destArray.push(statisticalArea.id);
                        }
                    }
                }
                
                setStatisticalAreas(statisticalAreaDict);
                setStatisticalAreaOutputs(nextStatisticalAreaOutputs);
            }
            
//             setLoading(false);
        });
    }, []);
   
    useEffect(() => {        
        if (!Array.isArray(areaIds.destinations) || !Array.isArray(areaIds.residences) || (areaIds.destinations.length + areaIds.residences.length === 0)) {
            setLoading(false);
            return;
        }
        
        let version = setGeoJsonVer(v => v+1);
        
        let idPolygonLayerMapper = (isDestination) => (id) => {
            let statisticalArea = statisticalAreas[id];
            
            if (!statisticalArea)
            {
                setLoading(false);
                return null;
            }
            
            return {
                id: statisticalArea.id,
                clusterId: statisticalArea.clusterId,
                isDestination: isDestination
            };
            

            /*
            return statisticalArea ? statisticalArea.areaPolygons : [];*/
        };
        
//         setDestinationPolygonLayers(destinationAreaIds.map(idPolygonLayerMapper(true)));
//         setHomePolygonLayers(homeAreaIds.map(idPolygonLayerMapper(false)));
        
        let destinationSettings = areaIds.destinations.map(idPolygonLayerMapper(true));
        let residenceSettings = areaIds.residences.map(idPolygonLayerMapper(false));
        
        let areaPolygonSettings;
        if (areaIds.residenceAbove) {
            areaPolygonSettings = residenceSettings.concat(destinationSettings);
        }
        else {
            areaPolygonSettings = destinationSettings.concat(residenceSettings);
        }
        
        
        let polygonsCollectionAreas = {};
        
        for (let areaPolygonSetting of areaPolygonSettings) {
            if (!polygonsCollectionAreas[areaPolygonSetting.clusterId]) {
                polygonsCollectionAreas[areaPolygonSetting.clusterId] = [areaPolygonSetting];
            }
            else {
                polygonsCollectionAreas[areaPolygonSetting.clusterId].push(areaPolygonSetting);
            }
        }
        
        let polygonLayerMapperFunc = (isDestination, bounds) => (statisticalAreaPolygons) => {
            let positions = [];
            for (let areaPolygon of statisticalAreaPolygons.polygons) {
                let destPoints = [];
                
                for (let point of areaPolygon.positions) {
                    destPoints.push([point.lat, point.lng]);
                    
                    bounds.minLat = Math.min(bounds.minLat, point.lat);
                    bounds.maxLat = Math.max(bounds.maxLat, point.lat);
                    bounds.minLng = Math.min(bounds.minLng, point.lng);
                    bounds.maxLng = Math.max(bounds.maxLng, point.lng);
                }
                
                positions.push(destPoints);
            }
            
            return <Polygon key={version + '_area_' + statisticalAreaPolygons.statisticalAreaId} positions={positions} color={isDestination ? '#009' : '#090'} weight={2}/>;
        };
        
        let destinationAreaIdsSet = new Set(areaIds.destinations);
        let homeAreaIdsSet = new Set(areaIds.residences);
        
        let nextPolygonLayers = [];
        
        let newBounds = {minLat: 1000, maxLat: -1000, minLng: 1000, maxLng: -1000};
        
        loadClusters(Object.keys(polygonsCollectionAreas)).then((polygonCollections) => {            
            for (let polygonCollection of polygonCollections) {
                for (let statisticalAreaPolygons of polygonCollection) {
                    if (destinationAreaIdsSet.has(statisticalAreaPolygons.statisticalAreaId)) {
                        nextPolygonLayers.push(polygonLayerMapperFunc(true, newBounds)(statisticalAreaPolygons));
                    }
                    else if (homeAreaIdsSet.has(statisticalAreaPolygons.statisticalAreaId)) {
                        nextPolygonLayers.push(polygonLayerMapperFunc(false, newBounds)(statisticalAreaPolygons));
                    }
                }
            }
        
            if (shouldAutoZoom) {
                setMapBounds([[newBounds.minLat, newBounds.minLng], [newBounds.maxLat, newBounds.maxLng]]);
            }
        
            setPolygonLayers(nextPolygonLayers);
            
            setLoading(false);
        });
        
        
        
    }, [areaIds, statisticalAreas, shouldAutoZoom]);
    
    useEffect(() => {        
        if (statisticalArea) {
            setLoading(true);
            
            let nextOtherCentroids = [];
            var nextOtherAreaIds = new Set();
            let nextTravelStatistics = [];
            
            let convertStatistic = (name, statistic) => {
                let ret = {
                    name: name,
                    isEducation: statistic.isEducation,
                    transportStatistics: {}
                };
                                
                for (let transportStat of statistic.transportStatistics) {
                    ret.transportStatistics[transportStat.type] = transportStat.count;
                }
                
                return ret;
            };
            
            if (selectedAreaIsDestination) {
                
                for (let statistic of statisticalArea.inwardTravelStatistics) {
                    nextOtherAreaIds.add(statistic.statisticalAreaId);
                    let otherStatisticalArea = statisticalAreas[statistic.statisticalAreaId];
                    nextOtherCentroids.push(otherStatisticalArea.centroid);
                    nextTravelStatistics.push(convertStatistic(otherStatisticalArea.name, statistic));
                }
                
                setAreaIds({residences: Array.from(nextOtherAreaIds).filter(id => id !== statisticalArea.id), destinations: [statisticalArea.id], residenceAbove: false});

            }
            else {
                let outputIds = statisticalAreaOutputs[statisticalArea.id];
                
                if (Array.isArray(outputIds)) {
                    for (let outputStatisticalArea of outputIds.map(id => statisticalAreas[id])) {
                        if (outputStatisticalArea) {
                            nextOtherCentroids.push(outputStatisticalArea.centroid);
                            nextOtherAreaIds.add(outputStatisticalArea.id);
                            
                            for (let statistic of outputStatisticalArea.inwardTravelStatistics) {
                                if (statistic.statisticalAreaId === statisticalArea.id) {
                                    nextTravelStatistics.push(convertStatistic(outputStatisticalArea.name, statistic));
                                }
                            }
                        }
                    }
                }
                                
                setAreaIds({residences: [statisticalArea.id], destinations: Array.from(nextOtherAreaIds).filter(id => id !== statisticalArea.id), residenceAbove: true});
            }
            
            nextTravelStatistics.sort((a, b) => a.name > b.name);
            
            setTravelStatistics(nextTravelStatistics);
            setOtherCentroids(nextOtherCentroids);
        }
        else {
            setAreaIds({residences: [], destinations: []});

            setOtherCentroids([]);
            setLoading(false);
        }
    }, [statisticalArea, selectedAreaIsDestination, statisticalAreas, statisticalAreaOutputs]);
    
    const mapClick = (mouseEvent) => {        
        if (!areaQuery.clusterBounds)
        {
            return;
        }
        
        let pointInBounds = (bounds, point) => {
            return  point.lat >= bounds.minLat &&
                    point.lng >= bounds.minLng &&
                    point.lat <= bounds.maxLat &&
                    point.lng <= bounds.maxLng;
        };
        
        setLoading(true);
                
        let clickedClusterIds = new Set();
        
        let clusterCount = areaQuery.clusterBounds.length;
        for (var i = 0; i < clusterCount; i++)
        {
            let clusterBounds = areaQuery.clusterBounds[i];
            let bounds = clusterBounds.bounds;
            
            if (pointInBounds(bounds, mouseEvent.latlng)) {
                clickedClusterIds.add(clusterBounds.clusterId);
            }
        }
        
        let nextStatisticalAreaCandidates = Object.entries(statisticalAreas)
            .map(entry => entry[1])
            .filter(it => clickedClusterIds.has(it.clusterId))
            .filter(it => pointInBounds(it.bounds, mouseEvent.latlng));

        if (nextStatisticalAreaCandidates.length === 1) {
            setStatisticalArea(nextStatisticalAreaCandidates[0]);
        }
        else {
            
            let candidateMap = {};
            for (let candidate of nextStatisticalAreaCandidates) {
                candidateMap[candidate.id] = candidate;
            }
            
            loadClusters(Array.from(clickedClusterIds)).then(clusters => {
                var nextLoading = false;
                for (let cluster of clusters) {
                    for (let statisticalAreaPolygons of cluster)
                    {
                        let candidate = candidateMap[statisticalAreaPolygons.statisticalAreaId];
                        
                        if (candidate && testPointInPolygons(statisticalAreaPolygons.polygons, mouseEvent.latlng)) {
                            setStatisticalArea(candidate);
                            nextLoading = true;
                        }
                    }
                }
                setLoading(nextLoading);
            });
        }
    };
    
    var transitLayer;
    var toFromOption;
    var settingsButton;
    var statsButton;
    
    let baseFontSize = screenIsSmall ? '10pt' : '16pt';
    let statsFontSize = screenIsSmall ? '10pt' : '12pt';
    
    let outerBoxStyle = screenIsSmall ? {borderRadius: '2.1mm', padding: '0.7mm', margin: '1mm'} : {borderRadius: '3mm', padding: '1mm', margin: '2mm'};
    outerBoxStyle = {...outerBoxStyle, backgroundColor: '#007e00', boxShadow: '0 0.5em 0.5em rgba(0, 0, 0, .3)'};
        
    let headerBoxStyle = screenIsSmall ? {borderRadius: '1.4mm', padding: '0.7mm 3.4mm', border: '0.7mm solid #fff'} : {borderRadius: '2mm', padding: '1mm 5mm', border: '1mm solid #fff'};
    headerBoxStyle = {...headerBoxStyle, display: 'flex', height: '100%', fontSize: baseFontSize, fontWeight: 'bold', alignItems: 'center', justifyContent: 'center', backgroundColor: '#007e00', color: '#fff', boxSizing: 'border-box', textAlign: 'center'};
    
    let buttonStyle = {display: 'flex', backgroundColor: '#fff', flex: 1, ...headerBoxStyle, padding: screenIsSmall ? '0.7mm 0.7mm' : '1mm 2mm'};
    let buttonIconStyle = screenIsSmall ? {width: '6mm'} : {width: '8mm'};
    
    let underlineBorderStyle = screenIsSmall ? {borderBottom: '0.7mm solid #fff', paddingBottom: '0.7mm'} : {borderBottom: '1mm solid #fff', paddingBottom: '1mm'};
    
    if (statisticalArea)
    {
        toFromOption = <div style={{...outerBoxStyle, flex: screenIsSmall ? 1 : 0, minWidth: screenIsSmall ? null : '15cm'}}>
            <div style={{display: 'flex', backgroundColor: '#fff', flex: 1, maxWidth: '15cm', ...headerBoxStyle}}>
                <div style={{display: 'flex', alignItems: 'center', justifyContent: screenIsSmall ? 'flex-start' : 'center', flex: screenIsSmall ? 1 : 0, paddingRight: screenIsSmall ? 0 : '1em'}}>
                    <Switch
                        onColor='#46b246' offColor='#46b246'
                        uncheckedIcon={false} checkedIcon={false}
                        onChange={checked => setSelectedAreaIsDestination(checked)}
                        checked={selectedAreaIsDestination}
                    />
                </div>

                <span>{selectedAreaIsDestination ? 'To' : 'From'}{' '}{statisticalArea.name}</span>
                
                
            </div>
        </div>;
        
        statsButton = <button onClick={event => setModalMode('stats')} style={{...buttonStyle, marginRight: '1.5mm'}}>
            <img alt="Statistics" style={buttonIconStyle} src="./table_view-white-18dp.svg" />
        </button>
    
            
        settingsButton = <button onClick={event => setModalMode('settings')} style={{...buttonStyle, marginLeft: '1.5mm'}}>
            <img alt="Settings" style={buttonIconStyle} src="./settings-white-18dp.svg" />
        </button>;
        
        if (showTravelLines) {
            transitLayer = <TransitLayer
                key={'transit_'+statisticalArea+'_'+geojsonVer}
                subject={[statisticalArea.centroid.lat, statisticalArea.centroid.lng]}
                others={otherCentroids.map(centroid => [centroid.lat, centroid.lng])}
                transitScale={zoom}
                travelIntoSubject={selectedAreaIsDestination}
            />;
        }
    }
    else {
        toFromOption = <div style={{...outerBoxStyle, flex: screenIsSmall ? 1 : 0, minWidth: screenIsSmall ? null : '15cm'}}>
            <div style={{display: 'flex', backgroundColor: '#fff', flex: 1, maxWidth: '15cm', ...headerBoxStyle}}>
                Select an Area by tapping on the Map
            </div>
        </div>;
    }
    
    var loadModal;
    if (loading) {
        loadModal = <div style={{position: 'absolute', display: 'flex', top: 0, zIndex: 2000, width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center'}}>
        
            <div style={{...outerBoxStyle, width: '5cm', height: '5cm', backgroundColor: '#ffdb00', margin: '5mm', transform: 'rotate(45deg)'}}>
                <div style={{flex: 1, ...headerBoxStyle, backgroundColor: '#ffdb00', borderColor: '#000', flexDirection: 'column', padding: '5mm'}}>
                    <div style={{transform: 'rotate(-45deg)', color: '#000', fontSize: '20pt', fontWeight: 'bold'}}>
                        LOADING<br/>
                        <div className="animatedCar"><span role="img" aria-label="Car Picture">&#x1F697;</span></div>
                    </div>
                </div>
            </div>;
        
        </div>
    }
    
    var modal;
    
    if (!loading && modalMode) {
        var modalContent;
        
        if (modalMode === 'settings') {
            modalContent = <div>
                <div style={underlineBorderStyle}>
                    Settings
                </div>
                
                <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5mm'}}>
                    <span style={{marginRight: '5mm'}}>Show Travel Lines:</span>
                    <Switch onChange={checked => setShowTravelLines(checked)} checked={showTravelLines} />
                </label>

                <label style={{display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: '5mm'}}>
                    <span style={{marginRight: '5mm'}}>Auto Zoom:</span>
                    <Switch onChange={checked => setShouldAutoZoom(checked)} checked={shouldAutoZoom} />
                </label>
            </div>;
        }
        else if (modalMode === 'help') {
            modalContent = <div>
                <div style={underlineBorderStyle}>
                    There And Back Again
                </div>
                
                <div style={{padding: '3mm', maxWidth: '10cm'}}>
                    A visualisation of the New Zealand 2018 Census Commuter data developed by T W Hobbs.<p/>
                    
                    Click or tap on the map to see where and how New Zealanders commuted to work or school.<p/>
                    
                    After selecting an area, you can tap the toggle next to the area name (<img alt="Toggle Example" style={{display: 'inline-block', verticalAlign: 'middle', width: '1.6em'}} src="./toggle.png"/>) to change
                    the direction of travel.<br/>
                    To see detailed statistics, tap the Statistics button (<img alt="Statistics Example" style={{display: 'inline-block', verticalAlign: 'middle'}} src="./table_view-white-18dp.svg"/>).
                </div>
                
            </div>;
        }
        else if (modalMode === 'stats') {
            
            let transportTypesWithData = new Set();
            for (let travelStatistic of travelStatistics) {
                for (let transportType in travelStatistic.transportStatistics) {
                    transportTypesWithData.add(transportType);
                }
            }
            
            let transportTypes = [
                {type: 1, label:  'Total'},
                {type: 2, label:  <label id="wfhLabel"><span role="img" aria-labelledby="wfhLabel">&#x1F3E0;</span> Work at Home</label>},
                {type: 3, label:  <label id="driveLabel"><span role="img" aria-labelledby="driveLabel">&#x1F697;</span> Drive</label>},
                {type: 4, label:  <label id="passengerLabel"><span role="img" aria-labelledby="passengerLabel">&#x1F697;</span> Passenger</label>},
                {type: 5, label:  <label id="bicycleLabel"><span role="img" aria-labelledby="bicycleLabel">&#x1F6B4;</span> Bicycle</label>},
                {type: 6, label:  <label id="walkLabel"><span role="img" aria-labelledby="walkLabel">&#x1F6B6;</span> Walk</label>},
                {type: 7, label:  <label id="busLabel"><span role="img" aria-labelledby="busLabel">&#x1F68C;</span> Bus</label>},
                {type: 8, label:  <label id="trainLabel"><span role="img" aria-labelledby="trainLabel">&#x1F683;</span> Train</label>},
                {type: 9, label:  <label id="ferryLabel"><span role="img" aria-labelledby="ferryLabel">&#x1F6F3;</span> Ferry</label>},
                {type: 10, label: <label id="otherLabel"><span role="img" aria-labelledby="otherLabel">&#x1F6F4;</span> Other</label>}
            ].filter(it => transportTypesWithData.has(''+it.type));
            
            let statisticValueMapper = (statistic, transportType) => {
                return statistic.transportStatistics[transportType.type];
            };
            
            let tableLeftStyle = screenIsSmall ? {fontSize: '8pt', maxWidth: '3cm', whiteSpace: 'normal'} : {};
            
            modalContent = <div style={{display: 'flex', alignItems: 'center', flexDirection: 'column', flex: 1}}>
                Commuters Travelling{' '}{selectedAreaIsDestination ? 'To' : 'From'}{' '}{statisticalArea.name}
                
                <div style={{display: 'flex', padding: screenIsSmall ? '1.4mm' :'3mm', paddingRight: 0, width: '100%', maxWidth: '80vw', maxHeight: '70vh', backgroundColor: '#fff', color: '#000', borderRadius: '3mm', fontWeight: 'normal', fontSize: statsFontSize}}>
                    <div style={{overflow: 'auto', maxWidth: '100%', maxHeight: '100%', paddingRight: '3mm'}}>


                        <StickyTable style={{fontSize: statsFontSize}}>
                            <Row>
                                <Cell className="statistic_table_name">{selectedAreaIsDestination ? 'Residence' : 'Destination'}</Cell>
                                <Cell>Purpose</Cell>
                                {transportTypes.map(transportType => <Cell key={transportType.type}>{transportType.label}</Cell>)}
                            </Row>
                            {travelStatistics.map((statistic, i) => <Row key={i}>
                                <Cell className="statistic_table_name" style={tableLeftStyle}>{statistic.name}</Cell>
                                <Cell>{statistic.isEducation ? <span role="img" aria-label="Education">&#x1F393;</span> : <span role="img" aria-label="Work">&#x1F4BC;</span>}</Cell>
                                {transportTypes.map(transportType => <Cell key={transportType.type}>{statisticValueMapper(statistic, transportType)}</Cell>)}
                            </Row>)}
                        </StickyTable>
                    </div>
                </div>
            </div>;
        }
        
        let modalStyle = {...outerBoxStyle};
        if (modalMode === 'stats') {
            modalStyle = {...modalStyle, marginLeft: '0.5mm', marginRight: '0.5mm'}
        }
        else {
            modalStyle = {...modalStyle, marginLeft: '5mm', marginRight: '5mm'};
        }
        
        modal = <div style={{position: 'absolute', display: 'flex', top: 0, zIndex: 2000, width: '100%', height: '100%', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0, 0, 0, 0.5)'}}>
        
            <div style={modalStyle}>
                <div style={{backgroundColor: '#fff', flex: 1, ...headerBoxStyle, paddingTop: '3mm', paddingBottom: '3mm', flexDirection: 'column'}}>

                    {modalContent}
                    
                    <button onClick={event => setModalMode(null)} style={{...headerBoxStyle, width: 'auto', height: 'auto', textDecoration: 'none', marginTop: '5mm'}}>
                        OK
                    </button>
                </div>
            </div>;
        
        </div>
    }
    
    //<GeoJSON key={geojsonVer} data={geojson} style={feature => ({weight: 1})} />
    
    let modals = [modal, loadModal].filter(it => it);
    
    let expander = screenIsSmall ? null : <div style={{flexGrow: 1}}/>;
    
    return <div>

        <Map ref={mapRef} center={initialCentre} zoomControl={false} attributionControl={false} zoom={zoom} bounds={mapBounds} onClick={mapClick} onViewportChanged={event => setZoom(event.zoom)} minZoom={4} maxZoom={ 16}>
            <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution="&copy; <a href=&quot;http://osm.org/copyright&quot;>OpenStreetMap</a> contributors"
            />
             
            {polygonLayers}
            
            {transitLayer}
                        
            <ZoomControl position="bottomleft"/>
            
            <AttributionControl prefix={'T W Hobbs, Stats NZ'}/>
        </Map>
        
        <div style={{position: 'absolute', display: 'flex', width: '100%', top: 0, zIndex: 1000, flexDirection: 'column', alignItems: 'center', justifyContent: 'space-between'}}>
            <div style={{display: 'flex', width: '100%', flexDirection: 'row'}}>
                
                {expander}
                
                {toFromOption}
                
                {expander}
                
                <div style={{...outerBoxStyle, marginLeft: 0, display: 'flex', flexDirection: 'row'}}>
                    {statsButton}
                
                    <button onClick={event => setModalMode('help')} style={buttonStyle}>
                        <img alt="Help" style={buttonIconStyle} src="./help-white-18dp.svg" />
                    </button>
                    
                    {settingsButton}
                </div>
            </div>
            
        </div>
        
        <TransitionGroup className="modals">
            {
                modals.map((modal, i) => <CSSTransition key={i} timeout={250} classNames="modal">
                    {modal}
                </CSSTransition>)
            }
            
        </TransitionGroup>
  </div>;
}

export default App;
