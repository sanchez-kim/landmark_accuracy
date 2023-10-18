import * as THREE from "three";
import { OBJLoader } from "OBJLoader";

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
camera.position.y = 8;
camera.position.z = 30;
camera.fov = 15;
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
  if (results.detections) {
    const faceBox = results.detections[0].boundingBox;

    const croppedFace = cropFaceFromImage(faceBox);

    faceMesh
      .send({ image: croppedFace })
      .then(() => {})
      .catch((err) => {
        console.error("Error in faceMesh.send: ", err);
      });
  }
}
function cropFaceFromImage(faceBox, offset = 0.2) {
  const sourceWidth = imgCanvas.width;
  const sourceHeight = imgCanvas.height;
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
  croppedCtx.drawImage(imgCanvas, x, y, width, height, 0, 0, width, height);

  imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
  imgCtx.drawImage(croppedCanvas, 0, 0, sourceWidth, sourceHeight);

  return imgCanvas;
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
  canvasCtx.restore();
}

function processImage(file, callback) {
  const image = new Image();
  image.src = URL.createObjectURL(file);

  image.onload = function () {
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    imgCtx.drawImage(image, 0, 0, imgCanvas.width, imgCanvas.height);
    try {
      faceDetection.send({ image: image });
    } catch (error) {
      console.error("Error from faceDetection.send: ", error);
    }
  };
}

function canvasToImage(canvas) {
  const dataURL = canvas.toDataURL("image/png");
  const image = new Image();
  image.src = dataURL;
  return image;
}

function renderFrontalImage() {
  renderer.render(scene, camera);
  renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
  const image = canvasToImage(renderer.domElement);
  storedImage = image;
  if (faceMesh) {
    faceMesh.send({ image: image }).then(() => {
      compareLandmarks();
    });
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
      const distance = Math.sqrt(
        Math.pow(landmarks2[i].x - landmarks1[i].x, 2) +
          Math.pow(landmarks2[i].y - landmarks1[i].y, 2)
      );
      total += distance;
      detailedMessage += `Distance for landmark ${i}: ${distance.toFixed(2)}\n`;
    }
    const average = total / num_landmarks;
    const message = `
    Number of Landmarks: ${num_landmarks}
    Average Distance: ${average.toFixed(2)}
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

document.getElementById("imageInput").addEventListener("change", function () {
  isImageCanvas = true;
  processImage(this.files[0], () => {
    compareLandmarks();
  });
});

document.getElementById("objInput").addEventListener("change", function () {
  resetFaceMesh();
  console.log("Obj canvas triggered");
  isImageCanvas = false;
  const file = this.files[0];
  const reader = new FileReader();

  reader.onload = function (event) {
    loader.load(event.target.result, function (object) {
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
