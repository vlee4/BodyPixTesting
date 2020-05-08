import React from 'react'
import {connect} from 'react-redux'
const bodyPix = require('@tensorflow-models/body-pix')

class Canvas extends React.Component {
  constructor() {
    super()
    this.state = {
      statusText: '',
      model: '', //downloaded bodyPix machine learning model
      capture: '', //video capture
      segmentationEstimated: false,
      //drawn onto a canvas
      maskCanvas: '',
      //the output canvas
      canvas: '',
      video: '',
      videoPlaying: '',

      videoWidth: '',
      videoHeight: '',

      backgroundVideo: '',
      existingMask: ''
      // maskImage: "", //most recent mask image generated from estimating person segmentation on video
      // maskBackgroundButton: "",
    }

    this.loadWebcamCapture = this.loadWebcamCapture.bind(this)
    this.loadImage = this.loadImage.bind(this)
    this.setup = this.setup.bind(this)
    this.loadModelAndStartEstimating = this.loadModelAndStartEstimating.bind(
      this
    )
    this.startDrawLoop = this.startDrawLoop.bind(this)
    this.draw = this.draw.bind(this)
    this.startEstimationLoop = this.startEstimationLoop.bind(this)
    this.estimateFrame = this.estimateFrame.bind(this)
    this.performEstimation = this.performEstimation.bind(this)
    this.setStatusText = this.setStatusText.bind(this)
  }

  componentDidMount() {
    this.setup()
  }
  //////////// Utility Functions/////////////////
  async loadWebcamCapture() {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      throw new Error(
        'Browser API navigator.mediaDevices.getUserMedia not available'
      )
    }

    const videoElement = document.getElementById('video')

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: true
    })
    videoElement.srcObject = stream

    return new Promise(resolve => {
      videoElement.onloadedmetadata = () => {
        videoElement.width = videoElement.videoWidth
        videoElement.height = videoElement.videoHeight
        resolve(videoElement)
      }
    })
  }

  async loadImage(imagePath) {
    const image = new Image()
    const promise = new Promise((resolve, reject) => {
      image.crossOrigin = ''
      image.onload = () => {
        resolve(image)
      }
    })

    image.src = imagePath
    return promise
  }
  ///////////////////////
  // setup function run when document loads
  async setup() {
    let {capture, backgroundVideo, canvas, maskCanvas} = this.state
    // capture from the webcam
    capture = await this.loadWebcamCapture('user')
    capture.play()

    backgroundVideo = document.getElementById('background-video')

    let theCanvas = document.getElementById('canvas')
    theCanvas.width = capture.width
    theCanvas.height = capture.height

    let theMaskCanvas = document.createElement('canvas')

    this.setState({
      canvas: theCanvas,
      maskCanvas: theMaskCanvas
    })

    this.loadModelAndStartEstimating()

    this.startDrawLoop()
  }

  startDrawLoop() {
    this.draw()

    document.getElementById('background-video').play()
  }

  async draw() {
    let {capture, canvas, segmentationEstimated, existingMask} = this.state
    const flipHorizontal = true
    // how much to blur the mask background by.  This affects the softness of the edge.
    const maskBlurAmount = 3
    // let canvas = this.state.canvas;
    const ctx = canvas.getContext('2d')
    // make sure video is loaded, and a mask has been estimated from the video.  The mask
    // continuously gets updated in the loop estimateFrame below, which is independent
    // from the draw loop
    if (capture && segmentationEstimated) {
      const maskedFrame = tf.tidy(() => {
        const image = tf.browser.fromPixels(capture)

        if (existingMask) {
          return image // image.matMul(image, existingMask);
        }

        return image
      })

      await tf.browser.toPixels(maskedFrame, capture)

      maskedFrame.dispose()

      ctx.clearRect(0, 0, canvas.width, canvas.height)

      ctx.save()

      if (flipHorizontal) {
        // flip the drawing of the results horizontally
        ctx.scale(-1, 1)
        ctx.translate(-canvas.width, 0)
      }

      // blur the mask and draw it onto the canvas
      ctx.filter = `blur(${maskBlurAmount}px)`
      ctx.drawImage(maskCanvas, 0, 0)
      ctx.filter = 'blur(0px)'

      // draw the background video on the canvas using the compositing operation 'source-in.'
      // "The new shape is drawn only where both the new shape and the destination canvas overlap. Everything else is made transparent."
      // see all possible compositing operations at https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Compositing
      ctx.globalCompositeOperation = 'source-in'
      ctx.drawImage(this.backgroundVideo, 0, 0, canvas.width, canvas.height)

      // draw camera feed frame onto the canvas using the compositing operation 'destination-over.'
      // "New shapes are drawn behind the existing canvas content."
      ctx.globalCompositeOperation = 'destination-over'
      ctx.drawImage(capture, 0, 0)

      ctx.restore()
    }

    requestAnimationFrame(this.draw)
  }

  async loadModelAndStartEstimating() {
    let {model} = this.state
    this.setStatusText('downloading the machine learning model...')
    let theModel = await bodyPix.load()
    this.setState({model: theModel})

    this.setStatusText('')

    // start the estimation loop, separately from the drawing loop.
    // This allows drawing to happen at a high number of frames per
    // second, independent from the speed of estimation.
    this.startEstimationLoop()
  }

  startEstimationLoop() {
    this.estimateFrame()
  }

  async estimateFrame() {
    let {capture} = this.state
    if (capture) {
      await this.performEstimation()
    }

    // at the end of estimating, start again after the current frame is complete.
    requestAnimationFrame(this.estimateFrame)
  }
  async performEstimation() {
    let {capture, existingMask} = this.state
    const newMask = await model.segmentPerson(capture)

    this.setState({existingMask: newMask})
    // existingMask = newMask

    this.setState({segmentationEstimated: true})
  }

  setStatusText(text) {
    const statusElement = document.getElementById('status')
    if (text) {
      statusElement.style.display = 'block'
      statusElement.innerText = text
    } else statusElement.style.display = 'none'
  }

  render() {
    return (
      <div>
        <h2>BodyPix testing in session</h2>
        <p id="status" />
        <canvas id="canvas" />
        <video id="video" playsInline />

        <video id="background-video" playsInline loop autoPlay>
          <source
            src="https://cdn.glitch.com/df9e423d-65e8-438e-8860-b1fed0f1040f%2Fliquid.mp4?1550622383996"
            type="video/mp4"
          />
          <p>Your browser doesn't support HTML5 video.</p>
        </video>
      </div>
    )
  }
}

export default connect()(Canvas)
