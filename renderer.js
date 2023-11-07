import * as THREE from "three";
import { OBJLoader } from "OBJLoader";
import { degToRad } from "MathUtils";

const scene = new THREE.Scene();
const canvas = document.getElementById("webgl_canvas");
const aspectRatio = canvas.width / canvas.height;
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.setSize(canvas.width, canvas.height);
renderer.setClearColor(0xffffff);

// change camera info
const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
camera.position.set(0, 0, 18);
camera.fov = 5;
camera.updateProjectionMatrix();

const light = new THREE.DirectionalLight(0xffffff, 2.0);
light.position.set(1, 1, 1).normalize();
scene.add(light);

window.addEventListener("resize", function () {
  const newAspectRatio = canvas.width / canvas.height;
  camera.aspect = newAspectRatio;
  camera.updateProjectionMatrix();
  renderer.setSize(canvas.width, canvas.height);
});

const loader = new OBJLoader();

let faceMesh = null;
let landmarks1 = null;
let landmarks2 = null;
let canvasCtx = null;
let isImageCanvas = null;
let storedImage = null;
let currentCtx;

const imgCanvas = document.getElementById("image_canvas");
const imgCtx = imgCanvas.getContext("2d");

const renderCanvas = document.getElementById("render_canvas");
const renderCtx = renderCanvas.getContext("2d");

const faceDetection = new FaceDetection({
  locateFile: (file) => {
    return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
  },
});

faceDetection.setOptions({
  model: "short",
  maxNumFaces: 1, // Detect only one face
  minDetectionConfidence: 0.5,
});

faceDetection.onResults(onFaceDetectionResults);

function onFaceDetectionResults(results) {
  let canvas, ctx;
  console.log(currentCtx);
  if (currentCtx === "REAL") {
    canvas = imgCanvas;
    ctx = imgCtx;
  } else if (currentCtx === "RENDERED") {
    canvas = renderCanvas;
    ctx = renderCtx;
  } else {
    console.error("Unknown image context: ", currentCtx);
    return;
  }

  if (results.detections) {
    const faceBox = results.detections[0].boundingBox;
    const croppedFace = cropFace(faceBox, canvas, ctx);

    storedImage = croppedFace;

    faceMesh
      .send({ image: croppedFace })
      .then(() => {})
      .catch((err) => {
        console.error("Error in faceMesh.send: ", err);
      });
  }
}

function cropFace(faceBox, canvas, ctx, offset = 0.3) {
  const sourceWidth = canvas.width;
  const sourceHeight = canvas.height;
  let x = (faceBox.xCenter - faceBox.width / 2) * sourceWidth;
  let y = (faceBox.yCenter - faceBox.height / 2) * sourceHeight;
  let width = faceBox.width * sourceWidth;
  let height = faceBox.height * sourceHeight;

  const xOffset = width * offset;
  const yOffset = height * offset;

  x = Math.max(0, x - xOffset);
  y = Math.max(0, y - yOffset);
  width = Math.min(sourceWidth - x, width + 2 * xOffset);
  height = Math.min(sourceHeight - y, height + 2 * yOffset);

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  croppedCanvas.width = width;
  croppedCanvas.height = height;

  croppedCtx.drawImage(canvas, x, y, width, height, 0, 0, width, height);

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(croppedCanvas, 0, 0, sourceWidth, sourceHeight);

  return canvas;
}

function onResults(results) {
  if (
    results &&
    results.multiFaceLandmarks &&
    results.multiFaceLandmarks.length > 0
  ) {
    if (isImageCanvas) {
      canvasCtx = imgCtx;
      landmarks1 = results.multiFaceLandmarks[0];
    } else {
      console.log("Doing render context");
      canvasCtx = renderCtx;
      landmarks2 = results.multiFaceLandmarks[0];

      try {
        canvasCtx.drawImage(
          storedImage,
          0,
          0,
          renderCanvas.width,
          renderCanvas.height
        );
      } catch (error) {
        console.error("Error drawing Mesh: ", error);
      }
    }

    if (landmarks1 && landmarks2) {
      compareLandmarks();
    }

    for (const landmarks of results.multiFaceLandmarks) {
      drawConnectors(canvasCtx, landmarks, FACEMESH_TESSELATION, {
        color: "#C0C0C070",
        lineWidth: 1,
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYE, {
        color: "#FF3030",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_EYEBROW, {
        color: "#FF3030",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_RIGHT_IRIS, {
        color: "#FF3030",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYE, {
        color: "#30FF30",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_EYEBROW, {
        color: "#30FF30",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LEFT_IRIS, {
        color: "#30FF30",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_FACE_OVAL, {
        color: "#E0E0E0",
      });
      drawConnectors(canvasCtx, landmarks, FACEMESH_LIPS, {
        color: "#E0E0E0",
      });
    }
  } else {
    console.error("No results!");
  }
}

function processImage(file, callback) {
  // Convert the image file to a buffer for sharp processing
  const reader = new FileReader();

  reader.onloadend = function () {
    const arrayBuffer = reader.result;

    // Use the exposed function to rotate the image
    window.imageProcessing
      .rotateImage(arrayBuffer)
      .then((rotatedBuffer) => {
        // Create a new Blob from the rotated buffer
        const blob = new Blob([rotatedBuffer], { type: "image/jpeg" });
        const rotatedImageURL = URL.createObjectURL(blob);

        const rotatedImage = new Image();
        rotatedImage.src = rotatedImageURL;

        rotatedImage.onload = function () {
          // Draw the rotated image onto the canvas
          imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
          imgCtx.drawImage(
            rotatedImage,
            0,
            0,
            imgCanvas.width,
            imgCanvas.height
          );

          try {
            // Now send the rotated image for face detection
            faceDetection.send({ image: rotatedImage }).then((results) => {
              callback(results); // Make sure to pass the results back to the callback
            });
          } catch (error) {
            console.error("Error from faceDetection.send: ", error);
            callback(null, error); // Pass the error to the callback
          }
        };
      })
      .catch((error) => {
        console.error("Error rotating image:", error);
        callback(null, error); // Pass the error to the callback if rotation fails
      });
  };

  // Read the file as an ArrayBuffer
  reader.readAsArrayBuffer(file);
}

async function canvasToImage(canvas) {
  const dataURL = canvas.toDataURL("image/png");
  const image = new Image();
  image.src = dataURL;
  return image;
}

async function renderFrontalImage() {
  try {
    renderer.render(scene, camera);

    renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
    const image = await canvasToImage(renderer.domElement);
    renderCtx.drawImage(image, 0, 0, renderCanvas.width, renderCanvas.height);

    const results = await faceDetection.send({ image: image });

    if (results && results.detections && results.detection.length > 0) {
      const faceBox = results.detections[0].boundingBox;
      const croppedRenderedFace = cropFace(faceBox, renderCanvas, renderCtx);

      if (faceMesh) {
        await faceMesh.send({ image: croppedRenderedFace });
        compareLandmarks();
      }
    }
  } catch (error) {
    console.error("Error in renderFrontalImage: ", error);
  }
}

function compareLandmarks() {
  let total = 0;
  let num_landmarks;
  let detailedMessage = "";

  if (!landmarks1 || !landmarks2) {
    return;
  }

  if (landmarks1 && landmarks2) {
    num_landmarks = landmarks1.length;
    // Calculate distances between corresponding landmarks.
    for (let i = 0; i < landmarks1.length; i++) {
      let x1_pixel = landmarks1[i].x * canvas.width;
      let y1_pixel = landmarks1[i].y * canvas.height;

      let x2_pixel = landmarks2[i].x * canvas.width;
      let y2_pixel = landmarks2[i].y * canvas.height;

      const distance = Math.sqrt(
        Math.pow(x2_pixel - x1_pixel, 2) + Math.pow(y2_pixel - y1_pixel, 2)
      );
      total += distance;
      detailedMessage += `Distance for landmark ${i}: ${distance.toFixed(2)}\n`;
    }
    const average = total / num_landmarks;
    const message = `
    Number of Landmarks: ${num_landmarks}
    Average Distance: ${average.toFixed(2)} pixels
    `;
    document.querySelector(".result").innerText = message;
    document.getElementById("detailed_results").innerText = detailedMessage;
  }
}

function resetFaceMesh() {
  if (faceMesh) {
    faceMesh.close();
  }
  faceMesh = new FaceMesh({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_mesh/${file}`;
    },
  });

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResults);
}

resetFaceMesh();

document.addEventListener("DOMContentLoaded", function () {
  document.getElementById("imageInput").addEventListener("change", function () {
    isImageCanvas = true;
    currentCtx = "REAL";
    processImage(this.files[0], () => {});
  });

  document.getElementById("objInput").addEventListener("change", function () {
    resetFaceMesh();
    console.log("Obj canvas triggered");
    isImageCanvas = false;
    currentCtx = "RENDERED";
    const file = this.files[0];
    const reader = new FileReader();

    reader.onload = function (event) {
      loader.load(event.target.result, function (object) {
        object.traverse((child) => {
          if (child instanceof THREE.Mesh) {
            const geometry = child.geometry;
            geometry.computeBoundingBox();
            const centroid = new THREE.Vector3();
            geometry.boundingBox.getCenter(centroid);
            geometry.translate(-centroid.x, -centroid.y, -centroid.z);
          }
        });
        scene.add(object);
        renderFrontalImage();
      });
    };
    reader.readAsDataURL(file);
  });

  document.querySelector(".collapsible").addEventListener("click", function () {
    this.classList.toggle("active");
    let content = this.nextElementSibling;
    if (content.style.maxHeight) {
      content.style.maxHeight = null;
    } else {
      content.style.maxHeight = content.scrollHeight + "px";
    }
  });
});
