// @flow

import { Polyline as LeafletPolyline } from 'leaflet'

import { withLeaflet, MapLayer } from 'react-leaflet';

import { AntPath } from 'leaflet-ant-path';

class TransitLayer extends MapLayer<LeafletElement, Props> {
    
    onCanvasUpdate(updateEvent) {
        console.log('Transit Canvas Update for ', updateEvent.target);
    };
    
    createLatLngs() {
        if (!this.props.subject || !this.props.others) {
            return [];
        }
        else {
            return this.props.others.map(source => [source, this.props.subject]);
        }
    }
    
    createLeafletElement(props: Props): LeafletElement {
        let antPolyline = new AntPath(this.createLatLngs(), {delay: 1000, weight: 4, hardwareAccelerated: true, reverse: !this.props.travelIntoSubject});
        
        return antPolyline;
    }

    updateLeafletElement(fromProps: Props, toProps: Props) {
        super.updateLeafletElement(fromProps, toProps)
        if (toProps.subject !== fromProps.subject || toProps.others !== fromProps.others) {
            this.leafletElement.setLatLngs(this.createLatLngs())
        }
        if (toProps.transitScale !== fromProps.transitScale) {
//             console.log('Transit Scale is now ', 0.5*this.props.transitScale);
//             this.leafletElement.setStyle({weight: 0.5*this.props.transitScale});
        }
        if (toProps.travelIntoSubject !== fromProps.travelIntoSubject) {
            this.leafletElement.setStyle({reverse: !toProps.travelIntoSubject});

        }
    }
}

export default withLeaflet<Props, LeafletPolyline>(TransitLayer)
