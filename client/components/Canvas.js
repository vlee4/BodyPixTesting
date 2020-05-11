import React from 'react'
// import Konva from "konva";
// import { Stage, Layer, Image, Text } from "react-konva";
import {connect} from 'react-redux'
const bodyPix = require('@tensorflow-models/body-pix')
// import regeneratorRuntime from 'regenerator-runtime'

class Canvas extends React.Component {
  constructor() {
    super()
    this.state = {
      _isMounted: false
    }
    this.startCam = this.startCam.bind(this)
    this.stopCam = this.stopCam.bind(this)
    this.segmentAndMask = this.segmentAndMask.bind(this)
    this.continuouslySegmentAndMask = this.continuouslySegmentAndMask.bind(this)
  }

  componentDidMount() {
    this.setState({
      _isMounted: true
    })
  }

  componentWillUnmount() {
    this.setState({
      _isMounted: false
    })
  }

  startCam() {
    var video = document.getElementById('video')
    if (navigator.mediaDevices.getUserMedia) {
      navigator.mediaDevices
        .getUserMedia({video: true})
        .then(function(stream) {
          video.srcObject = stream
        })
        .catch(function(error) {
          console.log('Something went wrong!', error)
        })
    }
  }
  stopCam() {
    var video = document.getElementById('video')
    var stream = video.srcObject
    var tracks = stream.getTracks()
    for (var i = 0; i < tracks.length; i++) {
      var track = tracks[i]
      track.stop()
    }
    video.srcObject = null
  }

  async segmentAndMask() {
    let video, canvasOut, canvasOutContext, canvasTemp, canvasTempContext, model
    const bodyPixConfig = {
      architechture: 'MobileNetV1',
      outputStride: 16,
      multiplier: 1,
      quantBytes: 4
    }
    const segmentationConfig = {
      internalResolution: 'high',
      segmentationThreshold: 0.05,
      scoreThreshold: 0.05
    }
    function init() {
      video = document.getElementById('video')
      //set ouput canvas
      canvasOut = document.getElementById('output-canvas')
      canvasOut.setAttribute('width', video.videoWidth)
      canvasOut.setAttribute('height', video.videoHeight)
      canvasOutContext = canvasOut.getContext('2d') //get context of output canvas
      //Create canvas
      canvasTemp = document.createElement('canvas')
      canvasTemp.setAttribute('width', video.videoWidth)
      canvasTemp.setAttribute('height', video.videoHeight)
      canvasTempContext = canvasTemp.getContext('2d') //get context of canvas
      video.play()
      computeFrame()
    }
    function computeFrame() {
      //drawImage(image, dx, dy, dWidth, dHeight, )
      //image: element to draw into the canvas context
      //dx: x coordinate where to place top left corner of source image in the destination canvas
      //dWidth: width to draw the image in the destination canvas: allowing for scaling; default: won't scale image

      //Draws the video into the intial canvas
      canvasTempContext.drawImage(
        video,
        0,
        0,
        video.videoWidth,
        video.videoHeight
      )
      //getImageData returns the imageData for the part of the inital canvas that is specified (ie. the whole canvas)
      let frame = canvasTempContext.getImageData(
        0,
        0,
        video.videoWidth,
        video.videoHeight
      )
      //same as when we do net.segmentPerson
      //they pass in the canvas with the video drawn into it
      //then they get the imageData for the blank output canvas
      model.segmentPerson(canvasTemp, segmentationConfig).then(segmentation => {
        canvasOutContext.clearRect(0, 0, canvasOut.width, canvasOut.height)
        let OutImage = canvasOutContext.getImageData(
          0,
          0,
          video.videoWidth,
          video.videoHeight
        )
        //ctx.getImageData(sx, sy, sw, sh)
        //sx: x-coordinate of from top-left corner from which ImageData will be extracted
        //sw: width or rectangle from which Image Data will be extrated
        for (let x = 0; x < video.videoWidth; x++) {
          for (let y = 0; y < video.videoHeight; y++) {
            //n = each pixel
            let n = x + y * video.videoWidth
            //checks to see if ImageData = 1, which denotes the pixels of the person
            if (segmentation.data[n] == 1) {
              OutImage.data[n * 4] = frame.data[n * 4] //R
              OutImage.data[n * 4 + 1] = frame.data[n * 4 + 1] //G
              OutImage.data[n * 4 + 2] = frame.data[n * 4 + 2] //B
              OutImage.data[n * 4 + 3] = frame.data[n * 4 + 3] //A
            }
          }
        }

        //putImageData(imageData, dx, dy)
        //imageData: ImageData obj with array of pixel values
        //dx: x-coordinate where to put the imagedata in the destination canvas; destination canvas being: canvasOutContext
        canvasOutContext.putImageData(OutImage, 0, 0)
        setTimeout(computeFrame, 0)
      })
    }

    bodyPix.load(bodyPixConfig).then(m => {
      //load will return bodyPix instance w/ provided bodyPixConfiguration
      model = m
      init()
    })
  }
  continuouslySegmentAndMask() {
    //continuously renders next frame of video
    var video = document.getElementById('video')
    if (video.srcObject && this.state._isMounted) {
      requestAnimationFrame(() => {
        console.log('this', this)
        this.segmentAndMask()
      })
    }
    //if cam is running then continue this function if not, then stop this function
    //Also, check if component is mounted first before running this fn
  }

  render() {
    // let video = document.getElementById('video')
    if (!navigator.mediaDevices.getUserMedia) {
      return <h2>Loading...</h2>
    }
    return (
      <div>
        <div id="container">
          <video autoPlay={true} id="video" />
          <div className="buttons">
            <button type="button" onClick={this.startCam}>
              START
            </button>
            <button type="button" onClick={this.stopCam}>
              STOP
            </button>
            <button type="button" onClick={this.segmentAndMask}>
              SEGMENT
            </button>
          </div>
          <hr />
          {/* OUTPUT CANVAS */}
          <canvas id="output-canvas" height="375" width="500" />
        </div>
      </div>
    )
  }
}
export default connect()(Canvas)
