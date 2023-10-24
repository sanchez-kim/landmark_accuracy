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
camera.position.set(0, 4, 24);
camera.fov = 80;
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

function resizeLandmarks(landmarks, box, newWidth, newHeight) {
  const originalWidth = box.maxX - box.minX;
  const originalHeight = box.maxY - box.minY;

  const widthScale = newWidth / originalWidth;
  const heightScale = newHeight / originalHeight;

  return landmarks.map((landmark) => ({
    x: (landmark.x - box.minX) * widthScale,
    y: (landmark.y - box.minY) * heightScale,
  }));
}

function onResults(results) {
  if (
    results &&
    results.multiFaceLandmarks &&
    results.multiFaceLandmarks.length > 0
  ) {
    const box = getBoundingBox(results.multiFaceLandmarks[0]);
    const resizedLandmarks = resizeLandmarks(
      results.multiFaceLandmarks[0],
      box,
      640,
      640
    );

    if (isImageCanvas) {
      canvasCtx = imgCtx;
      landmarks1 = resizedLandmarks;
    } else {
      canvasCtx = renderCtx;
      landmarks2 = resizedLandmarks;
    }

    const {
      croppedCanvas: croppedCanvas,
      newWidth,
      newHeight,
    } = resizeToTarget(box, imgCanvas, imgCtx);
    canvasCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    canvasCtx.drawImage(croppedCanvas, 0, 0);

    if (storedImage) {
      canvasCtx.drawImage(
        storedImage,
        0,
        0,
        canvasCtx.canvas.width,
        canvasCtx.canvas.height
      );
    }
    // Visualize landmarks on cropped image
    drawLandmarks(canvasCtx, results.multiFaceLandmarks);

    if (landmarks1 && landmarks2) {
      compareLandmarks();
    }
  } else {
    console.error("No results!");
  }
}

function drawLandmarks(ctx, landmarks) {
  for (const landmark of landmarks) {
    drawConnectors(ctx, landmark, FACEMESH_TESSELATION, {
      color: "#C0C0C070",
      lineWidth: 1,
    });
    drawConnectors(ctx, landmark, FACEMESH_RIGHT_EYE, {
      color: "#FF3030",
    });
    drawConnectors(ctx, landmark, FACEMESH_RIGHT_EYEBROW, {
      color: "#FF3030",
    });
    drawConnectors(ctx, landmark, FACEMESH_RIGHT_IRIS, {
      color: "#FF3030",
    });
    drawConnectors(ctx, landmark, FACEMESH_LEFT_EYE, {
      color: "#30FF30",
    });
    drawConnectors(ctx, landmark, FACEMESH_LEFT_EYEBROW, {
      color: "#30FF30",
    });
    drawConnectors(ctx, landmark, FACEMESH_LEFT_IRIS, {
      color: "#30FF30",
    });
    drawConnectors(ctx, landmark, FACEMESH_FACE_OVAL, {
      color: "#E0E0E0",
    });
    drawConnectors(ctx, landmark, FACEMESH_LIPS, {
      color: "#E0E0E0",
    });
  }
}

function processImage(file, callback) {
  const image = new Image();
  image.src = URL.createObjectURL(file);

  image.onload = function () {
    imgCtx.clearRect(0, 0, imgCanvas.width, imgCanvas.height);
    imgCtx.drawImage(image, 0, 0, imgCanvas.width, imgCanvas.height);
    storedImage = image;
    try {
      faceMesh.send({ image: image }).then(() => {
        callback();
      });
    } catch (error) {
      console.error("Error from faceDetection.send: ", error);
      callback();
    }
  };
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

    storedImage = image;

    const results = await faceMesh.send({ image: image });

    if (
      results &&
      results.multiFaceLandmarks &&
      results.multiFaceLandmarks.length > 0
    ) {
      const box = getBoundingBox(results.multiFaceLandmarks[0]);

      const resizedLandmarks = resizeLandmarks(
        results.multiFaceLandmarks[0],
        box,
        1000,
        1000
      );
      landmarks2 = resizedLandmarks;

      console.log(`Original bounding box width: ${box.maxX - box.minX} pixels`);
      console.log(
        `Original bounding box height: ${box.maxY - box.minY} pixels`
      );

      const {
        croppedCanvas: croppedRenderedFace,
        newWidth,
        newHeight,
      } = resizeToTarget(box, renderCanvas, renderCtx);

      // Logging the resized dimensions
      console.log(`Resized width: ${newWidth} pixels`);
      console.log(`Resized height: ${newHeight} pixels`);

      renderCtx.clearRect(0, 0, renderCanvas.width, renderCanvas.height);
      renderCtx.drawImage(
        croppedRenderedFace,
        box.minX,
        box.minY,
        newWidth,
        newHeight
      );

      if (landmarks1 && landmarks2) {
        compareLandmarks();
      }
    }
  } catch (error) {
    console.error("Error in renderFrontalImage: ", error);
  }
}

function compareLandmarks() {
  let total = 0;
  let num_landmarks = landmarks1.length;
  let detailedMessage = "";

  for (let i = 0; i < num_landmarks; i++) {
    let distance = Math.sqrt(
      Math.pow(landmarks2[i].x - landmarks1[i].x, 2) +
        Math.pow(landmarks2[i].y - landmarks1[i].y, 2)
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

function getBoundingBox(landmarks) {
  let minX = Infinity;
  let minY = Infinity;
  let maxX = -Infinity;
  let maxY = -Infinity;

  landmarks.forEach((point) => {
    if (point.x < minX) minX = point.x;
    if (point.y < minY) minY = point.y;
    if (point.x > maxX) maxX = point.x;
    if (point.y > maxY) maxY = point.y;
  });

  return { minX, minY, maxX, maxY };
}

function transformLandmarksToTarget(landmarks, box) {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;

  const newWidth = 1000;
  const newHeight = 1000;

  const scaleX = newWidth / width;
  const scaleY = newHeight / height;

  return landmarks.map((landmark) => ({
    x: (landmark.x - box.minX) * scaleX,
    y: (landmark.y - box.minY) * scaleY,
  }));
}

function resizeToTarget(box, canvas, ctx) {
  const width = box.maxX - box.minX;
  const height = box.maxY - box.minY;

  const newWidth = 2000;
  const newHeight = 2000;

  const croppedCanvas = document.createElement("canvas");
  const croppedCtx = croppedCanvas.getContext("2d");

  croppedCanvas.width = newWidth;
  croppedCanvas.height = newHeight;
  croppedCtx.clearRect(0, 0, newWidth, newHeight);
  croppedCtx.drawImage(
    canvas,
    box.minX,
    box.minY,
    width,
    height,
    0,
    0,
    newWidth,
    newHeight
  );

  return { croppedCanvas, newWidth, newHeight };
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
