// import './App.css';
import 'ol/ol.css';
import { useState, useEffect, useRef, useCallback } from 'react';
import OlMap from 'ol/Map.js';
import ImageLayer from 'ol/layer/Image.js';
import VectorLayer from 'ol/layer/Vector';
import TileLayer from 'ol/layer/WebGLTile';
import Polygon from 'ol/geom/Polygon.js';
import Feature from 'ol/Feature.js';
import MousePosition from 'ol/control/MousePosition.js';
import {defaults as defaultControls} from 'ol/control.js';
import {createStringXY} from 'ol/coordinate.js';
import Projection from 'ol/proj/Projection.js';
import Static from 'ol/source/ImageStatic.js';
import VectorSource from 'ol/source/Vector';
import {Circle as CircleStyle, Fill, Stroke, Style} from 'ol/style.js';
import View from 'ol/View.js';
import {getCenter} from 'ol/extent.js';

import OlLayerTile from 'ol/layer/Tile';
import OlSourceOsm from 'ol/source/OSM';
import OlSourceTileWMS from 'ol/source/TileWMS';
import OlView from 'ol/View';
import ImageSource from 'ol/source/Image';

///////////////////// helper functions for making polygons /////////////////////

const makePoligons = (polygons, canvasSize, mapSize) => {
  if (polygons === undefined || polygons[0] === undefined || canvasSize === undefined) {
    return undefined
  } 

  const scaleFactor = {
    x: (mapSize[0] / canvasSize.width),
    y: (mapSize[1] / canvasSize.height)
  }
  
  return polygons.map(
    (polygon) => {
      const coords = polygon.map(
          (vertexCoords) => {
            return [
            vertexCoords.canvasX*scaleFactor.x,
            (canvasSize.height-vertexCoords.canvasY)*scaleFactor.y
          ]
        }
      )
      console.log("makePolygons.map")
      console.log(coords)
      const dummy = new Polygon( [coords] )
      return new Feature( { geometry:dummy } )
    }

  )
}



function MyMap({image, polyCoords, canvasSize}) {

  if (polyCoords === undefined) {
    return( <></>)
  }

    const extent = [0, 0, 500, 500];

    const projection = new Projection({
      code: 'xkcd-image',
      units: 'pixels',
      extent: extent,
    });

    const imageSource = new Static({
            attributions: '© <a href="https://xkcd.com/license.html">xkcd</a>',
            url: image,
            projection: projection,
            imageExtent: extent,
            wrapX: false,
            noWrap: true
    })

    
    // const multSpectralLayer = new TileLayer({
    //   source: imageSource,
    //   style: {
    //     // variables: getVariables(),
    //     color: [
    //       'array',
    //       ['band', 0],
    //       ['band', 1],
    //       ['band', 2],
    //       // ['band', 5],
    //     ],
    //   },
    // });

    const imageLayer = new ImageLayer({
          source: imageSource,
    })

    const vectorSource = new VectorSource({
      features: makePoligons(
        polyCoords.map((e) => e.points),
        canvasSize,
        [extent[2], extent[3]]
      ),
      projection: projection,
    });

    const vectorLayer = new VectorLayer({
      source: vectorSource,
      style: [
        new Style({
          stroke: new Stroke({
            color: 'blue',
            width: 3,
          }),
          fill: new Fill({
            color: 'rgba(0, 0, 255, 0.1)',
          }),
        })
      ],
    });

    const mousePositionControl = new MousePosition({
      coordinateFormat: createStringXY(4),
      projection: projection,
      // comment the following two lines to have the mouse position
      // be placed within the map.
      // className: 'custom-mouse-position',
      // target: document.getElementById('mouse-position'),
    });

    const selectStyle = new Style({
      fill: new Fill({
        color: 'rgba(0, 0, 255, 0.1)',
      }),
      stroke: new Stroke({
        color: 'rgba(255, 0, 0, 0.7)',
        width: 2,
        lineDash: [1,3,1,3,1,2],
        lineDashOffset: [1,2,1,2,1,2],
      }),
    });

  useEffect(() => {


    const olMap = new OlMap({
      controls: [mousePositionControl],
      layers: [imageLayer, vectorLayer],
      target: 'map',
      view: new View({
        projection: projection,
        center: getCenter(extent),
        extent: extent,
        zoom: 1,
        maxZoom: 8,
      }),
    });


    let selected = null;

    olMap.on('pointermove',  (e) => {
      if (selected !== null) {
        selected.setStyle(undefined);
        selected = null;
      }

      olMap.forEachFeatureAtPixel(e.pixel, (f) => {
        selected = f;
        selectStyle.getFill().setColor(f.get('COLOR') || 'rgba(0, 0, 255, 0.1)');
        f.setStyle(selectStyle);
        return true;
      });

    });
    return () => olMap.setTarget(null)
  }, [imageLayer, vectorLayer])

// https://mxd.codes/articles/how-to-create-a-web-map-with-open-layers-and-react
  return (
    <div style={{
          position: 'relative',
          height: '500px',
          width: '500px'
    }}
    id="map"/>
  )

}


export const FinalClassificationScreen = ({
  isModalOpen,
  setModalOpen,
  onClose,
  image,
  polyCoords,
  canvasSize
}) => {
  const modalRef = useRef(null);

  const MODALSIZE = 1000

  useEffect(() => {
    const modalElement = modalRef.current;
    if (modalElement) {
      if (isModalOpen) {
        modalElement.showModal();
      } else {
        modalElement.close();
      }
    }
  }, [isModalOpen]);

  const handleCloseModal = () => {
    if (onClose) {
      onClose();
    }
    setModalOpen(false);
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape") {
      if (isModalOpen) {
        // https://github.com/slightlyoff/history_api/issues/13
        event.preventDefault()
      }
      console.log("ESC was pressed")
      console.log("polyCoords:")
      console.log(polyCoords)
      console.log("canvasSize:")
      console.log(canvasSize)
      console.log("iamge:")
      if (image) {
        console.log(image)
      }
      // handleCloseModal();
    }
  };

  const containerStyles = (size, metric, style) => {
    let _size = null
    switch (metric) {
      case "px":
          _size = `${size}px`;
          break;
      case "%":
          _size = `${size}%`;
          break;
      default:
          _size = size;
          break;
    }

    const returnValue = {
      height: _size,
      width: _size,
      maxHeight: _size,
      maxWidth: _size,
    }

    return style ? {...returnValue, ...style} : returnValue
    
  }
  
  return (
    <dialog ref={modalRef} onKeyDown={handleKeyDown} style={{
      height: 600,
      width: 500,
      maxHeight: 600,
      maxWidth: 500,
    } }
    >
      <div style={ containerStyles(700,null,{
        flexDirection: "column",
        // display: "grid",
        // gridTemplateRows: "40px 500px 40px",
        // gridTemplateColumns: "500px 500px",
        // columnGap: "1em"
        })
      }>
        <h1 style={{ flex:1, textAlign:"center"}}>
          Classifique as colheitas
        </h1>
        <div style={{flex:8, flexDirection:"row"}}>
          {
            image ? <MyMap image={image} polyCoords={polyCoords} canvasSize={canvasSize}/>: <></>
              // : <div style={{ flex: 1}}>
              //     {image ? <img src={image} alt={"imagem"} width={500}/> : <h1>oi</h1>}
              //   </div>
          }
        </div>
        <div style={{flex: 1, display:"flex", justifyContent:"space-between"}}>
          <button className="modal-close-btn" onClick={handleCloseModal}>
            Cancel
          </button>
          <button className="modal-close-btn" onClick={handleCloseModal}>
            Finish
          </button>
        </div>
      </div>
    </dialog>
  );
};
