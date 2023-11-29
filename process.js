// set scene
const scene = new THREE.Scene();

// set canvas
const canvas = document.createElement("canvas");
canvas.width = 500;
canvas.height = 500;
const aspectRatio = canvas.width / canvas.height;
document.body.appendChild(canvas);

// renderer
const renderer = new THREE.WebGLRenderer({
  canvas: canvas,
});
renderer.setSize(canvas.width, canvas.height);
renderer.setClearColor(0xffffff);

// camera info
// const camera = new THREE.PerspectiveCamera(75, aspectRatio, 0.1, 1000);
// camera.position.set(0, 0, 18);
// camera.fov = 6;
// camera.updateProjectionMatrix();
let camera = new THREE.OrthographicCamera(-2, 2, 2, -2, 1, 1000);
camera.position.set(0, 0.2, 5);
camera.zoom = 1.5;
camera.updateProjectionMatrix();

// lighting options
const light = new THREE.DirectionalLight(0xffffff, 1.0);
light.position.set(0, 0, 1);
scene.add(light);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.05);
scene.add(ambientLight);

let faceMesh;
let landmarks1 = null;
let landmarks2 = null;
let canvasCtx = null;
let isImageCanvas = null;
let storedImage = null;
let currentCtx;

// set up canvas and context for image processing
const imgCanvas = document.createElement("canvas");
document.body.appendChild(imgCanvas);
imgCanvas.width = 500;
imgCanvas.height = 500;
const imgCtx = imgCanvas.getContext("2d");
const renderCanvas = document.createElement("canvas");
renderCanvas.width = 500;
renderCanvas.height = 500;
const renderCtx = renderCanvas.getContext("2d");

// set up face detection
async function initializeFaceDetection() {
  const faceDetection = new FaceDetection({
    locateFile: (file) => {
      return `https://cdn.jsdelivr.net/npm/@mediapipe/face_detection/${file}`;
    },
  });

  faceDetection.setOptions({
    model: "short",
    maxNumFaces: 1,
    minDetectionConfidence: 0.5,
  });

  faceDetection.onResults(onFaceDetectionResults);

  return faceDetection;
}

// set up face mesh
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

// after detecting a face, crop the image to the face and send it to the face mesh
function onFaceDetectionResults(results) {
  let canvasTemp, ctxTemp;
  console.log(currentCtx);
  if (currentCtx === "image") {
    canvasTemp = imgCanvas;
    ctxTemp = imgCtx;
  } else if (currentCtx === "obj") {
    canvasTemp = renderCanvas;
    ctxTemp = renderCtx;
  } else {
    console.error("Error in onFaceDetectionResults: ", error);
  }
  console.log(results);

  if (results.detections) {
    const faceBox = results.detections[0].boundingBox;
    const croppedFace = cropFace(faceBox, canvasTemp, ctxTemp);

    storedImage = croppedFace;

    faceMesh
      .send({ image: croppedFace })
      .then(() => {})
      .catch((err) => {
        console.error("Error in faceMesh.send: ", err);
      });
  }
}

async function cropFace(faceBox, canvas, ctx, offset = 0.3) {
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

// after detecting landmarks, draw the mesh on the canvas
function onResults(results) {
  if (
    results &&
    results.multiFaceLandmarks &&
    results.multiFaceLandmarks.length > 0
  ) {
    if (isImageCanvas) {
      canvasCtx = imgCtx;
      landmarks1 = results.multiFaceLandmarks[0];
      console.log(landmarks1);
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

async function processImage(imageDataUrl, callback) {
  const faceDetection = await initializeFaceDetection();
  const rotatedImage = new Image();
  rotatedImage.src = imageDataUrl;

  rotatedImage.onload = function () {
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    imgCtx.drawImage(rotatedImage, 0, 0, imgCanvas.width, imgCanvas.height);

    try {
      faceDetection.send({ image: rotatedImage }).then((results) => {
        callback(results);
      });
    } catch (error) {
      console.error("Error from faceDetection.send: ", error);
      callback(null, error);
    }
  };
  rotatedImage.onerror = function (error) {
    console.error("Error loading image:", error);
    callback(null, error);
  };
}

async function canvasToImage(canvas) {
  const dataURL = canvas.toDataURL("image/png");
  const image = new Image();
  image.src = dataURL;
  return image;
}

async function renderFrontalImage() {
  const faceDetection = await initializeFaceDetection();
  currentCtx = "obj";
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
    }
    const average = (total / num_landmarks).toFixed(2);
    return average;
  }
}

function resetFaceMesh() {
  if (faceMesh) {
    faceMesh.close();
  }
  faceMesh = new FaceMesh();

  faceMesh.setOptions({
    maxNumFaces: 1,
    refineLandmarks: true,
    minDetectionConfidence: 0.5,
    minTrackingConfidence: 0.5,
  });

  faceMesh.onResults(onResults);
}

async function main(imageDataUrl, objDataUrl) {
  currentCtx = "image";
  processImage(imageDataUrl, () => {});

  const loader = new THREE.OBJLoader();
  const object = await new Promise((resolve, reject) => {
    loader.load(objDataUrl, (object) => {
      object.traverse((child) => {
        if (child instanceof THREE.Mesh) {
          const geometry = child.geometry;
          geometry.computeBoundingBox();
          const centroid = new THREE.Vector3();
          geometry.boundingBox.getCenter(centroid);
          geometry.translate(-centroid.x, -centroid.y, -centroid.z);
        }
      });
      resolve(object);
    });
  });
  scene.add(object);
  renderFrontalImage();

  const result = compareLandmarks();
  return result;
}

window.main = main;
